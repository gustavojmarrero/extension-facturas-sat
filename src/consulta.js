// Maneja el formulario del portal desde el script de contenido: llena un intervalo, pulsa
// «Buscar CFDI» y lee la tabla. No usa el JavaScript del portal (vive en otro mundo): espera a
// que el portal reemplace la tabla de resultados, que es lo que hace al terminar cada consulta.

import { IDS, RECIBIDAS, EMITIDAS, COLUMNAS, FILA, TOPE_POR_CONSULTA } from './portal.js';
import { hms, ultimoDiaConsultable } from './intervalos.js';
import { importe } from './relacion.js';

export class ErrorPortal extends Error {}

const $ = (id) => document.getElementById(id);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const dos = (n) => String(n).padStart(2, '0');

export function visible(el) {
  return !!el && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);
}

export function tipoDePagina(ruta = location.pathname) {
  if (/ConsultaEmisor\.aspx/i.test(ruta)) return 'emitidas';
  if (/ConsultaReceptor\.aspx/i.test(ruta)) return 'recibidas';
  return null;
}

async function esperarA(condicion, limiteMs, descripcion) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    const valor = condicion();
    if (valor) return valor;
    await esperar(100);
  }
  throw new ErrorPortal(`El portal no respondió a tiempo (${descripcion}).`);
}

function textoAlertas() {
  const caja = $(IDS.alertas);
  return caja && visible(caja) ? caja.textContent.replace(/\s+/g, ' ').replace('×', '').trim() : '';
}

// El filtro «Fecha de Emisión» hace un postback parcial que habilita los campos de fecha.
export async function activarFiltroFechas() {
  const radio = $(IDS.radioFechas);
  if (!radio) throw new ErrorPortal('No encontré el filtro por fecha de emisión. ¿Cambió el portal?');
  const listo = () => $(IDS.radioFechas)?.checked && $('ctl00_MainContent_TxtUUID')?.disabled;
  if (listo()) return;
  radio.click();
  await esperarA(listo, 20000, 'activar el filtro por fecha');
  await esperar(300);
}

function poner(id, valor) {
  const el = $(id);
  if (!el) throw new ErrorPortal(`Falta el campo ${id} en el portal.`);
  el.value = String(valor);
  if (el.tagName === 'SELECT' && el.value !== String(valor)) throw new ErrorPortal(`El portal no acepta ${valor} en ${id}.`);
}

function ponerHoras(campos, iv) {
  const a = hms(iv.desde);
  const b = hms(iv.hasta);
  poner(campos.hora, a.h);
  poner(campos.minuto, a.m);
  poner(campos.segundo, a.s);
  poner(campos.horaFin, b.h);
  poner(campos.minutoFin, b.m);
  poner(campos.segundoFin, b.s);
}

export function llenar(tipo, iv, hoy = new Date()) {
  if (tipo === 'recibidas') {
    poner(RECIBIDAS.anio, iv.anio);
    poner(RECIBIDAS.mes, iv.mes);
    poner(RECIBIDAS.dia, iv.dia === 0 ? '0' : dos(iv.dia));
    ponerHoras(RECIBIDAS, iv);
  } else {
    const desde = iv.dia === 0 ? 1 : iv.dia;
    const hasta = iv.dia === 0 ? ultimoDiaConsultable(iv.anio, iv.mes, hoy) : iv.dia;
    poner(EMITIDAS.desde, `${dos(desde)}/${dos(iv.mes)}/${iv.anio}`);
    poner(EMITIDAS.hasta, `${dos(hasta)}/${dos(iv.mes)}/${iv.anio}`);
    ponerHoras(EMITIDAS, iv);
  }
}

function indicesDeColumnas(tabla) {
  const encabezados = [...(tabla.rows[0]?.cells || [])].map((c) => c.textContent.replace(/\s+/g, ' ').trim());
  const indices = {};
  for (const nombre of COLUMNAS) {
    const i = encabezados.indexOf(nombre);
    if (i === -1 && nombre !== 'RFC a cuenta de terceros') throw new ErrorPortal(`La tabla del portal ya no trae la columna «${nombre}».`);
    indices[nombre] = i;
  }
  return indices;
}

export function leerTabla(tabla) {
  if (!tabla) return [];
  const ix = indicesDeColumnas(tabla);
  const texto = (fila, nombre) => (ix[nombre] >= 0 ? fila.cells[ix[nombre]]?.textContent.replace(/\s+/g, ' ').trim() || '' : '');
  const facturas = [];
  for (const fila of [...tabla.rows].slice(1)) {
    const uuid = fila.querySelector(FILA.uuid)?.value?.trim();
    if (!uuid) continue;
    const xml = /AccionCfdi\('([^']+)'\s*,\s*'Recuperacion'\)/.exec(fila.querySelector(FILA.descargaXml)?.getAttribute('onclick') || '');
    const pdf = /\w+\('([^']+)'\)/.exec(fila.querySelector(FILA.descargaPdf)?.getAttribute('onclick') || '');
    facturas.push({
      uuid: uuid.toUpperCase(),
      rfcEmisor: texto(fila, 'RFC Emisor'),
      nombreEmisor: texto(fila, 'Nombre o Razón Social del Emisor'),
      rfcReceptor: texto(fila, 'RFC Receptor'),
      nombreReceptor: texto(fila, 'Nombre o Razón Social del Receptor'),
      fechaEmision: texto(fila, 'Fecha de Emisión'),
      fechaCertificacion: texto(fila, 'Fecha de Certificación'),
      pac: texto(fila, 'PAC que Certificó'),
      total: importe(texto(fila, 'Total')),
      efecto: texto(fila, 'Efecto del Comprobante'),
      estatusCancelacion: texto(fila, 'Estatus de cancelación'),
      estado: texto(fila, 'Estado del Comprobante'),
      estatusProceso: texto(fila, 'Estatus de Proceso de Cancelación'),
      fechaSolicitudCancelacion: texto(fila, 'Fecha de Solicitud de la Cancelación'),
      fechaCancelacion: texto(fila, 'Fecha de Cancelación'),
      rfcTercero: texto(fila, 'RFC a cuenta de terceros'),
      // Enlaces de un solo uso del portal: sirven para descargar en esta consulta, no se guardan.
      urlXml: xml ? xml[1] : null,
      datosPdf: pdf ? pdf[1] : null,
    });
  }
  return facturas;
}

// Busca con los valores ya puestos y espera a que el portal reemplace la tabla.
export async function buscar() {
  const anterior = $(IDS.tabla);
  const alertaAntes = textoAlertas();
  $(IDS.buscar).click();
  const hecho = await esperarA(
    () => {
      const tabla = $(IDS.tabla);
      if (tabla && tabla !== anterior) return { tabla };
      const alerta = textoAlertas();
      if (alerta && alerta !== alertaAntes) return { alerta };
      if (!document.body.contains($(IDS.buscar))) return { salio: true };
      return null;
    },
    120000,
    'buscar',
  );
  if (hecho.salio) throw new ErrorPortal('El portal salió de la consulta. Quizá se cerró la sesión.');
  if (hecho.alerta) throw new ErrorPortal(`El portal mostró un aviso: ${hecho.alerta}`);
  await esperar(150);
  const facturas = leerTabla($(IDS.tabla));
  const limite = visible($(IDS.panelLimite)) || facturas.length >= TOPE_POR_CONSULTA;
  return { facturas, limite };
}
