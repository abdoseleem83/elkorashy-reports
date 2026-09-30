// رفع شهر موجود: بيسأل قبل الاستبدال، والصيغة القديمة (2026-1) ما تفضلش جنب الجديدة فالشهر يتحسب مرتين
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let fail=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(ok?'':'  — '+x)); if(!ok) fail++; };
const b=await chromium.launch(); const pg=await b.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
let answer=false, asked=0; pg.on('dialog', d=>{ asked++; answer? d.accept() : d.dismiss(); });
await pg.addInitScript(()=>{ localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('customers_v1', JSON.stringify([{id:'c1',name:'موزع أ',cls:'موزع'}]));
  localStorage.setItem('monthlySales_v1', JSON.stringify({'2026-1':{'موزع أ':500}}));
  localStorage.setItem('monthlySector_v1', JSON.stringify({'2026-1':{'موزع أ':{'كومبن':500}}})); });
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(600);
const up = ()=> pg.evaluate(()=>{
  module='sales'; save('_salesTab_',0); render(true);
  pendingImport={type:'sales', custMap:{'موزع أ':900}, sectorMap:{'موزع أ':{'كومبن':900}}, doorMap:{}, itemMap:{}, unmatchedCust:new Set(), hasQty:false};
  document.body.insertAdjacentHTML('beforeend','<select id="s_mo"><option value="01" selected></option></select><select id="s_yr"><option selected>2026</option></select>');
  commitSalesImport(); document.getElementById('s_mo').remove(); document.getElementById('s_yr').remove();
  return {keys:Object.keys(monthlySales), tot:salesMonths().reduce((a,m)=> a+Object.values(monthlySales[m]).reduce((x,y)=>x+y,0),0)};
});
let r=await up();
ck('سأل قبل ما يستبدل يناير', asked===1, String(asked));
ck('رفض = الشهر القديم زي ما هو', JSON.stringify(r.keys)==='["2026-1"]' && r.tot===500, JSON.stringify(r));
answer=true; r=await up();
ck('وافق = الشهر اتستبدل والصيغة القديمة اتشالت (مش متحسوب مرتين)', JSON.stringify(r.keys)==='["2026-01"]' && r.tot===900, JSON.stringify(r));
ck('مفيش أخطاء', !errs.length, errs.join('|'));
await b.close(); process.exit(fail?1:0);
