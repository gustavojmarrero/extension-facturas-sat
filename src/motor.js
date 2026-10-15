// Recorre el periodo pedido: consulta cada intervalo, parte los que llegan al tope de 500,
// registra las facturas y descarga sus archivos. Una consulta a la vez y con pausas, como lo
// haría una persona. Si se cierra la sesión o se acaba la cuota, guarda y se detiene.

import { intervalosIniciales, partir, etiqueta } from './intervalos.js';
import { activarFiltroFechas, llenar, buscar, ErrorPortal } from './consulta.js';
import { bajarXml, bajarPdf, mantenerSesion, aDataUrl, SesionCerrada, DescargaNoPermitida } from './descargas.js';
import { datosDelXml } from './xml.js';
import { rutaArchivo, rutaExcel } from './nombres.js';
import { hojasDeRelacion } from './relacion.js';
import { libro } from './xlsx.js';
import { CUOTA_XML_DIARIA, PAGINAS } from './portal.js';
import { guardarTrabajo, leerCuota, guardarCuota, fechaLocal } from './estado.js';
import { PAUSA_CONSULTA_MS, PAUSA_DESCARGA_MS } from './config.js';

const MAX_ERRORES = 200;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function nuevoTrabajo({ tipo, anio, meses, opciones, hoy = new Date() }) {
  return {
    version: 1,
    tipo,
    anio,
    meses,
    opciones,
    rfc: null,
    creado: new Date().toISOString(),
    pendientes: intervalosIniciales(anio, meses, hoy),
    cobertura: [],
    facturas: {},
    archivos: {},
    errores: [],
    consultas: 0,
    estado: 'listo',
    mensaje: '',
  };
}

// ¿La factura cae en el intervalo? (los dos filtros del portal son por fecha de emisión)
export function contiene(iv, fechaEmision) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(fechaEmision || '');
  if (!m) return false;
  const [a, mes, d, h, mi, s] = m.slice(1).map(Number);
  if (a !== iv.anio || mes !== iv.mes) return false;
  if (iv.dia === 0) return true;
  const seg = h * 3600 + mi * 60 + s;
  return d === iv.dia && seg >= iv.desde && seg <= iv.hasta;
}

export function faltantes(trabajo) {
  const { xml, pdf } = trabajo.opciones;
  return Object.values(trabajo.facturas).filter((f) => {
    const a = trabajo.archivos[f.uuid] || {};
    return (xml && !a.xml) || (pdf && !a.pdf);
  });
}

// Para continuar otro día: vuelve a consultar solo los intervalos con archivos pendientes,
// porque los enlaces de descarga del portal no sirven de una consulta a otra.
export function prepararContinuacion(trabajo) {
  const pendientes = faltantes(trabajo);
  const volver = trabajo.cobertura.filter((c) => pendientes.some((f) => contiene(c.iv, f.fechaEmision)));
  trabajo.cobertura = trabajo.cobertura.filter((c) => !volver.includes(c));
  trabajo.pendientes = [...volver.map((c) => c.iv), ...trabajo.pendientes];
  trabajo.errores = [];
  return trabajo;
}

export class Motor {
  constructor({ tipo, alCambiar = () => {}, enviarArchivo, guardar = guardarTrabajo }) {
    this.pagina = PAGINAS[tipo];
    this.alCambiar = alCambiar;
    this.enviarArchivo = enviarArchivo;
    this.guardar = guardar;
    this.detenido = false;
  }

  detener() {
    this.detenido = true;
  }

  avisar(trabajo, mensaje) {
    trabajo.mensaje = mensaje;
    this.alCambiar(trabajo);
  }

  async correr(trabajo) {
    this.detenido = false;
    this.cuota = null;
    trabajo.estado = 'corriendo';
    let sesionCerrada = false;
    const latido = setInterval(() => mantenerSesion().catch(() => (sesionCerrada = true)), 60000);
    try {
      this.avisar(trabajo, 'Preparando la consulta por fecha…');
      await activarFiltroFechas();
      while (trabajo.pendientes.length && !this.detenido) {
        if (sesionCerrada) throw new SesionCerrada('La sesión del SAT se cerró.');
        const iv = trabajo.pendientes[0];
        this.avisar(trabajo, `Consultando ${etiqueta(iv)}…`);
        llenar(trabajo.tipo, iv);
        const { facturas, limite } = await buscar();
        trabajo.consultas++;
        const partes = limite ? partir(iv) : null;
        if (partes) {
          trabajo.pendientes.splice(0, 1, ...partes);
          this.avisar(trabajo, `${etiqueta(iv)} llegó al tope de 500: se parte en ${partes.length} consultas.`);
          await this.guardar(trabajo);
          await esperar(PAUSA_CONSULTA_MS);
          continue;
        }
        this.registrar(trabajo, facturas);
        await this.descargar(trabajo, facturas);
        if (this.detenido) break;
        trabajo.cobertura.push({
          iv,
          n: facturas.length,
          estado: limite ? 'incompleto' : 'completo',
          nota: limite
            ? '500 facturas o más en un mismo segundo: el portal solo muestra 500. Solicita la metadata de ese segundo en el portal para ver el resto.'
            : '',
        });
        trabajo.pendientes.shift();
        await this.guardar(trabajo);
        await esperar(PAUSA_CONSULTA_MS);
      }
      if (this.detenido) {
        trabajo.estado = 'pausado';
        this.avisar(trabajo, 'En pausa. Puedes continuar cuando quieras.');
      } else {
        await this.terminar(trabajo);
      }
    } catch (e) {
      trabajo.estado = 'pausado';
      const motivo =
        e instanceof SesionCerrada
          ? 'La sesión del SAT se cerró. Vuelve a entrar al portal y pulsa Continuar: no se pierde lo avanzado.'
          : e instanceof ErrorPortal
            ? e.message
            : `Se detuvo por un error: ${e.message}`;
      this.avisar(trabajo, motivo);
    } finally {
      clearInterval(latido);
      await this.guardar(trabajo);
    }
    return trabajo;
  }

  registrar(trabajo, facturas) {
    for (const { urlXml, datosPdf, ...datos } of facturas) {
      const previa = trabajo.facturas[datos.uuid];
      trabajo.facturas[datos.uuid] = { ...datos, xml: previa?.xml || null };
    }
    if (!trabajo.rfc && facturas.length) {
      trabajo.rfc = trabajo.tipo === 'emitidas' ? facturas[0].rfcEmisor : facturas[0].rfcReceptor;
    }
  }

  async cuotaDeHoy(trabajo) {
    const hoy = fechaLocal();
    if (!this.cuota || this.cuota.fecha !== hoy) this.cuota = await leerCuota(trabajo.rfc, hoy);
    return this.cuota;
  }

  anotarError(trabajo, uuid, archivo, mensaje) {
    if (trabajo.errores.length < MAX_ERRORES) trabajo.errores.push({ uuid, archivo, mensaje });
  }

  async descargar(trabajo, facturas) {
    const { xml: pedirXml, pdf: pedirPdf } = trabajo.opciones;
    if (!pedirXml && !pedirPdf) return;
    let desdeGuardado = 0;
    for (const f of facturas) {
      if (this.detenido) return;
      const cuota = await this.cuotaDeHoy(trabajo);
      const a = (trabajo.archivos[f.uuid] ||= {});
      const datos = trabajo.facturas[f.uuid];
      // El PDF lleva serie y folio del XML; si el XML está pendiente, el PDF espera con él.
      const xmlPendiente = pedirXml && !a.xml;
      if (xmlPendiente && !cuota.agotadaXml) {
        try {
          const texto = await bajarXml(this.pagina, f);
          datos.xml = datosDelXml(texto);
          const ruta = rutaArchivo({ tipo: trabajo.tipo, rfc: trabajo.rfc, factura: f, serie: datos.xml.serie, folio: datos.xml.folio, extension: 'xml' });
          await this.enviarArchivo(ruta, aDataUrl(texto, 'application/xml'));
          a.xml = ruta;
          cuota.xml++;
          if (cuota.xml >= CUOTA_XML_DIARIA) cuota.agotadaXml = true;
        } catch (e) {
          if (e instanceof SesionCerrada) throw e;
          if (e instanceof DescargaNoPermitida) {
            cuota.agotadaXml = true;
            cuota.avisoXml = e.message;
          } else this.anotarError(trabajo, f.uuid, 'XML', e.message);
        }
        await guardarCuota(trabajo.rfc, cuota);
        await esperar(PAUSA_DESCARGA_MS);
      }
      const puedePdf = pedirPdf && !a.pdf && !cuota.agotadaPdf && (!pedirXml || a.xml);
      if (puedePdf) {
        try {
          const bytes = await bajarPdf(this.pagina, f);
          const ruta = rutaArchivo({ tipo: trabajo.tipo, rfc: trabajo.rfc, factura: f, serie: datos.xml?.serie, folio: datos.xml?.folio, extension: 'pdf' });
          await this.enviarArchivo(ruta, aDataUrl(bytes, 'application/pdf'));
          a.pdf = ruta;
          cuota.pdf++;
        } catch (e) {
          if (e instanceof SesionCerrada) throw e;
          if (e instanceof DescargaNoPermitida) {
            cuota.agotadaPdf = true;
            cuota.avisoPdf = e.message;
          } else this.anotarError(trabajo, f.uuid, 'PDF', e.message);
        }
        await guardarCuota(trabajo.rfc, cuota);
        await esperar(PAUSA_DESCARGA_MS);
      }
      this.avisar(trabajo, `Descargando archivos… ${Object.values(trabajo.archivos).filter((x) => x.xml || x.pdf).length} facturas con archivos.`);
      if (++desdeGuardado >= 25) {
        desdeGuardado = 0;
        await this.guardar(trabajo);
      }
    }
  }

  async exportarExcel(trabajo) {
    const bytes = libro(hojasDeRelacion(trabajo));
    const ruta = rutaExcel({ tipo: trabajo.tipo, rfc: trabajo.rfc || 'SIN-RFC', anio: trabajo.anio, meses: trabajo.meses });
    await this.enviarArchivo(ruta, aDataUrl(bytes, MIME_XLSX), { visible: true });
    return ruta;
  }

  async terminar(trabajo) {
    const total = Object.keys(trabajo.facturas).length;
    let ruta = null;
    if (trabajo.opciones.excel) ruta = await this.exportarExcel(trabajo);
    const pendientes = faltantes(trabajo).length;
    const cuota = trabajo.rfc ? await this.cuotaDeHoy(trabajo) : null;
    trabajo.estado = pendientes ? 'faltan' : 'terminado';
    const partes = [`Listo: ${total.toLocaleString('es-MX')} facturas.`];
    if (ruta) partes.push(`Excel en Descargas/${ruta}.`);
    if (pendientes) {
      partes.push(
        cuota?.agotadaXml || cuota?.agotadaPdf
          ? `Faltan archivos de ${pendientes} facturas porque se llegó a la cuota diaria del SAT. Mañana pulsa Continuar.`
          : `Faltan archivos de ${pendientes} facturas. Pulsa Continuar para reintentarlos.`,
      );
    }
    this.avisar(trabajo, partes.join(' '));
  }
}

