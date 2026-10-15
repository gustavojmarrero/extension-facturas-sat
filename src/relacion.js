// Arma las hojas del Excel a partir de lo que reunió un trabajo:
// Facturas (una fila por UUID), Cobertura (cada consulta y si quedó completa) y Resumen.

import { etiqueta } from './intervalos.js';
import { carpetaTipo } from './nombres.js';

export const ENLACE_SITIO = 'https://reporteagil.com/?utm_source=extension-facturas-sat&utm_medium=excel';

// «$1,354.56» o «-$1,354.56» → número.
export function importe(texto) {
  if (typeof texto === 'number') return texto;
  const limpio = String(texto ?? '').replace(/[^0-9.-]/g, '');
  if (!limpio || limpio === '-' || limpio === '.') return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

const COLUMNAS_FACTURAS = [
  { titulo: 'Folio fiscal (UUID)', ancho: 38 },
  { titulo: 'Fecha de emisión', ancho: 20, tipo: 'fecha' },
  { titulo: 'Fecha de certificación', ancho: 20, tipo: 'fecha' },
  { titulo: 'RFC emisor', ancho: 15 },
  { titulo: 'Nombre del emisor', ancho: 36 },
  { titulo: 'RFC receptor', ancho: 15 },
  { titulo: 'Nombre del receptor', ancho: 36 },
  { titulo: 'Efecto', ancho: 12 },
  { titulo: 'Estado', ancho: 11 },
  { titulo: 'Estatus de cancelación', ancho: 24 },
  { titulo: 'Fecha de cancelación', ancho: 20, tipo: 'fecha' },
  { titulo: 'Total', ancho: 15, tipo: 'numero' },
  { titulo: 'Serie', ancho: 10 },
  { titulo: 'Folio', ancho: 12 },
  { titulo: 'Moneda', ancho: 8 },
  { titulo: 'Tipo de cambio', ancho: 10, tipo: 'numero' },
  { titulo: 'Subtotal', ancho: 15, tipo: 'numero' },
  { titulo: 'Descuento', ancho: 13, tipo: 'numero' },
  { titulo: 'Impuestos trasladados', ancho: 15, tipo: 'numero' },
  { titulo: 'Impuestos retenidos', ancho: 15, tipo: 'numero' },
  { titulo: 'Método de pago', ancho: 10 },
  { titulo: 'Forma de pago', ancho: 10 },
  { titulo: 'Uso del CFDI', ancho: 10 },
  { titulo: 'PAC que certificó', ancho: 15 },
  { titulo: 'RFC a cuenta de terceros', ancho: 15 },
  { titulo: 'XML', ancho: 6 },
  { titulo: 'PDF', ancho: 6 },
  { titulo: 'Archivo XML', ancho: 60 },
];

function filaFactura(f, archivos = {}) {
  const x = f.xml || {};
  return [
    f.uuid, f.fechaEmision, f.fechaCertificacion, f.rfcEmisor, f.nombreEmisor, f.rfcReceptor, f.nombreReceptor,
    f.efecto, f.estado, f.estatusCancelacion, f.fechaCancelacion, importe(f.total),
    x.serie, x.folio, x.moneda, x.tipoCambio, x.subtotal, x.descuento, x.trasladados, x.retenidos,
    x.metodoPago, x.formaPago, x.usoCfdi, f.pac, f.rfcTercero,
    archivos.xml ? 'Sí' : 'No', archivos.pdf ? 'Sí' : 'No', archivos.xml || '',
  ];
}

const ESTADO_COBERTURA = {
  completo: 'Completo',
  incompleto: 'Incompleto',
  pendiente: 'Pendiente',
};

export function hojasDeRelacion(trabajo, ahora = new Date()) {
  const facturas = Object.values(trabajo.facturas || {}).sort((a, b) => (a.fechaEmision || '').localeCompare(b.fechaEmision || ''));
  const archivos = trabajo.archivos || {};
  const cobertura = [
    ...(trabajo.cobertura || []),
    ...(trabajo.pendientes || []).map((iv) => ({ iv, n: null, estado: 'pendiente' })),
  ];
  const incompletos = cobertura.filter((c) => c.estado !== 'completo').length;
  const conXml = facturas.filter((f) => archivos[f.uuid]?.xml).length;
  const conPdf = facturas.filter((f) => archivos[f.uuid]?.pdf).length;
  const vigentes = facturas.filter((f) => /vigente/i.test(f.estado || '')).length;

  const resumen = [
    ['RFC', trabajo.rfc || ''],
    ['Facturas', carpetaTipo(trabajo.tipo)],
    ['Periodo', trabajo.meses.length === 1 ? `${trabajo.anio}-${String(trabajo.meses[0]).padStart(2, '0')}` : `${trabajo.anio} (${trabajo.meses.length} meses)`],
    ['Facturas encontradas', facturas.length],
    ['Vigentes', vigentes],
    ['Canceladas', facturas.length - vigentes],
    ['XML descargados', trabajo.opciones?.xml ? conXml : 'No se pidieron'],
    ['PDF descargados', trabajo.opciones?.pdf ? conPdf : 'No se pidieron'],
    ['Consultas al portal', cobertura.length],
    [
      'Cobertura',
      incompletos === 0 ? 'Completa: ninguna consulta quedó cortada en 500.' : `${incompletos} consulta(s) sin terminar o cortadas: revisa la hoja Cobertura.`,
    ],
    ['Generado', ahora.toISOString().slice(0, 19).replace('T', ' ')],
    ['', ''],
    ['Herramienta', 'Facturas SAT a Excel, XML y PDF de Reporte Ágil. No es una herramienta del SAT.'],
    ['Privacidad', 'Tus facturas se procesaron en tu navegador; no se enviaron a ningún servidor de Reporte Ágil.'],
    ['Más herramientas', { url: ENLACE_SITIO, texto: 'reporteagil.com' }],
  ];

  return [
    {
      nombre: 'Facturas',
      columnas: COLUMNAS_FACTURAS,
      filas: facturas.map((f) => filaFactura(f, archivos[f.uuid])),
    },
    {
      nombre: 'Cobertura',
      columnas: [
        { titulo: 'Consulta', ancho: 34 },
        { titulo: 'Facturas', ancho: 10, tipo: 'entero' },
        { titulo: 'Estado', ancho: 12 },
        { titulo: 'Nota', ancho: 80 },
      ],
      filas: cobertura.map((c) => [etiqueta(c.iv), c.n, ESTADO_COBERTURA[c.estado] || c.estado, c.nota || '']),
    },
    {
      nombre: 'Resumen',
      columnas: [
        { titulo: 'Concepto', ancho: 24 },
        { titulo: 'Valor', ancho: 90, tipo: 'mixto' },
      ],
      filas: resumen,
      filtro: false,
    },
  ];
}
