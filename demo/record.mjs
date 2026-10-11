// Renders the demo composition to PNG frames, deterministically.
// Usage:
//   npm install && npx playwright install chromium   (once)
//   node record.mjs [--no-captions] [--smoke] [--fps 60] [--scale 2]
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const NOCAP = process.argv.includes('--no-captions');
const SMOKE = process.argv.includes('--smoke');
const FPS = Number(arg('--fps', 60));
const SCALE = Number(arg('--scale', 2));
const OUT = join(HERE, 'out', NOCAP ? 'frames-nocap' : 'frames');
mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.jsx': 'text/jsx',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};
const srv = createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const p = join(HERE, urlPath);
  try {
    res.setHeader('Content-Type', MIME[extname(p)] ?? 'application/octet-stream');
    res.end(readFileSync(p));
  } catch {
    res.statusCode = 404;
    res.end();
  }
}).listen(0);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1460, height: 900 }, deviceScaleFactor: SCALE });
if (NOCAP) await page.addInitScript(() => { window.__NO_CAPTIONS = true; });
page.on('pageerror', (e) => console.error('[js]', String(e).slice(0, 400)));
await page.goto(`http://127.0.0.1:${srv.address().port}/composition/index.html`, { waitUntil: 'networkidle', timeout: 90_000 });
await page.waitForSelector('[data-om-exportable-video-with-duration-secs]', { timeout: 90_000 });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => new Promise((resolve) => {
  const img = new Image();
  img.onload = img.onerror = resolve;
  img.src = '/ds/farmland.png';
}));
await page.waitForTimeout(800);

const stage = await page.$('[data-om-exportable-video-with-duration-secs]');
const duration = Number(await stage.getAttribute('data-om-exportable-video-with-duration-secs'));
const frames = SMOKE ? 3 : Math.round(duration * FPS);
console.log(`duration=${duration}s frames=${frames} fps=${FPS} scale=${SCALE}x captions=${!NOCAP}`);

for (let f = 0; f <= frames; f++) {
  const t = SMOKE ? [2, 16, 36.5, 48][f] : Math.min(f / FPS, duration - 1e-4);
  const outPath = join(OUT, SMOKE ? `smoke-${t}.png` : `f${String(f).padStart(5, '0')}.png`);
  if (!SMOKE && existsSync(outPath)) continue;
  await page.evaluate((time) => {
    const el = document.querySelector('[data-om-exportable-video-with-duration-secs]');
    el.dispatchEvent(new CustomEvent('data-om-seek-to-time-frame', { detail: { time, sync: true } }));
    for (const a of document.getAnimations()) {
      try { a.pause(); a.currentTime = time * 1000; } catch { /* detached */ }
    }
  }, t);
  if (SMOKE) await page.waitForTimeout(350);
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1280, height: 720 } });
  if (!SMOKE && f % 300 === 0) console.log(`frame ${f}/${frames}`);
}
console.log(`done → ${OUT}`);
await browser.close();
srv.close();
