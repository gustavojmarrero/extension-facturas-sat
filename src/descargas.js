// Descarga el XML y el PDF de una factura con la sesión abierta, por el mismo camino que usa el
// portal al pulsar sus botones: primero ValidarDescarga (que lleva la cuenta de la cuota diaria)
// y después el archivo. Nada se envía fuera del portal.

import { METODOS } from './portal.js';
import { esXmlDeCfdi } from './xml.js';

export class SesionCerrada extends Error {}
export class DescargaNoPermitida extends Error {}

async function metodo(pagina, nombre, cuerpo) {
  const r = await fetch(`/${pagina}/${nombre}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(cuerpo),
  });
  if (r.status === 401 || r.redirected) throw new SesionCerrada('La sesión del SAT se cerró.');
  if (!r.ok) throw new Error(`El portal respondió ${r.status} en ${nombre}.`);
  const json = await r.json().catch(() => null);
  if (!json) throw new SesionCerrada('El portal no respondió como se esperaba; quizá se cerró la sesión.');
  return json.d ?? json;
}

async function validar(pagina, nombre) {
  const v = await metodo(pagina, nombre, { id: 1 });
  if (v && v.Codigo !== 0) throw new DescargaNoPermitida(v.Mensaje || 'El portal no permitió más descargas por hoy.');
}

export async function bajarXml(pagina, factura) {
  if (!factura.urlXml) throw new Error('La fila no trae enlace de descarga del XML.');
  await validar(pagina, METODOS.validarXml);
  const r = await fetch(new URL(factura.urlXml, location.href), { credentials: 'include' });
  const texto = await r.text();
  if (!esXmlDeCfdi(texto)) {
    if (/<html/i.test(texto)) throw new SesionCerrada('El portal devolvió una página en lugar del XML; quizá se cerró la sesión.');
    throw new Error('El portal no devolvió un XML válido.');
  }
  return texto;
}

export async function bajarPdf(pagina, factura) {
  if (!factura.datosPdf) throw new Error('La fila no trae enlace de la representación impresa.');
  await validar(pagina, METODOS.validarPdf);
  const url = await metodo(pagina, METODOS.urlPdf, { datos: factura.datosPdf });
  if (typeof url !== 'string' || !url) throw new Error('El portal no devolvió el enlace del PDF.');
  const r = await fetch(new URL(url, location.href), { credentials: 'include' });
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
    throw new Error('El portal no devolvió un PDF.');
  }
  return bytes;
}

export function mantenerSesion() {
  return fetch(METODOS.mantenerSesion, { credentials: 'include', cache: 'no-store' })
    .then((r) => {
      if (r.status === 401) throw new SesionCerrada('La sesión del SAT se cerró.');
      return true;
    });
}

// data: URL para que el service worker lo guarde con chrome.downloads.
export function aDataUrl(contenido, tipoMime) {
  const bytes = typeof contenido === 'string' ? new TextEncoder().encode(contenido) : contenido;
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${tipoMime};base64,${btoa(binario)}`;
}
