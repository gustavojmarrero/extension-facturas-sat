// Escritor mínimo de .xlsx (sin dependencias): un ZIP sin compresión con las partes de
// SpreadsheetML. Cada hoja es { nombre, columnas: [{ titulo, ancho, tipo }], filas: [[...]] }.
// tipo: 'texto' (por omisión), 'numero' (#,##0.00), 'entero', 'fecha' (texto ISO aaaa-mm-ddThh:mm:ss)
// 'enlace' ({ url, texto }) o 'mixto' (según el valor de cada celda).

const codificador = new TextEncoder();

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ZIP con método «stored» (0): suficiente para Excel, Google Sheets y LibreOffice.
export function zip(archivos) {
  const partes = [];
  const centrales = [];
  let desplazamiento = 0;
  for (const { nombre, contenido } of archivos) {
    const datos = typeof contenido === 'string' ? codificador.encode(contenido) : contenido;
    const nombreBytes = codificador.encode(nombre);
    const crc = crc32(datos);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint16(8, 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, datos.length, true);
    local.setUint32(22, datos.length, true);
    local.setUint16(26, nombreBytes.length, true);
    partes.push(new Uint8Array(local.buffer), nombreBytes, datos);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, datos.length, true);
    central.setUint32(24, datos.length, true);
    central.setUint16(28, nombreBytes.length, true);
    central.setUint32(42, desplazamiento, true);
    centrales.push(new Uint8Array(central.buffer), nombreBytes);
    desplazamiento += 30 + nombreBytes.length + datos.length;
  }
  const tamanoCentral = centrales.reduce((suma, p) => suma + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamanoCentral, true);
  fin.setUint32(16, desplazamiento, true);
  const todo = [...partes, ...centrales, new Uint8Array(fin.buffer)];
  const salida = new Uint8Array(todo.reduce((suma, p) => suma + p.length, 0));
  let i = 0;
  for (const p of todo) {
    salida.set(p, i);
    i += p.length;
  }
  return salida;
}

const escapar = (texto) =>
  String(texto)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function columna(indice) {
  let nombre = '';
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) nombre = String.fromCharCode(65 + ((n - 1) % 26)) + nombre;
  return nombre;
}

// Número de serie de Excel para «aaaa-mm-ddThh:mm:ss» (hora local tal cual, sin zona).
function serieDeFecha(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(texto || '');
  if (!m) return null;
  const [, a, mes, d, h = 0, mi = 0, s = 0] = m.map((v, i) => (i === 0 ? v : Number(v ?? 0)));
  return (Date.UTC(a, mes - 1, d, h, mi, s) - Date.UTC(1899, 11, 30)) / 86400000;
}

// Estilos: 0 normal, 1 encabezado, 2 importe, 3 fecha y hora, 4 entero, 5 enlace.
const ESTILO = { encabezado: 1, numero: 2, fecha: 3, entero: 4, enlace: 5 };

function celda(ref, valor, tipo) {
  if (valor === null || valor === undefined || valor === '') return '';
  if (tipo === undefined || tipo === 'mixto') {
    if (typeof valor === 'number') tipo = Number.isInteger(valor) ? 'entero' : 'numero';
    else if (typeof valor === 'object' && valor.url) tipo = 'enlace';
  }
  if (tipo === 'numero' || tipo === 'entero') {
    const n = typeof valor === 'number' ? valor : Number(valor);
    if (!Number.isFinite(n)) return `<c r="${ref}" t="inlineStr"><is><t>${escapar(valor)}</t></is></c>`;
    return `<c r="${ref}" s="${ESTILO[tipo]}"><v>${n}</v></c>`;
  }
  if (tipo === 'fecha') {
    const serie = serieDeFecha(valor);
    if (serie === null) return `<c r="${ref}" t="inlineStr"><is><t>${escapar(valor)}</t></is></c>`;
    return `<c r="${ref}" s="${ESTILO.fecha}"><v>${serie}</v></c>`;
  }
  if (tipo === 'enlace' && typeof valor === 'object') {
    const formula = `HYPERLINK("${valor.url.replace(/"/g, '""')}","${String(valor.texto).replace(/"/g, '""')}")`;
    return `<c r="${ref}" s="${ESTILO.enlace}" t="str"><f>${escapar(formula)}</f><v>${escapar(valor.texto)}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapar(valor)}</t></is></c>`;
}

function hojaXml({ columnas, filas, filtro = true }) {
  const cols = columnas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.ancho ?? 14}" customWidth="1"/>`).join('');
  const encabezado = columnas
    .map((c, i) => `<c r="${columna(i)}1" s="${ESTILO.encabezado}" t="inlineStr"><is><t>${escapar(c.titulo)}</t></is></c>`)
    .join('');
  const cuerpo = filas
    .map((fila, f) => {
      const r = f + 2;
      const celdas = fila.map((valor, i) => celda(`${columna(i)}${r}`, valor, columnas[i]?.tipo)).join('');
      return `<row r="${r}">${celdas}</row>`;
    })
    .join('');
  const ultima = `${columna(columnas.length - 1)}${filas.length + 1}`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols><sheetData><row r="1">${encabezado}</row>${cuerpo}</sheetData>` +
    (filtro && filas.length ? `<autoFilter ref="A1:${ultima}"/>` : '') +
    '</worksheet>'
  );
}

const ESTILOS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm:ss"/></numFmts>' +
  '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><u/><sz val="11"/><color rgb="FF0B6BD3"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0C1E55"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="6">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

export function libro(hojas) {
  const nombres = hojas.map((h) => escapar(h.nombre.slice(0, 31)));
  const archivos = [
    {
      nombre: '[Content_Types].xml',
      contenido:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
        '</Types>',
    },
    {
      nombre: '_rels/.rels',
      contenido:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    },
    {
      nombre: 'xl/workbook.xml',
      contenido:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        nombres.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        '</sheets></workbook>',
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      contenido:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        '</Relationships>',
    },
    { nombre: 'xl/styles.xml', contenido: ESTILOS },
    ...hojas.map((h, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, contenido: hojaXml(h) })),
  ];
  return zip(archivos);
}
