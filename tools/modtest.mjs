import { chromium } from 'playwright';
const SP='/tmp/claude-0/-home-user-CARD-NPC/3c703e0a-e75d-5bfe-ba5d-39cea88d79a4/scratchpad/';
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({viewport:{width:1440,height:900}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:9292/',{waitUntil:'load'});
await p.evaluate(()=>document.querySelector('.ecru-assortiments-section').scrollIntoView()); await p.waitForTimeout(3000);
await p.locator('.ecru-assortiments-section').screenshot({path:SP+'ecru-modeles-accueil.png'});
// configurateur via ?modele
await p.goto('http://127.0.0.1:9292/products/cartes-simples?variant=48429022216363&modele=monogramme',{waitUntil:'load'});
await p.waitForSelector('.ecru-carte.is-ready',{timeout:60000}); await p.waitForTimeout(5000);
const r1 = await p.evaluate(()=>[document.querySelector('[data-ecru-maquette]').value, document.querySelector('[data-ecru-champ="fond"]').value, document.querySelector('[data-ecru-modele="monogramme"]').getAttribute('aria-pressed')]);
await p.locator('.ecru-editeur__el').nth(1).click(); await p.fill('[data-ecru-nom]','Le Bar Marceau'); await p.waitForTimeout(4000);
await p.locator('.ecru-modele[data-ecru-modele="numero"]').click(); await p.waitForTimeout(4500);
await p.screenshot({path:SP+'ecru-config.png', fullPage:false});
await p.evaluate(()=>window.scrollTo(0,0)); await p.waitForTimeout(1500);
await p.locator('.ecru-produit__grille').screenshot({path:SP+'ecru-config-full.png'});
const r2 = await p.evaluate(()=>document.querySelector('[data-ecru-maquette]').value);
// sans paramètre : modèle par défaut
await p.goto('http://127.0.0.1:9292/products/carte-fidelite',{waitUntil:'load'});
await p.locator('label.ecru-pastille--design').click(); await p.waitForTimeout(800);
const r3 = await p.evaluate(()=>[document.querySelector('[data-ecru-maquette]').value, document.querySelector('[data-ecru-quantite]').value]);
console.log(JSON.stringify({r1,r2,r3,errs}));
await b.close();
