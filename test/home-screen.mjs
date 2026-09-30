// الصفحة الرئيسية: نظرة سريعة · تنبيهات · أيقونات الأقسام بأرقامها
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); if(!ok) bad++; };
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:412,height:880}});
pg.on('pageerror',e=>{bad++;console.log('❌ JS:',e.message)});
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('items_v1', JSON.stringify([{id:'i1',name:'صنف',mainGroup:'نيو لاين'}]));
  localStorage.setItem('warehouses_v1', JSON.stringify([{id:'w1',name:'طنطا'},{id:'w2',name:'الاسكندرية'}]));
  localStorage.setItem('whStock_v1', JSON.stringify({w1:{'ص1':{balance:1}},w2:{'ص2':{balance:2}}}));
  localStorage.setItem('whShortage_v1', JSON.stringify({w1:{'ص1':{q1:2},'ص2':{q1:1}}}));
  localStorage.setItem('customers_v1', JSON.stringify([
    {id:'c1',name:'موزع',cls:'موزع'},{id:'c2',name:'مش مصنف',cls:''},{id:'c3',name:'مش مصنف2',cls:''}]));
  localStorage.setItem('monthlySales_v1', JSON.stringify({'2026-08':{'موزع':38446809}}));
  localStorage.setItem('employees_v1', JSON.stringify([{id:'e1',name:'م'}]));
  localStorage.setItem('gvOrders_v1', JSON.stringify([{id:'o1',name:'حاوية',date:'2026-01-01',rows:[]}]));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(900);

const nMods=await pg.evaluate(()=> modules.length);
ck('أيقونة لكل قسم', (await pg.locator('.htile').count())===nMods, 'الأقسام='+nMods);
const txt=await pg.evaluate(()=>document.body.innerText);
ck('التحية والتاريخ بالعربي', /الخير/.test(txt) && /٢٠٢٦|2026/.test(txt));
ck('مبيعات آخر شهر مختصرة باسم الشهر', /38\.4 م/.test(txt) && /أغسطس 2026/.test(txt), '');
ck('عدّاد النواقص وغير المصنّف', /نواقص/.test(txt) && /غير مصنّف/.test(txt));
ck('تنبيه العملاء غير المصنّفين', /2 عميل من غير تصنيف/.test(txt), '');
ck('تنبيه النواقص', /2 صنف في طلب النواقص/.test(txt), '');
ck('أرقام الأقسام صح',
  /1 صنف/.test(txt) && /2 مخزن · 2 رصيد/.test(txt) && /3 عميل · 1 شهر/.test(txt) &&
  /1 طلبية/.test(txt) && /1 موظف/.test(txt), '');

// آخر أيقونة تاخد الصف كله بس لما العدد يبقى فردي
const w=await pg.evaluate(()=>{
  const t=[...document.querySelectorAll('.htile')];
  return {n:t.length, wide:document.querySelectorAll('.htile.wide').length,
          last:Math.round(t[t.length-1].getBoundingClientRect().width),
          first:Math.round(t[0].getBoundingClientRect().width)};
});
ck('آخر أيقونة عرضها كامل لو العدد فردي بس', w.wide===(w.n%2), JSON.stringify(w));
ck('عرض الأيقونات متساوي لو العدد زوجي',
  w.n%2 ? w.last>w.first*1.8 : Math.abs(w.last-w.first)<3, JSON.stringify(w));

// الضغط بيفتح القسم
await pg.locator('.htile').first().click(); await pg.waitForTimeout(350);
ck('الضغط على أيقونة بيفتح القسم', (await pg.evaluate(()=>module))==='items');
await pg.evaluate(()=>{ switchModule('items'); }); await pg.waitForTimeout(300);
ck('الرجوع بيوري الرئيسية تاني', (await pg.locator('.htile').count())===nMods);
// زرار الرئيسية في الشريط بيرجّع من أي قسم
await pg.evaluate(()=>{ switchModule('sales'); }); await pg.waitForTimeout(250);
await pg.locator('nav .nav-btn', {hasText:'الرئيسية'}).click(); await pg.waitForTimeout(300);
ck('زرار 🏠 بيرجّع للرئيسية',
  (await pg.evaluate(()=>module))===null && (await pg.locator('.htile').count())===nMods);

// تنبيه المخازن المكررة بيظهر لما يبقى فيه تكرار
await pg.evaluate(()=>{ warehouses.push({id:'w3',name:'طنطا'}); save('warehouses_v1',warehouses); render(true); });
await pg.waitForTimeout(300);
ck('تنبيه المخازن المكررة', /مخازن متكررة/.test(await pg.evaluate(()=>document.body.innerText)));
// ── باقي الشاشات على نفس شكل الرئيسية: شريط تبويبات واحد في كل قسم
for(const mo of ['items','warehouses','sales','gv','payroll']){
  await pg.evaluate(x=>{ module=x; render(true); }, mo);
  await pg.waitForTimeout(250);
  const c=await pg.locator('#main > .stabs > .stab').count();
  ck('شريط تبويبات موحّد في «'+mo+'»', c>=3, 'عدد='+c);
}
// التبويبات الداخلية كمان (تقارير المبيعات والمقارنات)
await pg.evaluate(()=>{ module='sales'; save('_salesTab_',2); render(true); }); await pg.waitForTimeout(300);
ck('تقارير المبيعات نفس الشريط', (await pg.locator('#st_content > .stabs > .stab').count())===6);
await pg.evaluate(()=>{ module='warehouses'; save('_whTab_','cmpx'); render(true); }); await pg.waitForTimeout(300);
ck('المقارنات نفس الشريط', (await pg.locator('#wh_content > .stabs > .stab').count())===3);
// مفيش أزرار تبويب بستايل قديم متحطوط بالإيد
const legacy=await pg.evaluate(()=>
  [...document.querySelectorAll('#main button')].filter(b=>/border-radius:9px/.test(b.getAttribute('style')||'')).length);
ck('مفيش تبويبات بالستايل القديم', legacy===0, 'عدد='+legacy);

console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
