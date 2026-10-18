// Prueba contra el servicio real del SAT (ConsultaCFDIService) con XML de CFDI del equipo:
//   node scripts/consulta-sat-real.mjs <archivo.xml|carpeta> [...]
// Por privacidad solo imprime conteos y códigos de estado: nunca RFC, UUID, nombres ni importes.
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SERVICIO = 'https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc';
const ACCION = 'http://tempuri.org/IConsultaCFDIService/Consulta';

function atributos(xml, etiqueta) {
  const apertura = new RegExp(`<(?:[\\w-]+:)?${etiqueta}\\b([^>]*)>`).exec(xml);
  if (!apertura) return {};
  const lista = {};
  for (const [, nombre, valor] of apertura[1].matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) lista[nombre] = valor;
  return lista;
}

const xmlEntidades = (t) => t.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function leer(xml) {
  const c = atributos(xml, 'Comprobante');
  const tfd = atributos(xml, 'TimbreFiscalDigital');
  return {
    version: c.Version || c.version || '',
    total: c.Total || c.total || '',
    sello: c.Sello || c.sello || '',
    re: xmlEntidades(atributos(xml, 'Emisor').Rfc || atributos(xml, 'Emisor').rfc || ''),
    rr: xmlEntidades(atributos(xml, 'Receptor').Rfc || atributos(xml, 'Receptor').rfc || ''),
    uuid: tfd.UUID || '',
  };
}

// 3.2: 17 caracteres, ceros a la izquierda y 6 decimales.
const tt32 = (total) => Number(total).toFixed(6).padStart(17, '0');
// 3.3 y 4.0: 6 decimales sin los ceros sobrantes de la derecha, al menos un decimal.
const tt33 = (total) => Number(total).toFixed(6).replace(/0+$/, '').replace(/\.$/, '.0');
const rfcExpr = (rfc) => rfc.replace(/&/g, '&amp;');

const VARIANTES = {
  'url+fe (3.3/4.0)': (d) =>
    `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${d.uuid}&re=${rfcExpr(d.re)}&rr=${rfcExpr(d.rr)}&tt=${tt33(d.total)}&fe=${d.sello.slice(-8)}`,
  '?re&rr&tt32&id (3.2)': (d) => `?re=${rfcExpr(d.re)}&rr=${rfcExpr(d.rr)}&tt=${tt32(d.total)}&id=${d.uuid}`,
  '?re&rr&tt33&id': (d) => `?re=${rfcExpr(d.re)}&rr=${rfcExpr(d.rr)}&tt=${tt33(d.total)}&id=${d.uuid}`,
  '?id&re&rr&tt33&fe': (d) => `?id=${d.uuid}&re=${rfcExpr(d.re)}&rr=${rfcExpr(d.rr)}&tt=${tt33(d.total)}&fe=${d.sello.slice(-8)}`,
};

const escapar = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function consultar(expresion) {
  const cuerpo =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">' +
    `<soap:Body><tem:Consulta><tem:expresionImpresa>${escapar(expresion)}</tem:expresionImpresa></tem:Consulta></soap:Body>` +
    '</soap:Envelope>';
  const r = await fetch(SERVICIO, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"${ACCION}"` },
    body: cuerpo,
  });
  const texto = await r.text();
  const campo = (n) => (new RegExp(`<(?:[\\w-]+:)?${n}\\b[^>]*?(?:/>|>([^<]*)</)`).exec(texto) || [])[1] ?? '';
  return { http: r.status, codigo: campo('CodigoEstatus'), estado: campo('Estado'), efos: campo('ValidacionEFOS') };
}

function archivos(rutas) {
  const lista = [];
  for (const ruta of rutas) {
    if (statSync(ruta).isDirectory()) {
      for (const e of readdirSync(ruta, { recursive: true })) if (/\.xml$/i.test(e)) lista.push(join(ruta, e));
    } else lista.push(ruta);
  }
  return lista;
}

const conteo = {};
const sumar = (clave) => (conteo[clave] = (conteo[clave] || 0) + 1);
const lista = archivos(process.argv.slice(2));
for (const [i, archivo] of lista.entries()) {
  const d = leer(readFileSync(archivo, 'utf8'));
  if (!d.uuid || !d.re || !d.rr || !d.total) {
    console.log(`#${i + 1} versión ${d.version || '?'}: le faltan datos para la expresión`);
    sumar('sin datos');
    continue;
  }
  for (const [nombre, armar] of Object.entries(VARIANTES)) {
    if (nombre.includes('fe') && d.sello.length < 8) continue;
    const r = await consultar(armar(d));
    // CodigoEstatus es texto del SAT («S - Comprobante obtenido satisfactoriamente.»), sin datos fiscales.
    const codigo = r.codigo.split(':')[0].trim();
    console.log(`#${i + 1} versión ${d.version} · ${nombre}: HTTP ${r.http} · ${codigo} · ${r.estado || '-'} · EFOS ${r.efos || '-'}`);
    sumar(`${nombre} → ${codigo} / ${r.estado || '-'}`);
    await new Promise((res) => setTimeout(res, 800));
  }
}
console.log('\nConteos:');
for (const [clave, n] of Object.entries(conteo)) console.log(`  ${clave}: ${n}`);
