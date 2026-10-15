import { test } from 'node:test';
import assert from 'node:assert/strict';
import { intervalosIniciales, partir, etiqueta, hms, ultimoDiaConsultable, ULTIMO_SEGUNDO } from '../src/intervalos.js';

const hoy = new Date(2026, 9, 14); // 14 de octubre de 2026

test('un intervalo por mes, sin meses futuros', () => {
  const ivs = intervalosIniciales(2026, [1, 9, 10, 11, 12], hoy);
  assert.deepEqual(ivs.map((iv) => iv.mes), [1, 9, 10]);
  assert.deepEqual(ivs[0], { anio: 2026, mes: 1, dia: 0, desde: 0, hasta: ULTIMO_SEGUNDO });
});

test('un mes se parte en sus días, sin días futuros', () => {
  assert.equal(partir({ anio: 2026, mes: 9, dia: 0, desde: 0, hasta: ULTIMO_SEGUNDO }, hoy).length, 30);
  assert.equal(partir({ anio: 2024, mes: 2, dia: 0, desde: 0, hasta: ULTIMO_SEGUNDO }, hoy).length, 29);
  const octubre = partir({ anio: 2026, mes: 10, dia: 0, desde: 0, hasta: ULTIMO_SEGUNDO }, hoy);
  assert.equal(octubre.length, 14);
  assert.equal(octubre.at(-1).dia, 14);
});

test('un día se parte a la mitad hasta llegar a un segundo', () => {
  const [a, b] = partir({ anio: 2026, mes: 9, dia: 1, desde: 0, hasta: ULTIMO_SEGUNDO }, hoy);
  assert.equal(a.hasta, 43199);
  assert.equal(b.desde, 43200);
  assert.equal(b.hasta, ULTIMO_SEGUNDO);
  let iv = { anio: 2026, mes: 9, dia: 1, desde: 0, hasta: ULTIMO_SEGUNDO };
  let pasos = 0;
  while (partir(iv, hoy)) {
    iv = partir(iv, hoy)[0];
    pasos++;
  }
  assert.equal(iv.desde, iv.hasta);
  assert.ok(pasos <= 17, `se llega a un segundo en ${pasos} pasos`);
  assert.equal(partir({ ...iv }, hoy), null);
});

test('las partes cubren el rango sin huecos ni traslapes', () => {
  const iv = { anio: 2026, mes: 9, dia: 3, desde: 100, hasta: 1001 };
  const [a, b] = partir(iv, hoy);
  assert.equal(a.desde, 100);
  assert.equal(a.hasta + 1, b.desde);
  assert.equal(b.hasta, 1001);
});

test('etiquetas y horas', () => {
  assert.equal(etiqueta({ anio: 2026, mes: 9, dia: 0, desde: 0, hasta: ULTIMO_SEGUNDO }), '2026-09');
  assert.equal(etiqueta({ anio: 2026, mes: 9, dia: 1, desde: 0, hasta: ULTIMO_SEGUNDO }), '2026-09-01');
  assert.equal(etiqueta({ anio: 2026, mes: 9, dia: 1, desde: 0, hasta: 43199 }), '2026-09-01 00:00:00–11:59:59');
  assert.deepEqual(hms(3723), { h: 1, m: 2, s: 3 });
  assert.equal(ultimoDiaConsultable(2026, 10, hoy), 14);
  assert.equal(ultimoDiaConsultable(2026, 9, hoy), 30);
});
