import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
for (const [w,h] of [[1440,900],[390,844]]) {
  const mob=w<600;
  const ctx = await b.newContext({viewport:{width:w,height:h},isMobile:mob,hasTouch:mob});
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto('http://127.0.0.1:9292/products/cartes-simples',{waitUntil:'load'});
  await p.waitForSelector('.ecru-carte.is-ready',{timeout:60000});
  const px = async () => { await p.waitForTimeout(4500); const v=p.locator('.ecru-carte__vue'); const buf=await v.screenshot(); return buf; };
  const { default: sharp } = await import('sharp').catch(()=>({default:null}));
  const avg = async (lab) => { const buf = await px(); const fs=await import('fs'); fs.writeFileSync(`/tmp/claude-0/-home-user-CARD-NPC/3c703e0a-e75d-5bfe-ba5d-39cea88d79a4/scratchpad/c-${w}-${lab}.png`, buf); };
  await avg('noir');
  await p.locator('label.ecru-pastille', {hasText:'Blanc'}).click(); await avg('blanc');
  await p.locator('label.ecru-pastille--design').click(); await p.locator('[data-cible="fond"][title="Vert anglais"]').click(); await avg('vert');
  await p.locator('label.ecru-matiere-choix', {hasText:'Métal'}).click(); await avg('vert-metal');
  console.log(w, errs.join('|')||'ok');
  await ctx.close();
}
await b.close();
