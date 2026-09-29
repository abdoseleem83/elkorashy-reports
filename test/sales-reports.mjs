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
               'موزع المحلة':{'ابواب WPC':40000}}}));
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
check('٥ تقارير جوه أيقونة التقارير',
  reps.join('|')==='📈 موزعين إجمالي|🧩 موزعين قطاعات|🚪 أبواب بالكود|🚪 موزعين أبواب|⚖️ مقارنة شهور', reps.join('|'));

// ١) موزعين إجمالي
const d1 = await pg.evaluate(()=>repModel('dist'));
check('الإجمالي: الشهور أعمدة بأسماء عربية',
  d1.header.join('|')==='م|بيان|أغسطس 2026|سبتمبر 2026|الإجمالي', d1.header.join('|'));
const t1 = d1.body[d1.body.length-1].cells;
check('أغسطس ١٩٠ ألف (المستبعد مش داخل)', t1[2]===190000, String(t1[2]));
check('سبتمبر ١٨٠ ألف والإجمالي ٣٧٠', t1[3]===180000 && t1[4]===370000, t1.join('/'));
check('مرتّب من الأعلى للأقل', d1.body[0].cells[1]==='موزع طنطا', String(d1.body[0].cells[1]));

// ٢) موزعين قطاعات
const d2 = await pg.evaluate(()=>repModel('distsec'));
check('القطاعات بالترتيب المطلوب: كومبن قبل اكسسوارات قبل ابواب',
  d2.header.join('|')==='م|الموزع|كومبن|اكسسوارات|ابواب|الإجمالي', d2.header.join('|'));
const t2 = d2.body[d2.body.length-1].cells;
check('كومبن ١٦٠ · اكسسوارات ٢٠ · أبواب ١٤٠', t2[2]===160000 && t2[3]===20000 && t2[4]===140000, t2.join('/'));
check('الموزعين بس (محل الجملة مش موجود)',
  !d2.body.some(r=> String(r.cells[1]||'').includes('محل جملة')), '');

// ٣) أبواب بالكود — كمية وقيمة
const d3 = await pg.evaluate(()=>repModel('doorcode'));
check('صف = الكود وأعمدة المقاسات من غير عمود الصنف',
  d3.header.join('|')==='م|الكود|70|80|90|متر|برور وحلق|خدمات|الكمية|الإجمالي', d3.header.join('|'));
const a05 = d3.body.find(r=> r.cells[1]==='A05');
const a07 = d3.body.find(r=> r.cells[1]==='A07');
check('A05 اتجمّع من الشهرين ومن العميلين: ٩٠ قطعة', a05 && a05.cells[8]===90, JSON.stringify(a05&&a05.cells));
check('وقيمته ١٠٠ ألف', a05 && a05.cells[9]===100000, String(a05&&a05.cells[9]));
check('A05 (٨٠ سم) وقع في عمود ٨٠ مش ٩٠', a05 && a05.cells[3]===100000 && a05.cells[4]===0, JSON.stringify(a05&&a05.cells));
check('A07 (٩٠ سم) وقع في عمود ٩٠', a07 && a07.cells[4]===40000, JSON.stringify(a07&&a07.cells));
const t3 = d3.body[d3.body.length-1].cells;
check('إجمالي الأبواب ١٣٠ باب + ٥٠٠ كالون', t3[8]===630 && t3[9]===149000, t3.join('/'));

// ٤) موزعين أبواب — كمية وقيمة
const d4 = await pg.evaluate(()=>repModel('distdoor'));
check('أعمدة العميل والكمية والقيمة', d4.header.join('|')==='م|العميل|الكمية|القيمة', d4.header.join('|'));
const tanta = d4.body.find(r=> r.cells[1]==='موزع طنطا');
check('طنطا ٥٥ قطعة و٦٠ ألف', tanta && tanta.cells[2]===55 && tanta.cells[3]===60000, JSON.stringify(tanta&&tanta.cells));
const t4 = d4.body[d4.body.length-1].cells;
check('موزعين أبواب: الأبواب بس — الكالون (قطاع فرعي إكسسوارات) مش داخل',
  t4[2]===130 && t4[3]===140000, t4.join('/'));

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
  x && x.d[0].join('|')==='م|الكود|70|80|90|متر|برور وحلق|خدمات|الكمية|الإجمالي', x? x.d[0].join('|'):'مفيش');
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
check('التقارير الخمسة ظاهرة حتى لو فاضية',
  (await pg2.evaluate(()=>[...document.querySelectorAll('#st_content > div:first-child button')].length))===5);

check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close();
process.exit(fail?1:0);
