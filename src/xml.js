// Datos del CFDI que el portal no muestra en la tabla y que sirven en la relación.
// Se leen con expresiones regulares para no depender de DOMParser (y poder probarlo en Node).

function atributos(xml, etiqueta) {
  const apertura = new RegExp(`<(?:[\\w-]+:)?${etiqueta}\\b([^>]*)>`).exec(xml);
  if (!apertura) return {};
  const lista = {};
  for (const [, nombre, valor] of apertura[1].matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) lista[nombre] = valor;
  return lista;
}

// Los impuestos del comprobante son los únicos <cfdi:Impuestos> con TotalImpuestos...
function impuestosDelComprobante(xml) {
  const lista = {};
  for (const m of xml.matchAll(/<(?:[\w-]+:)?Impuestos\b([^>]*TotalImpuestos[^>]*)>/g)) {
    for (const [, nombre, valor] of m[1].matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) lista[nombre] = valor;
  }
  return lista;
}

const numero = (texto) => (texto === undefined || texto === '' ? null : Number(texto));

export function datosDelXml(xml) {
  const c = atributos(xml, 'Comprobante');
  const receptor = atributos(xml, 'Receptor');
  const impuestos = impuestosDelComprobante(xml);
  return {
    version: c.Version || c.version || '',
    serie: c.Serie || '',
    folio: c.Folio || '',
    tipoComprobante: c.TipoDeComprobante || '',
    moneda: c.Moneda || '',
    tipoCambio: numero(c.TipoCambio),
    subtotal: numero(c.SubTotal),
    descuento: numero(c.Descuento),
    total: numero(c.Total),
    trasladados: numero(impuestos.TotalImpuestosTrasladados),
    retenidos: numero(impuestos.TotalImpuestosRetenidos),
    metodoPago: c.MetodoPago || '',
    formaPago: c.FormaPago || '',
    usoCfdi: receptor.UsoCFDI || '',
  };
}

export function esXmlDeCfdi(texto) {
  return /<(?:[\w-]+:)?Comprobante\b/.test(texto) && /<\?xml|xmlns/.test(texto);
}
