// Guarda en la carpeta de Descargas los archivos que arma el script de contenido (data: URL),
// en SAT/<RFC>/... Los XML y PDF se quitan de la lista de descargas de Chrome al terminar
// (el archivo se queda en disco) para no llenarla con miles de entradas; el Excel se queda visible.

import { PRUEBAS } from './config.js';

const ESPERA_MS = 60000;

function esperarFin(id) {
  return new Promise((resolver, rechazar) => {
    let listo = false;
    const terminar = (estado, error) => {
      if (listo) return;
      listo = true;
      clearTimeout(reloj);
      chrome.downloads.onChanged.removeListener(oyente);
      if (estado === 'interrupted') rechazar(new Error(error || 'La descarga se interrumpió.'));
      else resolver();
    };
    const reloj = setTimeout(() => terminar('complete'), ESPERA_MS);
    function oyente(cambio) {
      if (cambio.id === id && cambio.state && cambio.state.current !== 'in_progress') {
        terminar(cambio.state.current, cambio.error?.current);
      }
    }
    chrome.downloads.onChanged.addListener(oyente);
    // Un data: URL puede terminar antes de que se registre el oyente.
    chrome.downloads.search({ id }).then(([d]) => {
      if (d && d.state !== 'in_progress') terminar(d.state, d.error);
    });
  });
}

async function guardar({ ruta, url, visible }) {
  const id = await chrome.downloads.download({ url, filename: ruta, conflictAction: 'overwrite', saveAs: false });
  await esperarFin(id);
  if (PRUEBAS) await anotarParaPruebas(ruta, url);
  else if (!visible) await chrome.downloads.erase({ id });
  if (visible) await chrome.storage.local.set({ ultimaDescargaVisible: id });
  return id;
}

// Solo en el paquete de pruebas: deja la lista de archivos (y el Excel) para revisarlos.
async function anotarParaPruebas(ruta, url) {
  const { 'pruebas:guardados': lista = [] } = await chrome.storage.local.get('pruebas:guardados');
  lista.push({ ruta, url: ruta.endsWith('.xlsx') ? url : undefined });
  await chrome.storage.local.set({ 'pruebas:guardados': lista });
}

// «Ver en Descargas»: muestra el último Excel en la carpeta, o la carpeta de Descargas.
async function mostrar() {
  const { ultimaDescargaVisible: id } = await chrome.storage.local.get('ultimaDescargaVisible');
  const [d] = id ? await chrome.downloads.search({ id }) : [];
  if (d && d.exists !== false && d.state === 'complete') chrome.downloads.show(id);
  else chrome.downloads.showDefaultFolder();
}

// El ícono de la extensión y el enlace del panel abren el validador, o lo traen al frente si ya
// está abierto (getContexts ve las páginas propias sin el permiso «tabs»).
async function abrirValidador() {
  const url = chrome.runtime.getURL('validar.html');
  const [abierta] = (await chrome.runtime.getContexts?.({ contextTypes: ['TAB'], documentUrls: [url] })) || [];
  if (abierta?.tabId >= 0) {
    await chrome.tabs.update(abierta.tabId, { active: true });
    if (abierta.windowId >= 0) await chrome.windows.update(abierta.windowId, { focused: true });
  } else await chrome.tabs.create({ url });
}

chrome.action.onClicked.addListener(() => abrirValidador());

chrome.runtime.onMessage.addListener((mensaje, _remitente, responder) => {
  if (mensaje?.tipo === 'abrirValidador') {
    abrirValidador().then(() => responder({ ok: true }), (e) => responder({ ok: false, error: e.message }));
    return true;
  }
  if (mensaje?.tipo === 'mostrar') {
    mostrar().then(() => responder({ ok: true }));
    return true;
  }
  if (mensaje?.tipo !== 'guardar') return false;
  guardar(mensaje)
    .then((id) => responder({ ok: true, id }))
    .catch((e) => responder({ ok: false, error: e.message }));
  return true;
});
