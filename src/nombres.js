// Carpetas y nombres de los archivos descargados:
// SAT/<RFC>/Recibidas/2026/09/2026-09-01_<RFC de la contraparte>_<serie-folio>_<UUID>.xml
// El PDF lleva el mismo nombre. El Excel va en SAT/<RFC>/.

// Caracteres que Windows o macOS no aceptan en un nombre de archivo.
export function limpiar(texto) {
  return String(texto ?? '')
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .slice(0, 60);
}

export function carpetaTipo(tipo) {
  return tipo === 'emitidas' ? 'Emitidas' : 'Recibidas';
}

export function rutaArchivo({ tipo, rfc, factura, serie, folio, extension }) {
  const fecha = (factura.fechaEmision || '').slice(0, 10) || 'sin-fecha';
  const [anio = 'sin-fecha', mes = ''] = fecha.split('-');
  const contraparte = tipo === 'emitidas' ? factura.rfcReceptor : factura.rfcEmisor;
  const serieFolio = [serie, folio].map(limpiar).filter(Boolean).join('-');
  const base = [fecha, limpiar(contraparte), serieFolio, limpiar(factura.uuid)].filter(Boolean).join('_');
  const carpeta = ['SAT', limpiar(rfc), carpetaTipo(tipo), anio, mes].filter(Boolean).join('/');
  return `${carpeta}/${base}.${extension}`;
}

// SAT/<RFC>/Relacion_Recibidas_2026-09.xlsx (o _2026 si es el año completo).
export function rutaExcel({ tipo, rfc, anio, meses }) {
  const periodo = meses.length === 1 ? `${anio}-${String(meses[0]).padStart(2, '0')}` : String(anio);
  return `SAT/${limpiar(rfc)}/Relacion_${carpetaTipo(tipo)}_${periodo}.xlsx`;
}
