// Captures pleine page du vrai thème servi par `shopify theme dev` (http://127.0.0.1:9292).
// Usage : OUT=dossier node site.mjs [/chemin ...]
import { chromium } from 'playwright';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:9292';
const OUT = process.env.OUT || '.';
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/products/carte-fidelite'];
const vues = [
  { nom: 'bureau', width: 1440, height: 900, scale: 1 },
  { nom: 'mobile', width: 390, height: 844, scale: 2, mobile: true },
];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const v of vues) {
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: v.scale,
    isMobile: !!v.mobile,
    hasTouch: !!v.mobile,
  });
  for (const p of paths) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(BASE + p, { waitUntil: 'load', timeout: 90000 });
    // Fait défiler pour déclencher les apparitions et le chargement différé
    const h = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < h; y += v.height * 0.7) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(250);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2500);
    const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
    const nom = `${v.nom}${p.replace(/[/?=&]+/g, '-').replace(/-$/, '') || '-accueil'}.png`;
    await page.screenshot({ path: join(OUT, nom), fullPage: true });
    console.log(nom, '| débordement horizontal :', largeur > v.width ? `${largeur}px` : 'non', '| erreurs :', errs.join(' / ') || 'aucune');
    await page.close();
  }
  await ctx.close();
}
await browser.close();
