import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { libro } from '../src/xlsx.js';
import { hojasDeRelacion, importe } from '../src/relacion.js';
import { contiene, faltantes, prepararContinuacion, nuevoTrabajo } from '../src/motor.js';

function soffice() {
  for (const ruta of ['/Applications/LibreOffice.app/Contents/MacOS/soffice', '/usr/bin/soffice', '/usr/local/bin/soffice']) if (existsSync(ruta)) return ruta;
  return null;
}

function trabajoDePrueba() {
  const t = nuevoTrabajo({ tipo: 'recibidas', anio: 2026, meses: [9], opciones: { excel: true, xml: true, pdf: true }, hoy: new Date(2026, 9, 14) });
  t.rfc = 'BBB020202BBB';
  t.pendientes = [];
  t.cobertura = [
    { iv: { anio: 2026, mes: 9, dia: 1, desde: 0, hasta: 86399 }, n: 2, estado: 'completo', nota: '' },
    { iv: { anio: 2026, mes: 9, dia: 2, desde: 0, hasta: 0 }, n: 500, estado: 'incompleto', nota: '500 en un segundo' },
  ];
  t.facturas = {
    U1: { uuid: 'U1', fechaEmision: '2026-09-01T10:20:30', fechaCertificacion: '2026-09-01T10:21:00', rfcEmisor: 'AAA010101AAA', nombreEmisor: 'EMISOR & CIA <prueba>', rfcReceptor: 'BBB020202BBB', nombreReceptor: 'RECEPTOR', total: 1102, efecto: 'Ingreso', estado: 'Vigente', estatusCancelacion: 'Cancelable con aceptación', xml: { serie: 'F', folio: '2045', subtotal: 1000, trasladados: 152, moneda: 'MXN' } },
    U2: { uuid: 'U2', fechaEmision: '2026-09-02T00:00:00', rfcEmisor: 'CCC030303CCC', nombreEmisor: 'OTRO', rfcReceptor: 'BBB020202BBB', total: -5.5, efecto: 'Egreso', estado: 'Cancelado', xml: null },
  };
  t.archivos = { U1: { xml: 'SAT/BBB020202BBB/Recibidas/2026/09/a.xml', pdf: 'SAT/BBB020202BBB/Recibidas/2026/09/a.pdf' } };
  return t;
}

test('importes del portal', () => {
  assert.equal(importe('$1,354.56'), 1354.56);
  assert.equal(importe('-$5.50'), -5.5);
  assert.equal(importe(''), null);
});

test('la relación tiene facturas ordenadas, cobertura y resumen', () => {
  const [facturas, cobertura, resumen] = hojasDeRelacion(trabajoDePrueba(), new Date('2026-10-14T12:00:00Z'));
  assert.equal(facturas.filas.length, 2);
  assert.equal(facturas.filas[0][0], 'U1');
  assert.equal(facturas.filas[0][12], 'F');
  assert.equal(facturas.filas[1][25], 'No');
  assert.deepEqual(cobertura.filas.map((f) => f[2]), ['Completo', 'Incompleto']);
  assert.ok(resumen.filas.some(([c, v]) => c === 'Cobertura' && /1 consulta/.test(v)));
});

test('el .xlsx abre en LibreOffice con sus tres hojas', { skip: !soffice() && 'sin LibreOffice' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'facturas-sat-'));
  const archivo = join(dir, 'relacion.xlsx');
  writeFileSync(archivo, libro(hojasDeRelacion(trabajoDePrueba(), new Date('2026-10-14T12:00:00Z'))));
  execFileSync(soffice(), ['--headless', '--convert-to', 'csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1', '--outdir', dir, archivo], { stdio: 'ignore' });
  const facturas = readFileSync(join(dir, 'relacion-Facturas.csv'), 'utf8');
  assert.match(facturas, /Folio fiscal \(UUID\)/);
  assert.match(facturas, /EMISOR & CIA <prueba>/);
  assert.match(facturas, /2026-09-01 10:20:30/);
  assert.match(facturas, /,1102,/);
  assert.match(facturas, /,-5\.5,/);
  const resumen = readFileSync(join(dir, 'relacion-Resumen.csv'), 'utf8');
  assert.match(resumen, /reporteagil\.com/);
  assert.ok(existsSync(join(dir, 'relacion-Cobertura.csv')));
});

test('contiene: mes, día y rango de segundos', () => {
  assert.ok(contiene({ anio: 2026, mes: 9, dia: 0 }, '2026-09-30T23:59:59'));
  assert.ok(!contiene({ anio: 2026, mes: 9, dia: 0 }, '2026-10-01T00:00:00'));
  assert.ok(contiene({ anio: 2026, mes: 9, dia: 1, desde: 3600, hasta: 7199 }, '2026-09-01T01:30:00'));
  assert.ok(!contiene({ anio: 2026, mes: 9, dia: 1, desde: 3600, hasta: 7199 }, '2026-09-01T02:00:00'));
});

test('continuar vuelve a consultar solo los intervalos con archivos pendientes', () => {
  const t = trabajoDePrueba();
  assert.deepEqual(faltantes(t).map((f) => f.uuid), ['U2']);
  prepararContinuacion(t);
  assert.deepEqual(t.pendientes, [{ anio: 2026, mes: 9, dia: 2, desde: 0, hasta: 0 }]);
  assert.equal(t.cobertura.length, 1);
});
