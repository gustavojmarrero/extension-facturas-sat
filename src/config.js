// En el paquete que se publica PRUEBAS es false. `node scripts/build.mjs --pruebas` lo compila
// en true para el portal simulado de e2e/: sin pausas y con registro de lo que se guarda.
/* global __PRUEBAS__ */
export const PRUEBAS = typeof __PRUEBAS__ !== 'undefined' && __PRUEBAS__ === true;

// Pausas entre consultas y entre descargas, para ir al ritmo de una persona.
/* global __PAUSA_CONSULTA__ */
// El paquete del video demo (--video) acorta la pausa para que el corte del tope quepa en pantalla.
export const PAUSA_CONSULTA_MS = PRUEBAS ? 0 : typeof __PAUSA_CONSULTA__ !== 'undefined' ? __PAUSA_CONSULTA__ : 1000;
export const PAUSA_DESCARGA_MS = PRUEBAS ? 0 : 250;
