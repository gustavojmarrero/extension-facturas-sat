import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datosDelXml, datosParaValidar, esXmlDeCfdi } from '../src/xml.js';

const CFDI = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Serie="F" Folio="2045" Fecha="2026-09-01T10:20:30"
  SubTotal="1000.00" Descuento="50.00" Moneda="MXN" TipoCambio="1" Total="1102.00" TipoDeComprobante="I" Exportacion="01"
  MetodoPago="PUE" FormaPago="03" LugarExpedicion="01000">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="EMISOR" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB020202BBB" Nombre="RECEPTOR" UsoCFDI="G03" DomicilioFiscalReceptor="01000" RegimenFiscalReceptor="601"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="X" ValorUnitario="1000.00" Importe="1000.00" Descuento="50.00" ObjetoImp="02">
    <cfdi:Impuestos><cfdi:Traslados><cfdi:Traslado Base="950.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="152.00"/></cfdi:Traslados></cfdi:Impuestos>
  </cfdi:Concepto></cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="152.00"><cfdi:Traslados><cfdi:Traslado Base="950.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="152.00"/></cfdi:Traslados></cfdi:Impuestos>
</cfdi:Comprobante>`;

test('lee serie, folio, importes, impuestos del comprobante y uso del CFDI', () => {
  const d = datosDelXml(CFDI);
  assert.equal(d.version, '4.0');
  assert.equal(d.serie, 'F');
  assert.equal(d.folio, '2045');
  assert.equal(d.subtotal, 1000);
  assert.equal(d.descuento, 50);
  assert.equal(d.total, 1102);
  assert.equal(d.trasladados, 152);
  assert.equal(d.retenidos, null);
  assert.equal(d.metodoPago, 'PUE');
  assert.equal(d.formaPago, '03');
  assert.equal(d.usoCfdi, 'G03');
  assert.equal(d.tipoComprobante, 'I');
});

test('sin serie ni impuestos no falla', () => {
  const d = datosDelXml('<?xml version="1.0"?><cfdi:Comprobante xmlns:cfdi="x" Version="4.0" Total="0" TipoDeComprobante="P"><cfdi:Receptor UsoCFDI="CP01"/></cfdi:Comprobante>');
  assert.equal(d.serie, '');
  assert.equal(d.trasladados, null);
  assert.equal(d.usoCfdi, 'CP01');
});

test('reconoce un CFDI y rechaza una página HTML', () => {
  assert.ok(esXmlDeCfdi(CFDI));
  assert.ok(!esXmlDeCfdi('<html><body>Inicia sesión</body></html>'));
});

// Datos inventados: los RFC son los genéricos de prueba y el UUID no existe.
const TIMBRADO = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Fecha="2026-09-01T10:20:30" Total="1160.50"
  Sello="QUJDREVGR0hJSktM
  TU5PUFFSU1RVVldYWVo=" TipoDeComprobante="I">
  <cfdi:Emisor Rfc="M&amp;M010101AB1" Nombre="DULCES &quot;LA ESQUINA&quot; &amp; ASOCIADOS &#209;U" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101000" Nombre="PUBLICO EN GENERAL" UsoCFDI="S01"/>
  <cfdi:Complemento><tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1"
    UUID="0000AAAA-0000-4000-8000-000000000001" SelloCFD="NO-ES-ESTE" SelloSAT="TAMPOCO-ESTE"/></cfdi:Complemento>
</cfdi:Comprobante>`;

test('lee lo que pide el validador: UUID del timbre, RFC, nombre, fecha, total y sello del comprobante', () => {
  const d = datosParaValidar(TIMBRADO);
  assert.equal(d.version, '4.0');
  assert.equal(d.uuid, '0000AAAA-0000-4000-8000-000000000001');
  assert.equal(d.rfcEmisor, 'M&M010101AB1');
  assert.equal(d.nombreEmisor, 'DULCES "LA ESQUINA" & ASOCIADOS ÑU');
  assert.equal(d.rfcReceptor, 'XAXX010101000');
  assert.equal(d.fecha, '2026-09-01T10:20:30');
  assert.equal(d.total, '1160.50');
  assert.equal(d.sello, 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=');
  assert.equal(d.sello.slice(-8), 'VldYWVo=');
});

test('el CFDI 3.2 trae sus atributos en minúsculas', () => {
  const d = datosParaValidar(`<?xml version="1.0"?><cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/3" version="3.2" fecha="2016-05-01T08:00:00" total="99.9" sello="ABCDEFGHIJ">
    <cfdi:Emisor rfc="AAA010101AAA" nombre="EMISOR"/><cfdi:Receptor rfc="BBB020202BBB"/>
    <cfdi:Complemento><tfd:TimbreFiscalDigital xmlns:tfd="x" version="1.0" UUID="0000aaaa-0000-4000-8000-000000000002" selloSAT="Z"/></cfdi:Complemento></cfdi:Comprobante>`);
  assert.deepEqual(d, {
    version: '3.2', uuid: '0000aaaa-0000-4000-8000-000000000002', rfcEmisor: 'AAA010101AAA', nombreEmisor: 'EMISOR',
    rfcReceptor: 'BBB020202BBB', fecha: '2016-05-01T08:00:00', total: '99.9', sello: 'ABCDEFGHIJ',
  });
});

test('comillas simples y un «>» dentro de un valor', () => {
  const d = datosParaValidar(`<cfdi:Comprobante xmlns:cfdi="x" Version='4.0' Total='10'><cfdi:Emisor Nombre="A > B" Rfc='AAA010101AAA'/></cfdi:Comprobante>`);
  assert.equal(d.nombreEmisor, 'A > B');
  assert.equal(d.rfcEmisor, 'AAA010101AAA');
  assert.equal(d.total, '10');
});

test('sin timbre ni receptor deja los campos vacíos', () => {
  const d = datosParaValidar('<?xml version="1.0"?><cfdi:Comprobante xmlns:cfdi="x" Version="4.0" Total="1"/>');
  assert.equal(d.uuid, '');
  assert.equal(d.rfcReceptor, '');
  assert.equal(d.sello, '');
});
