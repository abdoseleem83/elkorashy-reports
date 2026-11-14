// تقسيم «مبيعات جملة» على المخازن (طنطا / اسكندرية) من عمود Inv_Name في شيت المبيعات — للجملة بس
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const errs=[];
const pg = await (await b.newContext()).newPage();
pg.on('pageerror', e=>errs.push(e.message));
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('customers_v1', JSON.stringify([
    {id:'c1',name:'موزع أ',cls:'موزع'},{id:'c2',name:'محل جملة',cls:'مبيعات جملة'}]));
  // شهر قديم اترفع من غير عمود المخزن
  localStorage.setItem('monthlySales_v1', JSON.stringify({'2026-07':{'موزع أ':8000,'محل جملة':2000}}));
  localStorage.setItem('monthlySector_v1', JSON.stringify({'2026-07':{'موزع أ':{'اكسسوارات':8000},'محل جملة':{'اكسسوارات':2000}}}));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(1200);

// ── رفع شيت بعمود المخزن
const upload = (rows)=> pg.evaluate(async (rows)=>{
  const ws=XLSX.utils.aoa_to_sheet(rows), wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Header_Wide');
  const buf=XLSX.write(wb,{type:'array',bookType:'xlsx'});
  importSales(new File([buf],'s.xlsx')); await new Promise(r=>setTimeout(r,600));
  return document.querySelector('#sheet')?.innerText || '';
}, rows);

const sheet1 = await upload([
  ['c_name','Item_Name','vout','vin','Inv_Name'],
  ['محل جملة','صنف س',10000,0,'مخزن طنطا'],
  ['محل جملة','صنف س',4000,0,'مخزن الإسكندرية'],
  ['موزع أ','صنف س',5000,0,'مخزن طنطا']]);
check('شيت التأكيد بيعرض المخازن', /المخازن في الملف/.test(sheet1) && /طنطا/.test(sheet1) && /الاسكندرية/.test(sheet1), sheet1.slice(0,200));
await pg.evaluate(()=>{ document.querySelector('#s_yr').value='2026'; document.querySelector('#s_mo').value='08'; commitSalesImport(); });
await pg.waitForTimeout(300);
const wh = await pg.evaluate(()=>monthlyWh['2026-08']);
check('المخزن اتخزّن مع الشهر', wh && wh['محل جملة'] && wh['محل جملة'].t && wh['محل جملة'].a && !wh['موزع أ'].a, JSON.stringify(wh));

// ── موزعين إجمالي: الجملة صفين، والموزع زي ما هو
const names = await pg.evaluate(()=>buildDistTotal().list.map(r=>r.name+'='+Math.round(r.total)));
check('جملة طنطا صف لوحده', names.includes('مبيعات جملة — طنطا=10000'), names.join(' | '));
check('جملة الاسكندرية صف لوحده', names.includes('مبيعات جملة — الاسكندرية=4000'), names.join(' | '));
check('الموزع مش متقسّم', names.includes('موزع أ=13000'), names.join(' | '));            // 5000 + 8000 (يوليو)
check('الشهر القديم (من غير مخزن) في صف «غير محدد المخزن»', names.includes('مبيعات جملة — غير محدد المخزن=2000'), names.join(' | '));
check('مفيش صف «مبيعات جملة» عادي لما فيه تقسيم', !names.some(n=>/^مبيعات جملة=/.test(n)));
const gt = await pg.evaluate(()=>Math.round(buildDistTotal().total));
check('الإجمالي الكلي = مجموع كل الصفوف (29000)', gt===29000, String(gt));

// ── موزعين قطاعات + موزعين وقطاعات
const ds = await pg.evaluate(()=>buildDistSectors().list.map(r=>r.name+'='+Math.round(r.total)));
check('قطاعات: جملة طنطا + اسكندرية صفين', ds.includes('مبيعات جملة — طنطا=10000') && ds.includes('مبيعات جملة — الاسكندرية=4000'), ds.join(' | '));
const blk = await pg.evaluate(()=>distBlkModel().dists.map(d=>d.name+'='+Math.round(d.total)));
check('موزعين وقطاعات: نفس التقسيم ونفس الأسماء', blk.includes('مبيعات جملة — طنطا=10000') && blk.includes('مبيعات جملة — الاسكندرية=4000') && blk.includes('مبيعات جملة — غير محدد المخزن=2000'), blk.join(' | '));

// ── شيت من غير عمود المخزن: الشهر يرجع غير مقسّم وبدون أخطاء
const sheet2 = await upload([['c_name','Item_Name','vout','vin'],['محل جملة','صنف س',3000,0]]);
check('تحذير إن مفيش عمود مخزن', /مفيهوش عمود المخزن/.test(sheet2));
await pg.evaluate(()=>{ document.querySelector('#s_yr').value='2026'; document.querySelector('#s_mo').value='08'; window.confirm=()=>true; commitSalesImport(); });
await pg.waitForTimeout(300);
check('الشهر اتبدّل وبقى غير مقسّم', (await pg.evaluate(()=>!monthlyWh['2026-08'])) === true);
const n3 = await pg.evaluate(()=>buildDistTotal().list.map(r=>r.name));
check('رجع صف واحد «مبيعات جملة»', n3.includes('مبيعات جملة') && !n3.some(n=>/ — طنطا/.test(n)), n3.join(' | '));
check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close(); process.exit(fail?1:0);
