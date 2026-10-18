// Estado de un CFDI en el servicio público de verificación del SAT (ConsultaCFDIService, SOAP):
// vigente, cancelado o no encontrado, si se puede cancelar, cómo va su cancelación y si el emisor
// está en la lista de EFOS. Solo se envía la expresión impresa del CFDI: UUID, RFC del emisor y del
// receptor, total y los últimos 8 caracteres del sello. Sin dependencias de chrome.* para probarlo
// en Node: fetch y las esperas se pueden reemplazar.

import { sinEntidades } from './xml.js';
import { esperar as esperarMs } from './cola.js';

export const SERVICIO_SAT = 'https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc';
// Patrón del permiso de host opcional (optional_host_permissions del manifiesto).
export const PERMISO_SAT = 'https://consultaqr.facturaelectronica.sat.gob.mx/*';
const ACCION_SOAP = 'http://tempuri.org/IConsultaCFDIService/Consulta';
const VERIFICADOR = 'https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx';

export class Detenido extends Error {}

export class ErrorConsulta extends Error {
  constructor(mensaje, reintentable = false) {
    super(mensaje);
    this.reintentable = reintentable;
  }
}

// El CFDI 3.2 (y anteriores) usa la expresión corta de su código QR; 3.3 y 4.0, la URL del verificador.
const esAntigua = (version) => Number(version) > 0 && Number(version) < 3.3;

// El total se arma como texto, sin pasar por un número de punto flotante:
// 3.2 → 17 caracteres con ceros a la izquierda y 6 decimales (0000001160.500000);
// 3.3 y 4.0 → sin ceros sobrantes a la derecha, con al menos un decimal (1160.5, 1000.0).
export function totalParaExpresion(total, version) {
  const texto = String(total ?? '').trim();
  let m = /^(\d*)(?:\.(\d*))?$/.exec(texto);
  if (!m || !(m[1] || m[2])) return null;
  if ((m[2] || '').length > 6) m = /^(\d+)\.(\d+)$/.exec(Number(texto).toFixed(6));
  const enteros = m[1].replace(/^0+(?=\d)/, '') || '0';
  const decimales = (m[2] || '').padEnd(6, '0');
  if (esAntigua(version)) return `${enteros.padStart(10, '0')}.${decimales}`;
  return `${enteros}.${decimales.replace(/0+$/, '') || '0'}`;
}

// Lo que le falta al XML para armar la expresión ('' si está completo).
export function faltaParaConsultar(d) {
  const faltan = [];
  if (!d.uuid) faltan.push('el folio fiscal (UUID) del timbre');
  if (!d.rfcEmisor) faltan.push('el RFC del emisor');
  if (!d.rfcReceptor) faltan.push('el RFC del receptor');
  if (totalParaExpresion(d.total, d.version) === null) faltan.push('el total');
  return faltan.length ? `Le falta ${faltan.join(', ')}.` : '';
}

// Un «&» dentro de un RFC va como «&amp;» en la expresión (la expresión entera se vuelve a
// escapar al meterla en el cuerpo SOAP).
const rfc = (texto) => texto.replace(/&/g, '&amp;');

export function expresionImpresa(d) {
  const tt = totalParaExpresion(d.total, d.version);
  if (esAntigua(d.version)) return `?re=${rfc(d.rfcEmisor)}&rr=${rfc(d.rfcReceptor)}&tt=${tt}&id=${d.uuid}`;
  return `${VERIFICADOR}?id=${d.uuid}&re=${rfc(d.rfcEmisor)}&rr=${rfc(d.rfcReceptor)}&tt=${tt}&fe=${(d.sello || '').slice(-8)}`;
}

const escaparXml = (texto) => texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Sin escapar los «&» de la expresión, el servicio responde 500.
export function cuerpoSoap(expresion) {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">' +
    `<soap:Body><tem:Consulta><tem:expresionImpresa>${escaparXml(expresion)}</tem:expresionImpresa></tem:Consulta></soap:Body>` +
    '</soap:Envelope>'
  );
}

// Valor de un elemento de la respuesta; null si no viene. <a:EstatusCancelacion i:nil="true"/> → ''.
function elemento(texto, nombre) {
  const m = new RegExp(`<(?:[\\w-]+:)?${nombre}\\b[^>]*?(?:/>|>([\\s\\S]*?)</(?:[\\w-]+:)?${nombre}>)`).exec(texto);
  return m ? sinEntidades(m[1] ?? '').trim() : null;
}

// Los valores quedan tal como los devuelve el SAT.
export function leerRespuesta(texto) {
  const codigoEstatus = elemento(texto, 'CodigoEstatus');
  if (codigoEstatus === null) {
    const falla = elemento(texto, 'faultstring');
    if (falla) throw new ErrorConsulta(`El SAT respondió con un error: ${falla}`, true);
    throw new ErrorConsulta('El SAT no respondió como se esperaba.', true);
  }
  return {
    codigoEstatus,
    estado: elemento(texto, 'Estado') ?? '',
    esCancelable: elemento(texto, 'EsCancelable') ?? '',
    estatusCancelacion: elemento(texto, 'EstatusCancelacion') ?? '',
    validacionEfos: elemento(texto, 'ValidacionEFOS') ?? '',
  };
}

const dos = (n) => String(n).padStart(2, '0');
// Hora local «aaaa-mm-ddThh:mm:ss», como las fechas del Excel.
export const fechaHora = (d) =>
  `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;

async function unaConsulta(hacerFetch, cuerpo, limiteMs, senal) {
  const control = new AbortController();
  const cortar = () => control.abort();
  const reloj = setTimeout(cortar, limiteMs);
  senal?.addEventListener('abort', cortar);
  let respuesta;
  let texto;
  try {
    respuesta = await hacerFetch(SERVICIO_SAT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"${ACCION_SOAP}"` },
      body: cuerpo,
      credentials: 'omit',
      cache: 'no-store',
      signal: control.signal,
    });
    texto = await respuesta.text();
  } catch {
    if (senal?.aborted) throw new Detenido('Se detuvo.');
    throw new ErrorConsulta(control.signal.aborted ? `El SAT no respondió en ${limiteMs / 1000} s.` : 'No hubo conexión con el servicio del SAT.', true);
  } finally {
    clearTimeout(reloj);
    senal?.removeEventListener('abort', cortar);
  }
  if (respuesta.status >= 500 || respuesta.status === 429) {
    const falla = elemento(texto, 'faultstring');
    throw new ErrorConsulta(`El SAT respondió ${respuesta.status}${falla ? `: ${falla}` : ''}.`, true);
  }
  if (!respuesta.ok) throw new ErrorConsulta(`El SAT respondió ${respuesta.status}.`);
  return leerRespuesta(texto);
}

// Consulta un CFDI. Ante un error de red, un tiempo agotado, un 5xx o un 429 lo vuelve a intentar
// con una espera que se duplica (2 s, 4 s…), hasta `intentos` veces. Una respuesta del SAT, aunque
// diga «No encontrado», no se reintenta. La señal corta las esperas y la petición en curso.
export async function consultarCfdi(datos, { fetch: hacerFetch = (...a) => fetch(...a), esperar = esperarMs, intentos = 3, espera = 2000, limiteMs = 30000, senal, ahora = () => new Date() } = {}) {
  const cuerpo = cuerpoSoap(expresionImpresa(datos));
  for (let intento = 1; ; intento++) {
    if (senal?.aborted) throw new Detenido('Se detuvo.');
    try {
      const respuesta = await unaConsulta(hacerFetch, cuerpo, limiteMs, senal);
      return { ...respuesta, consultado: fechaHora(ahora()), intentos: intento };
    } catch (e) {
      if (e instanceof Detenido || senal?.aborted) throw new Detenido('Se detuvo.');
      if (!e.reintentable || intento >= intentos) {
        const error = new ErrorConsulta(intento > 1 ? `${e.message} (${intento} intentos)` : e.message);
        error.intentos = intento;
        error.consultado = fechaHora(ahora());
        throw error;
      }
      await esperar(espera * 2 ** (intento - 1), senal);
    }
  }
}

const llano = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

// 'vigente', 'cancelado', 'no-encontrado' u 'otro', para los colores y las cifras de la página.
export function claseDeEstado(r) {
  const estado = llano(r?.estado);
  if (estado === 'vigente') return 'vigente';
  if (estado === 'cancelado') return 'cancelado';
  if (estado === 'no encontrado' || /^n\s*-\s*60[12]/i.test(r?.codigoEstatus || '')) return 'no-encontrado';
  return 'otro';
}

const CANCELABLE = {
  'cancelable con aceptacion': 'Para cancelarla, el emisor necesita que el receptor lo acepte.',
  'cancelable sin aceptacion': 'El emisor puede cancelarla sin pedir aceptación.',
  'no cancelable': 'Ya no se puede cancelar.',
};

const CANCELACION = {
  'en proceso': 'Tiene una solicitud de cancelación esperando la respuesta del receptor.',
  'solicitud rechazada': 'El receptor rechazó la solicitud de cancelación.',
  'plazo vencido': 'Se canceló porque el receptor no respondió en el plazo.',
  'cancelado con aceptacion': 'Se canceló con la aceptación del receptor.',
  'cancelado sin aceptacion': 'Se canceló sin necesitar aceptación.',
};

// Lectura en claro de la respuesta, para la tabla y el Excel.
export function lectura(r) {
  const partes = [];
  const clase = claseDeEstado(r);
  const codigo = (/^\s*n\s*-\s*(\d{3})/i.exec(r.codigoEstatus || '') || [])[1];
  if (clase === 'vigente') partes.push('Vigente: el SAT la tiene registrada y sin cancelar.');
  else if (clase === 'cancelado') partes.push('Cancelada ante el SAT: ya no tiene efectos fiscales.');
  else if (codigo === '601') partes.push('Los datos del XML (RFC o total) no coinciden con los del SAT: el archivo pudo modificarse.');
  else if (clase === 'no-encontrado') partes.push('El SAT no encontró este folio fiscal: puede ser falso o haberse timbrado hace muy poco.');
  else partes.push(`Respuesta del SAT: ${r.codigoEstatus || 'sin código'}.`);
  if (clase === 'vigente' && CANCELABLE[llano(r.esCancelable)]) partes.push(CANCELABLE[llano(r.esCancelable)]);
  if (CANCELACION[llano(r.estatusCancelacion)]) partes.push(CANCELACION[llano(r.estatusCancelacion)]);
  if (r.validacionEfos === '100') partes.push('Atención: el emisor está en la lista de EFOS del SAT (empresas que facturan operaciones simuladas).');
  else if (r.validacionEfos === '200') partes.push('El emisor no está en la lista de EFOS.');
  return partes.join(' ');
}
