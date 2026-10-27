// Aperçu local d'une section (sans boutique) : rend le Liquid, sert le thème, capture avec Chromium.
// Usage : node preview.mjs <section> [sortie.png ...] — voir les modes en bas.
import { Liquid } from 'liquidjs';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = process.env.OUT || ROOT;

const engine = new Liquid({ root: [join(ROOT, 'sections'), join(ROOT, 'snippets')], extname: '.liquid' });
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
engine.registerFilter('stylesheet_tag', (u) => `<link rel="stylesheet" href="${u}">`);

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

if (mode === 'vues') {
  // Points de vue de l'accueil : poses fixes, enregistrées dans assets/ (webp)
  const vues = [
    { nom: 'recto', pose: '-0.42,0.04,1.05', color: '#0d0d0c', finish: 'metal', elements: [] },
    { nom: 'verso', pose: '3.55,0.02,1.05', color: '#0d0d0c', finish: 'metal', elements: [] },
    { nom: 'profil', pose: '1.2,0.1,1.0', color: '#0d0d0c', finish: 'metal', elements: [] },
    {
      nom: 'sur-mesure',
      pose: '-0.3,0.03,1.05',
      color: '#5a1a22',
      ink: '#c2a165',
      finish: 'metal',
      elements: [
        { t: 'text', v: 'Maison Lune', x: 0.5, y: 0.5, s: 0.11, f: 'display', a: 'center' },
        { t: 'text', v: 'Restaurant · Paris', x: 0.5, y: 0.66, s: 0.045, f: 'body', a: 'center' },
      ],
    },
  ];
  const { server, url } = await serve(name);
  for (const v of vues) {
    const p = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
    await p.addInitScript((v) => {
      document.addEventListener('DOMContentLoaded', () => {
        const el = document.querySelector('[data-ecru-carte]');
        el.dataset.pose = v.pose;
        el.dataset.color = v.color;
        el.dataset.ink = v.ink || '#e9e4d8';
        el.dataset.finish = v.finish;
        el.dataset.elements = JSON.stringify(v.elements);
        el.removeAttribute('data-auto-open');
      });
    }, v);
    await p.goto(url);
    await p.addStyleTag({ content: '.ecru-section{padding:0!important}.ecru-carte__vue{height:1200px!important}.ecru-carte__bascule,.ecru-carte__avantages,.ecru-carte__fleches,.ecru-hero__texte,.ecru-hero__actions{display:none!important}' });
    await p.waitForSelector('.ecru-carte.is-ready', { timeout: 90000 });
    await p.waitForTimeout(1200);
    const png = await p.locator('.ecru-carte__vue').screenshot();
    const webp = await p.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/webp', 0.84).split(',')[1];
    }, png.toString('base64'));
    await writeFile(join(ROOT, 'assets', `ecru-vue-${v.nom}.webp`), Buffer.from(webp, 'base64'));
    console.log(`assets/ecru-vue-${v.nom}.webp`);
    await p.close();
  }
  server.close();
} else if (mode === 'rendus') {
  // Images produits : une par matière × couleur, fond noir, carré 1600 px
  const out = process.env.OUT || ROOT;
  const finishes = { pvc: 'mat', metal: 'metal' };
  const couleurs = { noir: ['#0d0d0c', '#e9e4d8'], blanc: ['#e9e4d8', '#121211'] };
  const produits = JSON.parse(process.env.PRODUITS || '{"vierge":{"card_text":"","card_holder":"","card_tier":""}}');
  for (const [prod, extra] of Object.entries(produits)) {
    for (const [mat, finish] of Object.entries(finishes)) {
      for (const [coul, [color, ink]] of Object.entries(couleurs)) {
        const { server, url } = await serve(name, { ...extra, card_color: color, ink_color: ink, finish, auto_open: false });
        const p = await browser.newPage({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 1 });
        await p.emulateMedia({ reducedMotion: 'reduce' });
        await p.goto(url);
        await p.addStyleTag({
          content: '.ecru-section{padding:0!important}.ecru-carte__vue{height:1600px!important}.ecru-carte__bascule,.ecru-carte__avantages,.ecru-carte__fleches{display:none!important}',
        });
        await p.waitForSelector('.ecru-carte.is-ready', { timeout: 90000 });
        await p.waitForTimeout(900);
        const png = await p.locator('.ecru-carte__vue').screenshot();
        const jpg = await p.evaluate(async (b64) => {
          const img = new Image();
          img.src = `data:image/png;base64,${b64}`;
          await img.decode();
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          c.getContext('2d').drawImage(img, 0, 0);
          return c.toDataURL('image/jpeg', 0.9).split(',')[1];
        }, png.toString('base64'));
        const file = `ecru-${prod}-${mat}-${coul}.jpg`;
        await writeFile(join(out, file), Buffer.from(jpg, 'base64'));
        console.log(file);
        await p.close();
        server.close();
      }
    }
  }
} else if (mode === 'poster') {
  // Image de secours : carte = 62,5 % de la largeur, fond transparent
  const { server, url } = await serve(name);
  const p = await browser.newPage({ viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 1 });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.addStyleTag({ content: '' }).catch(() => {});
  await p.goto(url);
  await p.addStyleTag({
    content: 'body{background:transparent!important}.ecru-section{background:transparent!important;padding:0!important}.ecru-carte__vue{height:1052px!important}.ecru-carte__bascule{display:none}',
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
