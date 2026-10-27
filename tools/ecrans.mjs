import { chromium } from 'playwright';
const [,, out, path='/', w='1440', h='900'] = process.argv;
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const mob = +w < 600;
const ctx = await b.newContext({ viewport:{width:+w,height:+h}, deviceScaleFactor: mob?2:1, isMobile:mob, hasTouch:mob });
const p = await ctx.newPage(); const errs=[];
p.on('pageerror', e=>errs.push(e.message));
await p.goto('http://127.0.0.1:9292'+path,{waitUntil:'load',timeout:90000});
await p.waitForTimeout(3000);
const H = await p.evaluate(()=>document.body.scrollHeight);
let i=0;
for (let y=0; y<H; y+= +h) { await p.evaluate(yy=>window.scrollTo(0,yy),y); await p.waitForTimeout(1500); await p.screenshot({path:`${out}-${String(i++).padStart(2,'0')}.png`}); }
console.log('H',H,'shots',i,'errs',errs.join('|')||'none', 'sw', await p.evaluate(()=>document.documentElement.scrollWidth));
await b.close();
