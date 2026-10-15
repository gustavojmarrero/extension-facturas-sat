// Guarda en la carpeta de Descargas los archivos que arma el script de contenido (data: URL),
// en SAT/<RFC>/... Los XML y PDF se quitan de la lista de descargas de Chrome al terminar
// (el archivo se queda en disco) para no llenarla con miles de entradas; el Excel se queda visible.

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
  if (!visible) await chrome.downloads.erase({ id });
  return id;
}

chrome.runtime.onMessage.addListener((mensaje, _remitente, responder) => {
  if (mensaje?.tipo !== 'guardar') return false;
  guardar(mensaje)
    .then((id) => responder({ ok: true, id }))
    .catch((e) => responder({ ok: false, error: e.message }));
  return true;
});
