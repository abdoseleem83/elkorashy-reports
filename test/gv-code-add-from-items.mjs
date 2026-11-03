// أكواد جيفز: زر + بيفتح فورمة الكود (مش الصنف)، وفيها بحث في الأصناف المرفوعة.
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
  localStorage.setItem('units_v1', JSON.stringify(['لفة','قطعة']));
  localStorage.setItem('items_v1', JSON.stringify([
    {id:'i1',name:'سبلونة جرار 160 سم GEVIS',mainGroup:'جيفز',subGroup:'',baseName:'',color:'فضي',unit:'قطعة',rollQty:''},
    {id:'i2',name:'سبلونة مفصلى 160 سم GEVIS',mainGroup:'جيفز',subGroup:'',baseName:'',color:'',unit:'قطعة',rollQty:''},
    {id:'i3',name:'باب كامل بني 70 سم',mainGroup:'أبواب',subGroup:'',baseName:'',color:'بني',unit:'قطعة',rollQty:''}]));
  localStorage.setItem('gvcodes_v1', JSON.stringify([
    {id:'g2',name:'سبلونة مفصلى 160 سم GEVIS',code:'ISP M1600',perCarton:'20',weight:'0.5',price:'1.2'}]));
});
await pg.goto(APP); await pg.waitForTimeout(1200);
const openTab = t => pg.evaluate(t=>{ module='items'; save('_itemsTab_',t); q=''; render(true); }, t);
const title = () => pg.evaluate(()=>document.querySelector('#sheet h3')?.textContent||'');

await openTab(1); await pg.click('#fab'); await pg.waitForTimeout(300);
check('تبويب أكواد جيفز: + بيفتح «إضافة كود جيفز»', (await title())==='إضافة كود جيفز', await title());
check('فيه خانة بحث في الأصناف', await pg.locator('#g_find').count()===1);
check('الفورمة فيها كود/كرتونة/وزن/سعر', (await pg.locator('#g_code,#g_pc,#g_w,#g_p').count())===4);

await pg.fill('#g_find','سبلونه جرار'); await pg.waitForTimeout(200);   // بـ«ه» بدل «ة» — لازم يلاقيه برضو
const res = await pg.locator('#g_find_res .card').allInnerTexts();
check('البحث لقى صنف واحد بنفس الاسم (يتجاهل ة/ه)', res.length===1 && res[0].includes('جرار 160'), res.join('|'));

await pg.locator('#g_find_res .card').first().click(); await pg.waitForTimeout(200);
check('اختيار الصنف ملّى الاسم', (await pg.inputValue('#g_name'))==='سبلونة جرار 160 سم GEVIS');
await pg.fill('#g_code','ISP M1600 - SUR'); await pg.fill('#g_pc','15'); await pg.fill('#g_w','0.23'); await pg.fill('#g_p','0.7');
await pg.evaluate(()=>saveGvCode('')); await pg.waitForTimeout(300);
const saved = await pg.evaluate(()=>gvcodes.find(g=>g.name==='سبلونة جرار 160 سم GEVIS'));
check('الكود اتحفظ بكل بياناته', saved && saved.code==='ISP M1600 - SUR' && saved.perCarton==='15' && saved.price==='0.7', JSON.stringify(saved));
check('عدد الأكواد بقى ٢', (await pg.evaluate(()=>gvcodes.length))===2);

// صنف متضاف قبل كده في أكواد جيفز → بيفتح بياناته للتعديل بدل التكرار
await pg.click('#fab'); await pg.waitForTimeout(300);
await pg.fill('#g_find','مفصلى'); await pg.waitForTimeout(200);
check('الصنف المتضاف عليه علامة «متضاف في أكواد جيفز»', (await pg.locator('#g_find_res').innerText()).includes('متضاف في أكواد جيفز'));
await pg.locator('#g_find_res .card').first().click(); await pg.waitForTimeout(300);
check('فتح الكود الموجود للتعديل', (await title())==='تعديل كود جيفز');
check('بياناته ظاهرة (الكود ISP M1600 · ٢٠ قطعة)', (await pg.inputValue('#g_code'))==='ISP M1600' && (await pg.inputValue('#g_pc'))==='20');
await pg.evaluate(()=>closeSheet());

check('فورمة التعديل من غير خانة البحث', await pg.locator('#g_find').count()===0);

// بقية التبويبات
await pg.evaluate(()=>closeSheet()); await openTab(0); await pg.click('#fab'); await pg.waitForTimeout(250);
check('تبويب الأصناف: + بيفتح «إضافة صنف»', (await title())==='إضافة صنف', await title());
await pg.evaluate(()=>closeSheet()); await openTab(2); await pg.click('#fab'); await pg.waitForTimeout(250);
check('تبويب الوحدات: + بيفتح «إضافة وحدة جديدة»', (await title())==='إضافة وحدة جديدة', await title());

// الصنف الجديد ظهر في «إضافة أصناف للطلبية»
await pg.evaluate(()=>closeSheet());
await pg.evaluate(()=>{ gvOrders.push({id:'o1',name:'ت',date:'2026-10-05',containers:1,cap:28000,archived:false,rows:[],cost:{}}); save('gvOrders_v1',gvOrders); gvSelect('o1'); module='gv'; render(true); gvAddItem(); });
await pg.waitForTimeout(300);
check('الصنف الجديد ظاهر في إضافة أصناف الطلبية', (await pg.locator('#gvlist').innerText()).includes('جرار 160'));
check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close(); process.exit(fail?1:0);
