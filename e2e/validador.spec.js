// El validador de CFDI (validar.html) del paquete de pruebas contra el servicio del SAT simulado.
import { test, expect, chromium } from '@playwright/test';
import { mkdtempSync, writeFileSync, readFileSync, cpSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { montarSat, xmlCfdi, VERIFICADOR } from './sat-falso.js';
import { montar, ORIGEN } from './portal-falso.js';

const DIST = new URL('../dist-pruebas/', import.meta.url).pathname;
const MANIFIESTO = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const HOST_SAT = 'https://consultaqr.facturaelectronica.sat.gob.mx/*';

async function abrir(dist = DIST) {
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'ext-sat-')), {
    channel: 'chromium',
    headless: true,
    acceptDownloads: true,
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  });
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  return { context, sw, id: new URL(sw.url()).host };
}

const almacen = (sw, clave) => sw.evaluate(async (k) => (await chrome.storage.local.get(k))[k], clave);
const archivo = (name, texto) => ({ name, mimeType: 'text/xml', buffer: Buffer.from(texto) });

function hojaDelExcel(dataUrl, hoja) {
  const dir = mkdtempSync(join(tmpdir(), 'ext-sat-xlsx-'));
  const ruta = join(dir, 'v.xlsx');
  writeFileSync(ruta, Buffer.from(dataUrl.split(',')[1], 'base64'));
  execFileSync('/Applications/LibreOffice.app/Contents/MacOS/soffice', ['--headless', '--convert-to', 'csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1', '--outdir', dir, ruta], { stdio: 'ignore' });
  return readFileSync(join(dir, `v-${hoja}.csv`), 'utf8').trim().split('\n');
}

// UUID inventados.
const U = (n) => `0000BBBB-0000-4000-8000-${String(n).padStart(12, '0')}`;
const FE = 'VldYWVo='; // últimos 8 del sello de xmlCfdi

test('valida vigente, cancelado, no encontrado, EFOS 100, 3.2 y un error de red con reintento; exporta a Excel', async () => {
  const { context, sw, id } = await abrir();
  const sat = await montarSat(context, {
    [U(1)]: { base: VERIFICADOR, campos: { id: U(1), re: 'AAA010101AAA', rr: 'XAXX010101000', tt: '1160.5', fe: FE }, respuesta: { estado: 'Vigente' } },
    [U(2)]: {
      base: VERIFICADOR, campos: { id: U(2), re: 'AAA010101AAA', rr: 'XAXX010101000', tt: '1000.0', fe: FE },
      respuesta: { estado: 'Cancelado', cancelable: 'Cancelable sin aceptación', cancelacion: 'Cancelado sin aceptación' },
    },
    // El RFC con «&» llega como «&amp;» dentro de la expresión.
    [U(4)]: { base: VERIFICADOR, campos: { id: U(4), re: 'M&amp;M010101AB1', rr: 'XAXX010101000', tt: '58.0', fe: FE }, respuesta: { estado: 'Vigente', efos: '100' } },
    [U(5)]: { base: VERIFICADOR, campos: { id: U(5), re: 'AAA010101AAA', rr: 'XAXX010101000', tt: '0.01', fe: FE }, respuesta: { estado: 'Vigente' }, fallasDeRed: 1 },
    [U(6)]: { base: '', campos: { re: 'CCC030303CCC', rr: 'XAXX010101000', tt: '0000000099.900000', id: U(6) }, respuesta: { estado: 'Vigente', cancelable: 'No cancelable' } },
  });
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/validar.html`);
  await expect(page.getByRole('heading', { name: 'Validar CFDI ante el SAT' })).toBeVisible();
  // El aviso de qué se envía al SAT está a la vista antes de la primera consulta.
  await expect(page.getByText(/el folio fiscal \(UUID\), el RFC del emisor y del receptor, el total y los últimos 8 caracteres del sello/)).toBeVisible();

  await page.setInputFiles('#archivos', [
    archivo('vigente.xml', xmlCfdi({ uuid: U(1), total: '1160.50' })),
    archivo('cancelado.xml', xmlCfdi({ uuid: U(2), total: '1000' })),
    archivo('no-encontrado.xml', xmlCfdi({ uuid: U(3), total: '10.00' })),
    archivo('efos.xml', xmlCfdi({ uuid: U(4), total: '58.000000', emisor: 'M&M010101AB1', nombre: 'DULCES M&M SA DE CV' })),
    archivo('red.xml', xmlCfdi({ uuid: U(5), total: '0.010' })),
    archivo('antiguo.xml', xmlCfdi({ uuid: U(6), version: '3.2', total: '99.90', emisor: 'CCC030303CCC' })),
    archivo('repetido.xml', xmlCfdi({ uuid: U(1), total: '1160.50' })),
    archivo('otro.xml', '<?xml version="1.0"?><pedido><total>5</total></pedido>'),
  ]);
  await expect(page.locator('#mensaje')).toContainText('Se agregaron 7 XML. 1 repetidos (mismo UUID) se omitieron. 1 no se pueden consultar');
  const boton = page.getByRole('button', { name: /validar 6 CFDI/i });
  await expect(boton).toBeEnabled();
  expect(sat.peticiones).toHaveLength(0);

  await boton.click();
  await expect(page.locator('#mensaje')).toContainText('Listo: 4 vigentes, 1 cancelados y 1 no encontrados. 1 con el emisor en la lista de EFOS.', { timeout: 30_000 });
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');

  // De dos en dos, por POST SOAP, y el CFDI con la falla de red se consultó dos veces.
  expect(sat.maxSimultaneas).toBeLessThanOrEqual(2);
  expect(sat.peticiones.every((p) => p.metodo === 'POST')).toBe(true);
  expect(sat.peticiones.filter((p) => p.id === U(5))).toHaveLength(2);
  expect(sat.peticiones).toHaveLength(7);

  const fila = (n) => page.locator('#filas tr', { hasText: U(n) });
  await expect(fila(1)).toContainText('Vigente');
  await expect(fila(1)).toContainText('S - Comprobante obtenido satisfactoriamente.');
  await expect(fila(2)).toContainText('Cancelado sin aceptación');
  await expect(fila(2)).toContainText('Cancelada ante el SAT');
  await expect(fila(3)).toContainText('N - 602: Comprobante no encontrado.');
  await expect(fila(3)).toContainText('No Encontrado');
  await expect(fila(4)).toContainText('M&M010101AB1');
  await expect(fila(4).locator('td.efos-100')).toHaveText('100');
  await expect(fila(4)).toContainText('Atención: el emisor está en la lista de EFOS');
  await expect(fila(5)).toContainText('Vigente');
  await expect(fila(6)).toContainText('No cancelable');
  await expect(page.locator('#filas tr', { hasText: 'otro.xml' })).toContainText('No se consultó: No es un CFDI.');

  await page.getByRole('button', { name: 'Exportar a Excel' }).click();
  await expect(page.locator('#mensaje')).toContainText('Excel en Descargas');
  await expect(page.getByRole('button', { name: 'Ver en Descargas' })).toBeVisible();
  const excel = (await almacen(sw, 'pruebas:guardados')).find((g) => /^SAT\/Validaciones\/Validacion_CFDI_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.xlsx$/.test(g.ruta));
  expect(excel).toBeTruthy();
  const filas = hojaDelExcel(excel.url, 'Validación');
  expect(filas[0]).toBe('Archivo,Folio fiscal (UUID),RFC emisor,Nombre del emisor,RFC receptor,Fecha de emisión,Total,CodigoEstatus,Estado,EsCancelable,EstatusCancelacion,ValidacionEFOS,Lectura,Consultado');
  expect(filas).toHaveLength(8);
  const linea = (n) => filas.find((l) => l.includes(U(n)));
  expect(linea(1)).toContain(',1160.5,S - Comprobante obtenido satisfactoriamente.,Vigente,Cancelable con aceptación,,200,');
  expect(linea(2)).toContain(',Cancelado,Cancelable sin aceptación,Cancelado sin aceptación,200,');
  expect(linea(3)).toContain(',N - 602: Comprobante no encontrado.,No Encontrado,');
  expect(linea(4)).toContain('M&M010101AB1,DULCES M&M SA DE CV,');
  expect(linea(4)).toMatch(/,100,"?Vigente: .* Atención: el emisor está en la lista de EFOS/);
  expect(linea(1)).toMatch(/,\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  expect(filas.find((l) => l.startsWith('otro.xml'))).toContain('No se consultó: No es un CFDI.');
  const resumen = hojaDelExcel(excel.url, 'Resumen');
  expect(resumen.some((l) => l.startsWith('Emisor en la lista de EFOS (100),1'))).toBe(true);
  expect(resumen.some((l) => /^Repetidos \(mismo UUID\),"?1:/.test(l))).toBe(true);
  await context.close();
});

test('detener deja pendientes los que faltan y Validar sigue con ellos', async () => {
  const { context, id } = await abrir();
  const cfdis = {};
  const entradas = [];
  for (let n = 1; n <= 12; n++) {
    cfdis[U(100 + n)] = { base: VERIFICADOR, campos: { id: U(100 + n), re: 'AAA010101AAA', rr: 'XAXX010101000', tt: `${n}.5`, fe: FE }, respuesta: { estado: 'Vigente' } };
    entradas.push(archivo(`f${n}.xml`, xmlCfdi({ uuid: U(100 + n), total: `${n}.50` })));
  }
  const sat = await montarSat(context, cfdis, { demoraMs: 400 });
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/validar.html`);
  await page.setInputFiles('#archivos', entradas);
  await page.getByRole('button', { name: /validar 12 CFDI/i }).click();
  await expect.poll(() => page.locator('#filas .estado.vigente').count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: 'Detener' }).click();
  await expect(page.locator('#mensaje')).toContainText('Detenido:');
  const hechas = sat.peticiones.length;
  expect(hechas).toBeLessThan(12);
  await page.waitForTimeout(1000);
  expect(sat.peticiones.length).toBe(hechas);
  const faltan = await page.locator('#filas .estado', { hasText: 'Pendiente' }).count();
  expect(faltan).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: new RegExp(`validar ${faltan} CFDI`, 'i') })).toBeEnabled();
  await page.getByRole('button', { name: new RegExp(`validar ${faltan} CFDI`, 'i') }).click();
  await expect(page.locator('#filas .estado.vigente')).toHaveCount(12, { timeout: 30_000 });
  await context.close();
});

test('el panel del portal abre el validador', async () => {
  const { context, sw, id } = await abrir();
  // Playwright no puede pulsar el ícono de la barra: se comprueba que el clic tiene quien lo atienda.
  expect(await sw.evaluate(() => chrome.action.onClicked.hasListeners())).toBe(true);
  await montar(context, { recibidas: [] });
  const page = await context.newPage();
  await page.goto(`${ORIGEN}/ConsultaReceptor.aspx`);
  const panel = page.locator('#reporteagil-facturas-sat');
  await panel.getByRole('button', { name: 'Entendido, continuar' }).click();
  const [validador] = await Promise.all([context.waitForEvent('page'), panel.getByRole('button', { name: /Valida su estado ante el SAT/ }).click()]);
  await validador.waitForLoadState();
  expect(validador.url()).toBe(`chrome-extension://${id}/validar.html`);
  await expect(validador.getByRole('heading', { name: 'Validar CFDI ante el SAT' })).toBeVisible();
  await context.close();
});

test('con el manifiesto que se publica, el permiso del SAT es opcional y se pide en el clic, antes de consultar', async () => {
  expect(MANIFIESTO.host_permissions).not.toContain(HOST_SAT);
  expect(MANIFIESTO.optional_host_permissions).toEqual([HOST_SAT]);
  expect(MANIFIESTO.permissions).toEqual(['downloads', 'storage']);
  expect(MANIFIESTO.action).toBeTruthy();
  expect(MANIFIESTO.action.default_popup).toBeUndefined();
  // El paquete de pruebas con el manifiesto tal cual: Chrome muestra su aviso de permiso (que aquí
  // nadie acepta), así que la petición queda pendiente y no sale ninguna consulta.
  const dist = mkdtempSync(join(tmpdir(), 'ext-sat-opcional-'));
  cpSync(DIST, dist, { recursive: true });
  writeFileSync(join(dist, 'manifest.json'), JSON.stringify(MANIFIESTO));
  const { context, sw, id } = await abrir(dist);
  const sat = await montarSat(context, {});
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/validar.html`);
  await expect(page.locator('#notaPermiso')).toBeVisible();
  await page.setInputFiles('#archivos', [archivo('a.xml', xmlCfdi({ uuid: U(200), total: '1.00' }))]);
  await page.getByRole('button', { name: 'Permitir y validar 1 CFDI' }).click();
  await expect(page.locator('#mensaje')).toContainText('Esperando el permiso de Chrome');
  await page.waitForTimeout(1000);
  await expect(page.locator('#mensaje')).toContainText('Esperando el permiso de Chrome');
  expect(sat.peticiones).toHaveLength(0);
  expect(await sw.evaluate((o) => chrome.permissions.contains({ origins: [o] }), HOST_SAT)).toBe(false);
  await context.close();
});

test('acepta una carpeta y archivos soltados', async () => {
  const { context, id } = await abrir();
  const sat = await montarSat(context, {
    [U(301)]: { base: VERIFICADOR, campos: { id: U(301), re: 'AAA010101AAA', rr: 'XAXX010101000', tt: '1.0', fe: FE }, respuesta: { estado: 'Vigente' } },
  });
  const carpeta = mkdtempSync(join(tmpdir(), 'ext-sat-carpeta-'));
  mkdirSync(join(carpeta, '2026', '09'), { recursive: true });
  writeFileSync(join(carpeta, '2026', '09', 'a.xml'), xmlCfdi({ uuid: U(301), total: '1' }));
  writeFileSync(join(carpeta, '2026', '09', 'b.xml'), xmlCfdi({ uuid: U(302), total: '2' }));
  writeFileSync(join(carpeta, 'nota.txt'), 'no es XML');
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/validar.html`);
  await page.setInputFiles('#carpeta', carpeta);
  await expect(page.locator('#mensaje')).toContainText('Se agregaron 2 XML.');
  await expect(page.locator('#mensaje')).toContainText('1 archivos que no son XML se ignoraron.');
  await expect(page.locator('#filas tr', { hasText: U(301) })).toContainText('/2026/09/a.xml');

  // Soltar un archivo en la zona.
  await page.evaluate((xml) => {
    const datos = new DataTransfer();
    datos.items.add(new File([xml], 'soltado.xml', { type: 'text/xml' }));
    document.getElementById('zona').dispatchEvent(new DragEvent('drop', { dataTransfer: datos, bubbles: true, cancelable: true }));
  }, xmlCfdi({ uuid: U(303), total: '3' }));
  await expect(page.locator('#filas tr', { hasText: 'soltado.xml' })).toContainText(U(303));
  await page.getByRole('button', { name: /validar 3 CFDI/i }).click();
  await expect(page.locator('#mensaje')).toContainText('Listo: 1 vigentes, 0 cancelados y 2 no encontrados.');
  expect(sat.peticiones).toHaveLength(3);
  await context.close();
});
