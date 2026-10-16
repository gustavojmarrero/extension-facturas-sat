// La extensión empaquetada (dist-pruebas/) contra el portal simulado.
import { test, expect, chromium } from '@playwright/test';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { montar, facturas, ORIGEN } from './portal-falso.js';

const DIST = new URL('../dist-pruebas/', import.meta.url).pathname;

async function abrir() {
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'ext-sat-')), {
    channel: 'chromium',
    headless: true,
    acceptDownloads: true,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  return { context, sw };
}

const almacen = (sw, clave) => sw.evaluate(async (k) => (await chrome.storage.local.get(k))[k], clave);

async function esperarEstado(sw, estados, ms = 150_000) {
  const inicio = Date.now();
  for (;;) {
    const t = await almacen(sw, 'trabajo');
    if (t && estados.includes(t.estado)) return t;
    if (Date.now() - inicio > ms) throw new Error(`El trabajo no llegó a ${estados} (estado: ${t?.estado}, ${t?.mensaje})`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

function hojaDelExcel(dataUrl, hoja) {
  const dir = mkdtempSync(join(tmpdir(), 'ext-sat-xlsx-'));
  const archivo = join(dir, 'r.xlsx');
  writeFileSync(archivo, Buffer.from(dataUrl.split(',')[1], 'base64'));
  execFileSync('/Applications/LibreOffice.app/Contents/MacOS/soffice', ['--headless', '--convert-to', 'csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1', '--outdir', dir, archivo], { stdio: 'ignore' });
  return readFileSync(join(dir, `r-${hoja}.csv`), 'utf8').trim().split('\n');
}

test('recibidas: parte el tope de 500 por día y por hora, marca el segundo saturado y arma el Excel', async () => {
  const RFC = 'BBB020202BBB';
  const datos = facturas({
    anio: 2026, mes: 9, porDia: 20, dias: Array.from({ length: 30 }, (_, i) => i + 1), receptor: RFC,
    extra: [{ dia: 5, cuantas: 700 }, { dia: 7, cuantas: 520, segundo: 12 * 3600 }],
  });
  const { context, sw } = await abrir();
  await montar(context, { recibidas: datos });
  const page = await context.newPage();
  await page.goto(`${ORIGEN}/ConsultaReceptor.aspx`);
  const panel = page.locator('#reporteagil-facturas-sat');
  await expect(panel.getByText('Facturas SAT a Excel')).toBeVisible();
  await expect(panel.getByText(/no envía nada a Reporte Ágil/)).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute('href', 'https://reporteagil.com/extensiones/facturas-sat/privacidad');
  await panel.getByRole('button', { name: 'Entendido, continuar' }).click();
  await panel.locator('select[name=anio]').selectOption('2026');
  await panel.locator('select[name=mes]').selectOption('9');
  await panel.locator('input[name=xml]').uncheck();
  await panel.locator('input[name=pdf]').uncheck();
  await panel.getByRole('button', { name: /Descargar facturas recibidas/ }).click();

  const t = await esperarEstado(sw, ['terminado', 'faltan', 'pausado']);
  expect(t.estado, t.mensaje).toBe('terminado');
  expect(Object.keys(t.facturas)).toHaveLength(datos.length - 20); // 20 quedan ocultas en el segundo saturado
  expect(t.rfc).toBe(RFC);
  const incompletos = t.cobertura.filter((c) => c.estado === 'incompleto');
  expect(incompletos).toHaveLength(1);
  expect(incompletos[0].iv).toMatchObject({ dia: 7, desde: 43200, hasta: 43200 });
  expect(t.cobertura.reduce((s, c) => s + c.n, 0)).toBe(datos.length - 20);
  expect(await page.evaluate(() => window.__cancelaciones || 0)).toBe(0);

  const guardados = await almacen(sw, 'pruebas:guardados');
  const excel = guardados.find((g) => g.ruta === `SAT/${RFC}/Relacion_Recibidas_2026-09.xlsx`);
  expect(excel).toBeTruthy();
  const filas = hojaDelExcel(excel.url, 'Facturas');
  expect(filas).toHaveLength(datos.length - 20 + 1);
  const cobertura = hojaDelExcel(excel.url, 'Cobertura');
  expect(cobertura.some((l) => l.includes('2026-09-07 12:00:00–12:00:00') && l.includes('Incompleto'))).toBe(true);
  await expect(panel.getByText(/Listo: 1,800 facturas/)).toBeVisible();
  await expect(panel.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await expect(panel.getByRole('button', { name: 'Ver en Descargas' })).toBeVisible();
  await context.close();
});

test('emitidas: XML y PDF con el mismo nombre en carpetas, Excel completo al agotarse la cuota y archivos otro día', async () => {
  const RFC = 'AAA010101AAA';
  const datos = facturas({ anio: 2026, mes: 8, porDia: 3, dias: [3, 4, 5, 6], emisor: RFC });
  const { context, sw } = await abrir();
  const portal = await montar(context, { emitidas: datos, limiteXml: 8 });
  const page = await context.newPage();
  await page.goto(`${ORIGEN}/ConsultaEmisor.aspx`);
  const panel = page.locator('#reporteagil-facturas-sat');
  await panel.getByRole('button', { name: 'Entendido, continuar' }).click();
  await panel.locator('select[name=anio]').selectOption('2026');
  await panel.locator('select[name=mes]').selectOption('8');
  await panel.getByRole('button', { name: /Descargar facturas emitidas/ }).click();

  let t = await esperarEstado(sw, ['terminado', 'faltan', 'pausado']);
  expect(t.estado, t.mensaje).toBe('faltan');
  const conXml = Object.values(t.archivos).filter((a) => a.xml);
  expect(conXml).toHaveLength(8);
  expect(Object.values(t.archivos).filter((a) => a.pdf)).toHaveLength(8);
  await expect(panel.getByText(/cuota diaria del SAT/)).toBeVisible();
  // La cuota solo frena los archivos: la relación sale con todas las facturas.
  const primerExcel = (await almacen(sw, 'pruebas:guardados')).filter((g) => g.ruta.endsWith('.xlsx')).at(-1);
  expect(hojaDelExcel(primerExcel.url, 'Facturas').slice(1)).toHaveLength(datos.length);

  const f = datos.find((x) => x.serie === 'F');
  const esperado = `SAT/${RFC}/Emitidas/2026/08/${f.fecha.slice(0, 10)}_${f.receptor}_F-${f.folio}_${f.uuid}`;
  const rutas = (await almacen(sw, 'pruebas:guardados')).map((g) => g.ruta);
  expect(rutas).toContain(`${esperado}.xml`);
  expect(rutas).toContain(`${esperado}.pdf`);
  expect(t.facturas[f.uuid].xml).toMatchObject({ serie: 'F', folio: f.folio, usoCfdi: 'G03' });

  // Al día siguiente: la cuota vuelve a empezar.
  portal.limiteXml = Infinity;
  await sw.evaluate((rfc) => chrome.storage.local.remove(`cuota:${rfc}`), RFC);
  await panel.getByRole('button', { name: 'Continuar descargas' }).click();
  t = await esperarEstado(sw, ['terminado']);
  expect(Object.values(t.archivos).filter((a) => a.xml && a.pdf)).toHaveLength(datos.length);
  expect(Object.keys(t.facturas)).toHaveLength(datos.length);
  const xlsx = (await almacen(sw, 'pruebas:guardados')).filter((g) => g.ruta.endsWith('.xlsx'));
  expect(xlsx.at(-1).ruta).toBe(`SAT/${RFC}/Relacion_Emitidas_2026-08.xlsx`);
  const filas = hojaDelExcel(xlsx.at(-1).url, 'Facturas');
  expect(filas.slice(1).every((l) => l.includes(',Sí,Sí,'))).toBe(true);
  await context.close();
});
