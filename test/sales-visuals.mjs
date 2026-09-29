import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); if(!ok) bad++; };
const b=await chromium.launch(); const pg=await b.newPage();
pg.on('pageerror',e=>{bad++;console.log('❌ JS:',e.message)});
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('customers_v1', JSON.stringify([
    {id:'a',name:'موزع أ',cls:'موزع'},{id:'b',name:'موزع ب',cls:'موزع'},
    {id:'c',name:'موزع ج',cls:'موزع'},{id:'d',name:'موزع د',cls:'موزع'},
    {id:'w',name:'محل جملة',cls:'مبيعات جملة'},{id:'dr',name:'عميل ابواب واحد',cls:'عميل ابواب'}]));
  localStorage.setItem('monthlySales_v1', JSON.stringify({
    '2026-01':{'موزع أ':400000,'موزع ب':300000,'موزع ج':200000,'موزع د':50000,'محل جملة':100000,'عميل ابواب واحد':70000},
    '2026-02':{'موزع أ':350000,'موزع ب':320000,'موزع ج':210000,'موزع د':60000,'محل جملة':90000,'عميل ابواب واحد':80000}}));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(800);
await pg.evaluate(()=>{ module='sales'; save('_salesTab_',2); save('_salesRep_','dist'); render(true); });
await pg.waitForTimeout(400);
const txt=await pg.evaluate(()=>document.body.innerText);
ck('ميداليات لأول تلاتة', /🥇/.test(txt) && /🥈/.test(txt) && /🥉/.test(txt));
ck('٣ مربعات فوق التقرير', (await pg.locator('.t3').count())===3);
ck('اسم الشهر بالعربي', /يناير 2026/.test(txt) && /فبراير 2026/.test(txt), txt.slice(0,80));
ck('عميل ابواب مش في التقرير', !/عميل ابواب واحد/.test(txt));
const hi=await pg.locator('table.rep td.hi').count(), lo=await pg.locator('table.rep td.lo').count();
ck('أعلى رقم أخضر وأقل رقم أحمر في كل عمود', hi===3 && lo===3, 'hi='+hi+' lo='+lo);
// الأرشفة
await pg.evaluate(()=>{ save('_salesTab_',0); render(true); }); await pg.waitForTimeout(300);
ck('شاشة الرفع بتوري الشهور بأسماء عربية',
  /يناير 2026/.test(await pg.evaluate(()=>document.body.innerText)));
await pg.evaluate(()=> toggleArchiveMonth('2026-01')); await pg.waitForTimeout(400);
const t2=await pg.evaluate(()=>document.body.innerText);
ck('الشهر بقى في الأرشيف', /الأرشيف/.test(t2), '');
const mos=await pg.evaluate(()=> salesMonths());
ck('الشهر المؤرشف خرج من التقارير', mos.length===1 && mos[0]==='2026-02', mos.join(','));
await pg.evaluate(()=> toggleArchiveMonth('2026-01')); await pg.waitForTimeout(400);
ck('رجع تاني', (await pg.evaluate(()=> salesMonths())).length===2);
// شريط التصدير عائم في جيفز
await pg.evaluate(()=>{ module='gv'; save('_gvTab_',null); render(true); }); await pg.waitForTimeout(300);
console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
