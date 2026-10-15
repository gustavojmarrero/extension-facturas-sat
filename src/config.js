// En el paquete que se publica PRUEBAS es false. `node scripts/build.mjs --pruebas` lo compila
// en true para el portal simulado de e2e/: sin pausas y con registro de lo que se guarda.
/* global __PRUEBAS__ */
export const PRUEBAS = typeof __PRUEBAS__ !== 'undefined' && __PRUEBAS__ === true;

// Pausas entre consultas y entre descargas, para ir al ritmo de una persona.
export const PAUSA_CONSULTA_MS = PRUEBAS ? 0 : 1000;
export const PAUSA_DESCARGA_MS = PRUEBAS ? 0 : 250;
