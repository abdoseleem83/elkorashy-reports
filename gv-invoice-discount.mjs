// تسعير جيفز: إجمالي الفاتورة لازم يظهر حتى لو ما اتكتبش، وخانة الخصم بتنزّل من الفاتورة.
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
    {id:'g1',name:'صنف أ',code:'A1',perCarton:'10',weight:'1',price:'2'},
    {id:'g2',name:'صنف ب',code:'B1',perCarton:'10',weight:'1',price:'3'}]));
  localStorage.setItem('gvOrders_v1', JSON.stringify([{id:'o1',name:'طلبية تجربة',date:'2026-10-01',containers:1,cap:28000,archived:false,
    rows:[{gid:'g1',qty:100,recv:100},{gid:'g2',qty:100,recv:100}], cost:{rate:50}}]));  // قيمة المستلم = 200+300 = 500$
  localStorage.setItem('_gvCur_', JSON.stringify('o1'));
});
await pg.goto(APP); await pg.waitForTimeout(1200);
await pg.evaluate(()=>{ gvSelect('o1'); });
const P0 = await pg.evaluate(()=>gvPricing(gvGet()));
check('من غير فاتورة ولا خصم: الفاتورة = المستلم ٥٠٠$', P0.invoice===500 && P0.netInvoice===500 && P0.goodsEgp===25000, JSON.stringify([P0.invoice,P0.netInvoice,P0.goodsEgp]));

await pg.evaluate(()=>{ module='gv'; gvTab=2; render(true); }); await pg.waitForTimeout(500);
const ph = await pg.evaluate(()=>[...document.querySelectorAll('input[placeholder]')].map(i=>i.placeholder));
check('خانة الفاتورة فيها القيمة المحسوبة (٥٠٠) بدل ما تبقى فاضية', ph.includes('500'), ph.join(','));
const txt0 = await pg.evaluate(()=>document.body.innerText);
check('خانة «خصم الفاتورة $» ظاهرة', txt0.includes('خصم الفاتورة $'));
check('سطر صافي الفاتورة ظاهر', txt0.includes('صافي الفاتورة') && txt0.includes('محسوبة من قيمة المستلم'));

// خصم ٥٠$ على فاتورة ٥٠٠$
await pg.evaluate(()=>gvCostSet('discount', 50)); await pg.waitForTimeout(300);
const P1 = await pg.evaluate(()=>gvPricing(gvGet()));
check('الصافي = ٤٥٠$ والبضاعة = ٢٢٥٠٠ ج', P1.netInvoice===450 && P1.goodsEgp===22500, JSON.stringify([P1.netInvoice,P1.goodsEgp]));
check('مجموع تكلفة الأصناف = الإجمالي بعد الخصم', Math.abs(P1.rows.reduce((a,r)=>a+r.costEgp,0)-P1.totalEgp)<0.01);
check('الصنف الأغلى نصيبه أكبر (٦٠٪ / ٤٠٪)', Math.abs(P1.rows[1].costEgp/P1.totalEgp-0.6)<1e-9);

// فاتورة مكتوبة يدوي + خصم + مصاريف بالدولار
await pg.evaluate(()=>{ gvCostSet('invoice', 520); gvCostSet('shipUsd', 10); }); await pg.waitForTimeout(300);
const P2 = await pg.evaluate(()=>gvPricing(gvGet()));
check('فاتورة ٥٢٠ − خصم ٥٠ = ٤٧٠ × ٥٠ + شحن ١٠×٥٠', P2.netInvoice===470 && P2.totalEgp===470*50+500, String(P2.totalEgp));
const txt2 = await pg.evaluate(()=>document.body.innerText);
check('السطر بيوضّح الخصم', /520.*خصم 50/.test(txt2));

// التصدير بيشمل الخصم والفاتورة الفعلية
const doc = await pg.evaluate(()=>gvPriceDocBody());
check('PDF/صورة فيها خانة الخصم', doc.includes('خصم الفاتورة $'));
await pg.evaluate(()=>gvCostSet('invoice', 0)); await pg.waitForTimeout(200);
const doc2 = await pg.evaluate(()=>gvPriceDocBody());
check('التصدير بيطبع الفاتورة المحسوبة (٥٠٠) مش صفر', />500</.test(doc2));
check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close(); process.exit(fail?1:0);
