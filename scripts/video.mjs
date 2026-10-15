// Video demo para YouTube y la ficha de la tienda: 1920×1080, con la extensión (dist-video/, igual que
// la publicable pero con pausa corta entre consultas) sobre el portal simulado de e2e/ y datos
// inventados. Captura cuadros nítidos con capturas de pantalla, ajusta cada escena a la duración
// de su narración (tienda/video/narracion/NN-*.mp3, de ElevenLabs) y mezcla voz y música con ffmpeg.
// Uso: node scripts/build.mjs --video && ESCALA=1.5 node scripts/capturas.mjs && node scripts/video.mjs
import { chromium } from '@playwright/test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { montar, facturas, ORIGEN } from '../e2e/portal-falso.js';

const raiz = new URL('..', import.meta.url).pathname;
const DIST = raiz + 'dist-video/';
const NARRACION = raiz + 'tienda/video/narracion/';
const SALIDA = raiz + 'tienda/video/';
const temporal = mkdtempSync(join(tmpdir(), 'video-sat-'));
const cuadros = join(temporal, 'cuadros');
mkdirSync(cuadros);
const simbolo = readFileSync(raiz + '../reporteagil/design/logo/final/simbolo.svg', 'utf8');

const duracion = (archivo) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', archivo]).toString().trim());
const ESCENAS = ['01-intro', '02-aviso', '03-formulario', '04-tope', '05-listo', '06-excel', '07-carpetas', '08-cierre'];
const clip = Object.fromEntries(ESCENAS.map((n) => {
  const ruta = NARRACION + n + '.mp3';
  return [n, { ruta: existsSync(ruta) ? ruta : null, ms: existsSync(ruta) ? Math.round(duracion(ruta) * 1000) : 3000 }];
}));

const recibidas = facturas({
  anio: 2026, mes: 9, porDia: 20, dias: Array.from({ length: 30 }, (_, i) => i + 1), receptor: 'CNO1905228T4',
  extra: [{ dia: 5, cuantas: 700 }],
});

const context = await chromium.launchPersistentContext(join(temporal, 'perfil'), {
  channel: 'chromium', headless: true, acceptDownloads: true, downloadsPath: join(temporal, 'descargas'),
  viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5,
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
let [sw] = context.serviceWorkers();
if (!sw) sw = await context.waitForEvent('serviceworker');
await montar(context, { recibidas });
const page = context.pages()[0] || (await context.newPage());
const panel = page.locator('#reporteagil-facturas-sat');
const trabajo = () => sw.evaluate(async () => (await chrome.storage.local.get('trabajo')).trabajo);

// Grabadora: capturas JPEG seguidas, cada una con su marca de tiempo.
const fotos = [];
let grabando = true;
const t0 = Date.now();
const grabar = (async () => {
  while (grabando) {
    const inicio = Date.now();
    try {
      const archivo = join(cuadros, `${String(fotos.length).padStart(5, '0')}.jpg`);
      await page.screenshot({ path: archivo, type: 'jpeg', quality: 92 });
      fotos.push({ t: inicio - t0, archivo });
    } catch {}
    const espera = 80 - (Date.now() - inicio);
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  }
})();

const marcas = {};
const escena = async (nombre, accion) => {
  marcas[nombre] = Date.now() - t0;
  const fin = Date.now() + clip[nombre].ms + 700;
  await accion?.();
  const resto = fin - Date.now();
  if (resto > 0) await page.waitForTimeout(resto);
};

async function rotulo(texto) {
  await page.evaluate((t) => {
    let r = document.getElementById('rotulo-video');
    if (!r) {
      r = document.createElement('div');
      r.id = 'rotulo-video';
      r.style.cssText = 'position:fixed;left:24px;bottom:24px;z-index:2147483646;max-width:560px;background:#0c1e55;color:#fff;font:600 22px/1.3 Helvetica Neue,Arial,sans-serif;padding:14px 18px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25)';
      document.body.appendChild(r);
    }
    r.textContent = t;
  }, texto);
}
const logo = `<div style="width:96px;height:114px;background:#fff;border-radius:18px;display:grid;place-items:center;margin:0 auto 26px"><div style="width:70px;height:84px">${simbolo.replace('<svg ', '<svg style="height:100%;width:auto" ')}</div></div>`;
const tarjeta = (html) => page.setContent(`<html><body style="margin:0;width:1280px;height:720px;background:#0c1e55;color:#fff;font-family:Helvetica Neue,Arial,sans-serif;display:grid;place-items:center">${html}</body></html>`);
const imagen = (archivo) => page.setContent(`<html><body style="margin:0;background:#0c1e55;overflow:hidden"><img src="data:image/png;base64,${readFileSync(raiz + 'tienda/capturas-hd/' + archivo).toString('base64')}" style="width:1280px;height:800px;display:block;margin-top:-40px"></body></html>`);

await escena('01-intro', () => tarjeta(`<div style="text-align:center">${logo}<div style="font-size:52px;font-weight:800;letter-spacing:-.03em">Facturas SAT a Excel</div>
  <div style="font-size:26px;color:#b9c3d9;margin-top:14px">Sin el tope de 500 · XML y PDF en carpetas · Gratis</div></div>`));
await escena('02-aviso', async () => {
  await page.goto(`${ORIGEN}/ConsultaReceptor.aspx`);
  await panel.getByRole('button', { name: 'Entendido, continuar' }).waitFor();
  await rotulo('Entra al portal del SAT como siempre. Tus datos no salen de tu navegador.');
});
await escena('03-formulario', async () => {
  await panel.getByRole('button', { name: 'Entendido, continuar' }).click();
  await rotulo('Elige el mes: relación en Excel y, si quieres, XML y PDF.');
  await page.waitForTimeout(600);
  await panel.locator('select[name=mes]').selectOption('9');
  await page.waitForTimeout(900);
  await panel.locator('input[name=pdf]').uncheck();
  await panel.locator('input[name=xml]').uncheck();
});
await panel.getByRole('button', { name: /Descargar facturas recibidas/ }).click();
await escena('04-tope', async () => {
  await rotulo('El portal solo muestra 500 por consulta: la extensión parte el mes por día y por hora.');
  for (let i = 0; i < 240; i++) {
    if ((await trabajo())?.estado === 'terminado') break;
    await page.waitForTimeout(250);
  }
});
await escena('05-listo', () => rotulo('Listo: todas las facturas del mes en un Excel, sin repetir ninguna.'));
await escena('06-excel', () => imagen('3-excel.png'));
await escena('07-carpetas', () => imagen('5-carpetas.png'));
await escena('08-cierre', () => tarjeta(`<div style="text-align:center">${logo}<div style="font-size:44px;font-weight:800;letter-spacing:-.03em">Gratis en Chrome Web Store</div>
  <div style="font-size:26px;color:#b9c3d9;margin-top:14px">reporteagil.com · No es una herramienta del SAT</div></div>`));
await page.waitForTimeout(800);
grabando = false;
await grabar;
const total = Date.now() - t0;
await context.close();

// Video: cada cuadro dura hasta la marca del siguiente.
const lista = fotos.map((f, i) => `file '${f.archivo}'\nduration ${(((fotos[i + 1]?.t ?? total) - f.t) / 1000).toFixed(3)}`).join('\n') + `\nfile '${fotos.at(-1).archivo}'\n`;
writeFileSync(join(temporal, 'cuadros.txt'), lista);
const mudo = join(temporal, 'mudo.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(temporal, 'cuadros.txt'), '-vf', 'scale=1920:1080:flags=lanczos,fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', mudo]);

// Audio: cada narración arranca con su escena; la música, si existe, va baja y se desvanece al final.
const entradas = [];
const filtros = [];
const voces = ESCENAS.filter((n) => clip[n].ruta);
voces.forEach((n, i) => {
  entradas.push('-i', clip[n].ruta);
  const ms = (marcas[n] ?? 0) + 250;
  filtros.push(`[${i + 1}:a]adelay=${ms}|${ms},aresample=44100[v${i}]`);
});
const segundos = (total / 1000).toFixed(2);
let mezcla = `${voces.map((_, i) => `[v${i}]`).join('')}amix=inputs=${voces.length}:normalize=0,volume=1.0[voz]`;
const musica = NARRACION + 'musica.mp3';
let finales = '[voz]';
if (existsSync(musica)) {
  entradas.push('-stream_loop', '-1', '-i', musica);
  const m = voces.length + 1;
  filtros.push(`[${m}:a]atrim=0:${segundos},afade=t=in:d=1.5,afade=t=out:st=${(total / 1000 - 3).toFixed(2)}:d=3,volume=0.16[mus]`);
  mezcla += `;[voz][mus]amix=inputs=2:normalize=0[mix]`;
  finales = '[mix]';
}
const final = SALIDA + 'demo-facturas-sat.mp4';
if (voces.length) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mudo, ...entradas, '-filter_complex', [...filtros, mezcla].join(';'), '-map', '0:v', '-map', finales, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', segundos, '-movflags', '+faststart', final]);
} else {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mudo, '-c', 'copy', '-movflags', '+faststart', final]);
}
console.log(`Video: ${final} (${segundos} s, ${fotos.length} cuadros, ${voces.length} narraciones${existsSync(musica) ? ', con música' : ''})`);
