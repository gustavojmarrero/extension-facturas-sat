// Servicio de verificación de CFDI del SAT simulado (ConsultaCFDIService) para las pruebas del
// validador. Como el real, responde 500 si la expresión trae un «&» sin escapar y «N - 601» si
// sus datos no coinciden; además comprueba el formato exacto de cada campo. Datos inventados.

export const SERVICIO = 'https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc';
export const VERIFICADOR = 'https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx';

const escapar = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// XML de un CFDI timbrado (4.0 por omisión; 3.2 con sus atributos en minúsculas).
export function xmlCfdi({ uuid, version = '4.0', emisor = 'AAA010101AAA', nombre = 'PAPELERIA LA ESCUADRA SA DE CV', receptor = 'XAXX010101000', total, sello = 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=', fecha = '2026-09-01T10:20:30' }) {
  if (version === '3.2') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/3" version="3.2" fecha="${fecha}" total="${total}" sello="${sello}" tipoDeComprobante="ingreso">
  <cfdi:Emisor rfc="${escapar(emisor)}" nombre="${escapar(nombre)}"/><cfdi:Receptor rfc="${escapar(receptor)}"/>
  <cfdi:Complemento><tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" version="1.0" UUID="${uuid}" selloSAT="NO-ES-ESTE"/></cfdi:Complemento>
</cfdi:Comprobante>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="${version}" Fecha="${fecha}" Total="${total}" Sello="${sello}" TipoDeComprobante="I" Moneda="MXN">
  <cfdi:Emisor Rfc="${escapar(emisor)}" Nombre="${escapar(nombre)}" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="${escapar(receptor)}" Nombre="PUBLICO EN GENERAL" UsoCFDI="S01"/>
  <cfdi:Complemento><tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="${uuid}" SelloCFD="NO-ES-ESTE" SelloSAT="TAMPOCO"/></cfdi:Complemento>
</cfdi:Comprobante>`;
}

function respuesta({ codigo = 'S - Comprobante obtenido satisfactoriamente.', estado = 'Vigente', cancelable = 'Cancelable con aceptación', cancelacion = '', efos = '200' }) {
  return (
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><ConsultaResponse xmlns="http://tempuri.org/">' +
    '<ConsultaResult xmlns:a="http://schemas.datacontract.org/2004/07/Sat.Cfdi.Negocio.ConsultaCfdi.Servicio" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">' +
    `<a:CodigoEstatus>${codigo}</a:CodigoEstatus><a:EsCancelable>${cancelable}</a:EsCancelable><a:Estado>${estado}</a:Estado>` +
    (cancelacion ? `<a:EstatusCancelacion>${cancelacion}</a:EstatusCancelacion>` : '<a:EstatusCancelacion i:nil="true"/>') +
    `<a:ValidacionEFOS>${efos}</a:ValidacionEFOS></ConsultaResult></ConsultaResponse></s:Body></s:Envelope>`
  );
}

const NO_ENCONTRADO = { codigo: 'N - 602: Comprobante no encontrado.', estado: 'No Encontrado', cancelable: '', efos: '' };
const NO_VALIDA = { codigo: 'N - 601: La expresión impresa proporcionada no es válida.', estado: 'No Encontrado', cancelable: '', efos: '' };
const FALLA = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault><faultcode>s:Client</faultcode><faultstring xml:lang="es-MX">Solicitud mal formada</faultstring></s:Fault></s:Body></s:Envelope>';

// La expresión impresa tal como la recibe el SAT: se desescapa una vez (los «&» de un RFC siguen
// como «&amp;») y se parte en sus campos.
function leerExpresion(cuerpo) {
  const m = /<(?:[\w-]+:)?expresionImpresa>([\s\S]*?)<\/(?:[\w-]+:)?expresionImpresa>/.exec(cuerpo);
  if (!m) return null;
  if (/&(?!amp;|lt;|gt;|quot;|apos;)/.test(m[1])) return { malformada: true };
  const texto = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const i = texto.indexOf('?');
  const campos = {};
  for (const par of texto.slice(i + 1).split(/&(?!amp;)/)) {
    const j = par.indexOf('=');
    campos[par.slice(0, j)] = par.slice(j + 1);
  }
  return { base: texto.slice(0, i), campos };
}

// `cfdis`: { [uuid]: { base, campos: { id, re, rr, tt, fe? }, respuesta, fallasDeRed } }.
// `campos` es la expresión que se espera, campo por campo y con el formato exacto.
export async function montarSat(context, cfdis, { demoraMs = 120 } = {}) {
  const registro = { peticiones: [], enCurso: 0, maxSimultaneas: 0 };
  await context.route(`${SERVICIO}*`, async (route) => {
    const peticion = route.request();
    const cuerpo = peticion.postData() || '';
    const expresion = leerExpresion(cuerpo);
    const id = expresion?.campos?.id;
    registro.peticiones.push({ id, accion: peticion.headers().soapaction, metodo: peticion.method() });
    const cfdi = cfdis[id];
    if (cfdi?.fallasDeRed > 0) {
      cfdi.fallasDeRed--;
      return route.abort('failed').catch(() => {});
    }
    registro.enCurso++;
    registro.maxSimultaneas = Math.max(registro.maxSimultaneas, registro.enCurso);
    await new Promise((r) => setTimeout(r, demoraMs));
    registro.enCurso--;
    // Si la página abortó la petición (Detener), el fulfill falla y no importa.
    const responder = (status, body) => route.fulfill({ status, contentType: 'text/xml; charset=utf-8', body }).catch(() => {});
    if (peticion.method() !== 'POST' || peticion.headers().soapaction !== '"http://tempuri.org/IConsultaCFDIService/Consulta"' || !expresion || expresion.malformada) {
      return responder(500, FALLA);
    }
    const xml = (r) => responder(200, respuesta(r));
    if (!cfdi) return xml(NO_ENCONTRADO);
    const coincide = expresion.base === cfdi.base && Object.entries(cfdi.campos).every(([k, v]) => expresion.campos[k] === v) &&
      Object.keys(expresion.campos).length === Object.keys(cfdi.campos).length;
    return xml(coincide ? cfdi.respuesta : NO_VALIDA);
  });
  return registro;
}
