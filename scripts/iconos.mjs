// Genera iconos/16, 32, 48 y 128.png con el símbolo de Reporte Ágil (en 128 con el margen de
// 16 px que pide la Chrome Web Store). Requiere el logo de ~/Code/fullstack/reporteagil.
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';

const logos = new URL('../../reporteagil/design/logo/final/', import.meta.url).pathname;
const raiz = new URL('..', import.meta.url).pathname;
mkdirSync(raiz + 'iconos', { recursive: true });
const navegador = await chromium.launch();
for (const [tam, archivo, margen] of [[16, 'simbolo-simple.svg', 1], [32, 'simbolo-simple.svg', 2], [48, 'simbolo.svg', 3], [128, 'simbolo.svg', 16]]) {
  const svg = readFileSync(logos + archivo, 'utf8');
  const pagina = await navegador.newPage({ viewport: { width: tam, height: tam }, deviceScaleFactor: 1 });
  await pagina.setContent(`<html><body style="margin:0;background:transparent;display:grid;place-items:center;width:${tam}px;height:${tam}px">
    <div style="width:${tam - 2 * margen}px;height:${tam - 2 * margen}px;display:grid;place-items:center">${svg.replace('<svg ', '<svg style="height:100%;width:auto" ')}</div></body></html>`);
  await pagina.screenshot({ path: `${raiz}iconos/${tam}.png`, omitBackground: true });
  await pagina.close();
}
await navegador.close();
console.log('Iconos en iconos/');
