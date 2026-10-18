// Página del validador (validar.html). Lee en el navegador los XML que el usuario suelta o elige,
// consulta el estado de cada CFDI en el servicio público del SAT, de dos en dos y con pausas, y
// exporta el resultado a Excel. La lista vive solo en esta pestaña: no se guarda en el equipo.

import { datosParaValidar, esXmlDeCfdi } from './xml.js';
import { consultarCfdi, faltaParaConsultar, claseDeEstado, fechaHora, PERMISO_SAT, Detenido } from './verificacion.js';
import { correrCola } from './cola.js';
import { hojasDeValidacion, cifrasDeValidacion, lecturaDeFila } from './reporte-validacion.js';
import { libro } from './xlsx.js';
import { aDataUrl } from './descargas.js';
import { PAUSA_VALIDACION_MS, ESPERA_REINTENTO_MS } from './config.js';

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const TAMANO_MAXIMO = 25 * 1024 * 1024;

const $ = (id) => document.getElementById(id);
const filas = []; // { id, archivo, datos, problema, estado, resultado, error, consultado }
const vistos = new Set(); // UUID en mayúsculas, para no consultar dos veces el mismo CFDI
let repetidos = 0;
let leyendo = false;
let control = null; // AbortController de la validación en curso
let avance = { hechos: 0, total: 0 };
let permisoConcedido = false;

function html(texto) {
  return String(texto ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

const numero = (n) => Number(n || 0).toLocaleString('es-MX');
const porConsultar = () => filas.filter((f) => f.estado === 'pendiente' || f.estado === 'error');

function mensaje(texto, ruta) {
  $('mensaje').innerHTML = html(texto) + (ruta ? `<br><span class="ruta">${html(ruta).replace(/\//g, '/<wbr>')}</span>` : '');
}

// ---------- Archivos ----------

// Recorre una carpeta soltada (FileSystemEntry); readEntries entrega los archivos por lotes.
async function recorrer(entrada) {
  if (entrada.isFile) {
    const archivo = await new Promise((resolver, rechazar) => entrada.file(resolver, rechazar));
    return [{ archivo, ruta: entrada.fullPath.replace(/^\//, '') }];
  }
  if (!entrada.isDirectory) return [];
  const lector = entrada.createReader();
  const lista = [];
  for (;;) {
    const lote = await new Promise((resolver, rechazar) => lector.readEntries(resolver, rechazar));
    if (!lote.length) return lista;
    for (const e of lote) lista.push(...(await recorrer(e)));
  }
}

async function agregar(entradas) {
  const xml = entradas.filter((e) => /\.xml$/i.test(e.archivo.name));
  const otros = entradas.length - xml.length;
  if (!xml.length) {
    mensaje(otros ? 'Ninguno de esos archivos es un XML.' : 'No se encontraron archivos.');
    return;
  }
  leyendo = true;
  pintarControles();
  const nuevas = [];
  let repetidosAhora = 0;
  for (const [i, { archivo, ruta }] of xml.entries()) {
    if (i % 50 === 0) mensaje(`Leyendo ${numero(i)} de ${numero(xml.length)} archivos…`);
    const fila = { id: filas.length + nuevas.length, archivo: ruta, datos: null, problema: '', estado: 'pendiente', resultado: null, error: '' };
    try {
      if (archivo.size > TAMANO_MAXIMO) throw new Error('El archivo pesa más de 25 MB.');
      const texto = await archivo.text();
      if (!esXmlDeCfdi(texto)) throw new Error('No es un CFDI.');
      fila.datos = datosParaValidar(texto);
      const falta = faltaParaConsultar(fila.datos);
      if (falta) throw new Error(falta);
      const clave = fila.datos.uuid.toUpperCase();
      if (vistos.has(clave)) {
        repetidosAhora++;
        continue;
      }
      vistos.add(clave);
    } catch (e) {
      fila.problema = e.message;
      fila.estado = 'omitido';
    }
    nuevas.push(fila);
  }
  filas.push(...nuevas);
  repetidos += repetidosAhora;
  leyendo = false;
  $('filas').insertAdjacentHTML('beforeend', nuevas.map(filaHtml).join(''));
  const partes = [`Se agregaron ${numero(nuevas.length)} XML.`];
  if (repetidosAhora) partes.push(`${numero(repetidosAhora)} repetidos (mismo UUID) se omitieron.`);
  const omitidos = nuevas.filter((f) => f.problema).length;
  if (omitidos) partes.push(`${numero(omitidos)} no se pueden consultar: revisa la columna Lectura.`);
  if (otros) partes.push(`${numero(otros)} archivos que no son XML se ignoraron.`);
  mensaje(partes.join(' '));
  pintarControles();
}

// ---------- Tabla y cifras ----------

function estadoHtml(f) {
  if (f.resultado) return `<span class="estado ${claseDeEstado(f.resultado)}">${html(f.resultado.estado || 'Sin estado')}</span>`;
  const textos = { pendiente: 'Pendiente', consultando: 'Consultando…', error: 'Sin respuesta', omitido: 'No se consultó' };
  return `<span class="estado ${f.estado === 'error' ? 'error' : ''}">${textos[f.estado]}</span>`;
}

function filaHtml(f) {
  const d = f.datos || {};
  const r = f.resultado || {};
  const total = d.total ? Number(d.total).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '';
  const consultado = r.consultado || f.consultado || '';
  return `<tr id="f${f.id}">
    <td class="archivo">${html(f.archivo)}</td>
    <td class="uuid">${html(d.uuid)}</td>
    <td class="emisor"><span class="rfc">${html(d.rfcEmisor)}</span><small>${html(d.nombreEmisor)}</small></td>
    <td class="rfc">${html(d.rfcReceptor)}</td>
    <td class="fecha">${html((d.fecha || '').replace('T', ' '))}</td>
    <td class="total">${html(total)}</td>
    <td>${estadoHtml(f)}</td>
    <td class="sat">${html(r.codigoEstatus)}</td>
    <td class="sat">${html(r.esCancelable)}</td>
    <td class="sat">${html(r.estatusCancelacion)}</td>
    <td class="${r.validacionEfos === '100' ? 'efos-100' : ''}">${html(r.validacionEfos)}</td>
    <td class="lectura">${f.estado === 'pendiente' || f.estado === 'consultando' ? '' : html(lecturaDeFila(f))}</td>
    <td class="hora">${html(consultado.replace('T', ' '))}</td>
  </tr>`;
}

function pintarFila(f) {
  const tr = $(`f${f.id}`);
  if (tr) tr.outerHTML = filaHtml(f);
}

let cuadroPendiente = false;
function pintarControles() {
  if (cuadroPendiente) return;
  cuadroPendiente = true;
  requestAnimationFrame(() => {
    cuadroPendiente = false;
    const c = cifrasDeValidacion(filas);
    const cifra = (n, texto, alerta = false) => `<div class="cifra${alerta && n ? ' alerta' : ''}"><b>${numero(n)}</b><span>${texto}</span></div>`;
    $('cifras').innerHTML =
      cifra(c.archivos, 'XML en la lista') + cifra(c.vigentes, 'vigentes') + cifra(c.cancelados, 'cancelados', true) +
      cifra(c.noEncontrados, 'no encontrados', true) + cifra(c.efos, 'emisor en lista de EFOS', true) + cifra(c.sinRespuesta, 'sin respuesta o sin consultar');
    const pct = avance.total ? Math.round((avance.hechos / avance.total) * 100) : c.consultados && !c.pendientes ? 100 : 0;
    $('barra').firstElementChild.style.width = `${pct}%`;
    $('barra').setAttribute('aria-valuenow', String(pct));
    const corriendo = !!control;
    const pendientes = porConsultar().length;
    $('validar').disabled = corriendo || leyendo || !pendientes;
    $('validar').textContent = `${permisoConcedido ? 'Validar' : 'Permitir y validar'}${pendientes ? ` ${numero(pendientes)} CFDI` : ''}`;
    $('detener').hidden = !corriendo;
    $('exportar').disabled = corriendo || !filas.length;
    $('limpiar').disabled = corriendo || leyendo || !filas.length;
    $('elegirArchivos').disabled = $('elegirCarpeta').disabled = corriendo || leyendo;
    $('notaPermiso').hidden = permisoConcedido;
  });
}

// ---------- Validación ----------

async function validar(permiso) {
  if (!permisoConcedido) mensaje('Esperando el permiso de Chrome para consultar al SAT…');
  permisoConcedido = await permiso.catch(() => false);
  if (!permisoConcedido) {
    mensaje('Sin ese permiso no se puede consultar al SAT. Pulsa el botón otra vez y elige «Permitir».');
    pintarControles();
    return;
  }
  const lista = porConsultar();
  control = new AbortController();
  const senal = control.signal;
  avance = { hechos: 0, total: lista.length };
  for (const f of lista) {
    f.estado = 'pendiente';
    f.error = '';
    pintarFila(f);
  }
  mensaje(`Consultando ${numero(lista.length)} CFDI en el SAT…`);
  pintarControles();
  await correrCola(
    lista,
    async (f) => {
      f.estado = 'consultando';
      pintarFila(f);
      try {
        f.resultado = await consultarCfdi(f.datos, { senal, espera: ESPERA_REINTENTO_MS });
        f.estado = 'listo';
      } catch (e) {
        if (e instanceof Detenido) f.estado = 'pendiente';
        else {
          f.estado = 'error';
          f.error = e.message;
          f.consultado = e.consultado;
        }
      }
      if (f.estado !== 'pendiente') avance.hechos++;
      pintarFila(f);
      if (!senal.aborted) mensaje(`Consultando… ${numero(avance.hechos)} de ${numero(avance.total)}.`);
      pintarControles();
    },
    { concurrencia: 2, pausa: PAUSA_VALIDACION_MS, senal },
  );
  control = null;
  const c = cifrasDeValidacion(filas);
  const errores = filas.filter((f) => f.estado === 'error').length;
  if (senal.aborted) mensaje(`Detenido: ${numero(avance.hechos)} de ${numero(avance.total)} consultados. Pulsa Validar para seguir con los que faltan.`);
  else {
    const partes = [`Listo: ${numero(c.vigentes)} vigentes, ${numero(c.cancelados)} cancelados y ${numero(c.noEncontrados)} no encontrados.`];
    if (c.efos) partes.push(`${numero(c.efos)} con el emisor en la lista de EFOS.`);
    if (errores) partes.push(`${numero(errores)} sin respuesta del SAT: pulsa Validar para reintentarlos.`);
    mensaje(partes.join(' '));
  }
  avance = { hechos: 0, total: 0 };
  pintarControles();
}

async function exportar() {
  const ahora = new Date();
  const ruta = `SAT/Validaciones/Validacion_CFDI_${fechaHora(ahora).replace('T', '_').replace(/:/g, '-')}.xlsx`;
  try {
    const bytes = libro(hojasDeValidacion(filas, { repetidos, ahora }));
    const r = await chrome.runtime.sendMessage({ tipo: 'guardar', ruta, url: aDataUrl(bytes, MIME_XLSX), visible: true });
    if (!r?.ok) throw new Error(r?.error || 'Chrome no guardó el archivo.');
    mensaje('Excel en Descargas:', ruta);
    $('mostrar').hidden = false;
  } catch (e) {
    mensaje(`No se pudo crear el Excel: ${e.message}`);
  }
}

// ---------- Eventos ----------

$('validar').addEventListener('click', () => {
  if (control || leyendo || !porConsultar().length) return;
  // Tiene que ser lo primero del clic, sin ningún await antes: Chrome solo muestra su aviso de
  // permiso dentro del gesto del usuario. Si el permiso ya está concedido, resuelve true sin preguntar.
  const permiso = chrome.permissions.request({ origins: [PERMISO_SAT] });
  validar(permiso);
});
$('detener').addEventListener('click', () => {
  control?.abort();
  mensaje('Deteniendo…');
});
$('exportar').addEventListener('click', exportar);
$('mostrar').addEventListener('click', () => chrome.runtime.sendMessage({ tipo: 'mostrar' }));
$('limpiar').addEventListener('click', () => {
  if (control) return;
  filas.length = 0;
  vistos.clear();
  repetidos = 0;
  $('filas').innerHTML = '';
  $('mostrar').hidden = true;
  mensaje('');
  pintarControles();
});

$('elegirArchivos').addEventListener('click', () => $('archivos').click());
$('elegirCarpeta').addEventListener('click', () => $('carpeta').click());
for (const id of ['archivos', 'carpeta']) {
  $(id).addEventListener('change', (e) => {
    const entradas = [...e.target.files].map((archivo) => ({ archivo, ruta: archivo.webkitRelativePath || archivo.name }));
    e.target.value = '';
    agregar(entradas);
  });
}

const zona = $('zona');
for (const tipo of ['dragenter', 'dragover']) {
  zona.addEventListener(tipo, (e) => {
    e.preventDefault();
    zona.classList.add('encima');
  });
}
zona.addEventListener('dragleave', (e) => {
  if (!zona.contains(e.relatedTarget)) zona.classList.remove('encima');
});
zona.addEventListener('drop', async (e) => {
  e.preventDefault();
  zona.classList.remove('encima');
  if (control || leyendo) return;
  // Las entradas se toman durante el evento: después de un await el DataTransfer ya no las da.
  const items = [...(e.dataTransfer?.items || [])].filter((i) => i.kind === 'file');
  const entradas = items.map((i) => i.webkitGetAsEntry?.());
  const sueltos = entradas.some((x) => x) ? [] : [...(e.dataTransfer?.files || [])].map((archivo) => ({ archivo, ruta: archivo.name }));
  const lista = [...sueltos];
  for (const entrada of entradas) if (entrada) lista.push(...(await recorrer(entrada)));
  agregar(lista);
});
// Soltar un archivo fuera de la zona no debe abrirlo en la pestaña.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

chrome.permissions.contains({ origins: [PERMISO_SAT] }).then((concedido) => {
  permisoConcedido = concedido;
  pintarControles();
});
pintarControles();
