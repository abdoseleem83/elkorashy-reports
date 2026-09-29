// اختيار الشهور والتجميع بالكوارترات + عمود «غير معروف»
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); if(!ok) bad++; };
const b=await chromium.launch(); const pg=await b.newPage();
pg.on('pageerror',e=>{bad++;console.log('❌ JS:',e.message)});
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('customers_v1', JSON.stringify([
    {id:'a',name:'موزع أ',cls:'موزع'},{id:'b',name:'موزع ب',cls:'موزع'}]));
  const ms={};
  for(let i=1;i<=6;i++) ms['2026-'+String(i).padStart(2,'0')]={'موزع أ':i*10000,'موزع ب':i*5000};
  localStorage.setItem('monthlySales_v1', JSON.stringify(ms));
  localStorage.setItem('items_v1', JSON.stringify([{id:'i1',name:'صنف معروف',mainGroup:'نيو لاين',subGroup:''}]));
  localStorage.setItem('monthlyItems_v1', JSON.stringify({
    '2026-01':{'صنف معروف':{qty:1,val:1000},'صنف مش معروف':{qty:2,val:7000}}}));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(800);
await pg.evaluate(()=>{ module='sales'; save('_salesTab_',2); save('_salesRep_','dist'); render(true); });
await pg.waitForTimeout(400);

ck('شريط الشهور ظاهر', (await pg.locator('.mochip').count())>=10);
let h=await pg.evaluate(()=> repModel('dist').header);
ck('٦ شهور بأسماء عربية', h.length===9 && h[2]==='يناير 2026' && h[7]==='يونيو 2026', h.join('|'));

// كوارترات
await pg.evaluate(()=> setMoGroup('quarter')); await pg.waitForTimeout(350);
h=await pg.evaluate(()=> repModel('dist').header);
ck('التجميع بالكوارترات: عمودين',
  h.join('|')==='م|بيان|ربع 1 · 2026|ربع 2 · 2026|الإجمالي', h.join('|'));
let d=await pg.evaluate(()=> repModel('dist'));
let r0=d.body[0].cells;
ck('ربع ١ = ٦٠ ألف وربع ٢ = ١٥٠ ألف لموزع أ', r0[2]===60000 && r0[3]===150000, r0.join('/'));
ck('الإجمالي ٢١٠ ألف', r0[4]===210000, String(r0[4]));

// اختيار ربع معيّن
await pg.evaluate(()=> pickQuarter(1)); await pg.waitForTimeout(350);
h=await pg.evaluate(()=> repModel('dist').header);
ck('اختيار ربع ١ = تلات شهور بس',
  h.join('|')==='م|بيان|يناير 2026|فبراير 2026|مارس 2026|الإجمالي', h.join('|'));

// شيل شهر بالإيد
await pg.evaluate(()=> toggleMo('2026-02')); await pg.waitForTimeout(350);
h=await pg.evaluate(()=> repModel('dist').header);
ck('شيل فبراير', h.join('|')==='م|بيان|يناير 2026|مارس 2026|الإجمالي', h.join('|'));
await pg.evaluate(()=> allMonths()); await pg.waitForTimeout(350);
ck('رجوع للكل', (await pg.evaluate(()=> salesMonths())).length===6);

// «غير معروف» — الضغط بيوري الأصناف
const u=await pg.evaluate(()=> unknownItems());
ck('الأصناف غير المعروفة بتتحسب',
  u.length===1 && u[0].name==='صنف مش معروف' && u[0].val===7000, JSON.stringify(u));
await pg.evaluate(()=> showUnknownItems()); await pg.waitForTimeout(250);
ck('الشيت بيوري الصنف', /صنف مش معروف/.test(await pg.evaluate(()=>document.body.innerText)));
console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
