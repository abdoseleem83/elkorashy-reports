// ورقة طلبية جيفز (PDF / صورة / إكسل) لازم تطلع من غير عمودين الأسعار.
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
    {id:'g1',name:'سبلونة 40 جرار',code:'ISP M400',perCarton:'20',weight:'0.16',price:'0.61'},
    {id:'g2',name:'سبلونة 40 مفصلى',code:'ISP - M400',perCarton:'20',weight:'0.17',price:'0.6'}]));
  localStorage.setItem('gvOrders_v1', JSON.stringify([{id:'o1',name:'طلبية جيفز',date:'2026-10-05',containers:1,cap:28000,archived:false,
    rows:[{gid:'g1',qty:12000},{gid:'g2',qty:16000}], cost:{}}]));
});
await pg.goto(APP); await pg.waitForTimeout(1200);
await pg.evaluate(()=>{ gvSelect('o1'); });
const md = await pg.evaluate(()=>{ const m=gvModel(); return {header:m.header, widths:m.body.map(r=>r.cells.length), html:gvDocBody()}; });
check('العناوين ٨ أعمدة بس', md.header.length===8, md.header.join(' | '));
check('آخر عمود «إجمالي الوزن»', md.header[7]==='إجمالي الوزن');
check('كل الصفوف (والإجمالي) ٨ خانات', md.widths.every(n=>n===8), md.widths.join(','));
check('PDF/الصورة من غير «سعر القطعة» ولا «إجمالي القيمة»', !md.html.includes('سعر القطعة') && !md.html.includes('إجمالي القيمة'));
check('الأسعار نفسها مش ظاهرة في الجدول (0.61 / 7,286)', !/>0\.61</.test(md.html) && !md.html.includes('7,286') && !md.html.includes('7286'));
check('جدول الحاويات لسه موجود', md.html.includes('حمولة الحاوية'));
check('الكراتين والوزن لسه صح (٦٠٠ كرتونة · ١٩٢٠ كجم للصنف الأول)', md.html.includes('600') && md.html.includes('1,920'));
const aoa = await pg.evaluate(()=>modelToAoa(gvModel()));
check('الإكسل: صفوف الجدول ٨ أعمدة', aoa.filter(r=>r.length>=8 && typeof r[0]==='number').every(r=>r.length===8));
check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close(); process.exit(fail?1:0);
