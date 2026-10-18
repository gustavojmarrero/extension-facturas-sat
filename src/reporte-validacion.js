// Hojas del Excel del validador: Validación (una fila por XML, con los valores tal como los
// devolvió el SAT y su lectura en claro) y Resumen.

import { lectura, claseDeEstado } from './verificacion.js';

export const ENLACE_SITIO_VALIDADOR = 'https://reporteagil.com/?utm_source=extension-facturas-sat&utm_medium=excel-validacion';

const COLUMNAS = [
  { titulo: 'Archivo', ancho: 40 },
  { titulo: 'Folio fiscal (UUID)', ancho: 38 },
  { titulo: 'RFC emisor', ancho: 15 },
  { titulo: 'Nombre del emisor', ancho: 36 },
  { titulo: 'RFC receptor', ancho: 15 },
  { titulo: 'Fecha de emisión', ancho: 20, tipo: 'fecha' },
  { titulo: 'Total', ancho: 15, tipo: 'numero' },
  { titulo: 'CodigoEstatus', ancho: 44 },
  { titulo: 'Estado', ancho: 14 },
  { titulo: 'EsCancelable', ancho: 26 },
  { titulo: 'EstatusCancelacion', ancho: 26 },
  { titulo: 'ValidacionEFOS', ancho: 15 },
  { titulo: 'Lectura', ancho: 90 },
  { titulo: 'Consultado', ancho: 20, tipo: 'fecha' },
];

// Lectura de una fila sin respuesta del SAT.
export function lecturaDeFila(f) {
  if (f.resultado) return lectura(f.resultado);
  if (f.problema) return `No se consultó: ${f.problema}`;
  if (f.error) return `Sin respuesta del SAT: ${f.error}`;
  return 'Sin consultar.';
}

function fila(f) {
  const d = f.datos || {};
  const r = f.resultado || {};
  const total = d.total === undefined || d.total === '' ? null : Number(d.total);
  return [
    f.archivo, d.uuid, d.rfcEmisor, d.nombreEmisor, d.rfcReceptor, d.fecha, Number.isFinite(total) ? total : d.total,
    r.codigoEstatus, r.estado, r.esCancelable, r.estatusCancelacion, r.validacionEfos,
    lecturaDeFila(f), r.consultado || f.consultado,
  ];
}

// Cifras que comparten la página y el resumen del Excel.
export function cifrasDeValidacion(filas) {
  const con = filas.filter((f) => f.resultado);
  const clase = (c) => con.filter((f) => claseDeEstado(f.resultado) === c).length;
  return {
    archivos: filas.length,
    consultados: con.length,
    vigentes: clase('vigente'),
    cancelados: clase('cancelado'),
    noEncontrados: clase('no-encontrado'),
    efos: con.filter((f) => f.resultado.validacionEfos === '100').length,
    sinRespuesta: filas.filter((f) => !f.resultado && (f.error || f.problema)).length,
    pendientes: filas.filter((f) => !f.resultado && !f.error && !f.problema).length,
  };
}

export function hojasDeValidacion(filas, { repetidos = 0, ahora = new Date() } = {}) {
  const c = cifrasDeValidacion(filas);
  const resumen = [
    ['XML en la lista', c.archivos],
    ['Repetidos (mismo UUID)', repetidos ? `${repetidos}: se consultaron una sola vez y no se repiten en la hoja` : 0],
    ['Consultados en el SAT', c.consultados],
    ['Vigentes', c.vigentes],
    ['Cancelados', c.cancelados],
    ['No encontrados', c.noEncontrados],
    ['Emisor en la lista de EFOS (100)', c.efos],
    ['Sin respuesta o sin consultar', c.sinRespuesta + c.pendientes],
    ['Generado', ahora.toISOString().slice(0, 19).replace('T', ' ')],
    ['', ''],
    ['Fuente', 'Servicio público de verificación de CFDI del SAT (consultaqr.facturaelectronica.sat.gob.mx).'],
    ['Herramienta', 'Validador de Facturas SAT a Excel, XML y PDF de Reporte Ágil. No es una herramienta del SAT.'],
    [
      'Privacidad',
      'Los XML se leyeron en tu navegador. Por cada CFDI se envió al SAT solo el UUID, el RFC del emisor y del receptor, el total y los últimos 8 caracteres del sello; nada se envió a Reporte Ágil.',
    ],
    ['Más herramientas', { url: ENLACE_SITIO_VALIDADOR, texto: 'reporteagil.com' }],
  ];
  return [
    { nombre: 'Validación', columnas: COLUMNAS, filas: filas.map(fila) },
    {
      nombre: 'Resumen',
      columnas: [
        { titulo: 'Concepto', ancho: 32 },
        { titulo: 'Valor', ancho: 100, tipo: 'mixto' },
      ],
      filas: resumen,
      filtro: false,
    },
  ];
}
