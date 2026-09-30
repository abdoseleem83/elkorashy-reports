// دمج عميل اتغيّر اسمه: مبيعاته وقطاعاته وأبوابه تتنقل، والاسم القديم يتحوّل تلقائي
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); if(!ok) bad++; };
const b=await chromium.launch(); const pg=await b.newPage();
pg.on('pageerror',e=>{bad++;console.log('❌ JS:',e.message)});
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('customers_v1', JSON.stringify([
    {id:'old',name:'موزع طنطا القديم',cls:'موزع'},
    {id:'new',name:'موزع طنطا الجديد',cls:''}]));
  localStorage.setItem('monthlySales_v1', JSON.stringify({
    '2026-01':{'موزع طنطا القديم':100000,'موزع طنطا الجديد':40000}}));
  localStorage.setItem('monthlySector_v1', JSON.stringify({
    '2026-01':{'موزع طنطا القديم':{'كومبن':60000,'ابواب':40000},
               'موزع طنطا الجديد':{'كومبن':40000}}}));
  localStorage.setItem('monthlyDoors_v1', JSON.stringify({
    '2026-01':{'موزع طنطا القديم':{'باب كامل 90 سم A02':{qty:10,val:40000,code:'A02',sub:'ابواب'}}}}));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(800);
await pg.evaluate(()=>{ module='sales'; save('_salesTab_',1); render(true); }); await pg.waitForTimeout(300);
ck('زرار الدمج ظاهر قدام العميل',
  (await pg.locator('button[title="دمج في اسم تاني"]').count())>=2);
await pg.evaluate(()=> mergeCustomerSheet('old')); await pg.waitForTimeout(250);
ck('شيت الدمج فيه قايمة بالأسماء التانية',
  (await pg.locator('#mg_list option').count())===1);
await pg.fill('#mg_to','موزع طنطا الجديد');
await pg.evaluate(()=> doMergeCustomer('old')); await pg.waitForTimeout(400);

const st=await pg.evaluate(()=>({
  cust: JSON.parse(localStorage.getItem('customers_v1')),
  sales: JSON.parse(localStorage.getItem('monthlySales_v1')),
  sec: JSON.parse(localStorage.getItem('monthlySector_v1')),
  doors: JSON.parse(localStorage.getItem('monthlyDoors_v1')),
  alias: JSON.parse(localStorage.getItem('custAlias_v1'))}));
ck('العميل القديم اتشال', st.cust.length===1 && st.cust[0].id==='new', JSON.stringify(st.cust.map(c=>c.name)));
ck('التصنيف اتنقل للجديد', st.cust[0].cls==='موزع', st.cust[0].cls);
ck('المبيعات اتجمعت ١٤٠ ألف', st.sales['2026-01']['موزع طنطا الجديد']===140000,
  JSON.stringify(st.sales['2026-01']));
ck('الاسم القديم مبقاش موجود في المبيعات', !('موزع طنطا القديم' in st.sales['2026-01']));
ck('القطاعات اتجمعت: كومبن ١٠٠ وأبواب ٤٠',
  st.sec['2026-01']['موزع طنطا الجديد']['كومبن']===100000 &&
  st.sec['2026-01']['موزع طنطا الجديد']['ابواب']===40000,
  JSON.stringify(st.sec['2026-01']));
ck('الأبواب اتنقلت بالكود والقطاع الفرعي',
  st.doors['2026-01']['موزع طنطا الجديد']['باب كامل 90 سم A02'].code==='A02' &&
  st.doors['2026-01']['موزع طنطا الجديد']['باب كامل 90 سم A02'].qty===10,
  JSON.stringify(st.doors['2026-01']));
ck('جدول التحويل اتسجّل', st.alias['موزع طنطا القديم']==='موزع طنطا الجديد', JSON.stringify(st.alias));

// التقارير بتشوف سطر واحد بس
const d=await pg.evaluate(()=> repModel('dist'));
const rows=d.body.filter(r=>r.type==='row').map(r=>r.cells[0]);
ck('التقرير فيه سطر واحد للموزع', rows.length===1 && rows[0]==='موزع طنطا الجديد', rows.join('|'));

// دمج تاني: التحويل القديم بيتحدّث للاسم الأحدث
await pg.evaluate(()=>{
  customers.push({id:'x3',name:'موزع طنطا النهائي',cls:''}); save('customers_v1',customers);
  mergeCustomerNames('موزع طنطا الجديد','موزع طنطا النهائي'); });
const al=await pg.evaluate(()=> JSON.parse(localStorage.getItem('custAlias_v1')));
ck('الاسم الأول بقى بيوّدي على الاسم النهائي',
  al['موزع طنطا القديم']==='موزع طنطا النهائي', JSON.stringify(al));
console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
