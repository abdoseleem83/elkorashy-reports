// إضافة أصناف جيفز للطلبية: الكمية بالكراتين بتتحول قطع، والعكس، والخانتين بيتزامنوا.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const APP = process.env.APP_URL, XL = process.env.XLSX_LOCAL;
const errs=[];
const pg = await (await b.newContext()).newPage();
pg.on('pageerror', e=>errs.push(e.message));
if(XL) await pg.route('**/xlsx-js-style*/**', r=>r.fulfill({path:XL, contentType:'application/javascript'}));
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('gvcodes_v1', JSON.stringify([
    {id:'g1',name:'سبلونة حرار 160',code:'A1',perCarton:'15',weight:'1',price:'2'},
    {id:'g2',name:'سبلونة مفصلى 160',code:'B1',perCarton:'20',weight:'1',price:'3'},
    {id:'g3',name:'صنف من غير كرتونة',code:'C1',perCarton:'',weight:'1',price:'1'}]));
  localStorage.setItem('gvOrders_v1', JSON.stringify([{id:'o1',name:'تجربة',date:'2026-10-01',containers:1,cap:28000,archived:false,rows:[],cost:{}}]));
});
await pg.goto(APP); await pg.waitForTimeout(1200);
await pg.evaluate(()=>{ gvSelect('o1'); module='gv'; render(true); gvAddItem(); }); await pg.waitForTimeout(400);

const card = n => pg.locator('#gvlist .card', {hasText:n}).first();
const vals = async n => ({c: await card(n).locator('[data-k=c]').inputValue(), q: await card(n).locator('[data-k=q]').inputValue()});
const qtyOf = gid => pg.evaluate(id=>(gvGet().rows.find(r=>r.gid===id)||{}).qty, gid);

await card('حرار 160').locator('[data-k=c]').fill('3'); await card('حرار 160').locator('[data-k=c]').blur(); await pg.waitForTimeout(300);
check('٣ كراتين × ١٥ = ٤٥ قطعة اتخزّنت', (await qtyOf('g1'))===45, String(await qtyOf('g1')));
check('خانة القطع اتحدّثت لـ٤٥', (await vals('حرار 160')).q==='45', JSON.stringify(await vals('حرار 160')));

await card('مفصلى 160').locator('[data-k=q]').fill('50'); await card('مفصلى 160').locator('[data-k=q]').blur(); await pg.waitForTimeout(300);
check('٥٠ قطعة ÷ ٢٠ = ٢٫٥ كرتونة بتظهر', (await vals('مفصلى 160')).c==='2.5', JSON.stringify(await vals('مفصلى 160')));

await card('حرار 160').locator('[data-k=c]').fill('1.5'); await card('حرار 160').locator('[data-k=c]').blur(); await pg.waitForTimeout(300);
check('١٫٥ كرتونة = ٢٢٫٥ قطعة', (await qtyOf('g1'))===22.5);

const nopc = card('من غير كرتونة').locator('[data-k=c]');
check('الصنف من غير عدد قطع/كرتونة: خانة الكراتين مقفولة', await nopc.isDisabled());

// الجدول الرئيسي بيعرض الكراتين صح
const tot = await pg.evaluate(()=>gvCalc(gvGet()).tot.cartons);
check('إجمالي الكراتين في الطلبية = ١٫٥ + ٢٫٥ = ٤', Math.abs(tot-4)<1e-9, String(tot));

// تصفير الكراتين يشيل الصنف
await card('حرار 160').locator('[data-k=c]').fill('0'); await card('حرار 160').locator('[data-k=c]').blur(); await pg.waitForTimeout(300);
check('صفر كراتين بيشيل الصنف من الطلبية', (await pg.evaluate(()=>gvGet().rows.length))===1);
check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close(); process.exit(fail?1:0);
