import { chromium } from 'playwright';
const SP='/tmp/claude-0/-home-user-CARD-NPC/3c703e0a-e75d-5bfe-ba5d-39cea88d79a4/scratchpad/apres/';
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
for (const [w,h,n] of [[1440,900,'pd'],[390,844,'pm']]) {
  const mob=w<600;
  const ctx = await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:mob?2:1,isMobile:mob,hasTouch:mob});
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:9292/products/cartes-simples',{waitUntil:'load'});
  await p.waitForTimeout(5000);
  await p.screenshot({path:SP+n+'-1.png', fullPage: !mob});
  await p.locator('label.ecru-pastille--design').click();
  await p.waitForTimeout(800);
  await p.fill('[data-ecru-nom]','Maison Lune');
  await p.locator('[data-cible="fond"][title="Bordeaux"]').click();
  await p.locator('[data-cible="relief"][title="Or"]').click();
  await p.waitForTimeout(5000);
  await p.locator('.ecru-createur').scrollIntoViewIfNeeded();
  await p.screenshot({path:SP+n+'-2.png', fullPage: !mob});
  console.log(n, errs.join('|')||'ok', await p.evaluate(()=>[document.documentElement.scrollWidth, document.querySelector('[data-ecru-quantite]').value, document.querySelector('[data-ecru-maquette]').value, document.querySelector('[data-ecru-variant]').value]));
  await ctx.close();
}
await b.close();
