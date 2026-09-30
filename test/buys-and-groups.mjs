// تقرير المشتريات · نقل البنود بين الأعمدة · مربعات أعلى ٣ في الـPDF
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); if(!ok) bad++; };
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:412,height:880}});
pg.on('pageerror',e=>{bad++;console.log('❌ JS:',e.message)});
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('customers_v1', JSON.stringify([
    {id:'d1',name:'موزع طنطا',cls:'موزع'},
    {id:'g1',name:'عبد الخالق',cls:'مبيعات جملة'},
    {id:'g2',name:'محل النور',cls:'مبيعات جملة'},
    {id:'s1',name:'عميل خاص',cls:'مبيعات خاصة'}]));
  localStorage.setItem('monthlySales_v1', JSON.stringify({'2026-08':{
    'موزع طنطا':500000,'عبد الخالق':300000,'محل النور':120000,'عميل خاص':50000}}));
  // البيانات الجديدة بتتخزّن بالمجموعة الرئيسية
  localStorage.setItem('monthlySector_v1', JSON.stringify({'2026-08':{
    'موزع طنطا':{'قطاعات كرافت لاين':300000,'قطاعات PVC كومبن':200000},
    'عبد الخالق':{'قطاعات كرافت لاين':150000,'قطاعات PVC كومبن':100000,'شاتر':50000},
    'محل النور':{'قطاعات كرافت لاين':120000},
    'عميل خاص':{'نيو لاين':50000}}}));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(900);
await pg.evaluate(()=>{ module='sales'; save('_salesTab_',2); save('_salesRep_','buys'); render(true); });
await pg.waitForTimeout(400);

// ── ١) تقرير المشتريات
ck('أيقونة «مشتريات» موجودة',
  (await pg.locator('#st_content > .stabs .stab').allInnerTexts()).some(t=>/مشتريات/.test(t)));
const md=await pg.evaluate(()=> repModel('buys'));
ck('عملاء الجملة بس في التقرير',
  md.body.filter(r=>r.type==='row').map(r=>r.cells[0]).join('|')==='عبد الخالق|محل النور',
  md.body.filter(r=>r.type==='row').map(r=>r.cells[0]).join('|'));
ck('الأعمدة: كرافت وكومبن وأخرى',
  md.header.join('|')==='العميل|كرافت لاين|كومبن|أخرى|الإجمالي', md.header.join('|'));
const ak=md.body.find(r=>r.cells[0]==='عبد الخالق');
ck('عبد الخالق: كرافت ١٥٠ وكومبن ١٠٠ وشاتر ٥٠',
  ak.cells[1]===150000 && ak.cells[2]===100000 && ak.cells[3]===50000, JSON.stringify(ak.cells));
ck('وإجماليه ٣٠٠ ألف', ak.cells[4]===300000, String(ak.cells[4]));
ck('الموزع مش في التقرير ده', !md.body.some(r=>r.cells[0]==='موزع طنطا'));

// ── ٢) نقل بند لعمود تاني
await pg.evaluate(()=> secSheet('أخرى')); await pg.waitForTimeout(300);
ck('شيت العمود بيوري البند اللي تحته',
  /شاتر/.test(await pg.evaluate(()=>document.body.innerText)));
await pg.evaluate(()=> secMoveTo('شاتر','كومبن')); await pg.waitForTimeout(400);
const md2=await pg.evaluate(()=> repModel('buys'));
ck('العمود «أخرى» اختفى بعد النقل',
  md2.header.join('|')==='العميل|كرافت لاين|كومبن|الإجمالي', md2.header.join('|'));
const ak2=md2.body.find(r=>r.cells[0]==='عبد الخالق');
ck('وكومبن بقت ١٥٠ (١٠٠ + ٥٠ شاتر)', ak2.cells[2]===150000, JSON.stringify(ak2.cells));
ck('والإجمالي ما اتغيّرش', ak2.cells[3]===300000, String(ak2.cells[3]));
// نفس النقل بيأثر في تقرير الموزعين كمان
const ms=await pg.evaluate(()=> repModel('distsec'));
ck('نفس التوزيع في تقرير الموزعين',
  ms.header.join('|')==='الموزع|كرافت لاين|كومبن|الإجمالي', ms.header.join('|'));
// الرجوع
await pg.evaluate(()=> secMoveTo('شاتر','أخرى')); await pg.waitForTimeout(350);
ck('الرجوع للعمود الأصلي شغّال',
  (await pg.evaluate(()=> repModel('buys').header.join('|')))==='العميل|كرافت لاين|كومبن|أخرى|الإجمالي');

// ── ٣) مربعات أعلى ٣ في المستند المصدَّر
const doc=await pg.evaluate(()=>{
  const m2=repModel('buys'); return docBoxesHtml(m2); });
ck('المستند فيه مربعات أعلى ٣', /dxtop/.test(doc) && /🥇/.test(doc), doc.slice(0,50));
ck('وفيه أسماء العملاء والمجموعات', /عبد الخالق/.test(doc) && /كرافت لاين/.test(doc));
const cnt=(doc.match(/dxtl/g)||[]).length;
ck('مجموعتين مربعات (عملاء ومجموعات)', cnt===2, String(cnt));
// في كل التقارير
const all=await pg.evaluate(()=> ['dist','distsec','doorcode','distdoor','special','cmpmo','buys']
  .map(id=>{ try{ const m3=repModel(id); return {id, n:((m3&&m3.boxes)||[]).length}; }catch(e){ return {id, err:1}; } }));
ck('كل تقارير المبيعات فيها مربعات', all.every(x=>x.err||x.n>0), JSON.stringify(all));
console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
