// Compila e2e/arnes-real.js en dist-arnes/arnes.js para inyectarlo con `orca eval`.
import { build } from 'esbuild';
const raiz = new URL('..', import.meta.url).pathname;
await build({
  entryPoints: [raiz + 'e2e/arnes-real.js'], outfile: raiz + 'dist-arnes/arnes.js', bundle: true, format: 'iife',
  target: 'chrome120', define: { chrome: 'globalThis.__chromeFalso', __PRUEBAS__: 'false' },
});
console.log('dist-arnes/arnes.js');
