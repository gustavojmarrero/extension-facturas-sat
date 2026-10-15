import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datosDelXml, esXmlDeCfdi } from '../src/xml.js';

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
