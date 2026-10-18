// Compila la extensión en dist/ (sin minificar, para que se pueda revisar) y, con --zip,
// arma paquetes/facturas-sat-<versión>.zip para la Chrome Web Store. Con --pruebas compila en
// dist-pruebas/ el paquete para el portal simulado (sin pausas); con --video, dist-video/ para el
// video demo (pausa corta entre consultas).
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const raiz = new URL('..', import.meta.url).pathname;
const pruebas = process.argv.includes('--pruebas');
const video = process.argv.includes('--video');
const dist = raiz + (pruebas ? 'dist-pruebas/' : video ? 'dist-video/' : 'dist/');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: { content: raiz + 'src/content.js', background: raiz + 'src/background.js', validar: raiz + 'src/validar.js' },
  outdir: dist,
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  minify: false,
  legalComments: 'none',
  charset: 'utf8',
  define: { __PRUEBAS__: pruebas ? 'true' : 'false', __PAUSA_CONSULTA__: video ? '220' : '1000' },
});
cpSync(raiz + 'manifest.json', dist + 'manifest.json');
cpSync(raiz + 'validar.html', dist + 'validar.html');
if (pruebas) {
  // Playwright no puede pulsar el aviso de permiso de Chrome: en el paquete de pruebas el servicio
  // del SAT va también en host_permissions y chrome.permissions.request responde true sin preguntar.
  // El paquete que se publica lo deja solo en optional_host_permissions.
  const manifiesto = JSON.parse(readFileSync(raiz + 'manifest.json', 'utf8'));
  manifiesto.host_permissions = [...manifiesto.host_permissions, ...manifiesto.optional_host_permissions];
  writeFileSync(dist + 'manifest.json', JSON.stringify(manifiesto, null, 2));
}
if (existsSync(raiz + 'iconos')) cpSync(raiz + 'iconos', dist + 'iconos', { recursive: true });

if (process.argv.includes('--zip')) {
  const { version } = JSON.parse(readFileSync(raiz + 'manifest.json', 'utf8'));
  mkdirSync(raiz + 'paquetes', { recursive: true });
  const zip = `${raiz}paquetes/facturas-sat-${version}.zip`;
  rmSync(zip, { force: true });
  execFileSync('zip', ['-qr', '-X', zip, '.'], { cwd: dist });
  console.log('Paquete:', zip);
}
console.log(`Compilado en ${dist.slice(raiz.length)}`);
