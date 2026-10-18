// Datos del CFDI que el portal no muestra en la tabla y que sirven en la relación.
// Se leen con expresiones regulares para no depender de DOMParser (y poder probarlo en Node).

// Atributos de la primera etiqueta con ese nombre (con o sin prefijo). Acepta comillas simples
// o dobles y un «>» dentro de un valor, que el XML permite sin escapar.
function atributos(xml, etiqueta) {
  const apertura = new RegExp(`<(?:[\\w-]+:)?${etiqueta}\\b((?:[^>"']|"[^"]*"|'[^']*')*)>`).exec(xml);
  if (!apertura) return {};
  const lista = {};
  for (const [, nombre, doble, simple] of apertura[1].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) lista[nombre] = doble ?? simple;
  return lista;
}

// «&amp;», «&#209;» y demás entidades de un valor, para los RFC y nombres que las llevan.
export function sinEntidades(valor = '') {
  return valor.replace(/&(?:#x([0-9a-f]+)|#(\d+)|(amp|lt|gt|quot|apos));/gi, (_, hex, dec, nombre) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : dec ? String.fromCodePoint(Number(dec)) : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[nombre.toLowerCase()],
  );
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

// Lo que pide el validador: la expresión impresa del CFDI (UUID, RFC del emisor y del receptor,
// total y sello) y lo que se muestra junto al resultado. El CFDI 3.2 escribe sus atributos en
// minúsculas; el total y el sello quedan como texto, tal cual vienen en el XML.
export function datosParaValidar(xml) {
  const c = atributos(xml, 'Comprobante');
  const emisor = atributos(xml, 'Emisor');
  const receptor = atributos(xml, 'Receptor');
  const timbre = atributos(xml, 'TimbreFiscalDigital');
  const valor = (o, nombre) => sinEntidades(o[nombre] ?? o[nombre.toLowerCase()] ?? '').trim();
  return {
    version: valor(c, 'Version'),
    uuid: valor(timbre, 'UUID'),
    rfcEmisor: valor(emisor, 'Rfc'),
    nombreEmisor: valor(emisor, 'Nombre'),
    rfcReceptor: valor(receptor, 'Rfc'),
    fecha: valor(c, 'Fecha'),
    total: valor(c, 'Total'),
    sello: valor(c, 'Sello').replace(/\s+/g, ''),
  };
}

export function esXmlDeCfdi(texto) {
  return /<(?:[\w-]+:)?Comprobante\b/.test(texto) && /<\?xml|xmlns/.test(texto);
}
