// المبيعات: ٣ أيقونات (رفع · عملاء · تقارير) و٤ تقارير جوه التقارير
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const APP = process.env.APP_URL;
const errs=[];
const pg = await (await b.newContext()).newPage();
pg.on('pageerror', e=>errs.push(e.message));
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('customers_v1', JSON.stringify([
    {id:'c1',name:'موزع طنطا',cls:'موزع'},{id:'c2',name:'موزع المحلة',cls:'موزع'},
    {id:'c3',name:'محل جملة',cls:'مبيعات جملة'},{id:'c4',name:'عميل مستبعد',cls:'مستبعد'}]));
  localStorage.setItem('monthlySales_v1', JSON.stringify({
    '2026-08':{'موزع طنطا':100000,'موزع المحلة':60000,'محل جملة':30000,'عميل مستبعد':5000},
    '2026-09':{'موزع طنطا':120000,'موزع المحلة':40000,'محل جملة':20000}}));
  localStorage.setItem('monthlySector_v1', JSON.stringify({
    '2026-08':{'موزع طنطا':{'قطاعات PVC كومبن':70000,'ابواب WPC':30000},
               'موزع المحلة':{'اكسسوارات':20000,'ابواب WPC':40000},
               'محل جملة':{'قطاعات كرافت لاين':30000}},
    '2026-09':{'موزع طنطا':{'قطاعات PVC كومبن':90000,'ابواب WPC':30000},
               'موزع المحلة':{'ابواب WPC':40000},
               'محل جملة':{'قطاعات كرافت لاين':20000}}}));
  localStorage.setItem('monthlyDoors_v1', JSON.stringify({
    '2026-08':{'موزع طنطا':{'باب كامل 80 سم A05':{qty:30,val:30000,code:'A05',sub:'ابواب'}},
               'موزع المحلة':{'باب كامل 90 سم A07':{qty:40,val:40000,code:'A07',sub:'ابواب'}}},
    '2026-09':{'موزع طنطا':{'باب كامل 80 سم A05':{qty:25,val:30000,code:'A05',sub:'ابواب'},
                            'كالون سلندر نحاس ابواب WPC':{qty:500,val:9000,code:'',sub:'اكسسوارات ابواب wpc'}},
               'موزع المحلة':{'باب كامل 80 سم A05':{qty:35,val:40000,code:'A05',sub:'ابواب'}}}}));
});
await pg.goto(APP); await pg.waitForTimeout(1200);
await pg.evaluate(()=>{ module='sales'; render(true); }); await pg.waitForTimeout(350);

// ── التلات أيقونات
const tabs = await pg.evaluate(()=>[...document.querySelectorAll('#main .tabs button')].map(x=>x.textContent.trim()));
check('٣ أيقونات: رفع · عملاء · تقارير',
  tabs.join('|')==='📥 رفع شيت المبيعات|👥 العملاء|📊 التقارير', tabs.join('|'));
await pg.evaluate(()=>{ save('_salesTab_',0); render(true); }); await pg.waitForTimeout(300);
check('أيقونة الرفع فيها زرار الرفع', (await pg.evaluate(()=>document.body.innerText)).includes('رفع مبيعات شهر'));
await pg.evaluate(()=>{ save('_salesTab_',1); render(true); }); await pg.waitForTimeout(300);
const custTxt = await pg.evaluate(()=>document.body.innerText);
check('أيقونة العملاء فيها مجموعات العملاء', /موزع/.test(custTxt) && /استيراد عملاء/.test(custTxt), '');
await pg.evaluate(()=>{ toggleGroup('موزع'); }); await pg.waitForTimeout(250);
check('فتح المجموعة بيوري الأسماء', (await pg.evaluate(()=>document.body.innerText)).includes('موزع طنطا'));

// ── الأربع تقارير
await pg.evaluate(()=>{ save('_salesTab_',2); render(true); }); await pg.waitForTimeout(350);
const reps = await pg.evaluate(()=>[...document.querySelectorAll('#st_content > div:first-child button')].map(x=>x.textContent.trim()));
check('٦ تقارير جوه أيقونة التقارير',
  reps.join('|')==='📈 موزعين إجمالي|🧩 موزعين قطاعات|🚪 أبواب بالكود|🚪 موزعين أبواب|🏷️ مبيعات خاصة|⚖️ مقارنة شهور', reps.join('|'));

// ١) موزعين إجمالي
const d1 = await pg.evaluate(()=>repModel('dist'));
check('الإجمالي: الشهور أعمدة بأسماء عربية',
  d1.header.join('|')==='بيان|أغسطس 2026|سبتمبر 2026|الإجمالي', d1.header.join('|'));
const t1 = d1.body[d1.body.length-1].cells;
check('أغسطس ١٩٠ ألف (المستبعد مش داخل)', t1[1]===190000, String(t1[1]));
check('سبتمبر ١٨٠ ألف والإجمالي ٣٧٠', t1[2]===180000 && t1[3]===370000, t1.join('/'));
check('مرتّب من الأعلى للأقل', d1.body[0].cells[0]==='موزع طنطا', String(d1.body[0].cells[0]));

// ٢) موزعين قطاعات
const d2 = await pg.evaluate(()=>repModel('distsec'));
check('القطاعات بالترتيب المطلوب: كرافت قبل كومبن قبل اكسسوارات قبل ابواب',
  d2.header.join('|')==='الموزع|كرافت لاين|كومبن|اكسسوارات|ابواب|الإجمالي', d2.header.join('|'));
const t2 = d2.body[d2.body.length-1].cells;
check('كرافت ٥٠ · كومبن ١٦٠ · اكسسوارات ٢٠ · أبواب ١٤٠',
  t2[1]===50000 && t2[2]===160000 && t2[3]===20000 && t2[4]===140000, t2.join('/'));
// القطاعات لازم تطابق موزعين إجمالي: نفس الصفوف ونفس الإجمالي
check('مبيعات الجملة سطر مجمّع زي موزعين إجمالي',
  d2.body.some(r=> r.cells[0]==='مبيعات جملة'),
  d2.body.filter(r=>r.type==='row').map(r=>r.cells[0]).join('|'));
check('إجمالي القطاعات = إجمالي موزعين إجمالي',
  t2[t2.length-1]===t1[t1.length-1], t2[t2.length-1]+' مقابل '+t1[t1.length-1]);

// ٣) أبواب بالكود — كمية وقيمة
const d3 = await pg.evaluate(()=>repModel('doorcode'));
check('صف = الكود، وأعمدة المقاسات اللي فيها أرقام بس',
  d3.header.join('|')==='الكود|80|90|الإجمالي', d3.header.join('|'));
const a05 = d3.body.find(r=> r.cells[0]==='A05');
const a07 = d3.body.find(r=> r.cells[0]==='A07');
check('الكالون (إكسسوار) مستبعد خالص — مفيش «بدون كود»',
  !d3.body.some(r=> r.cells[0]==='بدون كود'),
  d3.body.filter(r=>r.type==='row').map(r=>r.cells[0]).join('|'));
check('وقيمة A05 ١٠٠ ألف', a05 && a05.cells[3]===100000, JSON.stringify(a05&&a05.cells));
check('A05 (٨٠ سم) وقع في عمود ٨٠ مش ٩٠', a05 && a05.cells[1]===100000 && a05.cells[2]===0, JSON.stringify(a05&&a05.cells));
check('A07 (٩٠ سم) وقع في عمود ٩٠', a07 && a07.cells[2]===40000, JSON.stringify(a07&&a07.cells));
const t3 = d3.body.filter(r=>r.type==='tot')[0].cells;
const q3 = d3.body[d3.body.length-1].cells;
check('سطر الكمية تحت سطر القيمة', q3[0]==='كمية' && q3[1]===90 && q3[2]===40 && q3[3]===130, q3.join('/'));
const a05q = d3.body[d3.body.indexOf(a05)+1];
check('كل كود تحته سطر كميته', a05q && a05q.type==='sub' && a05q.cells[1]===90,
  JSON.stringify(a05q&&a05q.cells));
check('إجمالي الأبواب ١٤٠ ألف والكمية في السطر اللي تحته', t3[3]===140000 && q3[3]===130, t3.join('/'));

// ٤) موزعين أبواب — كمية وقيمة
const d4 = await pg.evaluate(()=>repModel('distdoor'));
check('موزعين أبواب: أعمدة شهور زي موزعين إجمالي',
  d4.header.join('|')==='العميل|أغسطس 2026|سبتمبر 2026|الكمية|القيمة', d4.header.join('|'));
const tanta = d4.body.find(r=> r.cells[0]==='موزع طنطا');
check('طنطا ٥٥ قطعة و٦٠ ألف مقسومة على الشهرين',
  tanta && tanta.cells[1]===30000 && tanta.cells[2]===30000 && tanta.cells[3]===55 && tanta.cells[4]===60000,
  JSON.stringify(tanta&&tanta.cells));
const t4 = d4.body[d4.body.length-1].cells;
check('موزعين أبواب: الأبواب بس — الكالون (قطاع فرعي إكسسوارات) مش داخل',
  t4[3]===130 && t4[4]===140000, t4.join('/'));

// ── التصدير في كل تقرير
for(const [id,nm] of [['dist','إجمالي'],['distsec','قطاعات'],['doorcode','أبواب بالكود'],['distdoor','موزعين أبواب']]){
  await pg.evaluate(x=>{ save('_salesRep_',x); render(true); }, id);
  await pg.waitForTimeout(300);
  const r = await pg.evaluate(()=>{
    const m=document.getElementById('main'); m.scrollTop=m.scrollHeight;
    const bar=document.querySelector('#srep_c .impbar');
    if(!bar) return {ok:false};
    const bb=bar.getBoundingClientRect();
    return {ok:true, n:bar.querySelectorAll('button').length, onScreen: bb.bottom>0 && bb.top<=innerHeight};
  });
  check('تصدير '+nm+' ظاهر', r.ok && r.n===3 && r.onScreen, JSON.stringify(r));
}
const x = await pg.evaluate(()=>{
  let got=null; const real=window.saveAoaXlsx;
  window.saveAoaXlsx=(d,sh,fn,w,o)=>{ got={d,w,fn}; };
  try{ exportRep('doorcode','x'); } finally { window.saveAoaXlsx=real; }
  return got; });
check('إكسل الأبواب بالكود',
  x && x.d[0].join('|')==='الكود|80|90|الإجمالي', x? x.d[0].join('|'):'مفيش');
check('عرض الأعمدة مطابق', x.w.length===x.d[0].length, x.w.length+' vs '+x.d[0].length);

// ── جهاز فاضي خالص: لازم يوصل لزرار الرفع، مايبقاش طريق مسدود
const pg2 = await (await b.newContext()).newPage();
pg2.on('pageerror', e=>errs.push('فاضي: '+e.message));
await pg2.addInitScript(()=>{ localStorage.setItem('_sync_', JSON.stringify({off:true})); });
await pg2.goto(APP); await pg2.waitForTimeout(1000);
await pg2.evaluate(()=>{ module='sales'; render(true); }); await pg2.waitForTimeout(350);
const emptyTabs = await pg2.evaluate(()=>[...document.querySelectorAll('#main .tabs button')].map(x=>x.textContent.trim()));
check('الأيقونات ظاهرة حتى لو مفيش بيانات', emptyTabs.length===3, emptyTabs.join('|'));
check('الرسالة بتوجّهك للرفع',
  /ابدأ من/.test(await pg2.evaluate(()=>document.querySelector('#st_content').innerText)), '');
await pg2.evaluate(()=>{ save('_salesTab_',0); render(true); }); await pg2.waitForTimeout(300);
check('زرار رفع المبيعات موجود على جهاز فاضي', await pg2.evaluate(()=>!!document.querySelector('#impSales')));
await pg2.evaluate(()=>{ save('_salesTab_',1); render(true); }); await pg2.waitForTimeout(300);
check('زرار استيراد العملاء موجود على جهاز فاضي', await pg2.evaluate(()=>!!document.querySelector('#impCust')));
await pg2.evaluate(()=>{ save('_salesTab_',2); render(true); }); await pg2.waitForTimeout(300);
check('التقارير الستة ظاهرة حتى لو فاضية',
  (await pg2.evaluate(()=>[...document.querySelectorAll('#st_content > div:first-child button')].length))===6);

check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close();
process.exit(fail?1:0);
