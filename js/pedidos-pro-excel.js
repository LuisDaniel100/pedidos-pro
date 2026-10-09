
(function (root) {
    'use strict';
    const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const xml = value => String(value)
        .replace(/_x[0-9a-f]{4}_/gi, value => '_x005F_' + value.slice(1))
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
        .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
    const text = (ref, value, style = 0) => `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
    const number = (ref, value, style) => {
        if (!Number.isFinite(value)) throw new Error('El reporte contiene un número inválido.');
        return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
    };
    function serialDate(value) {
        const milliseconds = Date.parse(value + 'T00:00:00Z');
        if (!Number.isFinite(milliseconds)) throw new Error('El reporte contiene una fecha inválida.');
        return milliseconds / 86400000 + 25569;
    }
    function crc32(bytes) {
        let crc = 0xffffffff;
        for (const byte of bytes) {
            crc ^= byte;
            for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
        }
        return (crc ^ 0xffffffff) >>> 0;
    }
    function zip(files) {
        const encoder = new TextEncoder();
        const chunks = [], directory = [];
        let offset = 0, directoryLength = 0;
        for (const [path, content] of Object.entries(files)) {
            const name = encoder.encode(path), data = encoder.encode(declaration + content);
            const checksum = crc32(data);
            const local = new Uint8Array(30 + name.length), view = new DataView(local.buffer);
            view.setUint32(0, 0x04034b50, true);
            view.setUint16(4, 20, true);
            view.setUint16(6, 0x800, true);
            view.setUint16(12, 33, true); 
            view.setUint32(14, checksum, true);
            view.setUint32(18, data.length, true);
            view.setUint32(22, data.length, true);
            view.setUint16(26, name.length, true);
            local.set(name, 30);
            const central = new Uint8Array(46 + name.length), entry = new DataView(central.buffer);
            entry.setUint32(0, 0x02014b50, true);
            entry.setUint16(4, 20, true);
            entry.setUint16(6, 20, true);
            entry.setUint16(8, 0x800, true);
            entry.setUint16(14, 33, true);
            entry.setUint32(16, checksum, true);
            entry.setUint32(20, data.length, true);
            entry.setUint32(24, data.length, true);
            entry.setUint16(28, name.length, true);
            entry.setUint32(42, offset, true);
            central.set(name, 46);
            chunks.push(local, data);
            directory.push(central);
            offset += local.length + data.length;
            directoryLength += central.length;
        }
        const end = new Uint8Array(22), endView = new DataView(end.buffer);
        endView.setUint32(0, 0x06054b50, true);
        endView.setUint16(8, directory.length, true);
        endView.setUint16(10, directory.length, true);
        endView.setUint32(12, directoryLength, true);
        endView.setUint32(16, offset, true);
        const result = new Uint8Array(offset + directoryLength + end.length);
        let cursor = 0;
        for (const chunk of [...chunks, ...directory, end]) { result.set(chunk, cursor); cursor += chunk.length; }
        return result;
    }
    function create(rows, period = {}) {
        if (rows.length > 1048569) throw new Error('El reporte supera el límite de filas de Excel.');
        const headers = ['Folio', 'Cliente', 'Fecha de creación', 'Entrega prevista', 'Estado', 'Importe MXN'];
        const last = rows.length + 5, totalRow = last + 1;
        const periodLabel = !period.start && !period.end ? 'Todo el histórico' : `${period.start || 'Inicio del histórico'} a ${period.end || 'Fin del histórico'}`;
        const data = [
            `<row r="1" ht="30" customHeight="1">${text('A1', 'Pedidos Pro · Reporte de pedidos', 1)}</row>`,
            `<row r="2">${text('A2', 'Fecha de creación: ' + periodLabel)}</row>`,
            `<row r="3">${text('A3', 'Datos ficticios · MXN · IVA incluido · ' + rows.length + ' pedidos')}</row>`,
            `<row r="5" ht="26" customHeight="1">${headers.map((h, i) => text(String.fromCharCode(65 + i) + '5', h, 2)).join('')}</row>`
        ];
        rows.forEach((o, i) => {
            const r = i + 6;
            data.push(`<row r="${r}" ht="32" customHeight="1">${text('A' + r, o.id)}${text('B' + r, o.client)}${number('C' + r, serialDate(o.date), 3)}${number('D' + r, serialDate(o.due), 3)}${text('E' + r, o.status)}${number('F' + r, o.amount, 4)}</row>`);
        });
        const amount = Math.round(rows.reduce((sum, o) => sum + o.amount, 0) * 100) / 100;
        data.push(`<row r="${totalRow}" ht="26" customHeight="1">${text('E' + totalRow, 'Total', 2)}<c r="F${totalRow}" s="5">${rows.length ? `<f>SUM(F6:F${last})</f>` : ''}<v>${amount}</v></c></row>`);
        const styles = `<styleSheet xmlns="${NS}"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="&quot;$&quot;#,##0.00"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="18"/><color rgb="FF287052"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF287052"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="2" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
        return zip({
            '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
            '_rels/.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
            'xl/workbook.xml': `<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets><sheet name="Pedidos" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
            'xl/_rels/workbook.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
            'xl/styles.xml': styles,
            'xl/worksheets/sheet1.xml': `<worksheet xmlns="${NS}"><dimension ref="A1:F${totalRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="1" width="16" customWidth="1"/><col min="2" max="2" width="48" customWidth="1"/><col min="3" max="4" width="21" customWidth="1"/><col min="5" max="5" width="20" customWidth="1"/><col min="6" max="6" width="23" customWidth="1"/></cols><sheetData>${data.join('')}</sheetData><autoFilter ref="A5:F${last}"/><mergeCells count="3"><mergeCell ref="A1:F1"/><mergeCell ref="A2:F2"/><mergeCell ref="A3:F3"/></mergeCells></worksheet>`
        });
    }
    root.PedidosProExcel = { create, MIME };
})(typeof module === 'object' && module.exports ? module.exports : globalThis);
