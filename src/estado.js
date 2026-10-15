// Lo que se guarda en chrome.storage.local, solo en este equipo: el trabajo en curso (para
// reanudarlo si se cierra la sesión o se acaba la cuota) y la cuenta de descargas del día por RFC.
// No se guardan los enlaces del portal, que son de un solo uso.

const CLAVE_TRABAJO = 'trabajo';

export function fechaLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function leerTrabajo() {
  const r = await chrome.storage.local.get(CLAVE_TRABAJO);
  return r[CLAVE_TRABAJO] || null;
}

export async function guardarTrabajo(trabajo) {
  await chrome.storage.local.set({ [CLAVE_TRABAJO]: trabajo });
}

export async function borrarTrabajo() {
  await chrome.storage.local.remove(CLAVE_TRABAJO);
}

export async function leerCuota(rfc, hoy = fechaLocal()) {
  const clave = `cuota:${rfc}`;
  const c = (await chrome.storage.local.get(clave))[clave];
  return c && c.fecha === hoy ? c : { fecha: hoy, xml: 0, pdf: 0, agotadaXml: false, agotadaPdf: false };
}

export async function guardarCuota(rfc, cuota) {
  await chrome.storage.local.set({ [`cuota:${rfc}`]: cuota });
}
