// Portal del SAT simulado para las pruebas: mismas IDs, mismas columnas y mismo comportamiento
// que se comprobaron en el portal real el 2026-10-14 (tope de 500 con su aviso, tabla que se
// reemplaza al terminar, filtro por fecha que habilita los campos y métodos de descarga).
// Todos los datos son inventados.

export const ORIGEN = 'https://portalcfdi.facturaelectronica.sat.gob.mx';

const dos = (n) => String(n).padStart(2, '0');

function uuid(n) {
  const h = n.toString(16).padStart(12, '0');
  return `0000AAAA-0000-4000-8000-${h}`.toUpperCase();
}

// Genera facturas: { emisor, receptor, fecha 'aaaa-mm-ddThh:mm:ss', total, serie, folio }.
export function facturas({ anio, mes, porDia = 0, dias = [], extra = [], emisor, receptor, inicio = 1 }) {
  const lista = [];
  let n = inicio;
  const agregar = (dia, segundo) => {
    const h = Math.floor(segundo / 3600);
    const m = Math.floor((segundo % 3600) / 60);
    const s = segundo % 60;
    lista.push({
      uuid: uuid(n),
      fecha: `${anio}-${dos(mes)}-${dos(dia)}T${dos(h)}:${dos(m)}:${dos(s)}`,
      emisor: emisor ?? `EMI${dos(n % 97)}0101AA${n % 10}`,
      receptor: receptor ?? `REC${dos(n % 89)}0202BB${n % 10}`,
      total: Math.round((100 + (n * 37) % 9000) * 100) / 100,
      serie: n % 3 === 0 ? '' : 'F',
      folio: String(1000 + n),
    });
    n++;
  };
  for (const dia of dias) for (let i = 0; i < porDia; i++) agregar(dia, Math.floor(((i + 0.5) * 86400) / porDia));
  for (const { dia, cuantas, segundo } of extra) {
    for (let i = 0; i < cuantas; i++) agregar(dia, segundo ?? Math.floor(((i + 0.5) * 86400) / cuantas));
  }
  return lista;
}

function opciones(desde, hasta, pad = true) {
  let html = '';
  for (let i = desde; i <= hasta; i++) html += `<option value="${pad ? dos(i) : i}">${dos(i)}</option>`;
  return html;
}
const horas = (id, valor) =>
  `<select id="${id}">${opciones(0, id.includes('Hora') ? 23 : 59, false).replace(`value="${valor}"`, `value="${valor}" selected`)}</select>`;

function formulario(tipo) {
  if (tipo === 'recibidas') {
    const p = 'ctl00_MainContent_CldFecha_';
    return `<select id="DdlAnio" disabled>${opciones(2011, 2026, false)}</select>
      <select id="${p}DdlMes" disabled>${opciones(1, 12, false)}</select>
      <select id="${p}DdlDia" disabled><option value="0"></option>${opciones(1, 31)}</select>
      ${horas(p + 'DdlHora', 0)}${horas(p + 'DdlMinuto', 0)}${horas(p + 'DdlSegundo', 0)}
      ${horas(p + 'DdlHoraFin', 23)}${horas(p + 'DdlMinutoFin', 59)}${horas(p + 'DdlSegundoFin', 59)}`;
  }
  const i = 'ctl00_MainContent_CldFechaInicial2_';
  const f = 'ctl00_MainContent_CldFechaFinal2_';
  return `<input type="text" id="${i}Calendario_text" disabled>${horas(i + 'DdlHora', 0)}${horas(i + 'DdlMinuto', 0)}${horas(i + 'DdlSegundo', 0)}
    <input type="text" id="${f}Calendario_text" disabled>${horas(f + 'DdlHora', 0)}${horas(f + 'DdlMinuto', 0)}${horas(f + 'DdlSegundo', 0)}
    <input type="submit" id="ctl00_MainContent_BtnCancelar" value="Cancelar Seleccionados" onclick="window.__cancelaciones=(window.__cancelaciones||0)+1;return false;" style="display:none">`;
}

const COLUMNAS = [
  'Folio Fiscal', 'RFC Emisor', 'Nombre o Razón Social del Emisor', 'RFC Receptor', 'Nombre o Razón Social del Receptor',
  'Fecha de Emisión', 'Fecha de Certificación', 'PAC que Certificó', 'Total', 'Efecto del Comprobante',
  'Estatus de cancelación', 'Estado del Comprobante', 'Estatus de Proceso de Cancelación',
  'Fecha de Solicitud de la Cancelación', 'Fecha de Cancelación', 'RFC a cuenta de terceros',
];

// Script de la página simulada (corre en el mundo de la página, como el JavaScript del portal).
function scriptDePagina(tipo, datos) {
  return `
  const DATOS = ${JSON.stringify(datos)};
  const TIPO = ${JSON.stringify(tipo)};
  const COLUMNAS = ${JSON.stringify(COLUMNAS)};
  const NOMBRES = ['PAPELERIA LA ESCUADRA SA DE CV', 'TRANSPORTES DEL BAJIO SA DE CV', 'SERVICIOS DIGITALES ALFA SC', 'FERRETERA EL MARTILLO SA DE CV', 'DISTRIBUIDORA DE ALIMENTOS SOL SA DE CV', 'CONSULTORES ASOCIADOS DEL PACIFICO SC', 'LOGISTICA EXPRESS MEXICO SA DE CV', 'IMPRENTA MODERNA SA DE CV'];
  const $ = (id) => document.getElementById(id);
  const seg = (h, m, s) => Number(h) * 3600 + Number(m) * 60 + Number(s);
  function activarFechas() {
    setTimeout(() => {
      $('ctl00_MainContent_RdoFechas').checked = true;
      $('ctl00_MainContent_TxtUUID').disabled = true;
      document.querySelectorAll('#filtros select').forEach((s) => (s.disabled = false));
    }, 150);
  }
  function enRango(f) {
    const [fecha, hora] = f.fecha.split('T');
    const [a, mes, d] = fecha.split('-').map(Number);
    const [h, mi, s] = hora.split(':').map(Number);
    const x = seg(h, mi, s);
    if (TIPO === 'recibidas') {
      const p = 'ctl00_MainContent_CldFecha_';
      if (a !== Number($('DdlAnio').value) || mes !== Number($(p + 'DdlMes').value)) return false;
      const dia = Number($(p + 'DdlDia').value);
      if (dia === 0) return true;
      return d === dia && x >= seg($(p + 'DdlHora').value, $(p + 'DdlMinuto').value, $(p + 'DdlSegundo').value)
        && x <= seg($(p + 'DdlHoraFin').value, $(p + 'DdlMinutoFin').value, $(p + 'DdlSegundoFin').value);
    }
    const i = 'ctl00_MainContent_CldFechaInicial2_', fi = 'ctl00_MainContent_CldFechaFinal2_';
    const aFecha = (texto, h, m, s) => { const [dd, mm, aa] = texto.split('/'); return aa + '-' + mm + '-' + dd + 'T' + [h, m, s].map((v) => String(v).padStart(2, '0')).join(':'); };
    const desde = aFecha($(i + 'Calendario_text').value, $(i + 'DdlHora').value, $(i + 'DdlMinuto').value, $(i + 'DdlSegundo').value);
    const hasta = aFecha($(fi + 'Calendario_text').value, $(fi + 'DdlHora').value, $(fi + 'DdlMinuto').value, $(fi + 'DdlSegundo').value);
    return f.fecha >= desde && f.fecha <= hasta;
  }
  function fila(f) {
    const nombre = (rfc) => NOMBRES[parseInt(rfc.replace(/[^0-9]/g, '').slice(0, 2) || '0', 10) % NOMBRES.length];
    const celdas = [f.uuid, f.emisor, nombre(f.emisor), f.receptor, f.receptorNombre || 'COMERCIALIZADORA DEL NORTE SA DE CV', f.fecha, f.fecha, 'PAC010101AAA',
      '$' + f.total.toLocaleString('en-US', { minimumFractionDigits: 2 }), 'Ingreso', 'Cancelable con aceptación', 'Vigente', '', '', '', ''];
    return '<tr><td><div><table><tbody><tr><td><input id="ListaFolios" class="ListaFolios" type="checkbox" value="' + f.uuid.toLowerCase() + '">'
      + '<input type="hidden" id="ListaFoliosUrl" value="URL-' + f.uuid + '"></td>'
      + '<td><span id="BtnVerDetalle" onclick="AccionCfdi(\\'Detalle.aspx?Datos=D-' + f.uuid + '\\',\\'Detalle\\');"></span></td>'
      + '<td><span id="BtnDescarga" onclick="return AccionCfdi(\\'RecuperaCfdi.aspx?Datos=TOK-' + f.uuid + '\\',\\'Recuperacion\\');"></span></td>'
      + '<td><span id="BtnRI" onclick="recuperaRepresentacionImpresa(\\'RI-' + f.uuid + '\\');"></span></td></tr></tbody></table></div></td>'
      + celdas.map((c) => '<td><span>' + c + '</span></td>').join('') + '</tr>';
  }
  window.buscarFalso = function () {
    window.__consultas = (window.__consultas || 0) + 1;
    const todas = DATOS.filter(enRango).sort((a, b) => a.fecha.localeCompare(b.fecha));
    setTimeout(() => {
      const visibles = todas.slice(0, 500);
      const cabeza = '<tr><th><span><input type="checkbox" id="seleccionador"> Acciones</span></th>' + COLUMNAS.map((c) => '<th><span>' + c + '</span></th>').join('') + '</tr>';
      $('ContenedorDinamico').innerHTML = '<table id="ctl00_MainContent_tblResult"><tbody>' + cabeza + visibles.map(fila).join('') + '</tbody></table>';
      $('ctl00_MainContent_PnlLimiteRegistros').style.display = todas.length > 500 ? 'block' : 'none';
      $('ctl00_MainContent_PnlNoResultados').style.display = todas.length === 0 ? 'block' : 'none';
    }, 30);
    return false;
  };
  `;
}

// Aspecto genérico de portal (sin logos ni colores oficiales) para que las capturas de la ficha
// muestren la extensión sobre una página parecida a la consulta, con datos inventados.
const CSS = `body{margin:0;font:14px/1.4 Arial,Helvetica,sans-serif;color:#222;background:#f4f4f4}
  .barra{background:#3a3a3a;color:#fff;padding:14px 32px;font-size:15px}
  .contenido{max-width:1180px;margin:0 auto;padding:18px 32px}
  h1{font-size:22px;font-weight:normal;margin:6px 0 14px}
  form{background:#fff;border:1px solid #ddd;padding:16px 18px;border-radius:4px}
  #filtros{display:inline-flex;gap:6px;flex-wrap:wrap;margin:8px 0}
  select,input[type=text]{padding:4px;border:1px solid #bbb;border-radius:3px}
  #ctl00_MainContent_BtnBusqueda{background:#555;color:#fff;border:0;padding:7px 14px;border-radius:3px;margin-left:8px}
  #ContenedorDinamico{margin-top:14px;overflow:hidden}
  table#ctl00_MainContent_tblResult{border-collapse:collapse;font-size:12px;white-space:nowrap}
  #ctl00_MainContent_tblResult th{background:#e9e9e9;text-align:left;padding:6px 8px;border:1px solid #ddd}
  #ctl00_MainContent_tblResult > tbody > tr > td{padding:5px 8px;border:1px solid #eee;background:#fff}
  #ctl00_MainContent_tblResult td table td{border:0;padding:0 3px}
  #ctl00_MainContent_PnlLimiteRegistros{background:#fff7e0;border:1px solid #e8d18a;padding:8px;margin-top:10px}`;

export function pagina(tipo, datos) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Portal Contribuyentes CFDI | Buscar CFDI</title><style>${CSS}</style></head><body>
  <div class="barra">Factura electrónica · Consulta de comprobantes</div>
  <div class="contenido"><h1>${tipo === 'emitidas' ? 'Consultar Facturas Emitidas' : 'Consultar Facturas Recibidas'}</h1>
  <form onsubmit="return false">
    <input type="radio" id="ctl00_MainContent_RdoFolioFiscal" name="filtro" checked>
    <input type="text" id="ctl00_MainContent_TxtUUID">
    <input type="radio" id="ctl00_MainContent_RdoFechas" name="filtro" onclick="activarFechas()">
    <div id="filtros">${formulario(tipo)}</div>
    <input type="submit" id="ctl00_MainContent_BtnBusqueda" value="Buscar CFDI" onclick="return buscarFalso();">
    <div id="dvAlert"></div>
    <div id="ctl00_MainContent_PnlLimiteRegistros" style="display:none">La consulta realizada solo muestra los primeros 500 registros.</div>
    <div id="ctl00_MainContent_PnlNoResultados" style="display:none">No existen registros que cumplan con los criterios de búsqueda ingresados</div>
    <div id="ContenedorDinamico"></div>
  </form></div>
  <script>${scriptDePagina(tipo, datos)}</script></body></html>`;
}

function xmlDe(f) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0"${f.serie ? ` Serie="${f.serie}"` : ''} Folio="${f.folio}" Fecha="${f.fecha}" SubTotal="${(f.total / 1.16).toFixed(2)}" Moneda="MXN" Total="${f.total.toFixed(2)}" TipoDeComprobante="I" MetodoPago="PUE" FormaPago="03">
  <cfdi:Emisor Rfc="${f.emisor}"/><cfdi:Receptor Rfc="${f.receptor}" UsoCFDI="G03"/>
  <cfdi:Impuestos TotalImpuestosTrasladados="${(f.total - f.total / 1.16).toFixed(2)}"/>
</cfdi:Comprobante>`;
}

// Monta el portal en el contexto de Playwright. `limiteXml` imita la cuota diaria del SAT.
export async function montar(context, { recibidas = [], emitidas = [], limiteXml = Infinity } = {}) {
  const estado = { validacionesXml: 0, limiteXml, xml: 0, pdf: 0 };
  const todas = new Map([...recibidas, ...emitidas].map((f) => [f.uuid, f]));
  await context.route(`${ORIGEN}/**`, async (route) => {
    const url = new URL(route.request().url());
    const ruta = url.pathname;
    const json = (d) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ d }) });
    if (ruta === '/ConsultaReceptor.aspx') return route.fulfill({ contentType: 'text/html', body: pagina('recibidas', recibidas) });
    if (ruta === '/ConsultaEmisor.aspx') return route.fulfill({ contentType: 'text/html', body: pagina('emitidas', emitidas) });
    if (ruta.endsWith('/ValidarDescarga')) {
      estado.validacionesXml++;
      if (estado.validacionesXml > estado.limiteXml) return json({ Codigo: 1, CantidadTope: 2000, Mensaje: 'Has alcanzado el número máximo de descargas por día.' });
      return json({ Codigo: 0, CantidadDisponible: 0, CantidadTope: 2000, Mensaje: null });
    }
    if (ruta.endsWith('/ValidarDescargaRi')) return json({ Codigo: 0, CantidadDisponible: 0, CantidadTope: 2000, Mensaje: null });
    if (ruta.endsWith('/RecuperaRepresentacionImpresa')) {
      const { datos } = JSON.parse(route.request().postData() || '{}');
      return json(`RepresentacionImpresa.aspx?Datos=${encodeURIComponent(datos.replace(/^RI-/, ''))}`);
    }
    if (ruta === '/RecuperaCfdi.aspx') {
      const f = todas.get(url.searchParams.get('Datos').replace(/^TOK-/, ''));
      estado.xml++;
      return route.fulfill({ contentType: 'application/octet-stream', body: xmlDe(f) });
    }
    if (ruta === '/RepresentacionImpresa.aspx') {
      estado.pdf++;
      return route.fulfill({ contentType: 'application/pdf', body: `%PDF-1.4\n% ${url.searchParams.get('Datos')}\n%%EOF\n` });
    }
    if (ruta === '/mantienesesion.aspx') return route.fulfill({ body: '' });
    return route.fulfill({ status: 404, body: '' });
  });
  return estado;
}
