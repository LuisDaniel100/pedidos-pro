'use strict';


const $ = selector => document.querySelector(selector);
const STATES = ['Cotizada', 'Pendiente', 'Autorizada', 'En tránsito', 'Recibida'];
const COLORS = ['#c3a35e', '#b487a0', '#74a488', '#7d9eb5', '#a6b299'];
const KEY = 'pedidos-pro-v1';
const money = value => new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 2
}).format(value);
const esc = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const dateKey = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
const today = () => dateKey(new Date());
const dateLabel = value => new Date(value + 'T12:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
});
const total = order => Math.round(order.items.reduce((value, item) =>
    value + item.qty * item.price, 0) * 100) / 100;
const sum = rows => Math.round(rows.reduce((value, order) => value + total(order), 0) * 100) / 100;

function shift(value, days) {
    const date = new Date(value + 'T12:00:00');
    date.setDate(date.getDate() + days);
    return dateKey(date);
}

function seed() { return PedidosProData.create(today()); }
function inProgress(order) { return order.status === 2 || order.status === 3; }
function overdueRows(rows = orders) {
    return rows.filter(order => inProgress(order) && order.due < today());
}
function inPeriod(rows, period) {
    return rows.filter(order => (!period.start || order.date >= period.start)
        && (!period.end || order.date <= period.end));
}
function summaryPeriod(end = today()) { return { start: shift(end, -29), end }; }
function summaryRows(rows = orders, end = today()) { return inPeriod(rows, summaryPeriod(end)); }
function invalidPeriod(period) { return period.start && period.end && period.start > period.end; }
function periodLabel(period) {
    if (!period.start && !period.end) return 'Todo el histórico';
    return `${period.start ? dateLabel(period.start) : 'Inicio del histórico'} al ${
        period.end ? dateLabel(period.end) : 'último registro'}`;
}
function metrics(rows) {
    return {
        amount: sum(rows),
        awaiting: rows.filter(order => order.status === 0 || order.status === 1).length,
        active: rows.filter(inProgress).length,
        received: rows.filter(order => order.status === 4).length
    };
}
function validDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        && !isNaN(Date.parse(value));
}
function validItem(item) {
    return typeof item.name === 'string' && Number.isInteger(item.qty) && item.qty > 0
        && Number.isFinite(item.price) && item.price > 0 && Number.isFinite(item.qty * item.price);
}
function validOrder(order) {
    return order && typeof order.id === 'string' && /^PP-\d+$/.test(order.id)
        && typeof order.client === 'string' && order.client.trim()
        && [order.date, order.due].every(validDate)
        && Number.isInteger(order.status) && order.status >= 0 && order.status < STATES.length
        && typeof order.notes === 'string' && Array.isArray(order.items) && order.items.length > 0
        && order.items.every(validItem) && Number.isFinite(total(order))
        && Array.isArray(order.history) && order.history.length > 0
        && order.history.every(event => Number.isInteger(event.status)
            && event.status >= 0 && event.status < STATES.length && validDate(event.date));
}


let orders;
function storageWarning(message) {
    $('#storage-warning').hidden = false;
    $('#storage-warning').textContent = message;
}
function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(orders));
        $('#storage-warning').hidden = true;
        return true;
    } catch {
        storageWarning('El navegador no permite guardar los cambios. Se conservarán solamente mientras esta página permanezca abierta.');
        return false;
    }
}
function loadOrders() {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed) || !parsed.every(validOrder)
                || new Set(parsed.map(order => order.id)).size !== parsed.length) {
                throw Error('Datos locales inválidos');
            }
            orders = parsed;
        } else {
            orders = seed();
            save();
        }
    } catch {
        orders = seed();
        storageWarning('No se pudieron recuperar los datos locales. Se muestra una demo nueva; puedes restablecerla para volver a guardarla.');
    }
}
let toastTimer;
function notify(message) {
    $('#toast').textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').textContent = '', 4500);
}
const emptyFilters = () => ({ search: '', status: '', sort: 'new', start: '', end: '' });
let currentView = 'resumen';
let filters = emptyFilters();
let report = { start: '', end: '' };


function badge(status) { return `<span class="badge status-${status}">${STATES[status]}</span>`; }
function kpiCard(label, value, description, featured = false) {
    return `<article class="kpi${featured ? ' featured' : ''}">
        <span class="kpi-label">${label}</span><strong>${value}</strong>
        <small>${description}</small>
    </article>`;
}
function kpis(rows) {
    const counts = metrics(rows);
    return `<div class="kpis">
        ${kpiCard('Importe total cotizado', money(counts.amount), `${rows.length} pedidos en el periodo`, true)}
        ${kpiCard('Por autorizar', counts.awaiting, 'Cotizaciones y pendientes')}
        ${kpiCard('Pedidos en curso', counts.active, 'Autorizados y en tránsito')}
        ${kpiCard('Entregas completadas', counts.received, 'Recepción confirmada')}
    </div>`;
}
function orderRow(order) {
    const late = inProgress(order) && order.due < today();
    return `<tr>
        <td><button class="folio" data-detail="${order.id}">${order.id}</button>
            <small class="client-sub">${dateLabel(order.date)}</small></td>
        <td>${esc(order.client)}</td><td>${badge(order.status)}</td>
        <td>${dateLabel(order.due)}${late ? '<small class="client-sub">Entrega vencida</small>' : ''}</td>
        <td>${money(total(order))}</td>
        <td><button class="text-button" data-detail="${order.id}" aria-label="Ver pedido ${order.id}">Ver →</button></td>
    </tr>`;
}
function table(rows) {
    if (!rows.length) return `<div class="empty">No hay pedidos para estos filtros.
        <br>Prueba otro periodo o crea una cotización.</div>`;
    return `<div class="table-wrap"><table>
        <thead><tr><th>Folio / Fecha</th><th>Cliente</th><th>Estado</th>
            <th>Entrega prevista</th><th>Importe</th><th></th></tr></thead>
        <tbody>${rows.map(orderRow).join('')}</tbody>
    </table></div>`;
}
function statuses(rows) {
    return STATES.map((state, index) => {
        const count = rows.filter(order => order.status === index).length;
        const percent = rows.length ? count / rows.length * 100 : 0;
        return `<div class="status-row">
            <div class="status-row-label"><span>${state}</span><span>${count} pedidos</span></div>
            <div class="track"><span style="width:${percent}%;background:${COLORS[index]}"></span></div>
        </div>`;
    }).join('');
}
function annualCaption() {
    return `Importe cotizado por año. ${today().slice(0, 4)} parcial: acumulado al ${dateLabel(today())}.
        No representa un año completo.`;
}
function chartPeriods(rows, annual) {
    if (annual) return [...new Set(rows.map(order => order.date.slice(0, 4)))].sort().map(key => ({
        key, label: key === today().slice(0, 4) ? key + ' (parcial)' : key
    }));
    return Array.from({ length: 6 }, (_, index) => {
        const date = new Date();
        date.setDate(1);
        date.setMonth(date.getMonth() - 5 + index);
        return { key: dateKey(date).slice(0, 7), label: date.toLocaleDateString('es-MX', { month: 'short' }) };
    });
}
function chart(rows, annual = false) {
    const periods = chartPeriods(rows, annual);
    const values = periods.map(period => sum(rows.filter(order => order.date.startsWith(period.key))));
    const max = Math.max(...values, 1);
    const description = periods.map((period, index) => period.label + ': ' + money(values[index])).join('; ');
    return `<div class="chart" role="img" aria-label="${esc(description)}">
        ${periods.map((period, index) => `<div class="bar-group">
            <span class="bar-value">${money(values[index])}</span>
            <div class="bar" style="height:${values[index] / max * 80}%"></div>
            <small>${period.label}</small></div>`).join('')}
    </div>`;
}
function monthlyPanel() {
    return `<section class="panel">
        <div class="section-heading"><div><h2>Actividad comercial</h2>
            <p>Importe cotizado · Últimos seis meses</p></div><span class="badge status-2">MXN</span></div>
        ${chart(orders)}
        <p class="chart-caption">Mes actual y cinco anteriores. Mes actual hasta hoy; independiente del resumen de 30 días.</p>
    </section>`;
}
function statusPanel(rows) {
    return `<section class="panel">
        <div class="section-heading"><div><h2>Estado de los pedidos</h2><p>Últimos 30 días · Fecha de creación</p></div></div>
        ${statuses(rows)}
        <div class="alert-card"><strong>${overdueRows().length} entregas requieren atención</strong>
            <br>Autorizados o en tránsito con entrega vencida.
            <br><span>Todo el histórico · Sin límite de 30 días.</span>
            <a href="#pedidos">Consultar pedidos →</a></div>
    </section>`;
}
function newestFirst(a, b) { return b.date.localeCompare(a.date) || b.id.localeCompare(a.id); }
function dashboard() {
    const rows = summaryRows();
    const recent = [...rows].sort(newestFirst).slice(0, 6);
    $('#view').innerHTML = `<p class="period-caption">Fecha de creación: ${periodLabel(summaryPeriod())}, ambos incluidos.</p>
        ${kpis(rows)}<div class="dashboard-grid">${monthlyPanel()}${statusPanel(rows)}</div>
        <section class="panel"><div class="section-heading"><div><h2>Pedidos recientes</h2>
            <p>Los seis últimos del periodo de 30 días.</p></div><a href="#pedidos">Ver todos los pedidos →</a></div>
            ${table(recent)}</section>`;
}


function filtered() {
    const search = filters.search.toLocaleLowerCase('es');
    const rows = inPeriod(orders, filters).filter(order =>
        (order.id + ' ' + order.client).toLocaleLowerCase('es').includes(search)
        && (filters.status === '' || order.status === Number(filters.status)));
    const sorting = {
        amount: (a, b) => total(b) - total(a),
        due: (a, b) => a.due.localeCompare(b.due),
        new: newestFirst
    };
    return rows.sort(sorting[filters.sort] || newestFirst);
}
function dateFilters(values) {
    return `<label>Creado desde<input type="date" data-filter="start" value="${values.start}"></label>
        <label>Creado hasta<input type="date" data-filter="end" value="${values.end}"></label>`;
}
function listFilters() {
    return `<div class="filters">
        <label class="search">Buscar pedido<input type="search" data-filter="search"
            placeholder="Buscar folio o cliente" value="${esc(filters.search)}"></label>
        <label>Estado<select data-filter="status"><option value="">Todos los estados</option>
            ${STATES.map((state, i) => `<option value="${i}" ${filters.status === String(i) ? 'selected' : ''}>${state}</option>`).join('')}
        </select></label>${dateFilters(filters)}
        <label>Ordenar<select data-filter="sort"><option value="new">Más recientes</option>
            <option value="amount">Mayor importe</option><option value="due">Fecha de entrega</option></select></label>
        <button class="secondary" id="clear-filters">Limpiar</button>
    </div>`;
}
function renderList() {
    $('#view').innerHTML = `<section class="panel">${listFilters()}<div id="list-results"></div></section>`;
    $('[data-filter="sort"]').value = filters.sort;
    updateList();
}
function periodError() {
    return '<p class="warning" role="alert">La fecha inicial debe ser anterior o igual a la final.</p>';
}
function updateList() {
    const rows = filtered();
    $('#list-results').innerHTML = invalidPeriod(filters) ? periodError()
        : `<p class="muted">${rows.length} pedidos · ${money(sum(rows))}</p>${table(rows)}`;
}
function reportRows() { return inPeriod(orders, report); }
function renderReports() {
    $('#view').innerHTML = `<div class="filters">${dateFilters(report)}
        <button class="secondary" id="clear-report">Todo el histórico</button>
        <button class="primary" id="export">↓ Descargar Excel</button></div><div id="report-results"></div>`;
    updateReports();
}
function stateReportTable(rows) {
    const amount = sum(rows);
    const body = STATES.map((state, i) => {
        const subset = rows.filter(order => order.status === i);
        const subtotal = sum(subset);
        return `<tr><td>${badge(i)}</td><td>${subset.length}</td><td>${money(subtotal)}</td>
            <td>${amount ? (subtotal / amount * 100).toFixed(1) : '0.0'}%</td></tr>`;
    }).join('');
    return `<section class="panel"><div class="section-heading"><div><h2>Distribución por estado</h2>
        <p>Importes del periodo seleccionado.</p></div></div><div class="table-wrap"><table>
        <thead><tr><th>Estado</th><th>Folios</th><th>Importe</th><th>% del importe</th></tr></thead>
        <tbody>${body}</tbody></table></div></section>`;
}
function annualPanel() {
    return `<section class="panel"><h2>Comparativa anual</h2>
        <p class="muted">Todo el histórico · Independiente del filtro</p>${chart(orders, true)}
        <p class="chart-caption">${annualCaption()}</p></section>`;
}
function updateReports() {
    const invalid = invalidPeriod(report);
    $('#export').disabled = Boolean(invalid);
    if (invalid) { $('#report-results').innerHTML = periodError(); return; }
    const rows = reportRows();
    $('#report-results').innerHTML = `<p class="period-caption">Fecha de creación: ${periodLabel(report)}</p>
        ${kpis(rows)}<div class="report-grid">${stateReportTable(rows)}${annualPanel()}</div>`;
}
function render() {
    const route = location.hash.slice(1);
    currentView = ['resumen', 'pedidos', 'reportes'].includes(route) ? route : 'resumen';
    const meta = {
        resumen: ['Resumen · últimos 30 días', 'Cotizaciones, pedidos y recepciones del periodo.'],
        pedidos: ['Pedidos', 'Consulta cotizaciones y actualiza el estado de cada pedido.'],
        reportes: ['Reportes', 'Histórico completo, filtros por fecha y descarga en Excel.']
    }[currentView];
    $('#title').textContent = meta[0];
    $('#description').textContent = meta[1];
    $('#breadcrumb').textContent = currentView[0].toUpperCase() + currentView.slice(1);
    document.querySelectorAll('nav a').forEach(link => {
        const active = link.hash === '#' + currentView;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
    ({ resumen: dashboard, pedidos: renderList, reportes: renderReports })[currentView]();
}


function itemTable(items) {
    return `<div class="table-wrap"><table><thead><tr><th>Producto / presentación</th><th>Cant.</th>
        <th>Precio</th><th>Subtotal</th></tr></thead><tbody>
        ${items.map(item => `<tr><td>${esc(item.name)}</td><td>${item.qty}</td>
            <td>${money(item.price)}</td><td>${money(item.qty * item.price)}</td></tr>`).join('')}
    </tbody></table></div>`;
}
function timeline(history) {
    return `<h3>Historial del pedido</h3><ol class="timeline">
        ${history.map(event => `<li>${STATES[event.status]}<small>${dateLabel(event.date)}</small></li>`).join('')}
    </ol>`;
}
function detailActions(order) {
    const actions = ['Enviar a revisión', 'Autorizar pedido', 'Marcar en tránsito', 'Confirmar recepción'];
    return `<div class="modal-actions"><button class="secondary" data-close-detail>Cerrar</button>
        ${order.status < 4 ? `<button class="primary" data-advance="${order.id}">${actions[order.status]} →</button>`
            : '<span class="badge status-4">Entrega completada ✓</span>'}</div>`;
}
function detail(id) {
    const order = orders.find(order => order.id === id);
    if (!order) return;
    $('#detail-dialog').innerHTML = `<div class="section-heading"><div>
        <p class="eyebrow">DETALLE DEL PEDIDO</p><h2>${order.id}</h2></div>
        <button class="secondary" data-close-detail aria-label="Cerrar detalle">×</button></div>
        ${badge(order.status)}<div class="form-grid"><div><small class="muted">Cliente</small>
        <h3>${esc(order.client)}</h3></div><div><small class="muted">Entrega prevista</small>
        <h3>${dateLabel(order.due)}</h3></div></div>${itemTable(order.items)}
        <div class="form-total"><span>Total · IVA incluido</span><strong>${money(total(order))}</strong></div>
        ${order.notes ? `<h3>Notas</h3><p class="detail-notes">${esc(order.notes)}</p>` : ''}
        ${timeline(order.history)}${detailActions(order)}`;
    if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
}
function addLine() {
    const line = document.createElement('div');
    line.className = 'product-line';
    line.innerHTML = `<label>Producto / presentación<input class="item-name" required maxlength="100"
        placeholder="Papel carta, resma 500 hojas"></label>
        <label>Cantidad<input class="item-qty" required type="number" min="1" max="10000" step="1" value="1"></label>
        <label>Precio MXN<input class="item-price" required type="number" min="0.01" max="10000000" step="0.01" placeholder="0.00"></label>
        <button type="button" class="secondary remove-line" aria-label="Eliminar producto">×</button>`;
    $('#lines').append(line);
    updateTotal();
}
function getItems() {
    return [...document.querySelectorAll('.product-line')].map(element => ({
        name: element.querySelector('.item-name').value.trim(),
        qty: Number(element.querySelector('.item-qty').value),
        price: Number(element.querySelector('.item-price').value)
    }));
}
function updateTotal() {
    const value = total({ items: getItems() });
    $('#form-total').textContent = money(Number.isFinite(value) ? value : 0);
    const buttons = document.querySelectorAll('.remove-line');
    buttons.forEach(button => button.disabled = buttons.length === 1);
}
function openNewOrder() {
    $('#order-form').reset();
    $('#lines').innerHTML = '';
    $('#form-error').textContent = '';
    const due = $('#order-form').elements.due;
    due.min = today();
    due.value = shift(today(), 7);
    addLine();
    $('#order-dialog').showModal();
}
function createOrder(form, items) {
    const next = Math.max(1048, ...orders.map(order => Number(order.id.slice(3)))) + 1;
    return {
        id: `PP-${next}`, client: form.elements.client.value.trim(), date: today(),
        due: form.elements.due.value, status: 0, items, notes: form.elements.notes.value.trim(),
        history: [{ status: 0, date: today() }]
    };
}
function submitOrder(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const items = getItems();
    if (!form.elements.client.value.trim() || items.some(item => !item.name) || form.elements.due.value < today()) {
        $('#form-error').textContent = 'Escribe un cliente y productos válidos, y una fecha de entrega a partir de hoy.';
        return;
    }
    const order = createOrder(form, items);
    if (!validOrder(order)) {
        $('#form-error').textContent = 'Revisa las cantidades y los precios de los productos.';
        return;
    }
    orders.unshift(order);
    save();
    $('#order-dialog').close();
    render();
    detail(order.id);
    notify('Cotización ' + order.id + ' creada');
}
function advanceOrder(id) {
    const order = orders.find(order => order.id === id);
    if (!order || order.status >= 4) return;
    order.status++;
    order.history.push({ status: order.status, date: today() });
    save();
    render();
    detail(order.id);
    notify('Pedido actualizado: ' + STATES[order.status]);
}
function resetData() {
    orders = seed();
    save();
    filters = emptyFilters();
    report = { start: '', end: '' };
    $('#reset-dialog').close();
    render();
    notify('Datos de ejemplo restablecidos');
}


function exportExcel() {
    if (invalidPeriod(report)) { notify('Revisa el rango de fechas antes de descargar.'); return; }
    let url;
    try {
        const rows = reportRows();
        const workbook = PedidosProExcel.create(rows.map(order => ({
            id: order.id, client: order.client, date: order.date, due: order.due,
            status: STATES[order.status], amount: total(order)
        })), report);
        url = URL.createObjectURL(new Blob([workbook], { type: PedidosProExcel.MIME }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pedidos-pro-' + today() + '.xlsx';
        document.body.append(link);
        link.click();
        link.remove();
        notify('Excel generado: ' + rows.length + ' pedidos');
    } catch (error) {
        console.error('No se pudo exportar el reporte de Pedidos Pro.', error);
        notify('No se pudo generar el Excel. Intenta descargarlo de nuevo.');
    } finally {
        if (url) setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
}
function filterChanged(event) {
    const key = event.target.dataset.filter;
    if (!key) return;
    if (currentView === 'pedidos') { filters[key] = event.target.value; updateList(); }
    else { report[key] = event.target.value; updateReports(); }
}
function viewClicked(event) {
    const item = event.target.closest('[data-detail]');
    if (item) detail(item.dataset.detail);
    if (event.target.id === 'clear-filters') { filters = emptyFilters(); renderList(); }
    if (event.target.id === 'clear-report') { report = { start: '', end: '' }; renderReports(); }
    if (event.target.id === 'export') exportExcel();
}
function bindEvents() {
    $('#new-order').onclick = openNewOrder;
    $('#add-line').onclick = addLine;
    $('#order-form').addEventListener('input', updateTotal);
    $('#order-form').addEventListener('submit', submitOrder);
    $('#order-form').addEventListener('click', event => {
        if (event.target.closest('.remove-line') && document.querySelectorAll('.product-line').length > 1) {
            event.target.closest('.product-line').remove();
            updateTotal();
        }
        if (event.target.closest('.close')) $('#order-dialog').close();
    });
    $('#view').addEventListener('input', filterChanged);
    $('#view').addEventListener('click', viewClicked);
    $('#detail-dialog').addEventListener('click', event => {
        if (event.target.closest('[data-close-detail]')) $('#detail-dialog').close();
        const button = event.target.closest('[data-advance]');
        if (button) advanceOrder(button.dataset.advance);
    });
    $('#reset').onclick = () => $('#reset-dialog').showModal();
    $('#cancel-reset').onclick = () => $('#reset-dialog').close();
    $('#confirm-reset').onclick = resetData;
    window.addEventListener('hashchange', render);
}
loadOrders();
bindEvents();
render();
