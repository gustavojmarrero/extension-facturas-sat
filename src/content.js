// Punto de entrada en «Consultar Facturas Emitidas» y «Consultar Facturas Recibidas».

import { tipoDePagina } from './consulta.js';
import { Motor, nuevoTrabajo, prepararContinuacion } from './motor.js';
import { leerTrabajo, guardarTrabajo, borrarTrabajo } from './estado.js';
import { crearPanel } from './ui.js';

async function enviarArchivo(ruta, url, { visible = false } = {}) {
  const r = await chrome.runtime.sendMessage({ tipo: 'guardar', ruta, url, visible });
  if (!r?.ok) throw new Error(r?.error || 'Chrome no guardó el archivo.');
}

async function iniciar() {
  const tipo = tipoDePagina();
  if (!tipo || document.getElementById('reporteagil-facturas-sat')) return;

  let trabajo = await leerTrabajo();
  // Si la página se recargó a media descarga (por ejemplo, al cerrarse la sesión), queda en pausa.
  if (trabajo?.estado === 'corriendo') {
    trabajo.estado = 'pausado';
    trabajo.mensaje = 'La descarga se interrumpió. Pulsa Continuar para seguir donde se quedó.';
    await guardarTrabajo(trabajo);
  }

  let motor = null;
  const correr = async () => {
    motor = new Motor({ tipo, enviarArchivo, alCambiar: (t) => panel.pintar(t) });
    trabajo = await motor.correr(trabajo);
    panel.pintar(trabajo);
  };

  const panel = crearPanel({
    tipo,
    alIniciar: async ({ anio, meses, opciones }) => {
      trabajo = nuevoTrabajo({ tipo, anio, meses, opciones });
      await guardarTrabajo(trabajo);
      await correr();
    },
    alPausar: () => motor?.detener(),
    alContinuar: async () => {
      if (trabajo.estado === 'faltan') prepararContinuacion(trabajo);
      await correr();
    },
    alExportar: async () => {
      const m = motor || new Motor({ tipo, enviarArchivo, alCambiar: (t) => panel.pintar(t) });
      try {
        const ruta = await m.exportarExcel(trabajo);
        trabajo.mensaje = `Excel en Descargas/${ruta}.`;
      } catch (e) {
        trabajo.mensaje = `No se pudo crear el Excel: ${e.message}`;
      }
      await guardarTrabajo(trabajo);
      panel.pintar(trabajo);
    },
    alDescartar: async () => {
      motor?.detener();
      await borrarTrabajo();
      trabajo = null;
      panel.pintar(null);
    },
  });
  panel.pintar(trabajo);
}

iniciar();
