// Compila la extensión en dist/ (sin minificar, para que se pueda revisar) y, con --zip,
// arma paquetes/facturas-sat-<versión>.zip para la Chrome Web Store.
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const raiz = new URL('..', import.meta.url).pathname;
const dist = raiz + 'dist/';
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: { content: raiz + 'src/content.js', background: raiz + 'src/background.js' },
  outdir: dist,
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  minify: false,
  legalComments: 'none',
  charset: 'utf8',
});
cpSync(raiz + 'manifest.json', dist + 'manifest.json');
if (existsSync(raiz + 'iconos')) cpSync(raiz + 'iconos', dist + 'iconos', { recursive: true });

if (process.argv.includes('--zip')) {
  const { version } = JSON.parse(readFileSync(raiz + 'manifest.json', 'utf8'));
  mkdirSync(raiz + 'paquetes', { recursive: true });
  const zip = `${raiz}paquetes/facturas-sat-${version}.zip`;
  rmSync(zip, { force: true });
  execFileSync('zip', ['-qr', '-X', zip, '.'], { cwd: dist });
  console.log('Paquete:', zip);
}
console.log('Compilado en dist/');
