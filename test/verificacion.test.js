import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  totalParaExpresion, expresionImpresa, cuerpoSoap, leerRespuesta, consultarCfdi, faltaParaConsultar,
  lectura, claseDeEstado, Detenido, ErrorConsulta, SERVICIO_SAT,
} from '../src/verificacion.js';
import { correrCola, esperar } from '../src/cola.js';

// Datos inventados: RFC genéricos de prueba y un UUID que no existe.
const CFDI = {
  version: '4.0', uuid: '0000AAAA-0000-4000-8000-000000000001', rfcEmisor: 'AAA010101AAA', rfcReceptor: 'XAXX010101000',
  total: '1160.50', sello: 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=',
};

const respuestaSat = ({ codigo = 'S - Comprobante obtenido satisfactoriamente.', estado = 'Vigente', cancelable = 'Cancelable con aceptación', cancelacion = null, efos = '200' } = {}) =>
  '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><ConsultaResponse xmlns="http://tempuri.org/">' +
  '<ConsultaResult xmlns:a="http://schemas.datacontract.org/2004/07/Sat.Cfdi.Negocio.ConsultaCfdi.Servicio" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">' +
  `<a:CodigoEstatus>${codigo}</a:CodigoEstatus><a:EsCancelable>${cancelable}</a:EsCancelable><a:Estado>${estado}</a:Estado>` +
  (cancelacion === null ? '<a:EstatusCancelacion i:nil="true"/>' : `<a:EstatusCancelacion>${cancelacion}</a:EstatusCancelacion>`) +
  `<a:ValidacionEFOS>${efos}</a:ValidacionEFOS></ConsultaResult></ConsultaResponse></s:Body></s:Envelope>`;

test('total de la expresión: 3.2 con 17 caracteres; 3.3 y 4.0 sin ceros sobrantes y al menos un decimal', () => {
  assert.equal(totalParaExpresion('1160.50', '3.2'), '0000001160.500000');
  assert.equal(totalParaExpresion('0.5', '3.2'), '0000000000.500000');
  assert.equal(totalParaExpresion('1160.50', '4.0'), '1160.5');
  assert.equal(totalParaExpresion('1000', '4.0'), '1000.0');
  assert.equal(totalParaExpresion('1000.000000', '3.3'), '1000.0');
  assert.equal(totalParaExpresion('0.000001', '4.0'), '0.000001');
  assert.equal(totalParaExpresion('007.10', '4.0'), '7.1');
  assert.equal(totalParaExpresion('12345678901234567.89', '4.0'), '12345678901234567.89');
  assert.equal(totalParaExpresion('1.0000005', '4.0'), '1.000001');
  assert.equal(totalParaExpresion('', '4.0'), null);
  assert.equal(totalParaExpresion('1,160.50', '4.0'), null);
});

test('expresión de 4.0: URL del verificador con id, RFC, total y los últimos 8 del sello', () => {
  assert.equal(
    expresionImpresa(CFDI),
    'https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=0000AAAA-0000-4000-8000-000000000001&re=AAA010101AAA&rr=XAXX010101000&tt=1160.5&fe=VldYWVo=',
  );
});

test('expresión de 3.2: la corta del QR, sin sello', () => {
  assert.equal(
    expresionImpresa({ ...CFDI, version: '3.2' }),
    '?re=AAA010101AAA&rr=XAXX010101000&tt=0000001160.500000&id=0000AAAA-0000-4000-8000-000000000001',
  );
});

test('en el cuerpo SOAP los & van escapados, y el de un RFC dos veces', () => {
  const cuerpo = cuerpoSoap(expresionImpresa({ ...CFDI, rfcEmisor: 'M&M010101AB1' }));
  assert.match(cuerpo, /<tem:expresionImpresa>https:\/\/verificacfdi[^<]*\?id=0000AAAA-0000-4000-8000-000000000001&amp;re=M&amp;amp;M010101AB1&amp;rr=/);
  assert.ok(!/&(?!amp;)/.test(cuerpo), 'ningún & sin escapar');
});

test('lo que falta para consultar', () => {
  assert.equal(faltaParaConsultar(CFDI), '');
  assert.equal(faltaParaConsultar({ ...CFDI, uuid: '', total: 'x' }), 'Le falta el folio fiscal (UUID) del timbre, el total.');
});

test('lee la respuesta tal cual, con EstatusCancelacion nulo', () => {
  assert.deepEqual(leerRespuesta(respuestaSat()), {
    codigoEstatus: 'S - Comprobante obtenido satisfactoriamente.', estado: 'Vigente', esCancelable: 'Cancelable con aceptación',
    estatusCancelacion: '', validacionEfos: '200',
  });
  const noEncontrado = leerRespuesta(respuestaSat({ codigo: 'N - 602: Comprobante no encontrado.', estado: 'No Encontrado', cancelable: '', efos: '' }));
  assert.equal(noEncontrado.estado, 'No Encontrado');
  assert.equal(noEncontrado.validacionEfos, '');
  assert.throws(() => leerRespuesta('<html>Mantenimiento</html>'), ErrorConsulta);
});

test('lectura en claro y clase de estado', () => {
  assert.match(lectura(leerRespuesta(respuestaSat())), /^Vigente: .* el receptor lo acepte\. El emisor no está en la lista de EFOS\.$/);
  const cancelada = leerRespuesta(respuestaSat({ estado: 'Cancelado', cancelacion: 'Plazo vencido' }));
  assert.equal(claseDeEstado(cancelada), 'cancelado');
  assert.match(lectura(cancelada), /^Cancelada .* no respondió en el plazo\./);
  const efos = leerRespuesta(respuestaSat({ efos: '100' }));
  assert.match(lectura(efos), /Atención: el emisor está en la lista de EFOS/);
  const alterado = leerRespuesta(respuestaSat({ codigo: 'N - 601: La expresión impresa proporcionada no es válida.', estado: 'No Encontrado', cancelable: '', efos: '' }));
  assert.equal(claseDeEstado(alterado), 'no-encontrado');
  assert.match(lectura(alterado), /no coinciden con los del SAT/);
});

// fetch simulado: cada elemento de `guion` es una respuesta { status, body } o un Error que se lanza.
function fetchSimulado(guion) {
  const llamadas = [];
  const hacer = async (url, opciones) => {
    llamadas.push({ url, opciones });
    const paso = guion[Math.min(llamadas.length - 1, guion.length - 1)];
    if (paso instanceof Error) throw paso;
    return { status: paso.status ?? 200, ok: (paso.status ?? 200) < 300, text: async () => paso.body ?? '' };
  };
  return { hacer, llamadas };
}

test('consulta por POST SOAP, sin cookies, y devuelve la hora de la consulta', async () => {
  const { hacer, llamadas } = fetchSimulado([{ body: respuestaSat() }]);
  const r = await consultarCfdi(CFDI, { fetch: hacer, ahora: () => new Date(2026, 9, 17, 9, 5, 7) });
  assert.equal(r.estado, 'Vigente');
  assert.equal(r.consultado, '2026-10-17T09:05:07');
  assert.equal(r.intentos, 1);
  assert.equal(llamadas[0].url, SERVICIO_SAT);
  assert.equal(llamadas[0].opciones.method, 'POST');
  assert.equal(llamadas[0].opciones.credentials, 'omit');
  assert.equal(llamadas[0].opciones.headers.SOAPAction, '"http://tempuri.org/IConsultaCFDIService/Consulta"');
});

test('reintenta errores de red y 5xx con espera creciente', async () => {
  const esperas = [];
  const { hacer, llamadas } = fetchSimulado([new TypeError('Failed to fetch'), { status: 503 }, { body: respuestaSat({ estado: 'Cancelado' }) }]);
  const r = await consultarCfdi(CFDI, { fetch: hacer, esperar: async (ms) => esperas.push(ms), intentos: 3, espera: 100 });
  assert.equal(r.estado, 'Cancelado');
  assert.equal(r.intentos, 3);
  assert.equal(llamadas.length, 3);
  assert.deepEqual(esperas, [100, 200]);
});

test('se rinde tras los intentos y dice por qué', async () => {
  const { hacer, llamadas } = fetchSimulado([new TypeError('Failed to fetch')]);
  await assert.rejects(consultarCfdi(CFDI, { fetch: hacer, esperar: async () => {}, intentos: 3 }), (e) => {
    assert.ok(e instanceof ErrorConsulta);
    assert.equal(e.message, 'No hubo conexión con el servicio del SAT. (3 intentos)');
    assert.equal(e.intentos, 3);
    return true;
  });
  assert.equal(llamadas.length, 3);
});

test('una respuesta del SAT no se reintenta, aunque sea «No encontrado»; un 400 tampoco', async () => {
  const noEncontrado = fetchSimulado([{ body: respuestaSat({ codigo: 'N - 602: Comprobante no encontrado.', estado: 'No Encontrado' }) }]);
  assert.equal((await consultarCfdi(CFDI, { fetch: noEncontrado.hacer, esperar: async () => {} })).estado, 'No Encontrado');
  assert.equal(noEncontrado.llamadas.length, 1);
  const malo = fetchSimulado([{ status: 400 }]);
  await assert.rejects(consultarCfdi(CFDI, { fetch: malo.hacer, esperar: async () => {} }), /El SAT respondió 400\./);
  assert.equal(malo.llamadas.length, 1);
});

test('el 500 con SOAP Fault muestra el faultstring', async () => {
  const falla = '<s:Envelope xmlns:s="x"><s:Body><s:Fault><faultcode>a:InternalServiceFault</faultcode><faultstring xml:lang="es-MX">Error en el servicio</faultstring></s:Fault></s:Body></s:Envelope>';
  const { hacer } = fetchSimulado([{ status: 500, body: falla }]);
  await assert.rejects(consultarCfdi(CFDI, { fetch: hacer, esperar: async () => {}, intentos: 2 }), /El SAT respondió 500: Error en el servicio\. \(2 intentos\)/);
});

test('detener corta la espera del reintento sin volver a consultar', async () => {
  const control = new AbortController();
  const { hacer, llamadas } = fetchSimulado([new TypeError('Failed to fetch')]);
  const consulta = consultarCfdi(CFDI, { fetch: hacer, intentos: 3, espera: 60_000, senal: control.signal });
  setTimeout(() => control.abort(), 20);
  const inicio = Date.now();
  await assert.rejects(consulta, Detenido);
  assert.ok(Date.now() - inicio < 1000);
  assert.equal(llamadas.length, 1);
});

test('detener aborta la petición en curso', async () => {
  const control = new AbortController();
  const colgado = (_url, { signal }) => new Promise((_, rechazar) => signal.addEventListener('abort', () => rechazar(new Error('abortado'))));
  const consulta = consultarCfdi(CFDI, { fetch: colgado, senal: control.signal });
  setTimeout(() => control.abort(), 20);
  await assert.rejects(consulta, Detenido);
});

test('un tiempo agotado se reintenta', async () => {
  let n = 0;
  const lento = (_url, { signal }) =>
    ++n === 1
      ? new Promise((_, rechazar) => signal.addEventListener('abort', () => rechazar(new Error('abortado'))))
      : Promise.resolve({ status: 200, ok: true, text: async () => respuestaSat() });
  const r = await consultarCfdi(CFDI, { fetch: lento, limiteMs: 30, esperar: async () => {} });
  assert.equal(r.intentos, 2);
});

test('la cola trabaja de dos en dos, con pausa en cada carril, y se detiene', async () => {
  let activos = 0;
  let maximo = 0;
  const hechos = [];
  const pausas = [];
  await correrCola(
    Array.from({ length: 9 }, (_, i) => i),
    async (n) => {
      activos++;
      maximo = Math.max(maximo, activos);
      await new Promise((r) => setTimeout(r, 5));
      hechos.push(n);
      activos--;
    },
    { concurrencia: 2, pausa: 7, esperar: async (ms) => pausas.push(ms) },
  );
  assert.equal(maximo, 2);
  assert.deepEqual([...hechos].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(pausas.length >= 7 && pausas.every((ms) => ms === 7));

  const control = new AbortController();
  const atendidos = [];
  await correrCola(
    Array.from({ length: 50 }, (_, i) => i),
    async (n) => {
      atendidos.push(n);
      if (n === 3) control.abort();
    },
    { concurrencia: 2, senal: control.signal },
  );
  assert.ok(atendidos.length <= 5, `se detuvo tras ${atendidos.length}`);
});

test('esperar termina antes si se aborta', async () => {
  const control = new AbortController();
  const inicio = Date.now();
  setTimeout(() => control.abort(), 10);
  await esperar(60_000, control.signal);
  assert.ok(Date.now() - inicio < 1000);
});
