// Renders src/index.html frame by frame with headless Chromium and encodes with ffmpeg.
//   node render.mjs --stills 1.2,9.5,20      -> out/stills/*.png
//   node render.mjs [--fps 60] [--workers 4] -> out/video.mp4 (silent; mux with audio/mix.wav)
import { createServer } from 'node:http';
import { readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1] ?? true]] : acc), []));
const FPS = Number(args.fps || 60);
const WORKERS = Number(args.workers || 4);
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join(ROOT, p === '/' ? '/src/index.html' : p);
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const URL_ = `http://127.0.0.1:${server.address().port}/src/index.html`;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--disable-gpu-vsync', '--force-color-profile=srgb', '--font-render-hinting=none'] });
async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('console:', m.text()));
  await page.goto(URL_);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  return page;
}
const shot = async (page, t) => { await page.evaluate((tt) => window.renderFrame(tt), t); return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } }); };

if (args.stills) {
  const dir = join(ROOT, 'out/stills', String(args.set || 'a'));
  await mkdir(dir, { recursive: true });
  const page = await newPage();
  for (const t of String(args.stills).split(',').map(Number)) {
    await writeFile(join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`), await shot(page, t));
  }
  console.log('stills written');
} else {
  const page0 = await newPage();
  const duration = await page0.evaluate(() => window.DURATION);
  await page0.close();
  const total = Math.round(duration * FPS);
  const tmp = join(ROOT, 'out/parts');
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  const per = Math.ceil(total / WORKERS);
  const t0 = Date.now();
  let done = 0;
  await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
    const a = w * per, b = Math.min(total, a + per);
    if (a >= b) return;
    const page = await newPage();
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-tune', 'animation', join(tmp, `p${w}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = a; f < b; f++) {
      const buf = await shot(page, f / FPS);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if (++done % 120 === 0) console.log(`${done}/${total} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
  }));
  await writeFile(join(tmp, 'list.txt'), Array.from({ length: WORKERS }, (_, w) => `file 'p${w}.mp4'`).join('\n'));
  await new Promise((r, j) => spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'), '-c', 'copy', join(ROOT, 'out/video.mp4')], { stdio: 'inherit' }).on('close', (c) => (c ? j(c) : r())));
  console.log(`video rendered: ${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();
server.close();
