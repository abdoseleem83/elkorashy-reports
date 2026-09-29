// استيراد شيت المبيعات الحقيقي (تصدير المحاسبة) من أوله لآخره
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { existsSync } from 'node:fs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const FIX = new URL('./fixtures/sales-sample.xls', import.meta.url).pathname;
if(!existsSync(FIX)){ console.log('⏭️  ملف العينة مش موجود — تخطّي'); process.exit(0); }
const b = await chromium.launch();
const APP = process.env.APP_URL;
const errs=[];
const pg = await (await b.newContext()).newPage();
pg.on('pageerror', e=>errs.push(e.message));
await pg.addInitScript(()=>{ localStorage.setItem('_sync_', JSON.stringify({off:true})); });
await pg.goto(APP); await pg.waitForTimeout(1100);
// مكتبة قراءة الإكسل بتيجي من الإنترنت — من غيرها الاستيراد مايتجرّبش
if(await pg.evaluate(()=> typeof XLSX === 'undefined')){
  console.log('⏭️  مكتبة XLSX مش متحمّلة (مفيش إنترنت) — تخطّي اختبار الاستيراد');
  await b.close(); process.exit(0);
}
await pg.evaluate(()=>{ module='sales'; save('_salesTab_',0); render(true); }); await pg.waitForTimeout(300);

await pg.setInputFiles('#impSales', FIX);
await pg.waitForTimeout(7000);
const sheet = await pg.evaluate(()=>document.querySelector('#sheet')?.innerText||'');
check('شاشة التأكيد فتحت (صف العناوين اتلقى)', /تأكيد المبيعات/.test(sheet), sheet.slice(0,80));
check('قرا كل العملاء', /147/.test(sheet), (sheet.match(/عملاء: \d+/)||[''])[0]);
check('الإجمالي صح', /38,446,809/.test(sheet), (sheet.match(/إجمالي: [\d,]+/)||[''])[0]);
check('لقى أصناف أبواب', /أبواب: \d+ عميل/.test(sheet), (sheet.match(/أبواب: \d+ عميل/)||[''])[0]);
check('مقالش إن مفيش عمود كمية', !/مفيهوش عمود كمية/.test(sheet));

await pg.fill('#s_month','2026-01');
await pg.evaluate(()=>commitSalesImport()); await pg.waitForTimeout(2500);
check('الشهر اتحفظ', (await pg.evaluate(()=>Object.keys(monthlySales)))[0]==='2026-01');
check('العملاء اتضافوا لوحدهم', (await pg.evaluate(()=>customers.length))===147,
  String(await pg.evaluate(()=>customers.length)));
const tot = await pg.evaluate(()=>Math.round(Object.values(monthlySales['2026-01']).reduce((a,b)=>a+b,0)));
check('إجمالي المبيعات المحفوظ = 38,446,809', tot===38446809, String(tot));

const d = await pg.evaluate(()=>{ const dd=monthlyDoors['2026-01']||{}; let q=0,v=0; const names=new Set(), codes=new Set();
  Object.values(dd).forEach(bi=> Object.entries(bi).forEach(([n,x])=>{ q+=x.qty; v+=x.val; names.add(n); if(x.code) codes.add(x.code); }));
  return {custs:Object.keys(dd).length, items:names.size, q:Math.round(q), v:Math.round(v), codes:[...codes].sort()}; });
check('تفصيل الأبواب اتخزّن (احتياطي الاسم لما مفيش قايمة أصناف)',
  d.custs>0 && d.items>0, JSON.stringify({c:d.custs,i:d.items}));
check('كميات الأبواب اتقرت (مش أصفار)', d.q>0, String(d.q));
check('قيم الأبواب اتقرت', d.v>0, String(d.v));
check('الأكواد اتستخرجت من أسماء الأصناف',
  d.codes.length>=5 && d.codes.every(c=>/^[A-Z]\d+$/.test(c)), d.codes.join('،'));

// التقارير على البيانات الحقيقية
await pg.evaluate(()=>{ customers.slice(0,10).forEach(c=>c.cls='موزع'); save('customers_v1',customers); });
await pg.waitForTimeout(300);
const dc = await pg.evaluate(()=>repModel('doorcode'));
const dcTot = dc.body[dc.body.length-1].cells;
check('تقرير الأبواب بالكود = نفس المخزّن', Math.round(dcTot[4])===d.v, dcTot[4]+' vs '+d.v);
const dd = await pg.evaluate(()=>repModel('distdoor'));
const ddTot = dd.body[dd.body.length-1].cells;
check('أبواب الموزعين جزء من إجمالي الأبواب', ddTot[3]>0 && ddTot[3]<=dcTot[4], ddTot[3]+' / '+dcTot[4]);
const dt = await pg.evaluate(()=>repModel('dist'));
check('تقرير الإجمالي فيه الشهر عمود', dt.header.includes('2026-01'), dt.header.join('|'));

check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close();
process.exit(fail?1:0);
