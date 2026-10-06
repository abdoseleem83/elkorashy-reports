// الجرد: الصنف اللي اتجرد يروح تبويب «تم الجرد» واللي لسه ما اتجردش يفضل ظاهر.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const APP = process.env.APP_URL, XL = process.env.XLSX_LOCAL;
const errs=[];
const pg = await (await b.newContext({viewport:{width:420,height:800}})).newPage();
pg.on('pageerror', e=>errs.push(e.message));
if(XL) await pg.route('**/xlsx-js-style*/**', r=>r.fulfill({path:XL, contentType:'application/javascript'}));
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('warehouses_v1', JSON.stringify([{id:'w1',name:'طنطا'}]));
  localStorage.setItem('units_v1', JSON.stringify(['لفة','عود','قطعة']));
  localStorage.setItem('items_v1', JSON.stringify([
    {id:'i1',name:'صنف أ',mainGroup:'م1',subGroup:'',baseName:'',color:'',unit:'قطعة',rollQty:''},
    {id:'i2',name:'صنف ب',mainGroup:'م1',subGroup:'',baseName:'',color:'',unit:'قطعة',rollQty:''},
    {id:'i3',name:'صنف ج لفة',mainGroup:'م1',subGroup:'',baseName:'',color:'',unit:'لفة',rollQty:'10'},
    {id:'i4',name:'صنف د',mainGroup:'م2',subGroup:'',baseName:'',color:'',unit:'قطعة',rollQty:''}]));
  localStorage.setItem('whStock_v1', JSON.stringify({w1:{'صنف أ':{balance:10},'صنف ب':{balance:5},'صنف ج لفة':{balance:25},'صنف د':{balance:3}}}));
});
await pg.goto(APP); await pg.waitForTimeout(1500);
await pg.evaluate(()=>{ module='warehouses'; save('_whTab_','w1'); save('_whSub_',2); invView=0; invMain=new Set(['م1']); render(true); });
await pg.waitForTimeout(400);
const names = () => pg.locator('#invList .invc').evaluateAll(els=>els.map(e=>e.dataset.nm));
const badge = () => pg.locator('#invDoneBadge').innerText();
const seg = n => pg.locator('.stab', {hasText:n}).first();

check('البداية: الـ٣ أصناف ظاهرين', JSON.stringify(await names())===JSON.stringify(['صنف أ','صنف ب','صنف ج لفة']), (await names()).join('|'));
check('تبويب «تم الجرد (0)» موجود', (await seg('تم الجرد').innerText()).includes('0'));

// جرد صنف عادي: يكتب الكمية ويضغط برّه → يروح تم الجرد
await pg.locator('.invc[data-nm="صنف أ"] input').fill('8');
await pg.locator('.invc[data-nm="صنف أ"] input').blur(); await pg.waitForTimeout(200);
check('صنف أ اختفى من قايمة الإدخال وفضل ب وج', JSON.stringify(await names())===JSON.stringify(['صنف ب','صنف ج لفة']), (await names()).join('|'));
check('الشارة بقت ١ والمتبقي ٢', (await badge())==='1' && (await pg.locator('#invProg').innerText()).includes('2'), await pg.locator('#invProg').innerText());

// صنف بخانتين (لفة/عود): لما تنتقل من اللفة للعود في نفس الكارت ما يختفيش
const jf = pg.locator('.invc[data-nm="صنف ج لفة"] input');
await jf.nth(0).fill('2'); await jf.nth(1).focus(); await pg.waitForTimeout(200);
check('صنف ج لسه ظاهر وانت بتدخل خانة العود', (await names()).includes('صنف ج لفة'));
await jf.nth(1).fill('3'); await jf.nth(1).blur(); await pg.waitForTimeout(200);
check('بعد ما تخلّص الخانتين يروح تم الجرد', !(await names()).includes('صنف ج لفة') && (await badge())==='2');
check('الفعلي اتحسب ٢×١٠+٣ = ٢٣', (await pg.evaluate(()=>invCounts.w1.counts['صنف ج لفة'].actual))===23);

// صنف من غير كمية: ما يتنقلش لو سبته فاضي
await pg.locator('.invc[data-nm="صنف ب"] input').focus(); await pg.locator('.invc[data-nm="صنف ب"] input').blur(); await pg.waitForTimeout(200);
check('صنف ب (من غير كمية) لسه ظاهر', JSON.stringify(await names())===JSON.stringify(['صنف ب']));

// تبويب تم الجرد
await seg('تم الجرد').click(); await pg.waitForTimeout(300);
const done = await pg.locator('#invDoneList .invc').evaluateAll(els=>els.map(e=>e.dataset.nm));
check('تم الجرد فيه صنف أ وصنف ج (آخر واحد الأول)', JSON.stringify(done)===JSON.stringify(['صنف ج لفة','صنف أ']), done.join('|'));
const rowA = (await pg.locator('.invc[data-nm="صنف أ"]').innerText()).replace(/\s+/g,' ');
check('صنف أ: برنامج ١٠ · فعلي ٨ · عجز ٢', rowA.includes('10') && rowA.includes('8') && rowA.includes('-2'), rowA);

// تعديل الكمية من تم الجرد
await pg.locator('.invc[data-nm="صنف أ"] input').fill('10'); await pg.locator('.invc[data-nm="صنف أ"] input').blur(); await pg.waitForTimeout(200);
check('التعديل بيحدّث الفرق → مطابق', (await pg.locator('.invc[data-nm="صنف أ"]').innerText()).includes('مطابق'));

// رجّعه للجرد ↩️
await pg.locator('.invc[data-nm="صنف أ"] button').click(); await pg.waitForTimeout(200);
check('↩️ شال صنف أ من تم الجرد ومسح كميته', !(await pg.evaluate(()=>!!invCounts.w1.counts['صنف أ'])) && (await badge())==='1');
await seg('إدخال الجرد').click(); await pg.waitForTimeout(300);
check('صنف أ رجع لقايمة الإدخال مع ب', JSON.stringify(await names())===JSON.stringify(['صنف أ','صنف ب']), (await names()).join('|'));

// كل الأصناف تتجرد → رسالة «اتجردت»
for(const n of ['صنف أ','صنف ب']){ const i=pg.locator(`.invc[data-nm="${n}"] input`); await i.fill('1'); await i.blur(); await pg.waitForTimeout(150); }
check('لما الكل يتجرد بتظهر رسالة «كل أصناف الاختيار ده اتجردت»', await pg.locator('#invAllDone').isVisible());

// بعد إعادة التحميل: اللي اتجرد لسه في تم الجرد
await pg.evaluate(()=>render(true)); await pg.waitForTimeout(300);
check('بعد إعادة الرسم: قايمة الإدخال فاضية والرسالة ظاهرة', (await names()).length===0 && await pg.locator('#invAllDone').isVisible());
// البحث بيطلّع الصنف حتى لو اتجرد
await pg.evaluate(()=>{ q='صنف أ'; render(true); }); await pg.waitForTimeout(300);
check('البحث بيلاقي صنف اتجرد (عليه علامة ✅)', (await pg.locator('#invList .invc[data-nm="صنف أ"]').innerText()).includes('اتجرد'));
await pg.evaluate(()=>{ q=''; render(true); });
// النتيجة لسه شغالة
await seg('النتيجة').click(); await pg.waitForTimeout(300);
check('تبويب النتيجة لسه بيعرض الأصناف المجرودة (٣)', (await pg.locator('body').innerText()).includes('أصناف مجرودة'));
check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close(); process.exit(fail?1:0);
