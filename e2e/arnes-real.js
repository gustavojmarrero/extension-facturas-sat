// Arnés para probar el motor en el portal real desde el navegador de Orca, con la sesión que
// abre el usuario. Sustituye las API de Chrome: nada se guarda en disco y solo se devuelven
// conteos (nunca datos fiscales). Se compila con `node scripts/arnes-real.mjs`.
import { Motor, nuevoTrabajo } from '../src/motor.js';
import { datosDelXml } from '../src/xml.js';

const memoria = {};
globalThis.__chromeFalso = {
  storage: {
    local: {
      async get(k) { return typeof k === 'string' ? { [k]: memoria[k] } : { ...memoria }; },
      async set(o) { Object.assign(memoria, o); },
      async remove(k) { delete memoria[k]; },
    },
  },
};

window.__arnes = {
  async correr({ tipo, anio, meses, opciones, intervalos }) {
    const guardados = [];
    const trabajo = nuevoTrabajo({ tipo, anio, meses, opciones });
    if (intervalos) trabajo.pendientes = intervalos;
    const motor = new Motor({
      tipo,
      guardar: async () => {},
      enviarArchivo: async (ruta, url) => {
        const bytes = atob(url.split(',')[1]);
        guardados.push({ ruta, tamano: bytes.length, xml: ruta.endsWith('.xml') ? bytes : null, pdf: bytes.startsWith('%PDF-') });
      },
    });
    window.__arnes.estado = 'corriendo';
    const inicio = Date.now();
    await motor.correr(trabajo);
    const xmls = guardados.filter((g) => g.xml);
    const patron = /^SAT\/[A-ZÑ&0-9]{12,13}\/(Emitidas|Recibidas)\/\d{4}\/\d{2}\/\d{4}-\d{2}-\d{2}_[^_]+_(?:[^_]+_)?[0-9A-F-]{36}\.(xml|pdf|xlsx)$/;
    window.__arnes.resultado = {
      estado: trabajo.estado,
      mensaje: trabajo.mensaje.replace(/[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}/g, '<RFC>'),
      segundos: Math.round((Date.now() - inicio) / 1000),
      consultas: trabajo.consultas,
      facturas: Object.keys(trabajo.facturas).length,
      cobertura: trabajo.cobertura.map((c) => c.estado).reduce((a, e) => ({ ...a, [e]: (a[e] || 0) + 1 }), {}),
      archivosXml: xmls.length,
      xmlConFolio: xmls.filter((g) => datosDelXml(g.xml).folio).length,
      archivosPdf: guardados.filter((g) => g.ruta.endsWith('.pdf')).length,
      pdfValidos: guardados.filter((g) => g.ruta.endsWith('.pdf') && g.pdf).length,
      excel: guardados.filter((g) => g.ruta.endsWith('.xlsx')).map((g) => g.tamano),
      nombresValidos: guardados.filter((g) => !g.ruta.endsWith('.xlsx')).every((g) => patron.test(g.ruta)),
      errores: trabajo.errores.length,
      camposVacios: Object.values(trabajo.facturas).filter((f) => !f.fechaEmision || !f.rfcEmisor || !f.rfcReceptor || f.total === null).length,
    };
    window.__arnes.estado = 'listo';
    return window.__arnes.resultado;
  },
};
'arnes listo';
