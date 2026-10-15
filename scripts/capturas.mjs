// Capturas de la ficha de la Chrome Web Store (1280×800) y mosaico promocional (440×280), con la
// extensión publicable (dist/) sobre el portal simulado de e2e/ y datos inventados.
// Uso: node scripts/build.mjs && node scripts/capturas.mjs
import { chromium } from '@playwright/test';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, openSync, readSync, closeSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { montar, facturas, ORIGEN } from '../e2e/portal-falso.js';

const raiz = new URL('..', import.meta.url).pathname;
const DIST = raiz + 'dist/';
const SALIDA = raiz + 'tienda/capturas/';
mkdirSync(SALIDA, { recursive: true });
const temporal = mkdtempSync(join(tmpdir(), 'capturas-sat-'));
const descargas = join(temporal, 'descargas');
mkdirSync(descargas);
const simbolo = readFileSync(raiz + '../reporteagil/design/logo/final/simbolo.svg', 'utf8');

const RFC_R = 'CNO1905228T4';
const RFC_E = 'PLE180310KZ2';
const recibidas = facturas({
  anio: 2026, mes: 9, porDia: 20, dias: Array.from({ length: 30 }, (_, i) => i + 1), receptor: RFC_R,
  extra: [{ dia: 5, cuantas: 700 }, { dia: 7, cuantas: 520, segundo: 12 * 3600 }],
});
const emitidas = facturas({ anio: 2026, mes: 8, porDia: 7, dias: [3, 4, 5], emisor: RFC_E, inicio: 5000 });

const context = await chromium.launchPersistentContext(join(temporal, 'perfil'), {
  channel: 'chromium', headless: true, acceptDownloads: true, downloadsPath: descargas,
  viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1,
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
let [sw] = context.serviceWorkers();
if (!sw) sw = await context.waitForEvent('serviceworker');
await montar(context, { recibidas, emitidas });
const trabajo = () => sw.evaluate(async () => (await chrome.storage.local.get('trabajo')).trabajo);
const page = await context.newPage();
const panel = page.locator('#reporteagil-facturas-sat');
const crudas = {};
const capturar = async (nombre) => (crudas[nombre] = await page.screenshot());

async function esperarMensaje(re, ms = 120000) {
  const inicio = Date.now();
  while (Date.now() - inicio < ms) {
    if (re.test((await panel.locator('.mensaje').textContent().catch(() => '')) || '')) return;
    await page.waitForTimeout(40);
  }
  throw new Error(`no apareció ${re}`);
}

// 1. Aviso y formulario.
await page.goto(`${ORIGEN}/ConsultaReceptor.aspx`);
await panel.getByRole('button', { name: 'Entendido, continuar' }).waitFor();
await capturar('aviso');
await panel.getByRole('button', { name: 'Entendido, continuar' }).click();
await panel.locator('select[name=mes]').selectOption('9');
await panel.locator('input[name=pdf]').uncheck();
await capturar('formulario');

// 2. El tope de 500 se parte solo; 3. termina con el Excel.
await panel.locator('input[name=xml]').uncheck();
await panel.getByRole('button', { name: /Descargar facturas recibidas/ }).click();
await page.waitForFunction(() => document.querySelectorAll('#ctl00_MainContent_tblResult tr').length > 2);
await esperarMensaje(/2026-09-05 llegó al tope de 500/);
await capturar('tope');
for (;;) {
  const t = await trabajo();
  if (t?.estado === 'terminado') break;
  await page.waitForTimeout(1000);
}
await panel.getByText(/Listo:/).waitFor();
await capturar('listo');

// 4. XML y PDF de emitidas en carpetas.
await panel.getByRole('button', { name: 'Nueva consulta' }).click();
await page.goto(`${ORIGEN}/ConsultaEmisor.aspx`);
await panel.locator('select[name=mes]').selectOption('8');
await panel.getByRole('button', { name: /Descargar facturas emitidas/ }).click();
await esperarMensaje(/Descargando archivos/);
await page.waitForTimeout(2500);
await capturar('descargando');
let te;
for (;;) {
  te = await trabajo();
  if (te?.estado === 'terminado') break;
  await page.waitForTimeout(500);
}

// Excel de recibidas: el primer .xlsx descargado (por contenido; Playwright los nombra con GUID).
const excel = readdirSync(descargas).map((n) => join(descargas, n)).sort((x, y) => statSync(y).mtimeMs - statSync(x).mtimeMs).find((f) => {
  const fd = openSync(f, 'r');
  const b = Buffer.alloc(2);
  readSync(fd, b, 0, 2, 0);
  closeSync(fd);
  return b.toString('latin1') === 'PK';
});
const xlsx = join(temporal, 'Relacion_Emitidas_2026-08.xlsx');
writeFileSync(xlsx, readFileSync(excel));
execFileSync('/Applications/LibreOffice.app/Contents/MacOS/soffice', ['--headless', '--convert-to', 'csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1', '--outdir', temporal, xlsx], { stdio: 'ignore' });
const filasExcel = readFileSync(join(temporal, 'Relacion_Emitidas_2026-08-Facturas.csv'), 'utf8').trim().split('\n').slice(0, 22).map((l) => l.split(','));
await context.close();

// Composición: franja con el mensaje arriba y la captura debajo.
const navegador = await chromium.launch();
const lienzo = await navegador.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const FUENTE = "'Helvetica Neue', Arial, sans-serif";
async function componer(archivo, titulo, png) {
  await lienzo.setContent(`<html><body style="margin:0;width:1280px;height:800px;background:#0c1e55;font-family:${FUENTE}">
    <div style="height:80px;display:flex;align-items:center;gap:16px;padding:0 32px;color:#fff">
      <div style="width:30px;height:36px">${simbolo.replace('<svg ', '<svg style="height:100%;width:auto" ')}</div>
      <div style="font-size:26px;font-weight:700;letter-spacing:-0.02em">${titulo}</div></div>
    <img src="data:image/png;base64,${png.toString('base64')}" style="display:block;width:1280px;height:720px"></body></html>`);
  await lienzo.screenshot({ path: SALIDA + archivo });
}
async function componerHtml(archivo, titulo, html) {
  await lienzo.setContent(`<html><body style="margin:0;width:1280px;height:800px;background:#0c1e55;font-family:${FUENTE}">
    <div style="height:80px;display:flex;align-items:center;gap:16px;padding:0 32px;color:#fff">
      <div style="width:30px;height:36px">${simbolo.replace('<svg ', '<svg style="height:100%;width:auto" ')}</div>
      <div style="font-size:26px;font-weight:700;letter-spacing:-0.02em">${titulo}</div></div>
    <div style="width:1280px;height:720px;background:#f4f5f7;overflow:hidden">${html}</div></body></html>`);
  await lienzo.screenshot({ path: SALIDA + archivo });
}

await componer('1-sin-tope.png', 'Si el portal corta en 500, la consulta se parte sola', crudas.tope);
await componer('2-listo.png', 'Todas las facturas del mes en un Excel, gratis', crudas.listo);
// Columnas: UUID, fecha, RFC y nombre del receptor, estado, serie, folio, subtotal, impuestos trasladados y total.
const columnasExcel = [0, 1, 5, 6, 8, 12, 13, 16, 18, 11];
const importes = new Set([11, 16, 18]);
const titulosCortos = { 18: 'Impuestos', 6: 'Receptor' };
const formato = (v) => (v && !Number.isNaN(Number(v)) ? Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v);
const celda = (v, i, cab) => `<td style="padding:5px 8px;border:1px solid #d9dde3;white-space:nowrap;${i === 6 ? 'max-width:250px;overflow:hidden;text-overflow:ellipsis;' : ''}${cab ? 'background:#0c1e55;color:#fff;font-weight:700;' : ''}${!cab && importes.has(i) ? 'text-align:right;' : ''}">${cab ? titulosCortos[i] || v : importes.has(i) ? formato(v) : v}</td>`;
const tablaExcel = `<div style="margin:24px 32px;background:#fff;border:1px solid #c9ced6;box-shadow:0 4px 18px rgba(0,0,0,.12)">
  <div style="background:#1d6f42;color:#fff;padding:8px 14px;font:600 14px ${FUENTE}">Relacion_Emitidas_2026-08.xlsx · Facturas</div>
  <table style="border-collapse:collapse;font:13px ${FUENTE};color:#1f2937;width:100%">${filasExcel.map((f, r) => `<tr>${columnasExcel.map((i) => celda(f[i] ?? '', i, r === 0)).join('')}</tr>`).join('')}</table>
  <div style="display:flex;gap:2px;background:#e9ecef;padding:4px 10px;font:13px ${FUENTE}"><span style="background:#fff;padding:4px 12px;border:1px solid #c9ced6">Facturas</span><span style="padding:4px 12px">Cobertura</span><span style="padding:4px 12px">Resumen</span></div></div>`;
await componerHtml('3-excel.png', 'Relación con UUID, RFC, importes, impuestos y estado', tablaExcel);
await componer('4-descargas.png', 'XML y PDF de cada factura, con tu sesión', crudas.descargando);
const rutas = Object.values(te.archivos).flatMap((a) => [a.xml, a.pdf]).filter(Boolean).sort().slice(0, 18);
const carpeta = rutas[0].split('/').slice(0, -1).join(' ▸ ');
const listaArchivos = `<div style="margin:24px 32px;background:#fff;border:1px solid #c9ced6;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.12);overflow:hidden">
  <div style="background:#eceef1;padding:10px 16px;font:600 15px ${FUENTE};color:#333">Descargas ▸ ${carpeta}</div>
  ${rutas.map((r) => { const n = r.split('/').pop(); const pdf = n.endsWith('.pdf'); return `<div style="display:flex;gap:12px;align-items:center;padding:6px 16px;border-top:1px solid #eef0f3;font:14px ui-monospace,Menlo,monospace;color:#1f2937"><span style="font:700 11px ${FUENTE};color:#fff;background:${pdf ? '#b91c1c' : '#0b6bd3'};border-radius:4px;padding:3px 6px;width:30px;text-align:center">${pdf ? 'PDF' : 'XML'}</span>${n}</div>`; }).join('')}</div>`;
await componerHtml('5-carpetas.png', 'XML y PDF con el mismo nombre, ordenados por RFC, año y mes', listaArchivos);
await componer('6-aviso.png', 'Tus facturas no salen de tu navegador', crudas.aviso);

// Mosaico promocional pequeño (440×280).
const mosaico = await navegador.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
await mosaico.setContent(`<html><body style="margin:0;width:440px;height:280px;background:#0c1e55;color:#fff;font-family:${FUENTE};display:flex;align-items:center;gap:22px;padding:0 30px;box-sizing:border-box">
  <div style="width:84px;height:100px;flex:none;background:#fff;border-radius:16px;display:grid;place-items:center"><div style="width:62px;height:74px">${simbolo.replace('<svg ', '<svg style="height:100%;width:auto" ')}</div></div>
  <div><div style="font-size:30px;font-weight:800;letter-spacing:-0.03em;line-height:1.05">Facturas SAT<br>a Excel</div>
  <div style="margin-top:10px;font-size:15px;color:#b9c3d9;line-height:1.4">Sin el tope de 500 · XML y PDF<br>en carpetas · Gratis</div></div></body></html>`);
await mosaico.screenshot({ path: SALIDA + 'mosaico-440x280.png' });
await navegador.close();
console.log('Capturas en tienda/capturas/:', readdirSync(SALIDA).join(', '));
