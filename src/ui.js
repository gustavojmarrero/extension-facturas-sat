// Panel de la extensión dentro del portal, en un Shadow DOM para no chocar con sus estilos.

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const ENLACE_PANEL = 'https://reporteagil.com/?utm_source=extension-facturas-sat&utm_medium=panel';
const ENLACE_PRIVACIDAD = 'https://reporteagil.com/extensiones/facturas-sat/privacidad';

const SIMBOLO =
  '<svg viewBox="0 0 100 118" width="18" height="21" aria-hidden="true"><path fill="#0b6bd3" d="M40 0H74.8A25.2 25.2 0 0 1 74.8 50.4H40Z"/><path fill="#0f8a74" d="M10 0H42.4A10 10 0 0 1 52.4 10V50H0V10A10 10 0 0 1 10 0Z"/><path fill="#fba822" d="M0 50H44L41 54L31.2 111.6H24C10.7 111.6 0 100.9 0 87.6Z"/><path fill="#0c1e55" stroke="#ffffff" stroke-width="5" stroke-linejoin="round" paint-order="stroke" d="M47.5 59.5L94 95.5L72 97.5L80 114.5L73.5 117.8L61.5 103L47.5 117.5Z"/></svg>';

const ESTILOS = `
:host { all: initial; }
.panel { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; width: 340px; max-width: calc(100vw - 32px);
  font: 13px/1.45 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; color: #0c1e55;
  background: #ffffff; border: 1px solid #d5dbe5; border-radius: 12px; box-shadow: 0 8px 28px rgba(12, 30, 85, .18); }
.cabeza { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #e3e7ee; }
.cabeza strong { font-size: 14px; }
.cabeza small { color: #4a5675; display: block; font-size: 11px; }
.cabeza .titulo { flex: 1; }
.plegar { background: none; border: 0; color: #4a5675; cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 6px; }
.plegar:hover { background: #eef1f6; }
.cuerpo { padding: 12px; display: grid; gap: 10px; min-width: 0; }
.plegado .cuerpo, .plegado .pie { display: none; }
.fila { display: flex; gap: 8px; }
label { display: grid; gap: 4px; font-weight: 600; flex: 1; }
select { font: inherit; color: inherit; border: 1px solid #d5dbe5; border-radius: 6px; padding: 6px 8px; background: #fff; }
.opciones { display: flex; flex-wrap: wrap; gap: 6px 14px; }
.opciones label { display: flex; align-items: center; gap: 6px; font-weight: 500; flex: none; }
button.accion { font: inherit; font-weight: 700; border: 0; border-radius: 6px; padding: 9px 12px; cursor: pointer; background: #0b6bd3; color: #fff; }
button.accion:hover { background: #0957ad; }
button.secundario { font: inherit; font-weight: 600; border: 1px solid #d5dbe5; border-radius: 6px; padding: 8px 12px; cursor: pointer; background: #fff; color: #0c1e55; }
button.secundario:hover { background: #eef1f6; }
button:disabled { opacity: .55; cursor: default; }
.botones { display: flex; flex-wrap: wrap; gap: 8px; }
.cifras { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.cifra { background: #f7f8fa; border: 1px solid #e3e7ee; border-radius: 6px; padding: 6px 8px; }
.cifra b { display: block; font-size: 16px; font-variant-numeric: tabular-nums; }
.cifra span { color: #4a5675; font-size: 11px; }
.mensaje { background: #eaf2fc; border-radius: 6px; padding: 8px; overflow-wrap: anywhere; }
p { margin: 0; }
.aviso { color: #4a5675; font-size: 12px; }
.pie { padding: 8px 12px 10px; border-top: 1px solid #e3e7ee; color: #4a5675; font-size: 11px; }
.pie a { color: #0b6bd3; font-weight: 600; }
.puntos { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.puntos li { position: relative; background: #f7f8fa; border: 1px solid #e3e7ee; border-radius: 6px; padding: 7px 10px 7px 28px; }
.puntos li::before { content: '✓'; position: absolute; left: 10px; top: 7px; color: #0b6bd3; font-weight: 800; }
.enlace { color: #0b6bd3; font-weight: 600; justify-self: start; }
.barra { height: 6px; background: #eef1f6; border-radius: 999px; overflow: hidden; }
.barra span { display: block; height: 100%; background: #0b6bd3; border-radius: 999px; transition: width .4s ease; }
.ruta { display: block; margin-top: 4px; font: 11px/1.45 ui-monospace, 'SFMono-Regular', Menlo, monospace; color: #4a5675; }
`;

function html(texto) {
  return String(texto).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

const numero = (n) => Number(n || 0).toLocaleString('es-MX');

// La ruta del Excel va aparte, en monoespaciada y con cortes en cada «/».
function mensajeHtml(texto) {
  return html(texto).replace(/Descargas\/(\S+?\.xlsx)\.?/, (_, ruta) => `<span class="ruta">Descargas/${ruta.replace(/\//g, '/<wbr>')}</span>`);
}

export function crearPanel({ tipo, avisoAceptado = false, alAceptarAviso = () => {}, alIniciar, alPausar, alContinuar, alExportar, alMostrar, alDescartar }) {
  const anfitrion = document.createElement('div');
  anfitrion.id = 'reporteagil-facturas-sat';
  const raiz = anfitrion.attachShadow({ mode: 'open' });
  raiz.innerHTML = `<style>${ESTILOS}</style><section class="panel" role="region" aria-label="Facturas SAT a Excel"></section>`;
  document.body.appendChild(anfitrion);
  const panel = raiz.querySelector('.panel');
  let plegado = false;
  const etiquetaTipo = tipo === 'emitidas' ? 'emitidas' : 'recibidas';

  function cabeza() {
    return `<header class="cabeza">${SIMBOLO}<div class="titulo"><strong>Facturas SAT a Excel</strong><small>de Reporte Ágil · facturas ${etiquetaTipo}</small></div>
      <button class="plegar" data-accion="plegar" aria-label="${plegado ? 'Mostrar' : 'Ocultar'} el panel">${plegado ? '▴' : '▾'}</button></header>`;
  }

  const pie = `<footer class="pie">No es una herramienta del SAT. Tus facturas se procesan en tu navegador y no se envían a ningún servidor. Más herramientas gratis en <a href="${ENLACE_PANEL}" target="_blank" rel="noopener">reporteagil.com</a>.</footer>`;

  // Aviso que se acepta una vez antes de la primera descarga (divulgación de datos de la
  // Chrome Web Store): qué lee la extensión, dónde lo deja y que nada sale del navegador.
  function aviso() {
    return `<div class="cuerpo">
      <p><b>Antes de empezar</b></p>
      <ul class="puntos">
        <li><b>Lee</b> la tabla de facturas del portal y, si lo pides, el XML y el PDF de cada una.</li>
        <li><b>Guarda</b> el Excel y los archivos en tu carpeta de Descargas, y el avance en este equipo.</li>
        <li><b>Nada sale de tu navegador:</b> no envía nada a Reporte Ágil ni a terceros y nunca ve tu contraseña ni tu e.firma.</li>
      </ul>
      <a class="enlace" href="${ENLACE_PRIVACIDAD}" target="_blank" rel="noopener">Política de privacidad</a>
      <button class="accion" data-accion="aceptar">Entendido, continuar</button>
    </div>`;
  }

  function formulario() {
    const hoy = new Date();
    const anios = [];
    for (let a = hoy.getFullYear(); a >= 2011; a--) anios.push(`<option value="${a}">${a}</option>`);
    const meses = MESES.map((m, i) => `<option value="${i + 1}" ${i === (hoy.getMonth() + 11) % 12 ? 'selected' : ''}>${m}</option>`).join('');
    return `<div class="cuerpo">
      <div class="fila">
        <label>Año<select name="anio">${anios.join('')}</select></label>
        <label>Mes<select name="mes">${meses}<option value="todos">Todo el año</option></select></label>
      </div>
      <div class="opciones">
        <label><input type="checkbox" name="excel" checked> Relación en Excel</label>
        <label><input type="checkbox" name="xml" checked> XML</label>
        <label><input type="checkbox" name="pdf" checked> PDF</label>
      </div>
      <p class="aviso">Si una consulta llega al tope de 500, se parte sola por día y por hora. El SAT permite 2,000 XML al día: si un periodo tiene más, se continúa al día siguiente.</p>
      <button class="accion" data-accion="iniciar">Descargar facturas ${etiquetaTipo}</button>
    </div>`;
  }

  function progreso(t) {
    const facturas = Object.keys(t.facturas).length;
    const archivos = Object.values(t.archivos);
    const xml = archivos.filter((a) => a.xml).length;
    const pdf = archivos.filter((a) => a.pdf).length;
    const periodo = t.meses.length === 1 ? `${MESES[t.meses[0] - 1]} ${t.anio}` : `${t.anio} completo`;
    const hechas = t.cobertura.length;
    const avance = t.estado === 'terminado' ? 100 : Math.round((hechas / Math.max(1, hechas + t.pendientes.length)) * 100);
    const botones = {
      corriendo: `<button class="secundario" data-accion="pausar">Pausar</button>`,
      pausado: `<button class="accion" data-accion="continuar">Continuar</button><button class="secundario" data-accion="exportar">Excel con lo avanzado</button><button class="secundario" data-accion="descartar">Nueva consulta</button>`,
      faltan: `<button class="accion" data-accion="continuar">Continuar descargas</button><button class="secundario" data-accion="mostrar">Ver en Descargas</button><button class="secundario" data-accion="descartar">Nueva consulta</button>`,
      terminado: `<button class="secundario" data-accion="mostrar">Ver en Descargas</button><button class="secundario" data-accion="exportar">Excel otra vez</button><button class="accion" data-accion="descartar">Nueva consulta</button>`,
    }[t.estado] || '';
    return `<div class="cuerpo">
      <div><b>${html(periodo)}</b> · ${t.tipo === 'emitidas' ? 'emitidas' : 'recibidas'}</div>
      <div class="cifras">
        <div class="cifra"><b>${numero(facturas)}</b><span>facturas encontradas</span></div>
        <div class="cifra"><b>${numero(t.consultas)}</b><span>consultas · ${numero(t.pendientes.length)} por hacer</span></div>
        ${t.opciones.xml ? `<div class="cifra"><b>${numero(xml)}</b><span>XML descargados</span></div>` : ''}
        ${t.opciones.pdf ? `<div class="cifra"><b>${numero(pdf)}</b><span>PDF descargados</span></div>` : ''}
      </div>
      <div class="barra" role="progressbar" aria-label="Avance de las consultas" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${avance}"><span style="width:${avance}%"></span></div>
      <div class="mensaje" aria-live="polite">${mensajeHtml(t.mensaje || '')}</div>
      <div class="botones">${botones}</div>
    </div>`;
  }

  function otroTipo(t) {
    const pagina = t.tipo === 'emitidas' ? 'Consultar Facturas Emitidas' : 'Consultar Facturas Recibidas';
    return `<div class="cuerpo"><p>Tienes una descarga de facturas ${t.tipo === 'emitidas' ? 'emitidas' : 'recibidas'} sin terminar. Para continuarla, abre «${pagina}» en el portal.</p>
      <div class="botones"><button class="secundario" data-accion="descartar">Descartarla y empezar aquí</button></div></div>`;
  }

  let actual = null;
  let vista = '';
  function pintar(trabajo) {
    actual = trabajo;
    panel.classList.toggle('plegado', plegado);
    const clave = !trabajo ? (avisoAceptado ? 'formulario' : 'aviso') : trabajo.tipo !== tipo ? 'otro' : `progreso:${trabajo.estado}`;
    if (clave === vista && clave.startsWith('progreso')) {
      // Mientras avanza solo cambian las cifras y el mensaje: los botones se quedan quietos
      // para que un clic en «Pausar» no caiga en un botón que se acaba de reemplazar.
      const nuevo = document.createElement('div');
      nuevo.innerHTML = progreso(trabajo);
      for (const sel of ['.cifras', '.barra', '.mensaje']) panel.querySelector(sel).replaceWith(nuevo.querySelector(sel));
      return;
    }
    vista = clave;
    const cuerpo = !trabajo ? (avisoAceptado ? formulario() : aviso()) : trabajo.tipo !== tipo ? otroTipo(trabajo) : progreso(trabajo);
    panel.innerHTML = cabeza() + cuerpo + pie;
  }

  panel.addEventListener('click', (e) => {
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    if (!accion) return;
    if (accion === 'plegar') {
      plegado = !plegado;
      vista = '';
      return pintar(actual);
    }
    if (accion === 'aceptar') {
      avisoAceptado = true;
      alAceptarAviso();
      return pintar(actual);
    }
    if (accion === 'iniciar') {
      const anio = Number(panel.querySelector('[name=anio]').value);
      const mes = panel.querySelector('[name=mes]').value;
      const opciones = Object.fromEntries(['excel', 'xml', 'pdf'].map((n) => [n, panel.querySelector(`[name=${n}]`).checked]));
      if (!opciones.excel && !opciones.xml && !opciones.pdf) return;
      const meses = mes === 'todos' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [Number(mes)];
      return alIniciar({ anio, meses, opciones });
    }
    ({ pausar: alPausar, continuar: alContinuar, exportar: alExportar, mostrar: alMostrar, descartar: alDescartar })[accion]?.();
  });

  return { pintar };
}
