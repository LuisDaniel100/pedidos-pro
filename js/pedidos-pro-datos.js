
(function (root) {
    'use strict';
    function create(asOf) {
        const day = value => new Date(value + 'T12:00:00Z');
        const key = value => value.toISOString().slice(0, 10);
        const shift = (value, days) => { const d = day(value); d.setUTCDate(d.getUTCDate() + days); return key(d); };
        const year = Number(asOf.slice(0, 4));
        let state = 73129;
        const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
        const integer = (min, max) => min + Math.floor(random() * (max - min + 1));
        const pick = values => values[integer(0, values.length - 1)];

        const groups = [
            {
                clients: ['Colegio Ladera Azul', 'Academia Patio Sur', 'Centro Educativo Vértice', 'Instituto Las Dalias'],
                products: [
                    ['Papel bond carta 75 g, resma 500 hojas', 112.5, 10, 90],
                    ['Cuaderno profesional rayado, paquete 10 piezas', 285, 5, 30],
                    ['Lápiz HB, caja 12 piezas', 39.9, 10, 60],
                    ['Marcador para pizarrón, juego 4 colores', 89, 4, 25]
                ], lead: [3, 8]
            },
            {
                clients: ['Consultoría Nudo Claro', 'Despacho Abedul', 'Servicios Contables Trazo Sur'],
                products: [
                    ['Carpeta de argollas tamaño carta, pieza', 68.5, 5, 35],
                    ['Folder manila carta, paquete 100 piezas', 179, 2, 12],
                    ['Bolígrafo azul, caja 12 piezas', 52.9, 3, 20],
                    ['Notas adhesivas 76 × 76 mm, paquete 12 bloques', 119, 1, 8]
                ], lead: [2, 6]
            },
            {
                clients: ['Centro de Copiado Cal y Color', 'Impresiones Patio Nueve', 'Encuadernación Senda'],
                products: [
                    ['Papel bond carta 90 g, resma 500 hojas', 148, 15, 100],
                    ['Cartulina opalina carta 225 g, paquete 100 hojas', 198.5, 3, 20],
                    ['Mica para engargolar carta, paquete 100 piezas', 259, 2, 15],
                    ['Arillo plástico 12 mm, caja 100 piezas', 174.5, 2, 10]
                ], lead: [2, 7]
            },
            {
                clients: ['Logística Cobre Norte', 'Mensajería Bruma', 'Almacenes Enlace'],
                products: [
                    ['Etiqueta adhesiva térmica 100 × 150 mm, rollo 500 piezas', 219.8, 4, 40],
                    ['Sobre bolsa kraft oficio, paquete 50 piezas', 96.5, 3, 25],
                    ['Cinta de empaque 48 mm × 50 m, paquete 6 rollos', 139, 2, 18],
                    ['Marcador permanente negro, caja 12 piezas', 114.5, 2, 12]
                ], lead: [2, 5]
            }
        ];
        const rows = [];
        function order(date, group, scenario) {
            const age = Math.floor((day(asOf) - day(date)) / 86400000);
            const approval = integer(1, 4), dispatch = approval + integer(1, 5);
            const received = dispatch + integer(1, 5);
     
            let status = age >= received ? 4 : age >= dispatch ? 3 : age >= approval ? 2 : age >= 1 ? 1 : 0;
            if (scenario) status = scenario.events.length - 1;
            let due = shift(date, Math.max(integer(...group.lead), dispatch + 1));
            if (status === 4) due = shift(date, received + integer(-2, 3));
            if (scenario) due = shift(asOf, scenario.delivery);
            const selected = [...group.products]; 
            for (let i = selected.length - 1; i > 0; i--) { const j = integer(0, i); [selected[i], selected[j]] = [selected[j], selected[i]]; }
            const items = selected.slice(0, integer(1, 4)).map(([name, price, min, max]) => ({
                name, qty: integer(min, max),
                price: Math.round(price * (1 - (year - Number(date.slice(0, 4))) * 0.035) * pick([0.96, 0.98, 1, 1, 1.02]) * 100) / 100
            }));
            const offsets = scenario ? scenario.events : [0, 1, approval, dispatch, received];
            const notes = [
                ['Precio sujeto a confirmación de existencias.', 'Cliente solicita otra presentación antes de confirmar.', 'Cotización para reposición mensual de papelería.'],
                ['Pendiente de confirmación de cantidades por el cliente.', 'En revisión de presupuesto; no programar salida todavía.'],
                ['Suministros apartados. Coordinar horario de recepción.', 'Pedido autorizado; preparar las cajas completas.'],
                ['Salida registrada. Confirmar recepción con responsable de compras.', 'Suministros en reparto; entregar en recepción administrativa.'],
                ['Entrega completa; cantidades verificadas en recepción.', 'Recibido en almacén del cliente sin faltantes.', 'Entrega en oficina confirmada.']
            ];
            rows.push({ id: '', client: pick(group.clients), date, due, status, items, notes: scenario ? scenario.note : pick(notes[status]),
                history: offsets.slice(0, status + 1).map((offset, status) => ({ status, date: shift(date, offset) })) });
        }
        for (let y = year - 3; y <= year; y++) {
            for (let month = 1; month <= 12; month++) {
                const count = integer(5, 12);
                const days = new Date(Date.UTC(y, month, 0)).getUTCDate();
                for (let i = 0; i < count; i++) {
                    const date = `${y}-${String(month).padStart(2, '0')}-${String(integer(1, days)).padStart(2, '0')}`;
                    if (date < shift(asOf, -29)) order(date, pick(groups));
                }
            }
        }


        const recent = [
            { age: 0, group: 0, events: [0], delivery: 8, note: 'Cotización enviada para el próximo curso; falta confirmar número de grupos.' },
            { age: 1, group: 2, events: [0], delivery: 6, note: 'Cliente revisa gramajes de papel antes de confirmar el pedido.' },
            { age: 4, group: 1, events: [0], delivery: 10, note: 'Se cotizaron carpetas y artículos de archivo; pendiente de aprobación administrativa.' },
            { age: 7, group: 3, events: [0], delivery: 5, note: 'Presupuesto enviado; cliente aún no confirma la fecha de reposición.' },
            { age: 2, group: 0, events: [0, 1], delivery: 7, note: 'En revisión de cantidades con el responsable de compras.' },
            { age: 3, group: 1, events: [0, 2], delivery: 9, note: 'Pendiente de autorización del presupuesto de oficina.' },
            { age: 6, group: 2, events: [0, 1], delivery: 4, note: 'Cliente solicita validar presentaciones y cantidades antes de autorizar.' },
            { age: 10, group: 0, events: [0, 3], delivery: 6, note: 'Inicio de curso aplazado; sin autorización para preparar los paquetes.' },
            { age: 15, group: 3, events: [0, 4], delivery: 8, note: 'Cliente mantiene el presupuesto en revisión; entrega tentativa.' },
            { age: 3, group: 2, events: [0, 1, 2], delivery: 2, note: 'Autorizado ayer; almacén prepara las cajas.' },
            { age: 5, group: 3, events: [0, 2, 4], delivery: 3, note: 'Cantidades confirmadas; salida pendiente de asignación de ruta.' },
            { age: 9, group: 1, events: [0, 2, 6], delivery: 4, note: 'Suministros apartados; cliente recibirá las cajas al concluir su inventario.' },
            { age: 13, group: 0, events: [0, 3, 8], delivery: -1, note: 'Salida retrasada por disponibilidad de transporte; confirmar nueva fecha con el cliente.' },
            { age: 4, group: 3, events: [0, 1, 2, 4], delivery: 1, note: 'Salida registrada hoy; recepción prevista mañana.' },
            { age: 6, group: 2, events: [0, 1, 3, 5], delivery: 0, note: 'En reparto desde ayer; pendiente de recepción durante el día.' },
            { age: 11, group: 0, events: [0, 2, 5, 10], delivery: 1, note: 'Paquetes despachados ayer; entrega programada para mañana en el colegio.' },
            { age: 17, group: 1, events: [0, 4, 9, 15], delivery: -1, note: 'Unidad en ruta con retraso; aún no se confirma la recepción.' },
            { age: 5, group: 2, events: [0, 1, 2, 3, 5], delivery: 0, note: 'Recepción confirmada hoy; entrega completa.' },
            { age: 8, group: 3, events: [0, 1, 3, 5, 6], delivery: -2, note: 'Paquetes recibidos en almacén; cantidades verificadas.' },
            { age: 12, group: 0, events: [0, 2, 4, 7, 9], delivery: -4, note: 'Entrega recibida con un día de retraso; sin faltantes.' },
            { age: 16, group: 1, events: [0, 2, 6, 10, 12], delivery: -4, note: 'Recepción completa; carpetas y cajas revisadas al recibir.' },
            { age: 21, group: 0, events: [0, 3, 5, 8, 10], delivery: -10, note: 'Entrega recibida un día antes de lo previsto, con autorización del cliente.' },
            { age: 25, group: 2, events: [0, 1, 4, 6, 8], delivery: -17, note: 'Pedido recibido completo en la fecha acordada.' },
            { age: 29, group: 3, events: [0, 2, 3, 6, 7], delivery: -22, note: 'Recepción cerrada; suministros entregados al responsable de almacén.' }
        ];
        recent.forEach(scenario => order(shift(asOf, -scenario.age), groups[scenario.group], scenario));
        rows.sort((a, b) => a.date.localeCompare(b.date));
        rows.forEach((row, index) => { row.id = 'PP-' + (3101 + index); });
        return rows.reverse();
    }
    root.PedidosProData = { create };
})(typeof module === 'object' && module.exports ? module.exports : globalThis);

