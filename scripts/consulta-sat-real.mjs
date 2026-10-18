// Prueba el validador contra el servicio real del SAT (ConsultaCFDIService) con XML de CFDI del
// equipo, con el mismo código que la extensión (src/verificacion.js y src/cola.js):
//   node scripts/consulta-sat-real.mjs <archivo.xml|carpeta> [...] [--esperado esperado.json]
// esperado.json: { "<UUID>": "vigente" | "cancelado" } para comparar con lo que responde el SAT.
// Por privacidad solo imprime conteos y códigos de estado: nunca nombres de archivo, RFC, UUID,
// nombres ni importes.
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { datosParaValidar, esXmlDeCfdi } from '../src/xml.js';
import { consultarCfdi, faltaParaConsultar } from '../src/verificacion.js';
import { correrCola } from '../src/cola.js';

const args = process.argv.slice(2);
const iEsperado = args.indexOf('--esperado');
const esperado = iEsperado >= 0 ? JSON.parse(readFileSync(args.splice(iEsperado, 2)[1], 'utf8')) : null;
const porUuid = new Map(Object.entries(esperado || {}).map(([u, e]) => [u.toUpperCase(), String(e).toLowerCase()]));

function archivos(rutas) {
  const lista = [];
  for (const ruta of rutas) {
    if (statSync(ruta).isDirectory()) {
      for (const e of readdirSync(ruta, { recursive: true })) if (/\.xml$/i.test(e)) lista.push(join(ruta, e));
    } else lista.push(ruta);
  }
  return lista;
}

const conteos = {};
const sumar = (grupo, clave) => {
  conteos[grupo] ||= {};
  conteos[grupo][clave] = (conteos[grupo][clave] || 0) + 1;
};

const elementos = [];
for (const archivo of archivos(args)) {
  const texto = readFileSync(archivo, 'utf8');
  if (!esXmlDeCfdi(texto)) {
    sumar('Lectura', 'no es un CFDI');
    continue;
  }
  const datos = datosParaValidar(texto);
  if (faltaParaConsultar(datos)) {
    sumar('Lectura', 'le faltan datos');
    continue;
  }
  sumar('Lectura', `CFDI ${datos.version}`);
  elementos.push(datos);
}

const inicio = Date.now();
await correrCola(
  elementos,
  async (datos) => {
    const v = datos.version;
    try {
      const r = await consultarCfdi(datos);
      sumar('CodigoEstatus', r.codigoEstatus);
      sumar('Estado', r.estado || '(vacío)');
      sumar('EsCancelable', r.esCancelable || '(vacío)');
      sumar('EstatusCancelacion', r.estatusCancelacion || '(vacío)');
      sumar('ValidacionEFOS', r.validacionEfos || '(vacío)');
      if (r.intentos > 1) sumar('Reintentos', `respondió al intento ${r.intentos}`);
      const e = porUuid.get(datos.uuid.toUpperCase());
      if (esperado) {
        const sat = (r.estado || '(vacío)').toLowerCase();
        sumar(`Esperado → SAT (${v})`, e ? `${e} → ${sat}` : `sin esperado → ${sat}`);
        sumar('Comparación', !e ? 'sin esperado' : e === sat ? `coincide (${v})` : `difiere (${v})`);
      }
    } catch (error) {
      sumar('Errores', error.message.replace(/\d+(?:\.\d+)?/g, (n) => (n.length > 3 ? '#' : n)));
    }
  },
  { concurrencia: 2, pausa: 500 },
);

for (const [grupo, lista] of Object.entries(conteos)) {
  console.log(`\n${grupo}:`);
  for (const [clave, n] of Object.entries(lista).sort()) console.log(`  ${clave}: ${n}`);
}
console.log(`\n${elementos.length} consultas en ${Math.round((Date.now() - inicio) / 1000)} s (concurrencia 2, pausa 500 ms).`);
