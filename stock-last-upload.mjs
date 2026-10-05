// تاريخ ووقت آخر رفعة رصيد: بيتسجّل لكل مخزن وقت الحفظ، ويظهر في الأرصدة والمقارنات.
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
  localStorage.setItem('warehouses_v1', JSON.stringify([{id:'w1',name:'طنطا'},{id:'w2',name:'الاسكندرية'}]));
  localStorage.setItem('whStock_v1', JSON.stringify({}));
});
await pg.goto(APP); await pg.waitForTimeout(1500);
const FILE = new URL('./fixtures/stock-raw-tanta.xls', import.meta.url).pathname;
const openWh = id => pg.evaluate(id=>{ module='warehouses'; save('_whTab_',id); save('_whSub_',0); render(true); }, id);

await openWh('w1'); await pg.waitForTimeout(300);
check('قبل أي رفعة: بيقول مفيش تاريخ مسجّل', (await pg.locator('#stockAt').innerText()).includes('مفيش تاريخ مسجّل'));

const t0 = Date.now();
await pg.setInputFiles('#impStock', FILE); await pg.waitForTimeout(800);
check('لسه مفيش تسجيل قبل ما تدوس حفظ', (await pg.evaluate(()=>load('whStockAt_v1',{}))).w1===undefined);
await pg.evaluate(()=>commitImport()); await pg.waitForTimeout(400);
const at = await pg.evaluate(()=>load('whStockAt_v1',{}));
check('اتسجّل وقت الرفعة لطنطا (دلوقتي)', at.w1 && at.w1.t>=t0 && at.w1.t<=Date.now()+1000, JSON.stringify(at.w1));
check('اتسجّل اسم الملف وعدد الأصناف', at.w1.f==='stock-raw-tanta.xls' && at.w1.n===234);
check('الاسكندرية ما اتسجلتش (ما اترفعلهاش حاجة)', at.w2===undefined);

const txt = await pg.locator('#stockAt').innerText();
check('الشاشة بتعرض التاريخ والوقت والملف', txt.includes('النهارده') && txt.includes('stock-raw-tanta.xls') && txt.includes('234') && /[٠-٩0-9]+:[٠-٩0-9]{2}|[٠-٩0-9]+\s*[ص م]/.test(txt), txt);
const exp = new Date(at.w1.t).toLocaleString('ar-EG',{day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit'});
check('الوقت المعروض = وقت الرفعة بالظبط', txt.includes(exp), exp);

// الاسكندرية لسه من غير تاريخ، والمقارنات بتوريهم الاتنين
await openWh('w2'); await pg.waitForTimeout(300);
check('تبويب الاسكندرية: لسه مفيش تاريخ', (await pg.locator('#stockAt').innerText()).includes('مفيش تاريخ مسجّل'));
await pg.setInputFiles('#impStock', FILE); await pg.waitForTimeout(800);
await pg.evaluate(()=>commitImport()); await pg.waitForTimeout(300);
const at2 = await pg.evaluate(()=>load('whStockAt_v1',{}));
check('رفعة الاسكندرية متسجّلة لوحدها، وطنطا ما اتغيرتش', at2.w2 && at2.w2.t>=at.w1.t && at2.w1.t===at.w1.t);

await pg.evaluate(()=>{ module='warehouses'; save('_whTab_','cmpx'); save('_cmpView_','compare'); render(true); }); await pg.waitForTimeout(400);
const all = await pg.locator('#stockAtAll').innerText().catch(()=> '');
check('المقارنات بتعرض آخر رفعة لكل مخزن', all.includes('طنطا') && all.includes('الاسكندرية') && all.includes('stock-raw-tanta.xls'), all.replace(/\n/g,' | '));

// رفعة قديمة (٣ أيام) بتبان «من ٣ يوم»
await pg.evaluate(()=>{ const a=load('whStockAt_v1',{}); a.w1.t=Date.now()-3*864e5-5000; save('whStockAt_v1',a); });
check('رفعة من ٣ أيام: «من 3 يوم»', (await pg.evaluate(()=>whStockAtText('w1'))).includes('من 3 يوم'));

// تعديل الرصيد يدوي/خصم طنطا ما بيغيّرش تاريخ الرفعة
const before = await pg.evaluate(()=>JSON.stringify(load('whStockAt_v1',{})));
await pg.evaluate(()=>{ whStock.w1['باب كامل بني 70 سم A07'].balance=0; save('whStock_v1',whStock); });
check('تعديل الرصيد من غير رفع شيت ما بيغيّرش التاريخ', before===(await pg.evaluate(()=>JSON.stringify(load('whStockAt_v1',{})))));
check('المفتاح داخل المزامنة', await pg.evaluate(()=>SYNC_KEYS.includes('whStockAt_v1') && typeof SYNC_VARS.whStockAt_v1==='function'));
check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close(); process.exit(fail?1:0);
