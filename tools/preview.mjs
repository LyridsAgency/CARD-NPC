// Aperçu local d'une section (sans boutique) : rend le Liquid, sert le thème, capture avec Chromium.
// Usage : node preview.mjs <section> [sortie.png ...] — voir les modes en bas.
import { Liquid } from 'liquidjs';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = process.env.OUT || ROOT;

const engine = new Liquid({ root: join(ROOT, 'sections'), extname: '.liquid' });
const raw = (open, close) => ({
  parse(_, remain) {
    this.text = '';
    let t;
    while ((t = remain.shift())) {
      if (t.name === `end${this.name}`) return;
      this.text += t.getText();
    }
  },
  render() {
    return open ? `${open}${this.text}${close}` : '';
  },
});
engine.registerTag('schema', { ...raw('', ''), name: 'schema' });
engine.registerTag('stylesheet', { ...raw('<style>', '</style>'), name: 'stylesheet' });
engine.registerTag('javascript', { ...raw('<script>', '</script>'), name: 'javascript' });
engine.registerTag('style', {
  parse(_, remain) {
    this.tpls = [];
    const stream = this.liquid.parser
      .parseStream(remain)
      .on('tag:endstyle', () => stream.stop())
      .on('template', (t) => this.tpls.push(t));
    stream.start();
  },
  *render(ctx, emitter) {
    emitter.write('<style>');
    yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
    emitter.write('</style>');
  },
});
engine.registerFilter('asset_url', (f) => `/assets/${f}`);

async function renderSection(name, overrides = {}) {
  const src = await readFile(join(ROOT, 'sections', `${name}.liquid`), 'utf8');
  const schema = JSON.parse(src.match(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/)[1]);
  const settings = Object.fromEntries(schema.settings.filter((s) => s.id).map((s) => [s.id, s.default ?? '']));
  const preset = schema.presets?.[0] || {};
  const blocks = (preset.blocks || []).map((b, i) => ({ id: `b${i}`, type: b.type, settings: b.settings, shopify_attributes: '' }));
  const section = { id: 'apercu', settings: { ...settings, ...overrides }, blocks };
  return engine.parseAndRender(src, { section, routes: { all_products_collection_url: '/collections/all' } });
}

async function page(name, overrides) {
  const body = await renderSection(name, overrides);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html{font-size:62.5%}body{margin:0;background:#070707}.visually-hidden{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}</style>
</head><body>${body}</body></html>`;
}

const TYPES = { '.js': 'text/javascript', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.html': 'text/html' };

export async function serve(name, overrides) {
  const html = await page(name, overrides);
  const server = createServer(async (req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(html);
    }
    try {
      const data = await readFile(join(ROOT, url));
      res.writeHead(200, { 'content-type': TYPES[extname(url)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, r));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

const [, , mode = 'shots', name = 'ecru-carte-3d'] = process.argv;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

if (mode === 'poster') {
  // Image de secours : carte = 62,5 % de la largeur, fond transparent
  const { server, url } = await serve(name);
  const p = await browser.newPage({ viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 1 });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.addStyleTag({ content: '' }).catch(() => {});
  await p.goto(url);
  await p.addStyleTag({
    content: 'body{background:transparent!important}.ecru-carte{background:transparent!important;padding:0!important}.ecru-carte__inner{padding:0!important}.ecru-carte__vue{height:1052px!important}.ecru-carte__bascule{display:none}',
  });
  await p.waitForSelector('.ecru-carte.is-ready', { timeout: 60000 });
  await p.waitForTimeout(800);
  const png = await p.locator('.ecru-carte__vue').screenshot({ omitBackground: true });
  const webp = await p.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', 0.86).split(',')[1];
  }, png.toString('base64'));
  await writeFile(join(ROOT, 'assets', 'ecru-carte-secours.webp'), Buffer.from(webp, 'base64'));
  console.log('assets/ecru-carte-secours.webp');
  server.close();
} else {
  const { server, url } = await serve(name);
  const shots = [
    { file: 'bureau.png', w: 1440, h: 900, hover: false, wait: 2600 },
    { file: 'bureau-survol.png', w: 1440, h: 900, hover: true, wait: 4200 },
    { file: 'mobile.png', w: 390, h: 844, mobile: true, wait: 2600 },
    { file: 'mobile-avantages.png', w: 390, h: 844, mobile: true, open: true, wait: 3200 },
  ].filter((s) => !process.env.ONLY || s.file === process.env.ONLY);
  if (process.env.ONLY === 'verso.png') shots.push({ file: 'verso.png', w: 1440, h: 900, wait: 14000 });
  const errors = [];
  for (const s of shots) {
    const ctx = await browser.newContext({
      viewport: { width: s.w, height: s.h },
      deviceScaleFactor: s.mobile ? 2 : 1,
      isMobile: !!s.mobile,
      hasTouch: !!s.mobile,
    });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`${s.file}: ${e.message}`));
    p.on('console', (m) => m.type() === 'error' && errors.push(`${s.file}: ${m.text()}`));
    await p.goto(url);
    await p.waitForSelector('.ecru-carte.is-ready', { timeout: 60000 });
    if (s.hover) await p.mouse.move(s.w * 0.52, 420, { steps: 6 });
    if (s.open) await p.click('.ecru-carte__bascule');
    await p.waitForTimeout(s.wait);
    await p.screenshot({ path: join(OUT, s.file), fullPage: !!s.mobile });
    await ctx.close();
  }
  console.log(errors.length ? errors.join('\n') : 'aucune erreur console');
  server.close();
}
await browser.close();
