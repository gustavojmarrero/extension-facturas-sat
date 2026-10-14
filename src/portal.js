// Estructura del portal «Consulta y recuperación de comprobantes» del SAT
// (portalcfdi.facturaelectronica.sat.gob.mx), comprobada en una sesión real el 2026-10-14.
// Si el SAT cambia el portal, se actualiza aquí y en las pruebas con su fecha.

export const ORIGEN = 'https://portalcfdi.facturaelectronica.sat.gob.mx';

export const PAGINAS = {
  emitidas: 'ConsultaEmisor.aspx',
  recibidas: 'ConsultaReceptor.aspx',
};

// Cada consulta devuelve como máximo 500 filas y muestra este panel cuando trunca.
export const TOPE_POR_CONSULTA = 500;
// Cuota diaria del portal: ValidarDescarga responde CantidadTope: 2000.
export const CUOTA_XML_DIARIA = 2000;

export const IDS = {
  radioFechas: 'ctl00_MainContent_RdoFechas', // hace __doPostBack al marcarse
  buscar: 'ctl00_MainContent_BtnBusqueda',
  tabla: 'ctl00_MainContent_tblResult', // el portal la reemplaza al terminar cada consulta
  contenedorTabla: 'ContenedorDinamico',
  panelLimite: 'ctl00_MainContent_PnlLimiteRegistros', // «solo muestra los primeros 500 registros»
  panelSinResultados: 'ctl00_MainContent_PnlNoResultados',
  alertas: 'dvAlert',
  progreso: 'ctl00_MainContent_UpdateProgress1',
};

// Recibidas: un mes completo (día 0) o un día, con hora, minuto y segundo de inicio y fin.
export const RECIBIDAS = {
  anio: 'DdlAnio',
  mes: 'ctl00_MainContent_CldFecha_DdlMes', // valores 1..12
  dia: 'ctl00_MainContent_CldFecha_DdlDia', // '0' = todo el mes; '01'..'31'
  hora: 'ctl00_MainContent_CldFecha_DdlHora',
  minuto: 'ctl00_MainContent_CldFecha_DdlMinuto',
  segundo: 'ctl00_MainContent_CldFecha_DdlSegundo',
  horaFin: 'ctl00_MainContent_CldFecha_DdlHoraFin',
  minutoFin: 'ctl00_MainContent_CldFecha_DdlMinutoFin',
  segundoFin: 'ctl00_MainContent_CldFecha_DdlSegundoFin',
};

// Emitidas: rango de fechas dd/mm/aaaa (los campos de texto están deshabilitados, pero
// asignarles valor funciona) con hora, minuto y segundo de inicio y fin.
export const EMITIDAS = {
  desde: 'ctl00_MainContent_CldFechaInicial2_Calendario_text',
  hasta: 'ctl00_MainContent_CldFechaFinal2_Calendario_text',
  hora: 'ctl00_MainContent_CldFechaInicial2_DdlHora',
  minuto: 'ctl00_MainContent_CldFechaInicial2_DdlMinuto',
  segundo: 'ctl00_MainContent_CldFechaInicial2_DdlSegundo',
  horaFin: 'ctl00_MainContent_CldFechaFinal2_DdlHora',
  minutoFin: 'ctl00_MainContent_CldFechaFinal2_DdlMinuto',
  segundoFin: 'ctl00_MainContent_CldFechaFinal2_DdlSegundo',
};

// Columnas de la tabla de resultados, en orden (la primera es «Acciones»).
export const COLUMNAS = [
  'Acciones', 'Folio Fiscal', 'RFC Emisor', 'Nombre o Razón Social del Emisor', 'RFC Receptor',
  'Nombre o Razón Social del Receptor', 'Fecha de Emisión', 'Fecha de Certificación', 'PAC que Certificó',
  'Total', 'Efecto del Comprobante', 'Estatus de cancelación', 'Estado del Comprobante',
  'Estatus de Proceso de Cancelación', 'Fecha de Solicitud de la Cancelación', 'Fecha de Cancelación',
  'RFC a cuenta de terceros',
];

// En cada fila: input.ListaFolios (value = UUID) y, en la celda de acciones,
// #BtnDescarga  onclick="return AccionCfdi('RecuperaCfdi.aspx?Datos=…','Recuperacion');"
// #BtnRI        onclick="recuperaRepresentacionImpresa('…');"
export const FILA = {
  uuid: 'input.ListaFolios',
  descargaXml: '#BtnDescarga',
  descargaPdf: '#BtnRI',
};

// Métodos de página (POST JSON a `<página>.aspx/<método>`), probados con fetch y la sesión:
// - ValidarDescarga {id: n} y ValidarDescargaRi {id: n} → d.Codigo 0 = se puede; si no, d.Mensaje.
//   CantidadDisponible llegó en 0 con Codigo 0: no se usa como saldo.
// - RecuperaRepresentacionImpresa {datos} → d = URL del PDF.
// - GET RecuperaCfdi.aspx?Datos=… → XML (application/octet-stream).
// - GET /mantienesesion.aspx mantiene la sesión; 401 = sesión cerrada.
export const METODOS = {
  validarXml: 'ValidarDescarga',
  validarPdf: 'ValidarDescargaRi',
  urlPdf: 'RecuperaRepresentacionImpresa',
  mantenerSesion: '/mantienesesion.aspx',
};

// Controles que la extensión nunca toca: cancelan facturas o seleccionan en lote.
export const PROHIBIDOS = [
  'ctl00_MainContent_BtnCancelar', 'ctl00_MainContent_btnCancelarModal', 'seleccionador',
  'ctl00_MainContent_BtnDescargar', 'ctl00_MainContent_BtnDescargarRi', 'ctl00_MainContent_BtnMetadata',
];
