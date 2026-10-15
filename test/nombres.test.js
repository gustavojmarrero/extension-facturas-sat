import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rutaArchivo, rutaExcel, limpiar } from '../src/nombres.js';

const factura = {
  uuid: '11111111-2222-4333-8444-555555555555',
  fechaEmision: '2026-09-01T10:20:30',
  rfcEmisor: 'AAA010101AAA',
  rfcReceptor: 'BBB020202BBB',
};

test('recibidas: carpeta por año y mes, nombre con fecha, emisor, serie-folio y UUID', () => {
  assert.equal(
    rutaArchivo({ tipo: 'recibidas', rfc: 'BBB020202BBB', factura, serie: 'A', folio: '123', extension: 'xml' }),
    'SAT/BBB020202BBB/Recibidas/2026/09/2026-09-01_AAA010101AAA_A-123_11111111-2222-4333-8444-555555555555.xml',
  );
});

test('emitidas: la contraparte es el receptor; sin serie ni folio se omiten', () => {
  assert.equal(
    rutaArchivo({ tipo: 'emitidas', rfc: 'AAA010101AAA', factura, extension: 'pdf' }),
    'SAT/AAA010101AAA/Emitidas/2026/09/2026-09-01_BBB020202BBB_11111111-2222-4333-8444-555555555555.pdf',
  );
});

test('quita caracteres que no aceptan los sistemas de archivos y conserva & y Ñ', () => {
  assert.equal(limpiar('A/B:C*D?"E<F>G|H'), 'A-B-C-D-E-F-G-H');
  assert.equal(limpiar('Ñ&A010101AAA'), 'Ñ&A010101AAA');
  assert.equal(limpiar('..oculto'), 'oculto');
});

test('Excel por mes o por año', () => {
  assert.equal(rutaExcel({ tipo: 'recibidas', rfc: 'BBB020202BBB', anio: 2026, meses: [9] }), 'SAT/BBB020202BBB/Relacion_Recibidas_2026-09.xlsx');
  assert.equal(rutaExcel({ tipo: 'emitidas', rfc: 'AAA010101AAA', anio: 2025, meses: [1, 2, 3] }), 'SAT/AAA010101AAA/Relacion_Emitidas_2025.xlsx');
});
