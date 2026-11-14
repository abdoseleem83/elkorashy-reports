// عمود «الوظيفة» في المرتبات: حقل في الموظف + عمود في كشف الإرسال والكشف التفصيلي + استيراد من الشيت
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch(); const errs=[];
const pg = await (await b.newContext()).newPage();
pg.on('pageerror', e=>errs.push(e.message)); pg.on('dialog', d=>d.accept());
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('employees_v1', JSON.stringify([
    {id:'e1',name:'أحمد علي',branch:'طنطا',job:'محاسب',salary:6000,h1:true,h2:true},
    {id:'e2',name:'محمود سعيد',branch:'طنطا',salary:5000,h1:true,h2:true},
    {id:'e3',name:'سامي حسن',branch:'اسكندرية',job:'سائق',salary:4000,h1:true,h2:true}]));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(1200);

for(const kind of ['send','full']){
  await pg.evaluate(k=>{ payKind=k; payMonth='2026-08'; payHalf=1; payExportBranch=''; }, kind);
  const md = await pg.evaluate(()=>{ const m=payModel(); return {h:m.header, r:m.body.filter(x=>x.type==='row').map(x=>x.cells.slice(0,4)), t:m.body[m.body.length-1].cells.length}; });
  check(`(${kind}) عمود الوظيفة بعد الموظف`, md.h[1]==='الموظف' && md.h[2]==='الوظيفة' && md.h[3]==='الفرع', md.h.slice(0,4).join('|'));
  check(`(${kind}) قيمة الوظيفة في الصف + الفاضية فاضية`, md.r.some(c=>c[1]==='أحمد علي'&&c[2]==='محاسب') && md.r.some(c=>c[1]==='محمود سعيد'&&c[2]==='') && md.r.some(c=>c[2]==='سائق'), JSON.stringify(md.r));
  check(`(${kind}) صف الإجمالي بنفس عدد الأعمدة`, md.t===md.h.length, md.t+' vs '+md.h.length);
}
// تصدير فرع واحد
await pg.evaluate(()=>{ payKind='send'; payExportBranch='اسكندرية'; });
const one = await pg.evaluate(()=>payModel().header.slice(0,3).join('|'));
check('تصدير فرع واحد: الوظيفة موجودة والفرع اتشال', one==='م|الموظف|الوظيفة', one);

// من غير وظايف: الكشف زي ما كان
await pg.evaluate(()=>{ employees.forEach(e=>delete e.job); payExportBranch=''; });
const nojob = await pg.evaluate(()=>payModel().header.slice(0,3).join('|'));
check('من غير وظايف مسجّلة: مفيش عمود وظيفة', nojob==='م|الموظف|الفرع', nojob);

// نموذج الإضافة/التعديل بيحفظ الوظيفة
await pg.evaluate(()=>{ editEmployee('e2'); }); await pg.waitForTimeout(150);
check('نموذج الموظف فيه خانة الوظيفة', (await pg.locator('#e_job').count())===1);
await pg.evaluate(()=>{ document.querySelector('#e_job').value='مندوب مبيعات'; saveEmployee('e2'); });
check('الوظيفة اتحفظت', (await pg.evaluate(()=>employees.find(e=>e.id==='e2').job))==='مندوب مبيعات');
await pg.evaluate(()=>{ editEmployee(''); }); await pg.waitForTimeout(150);
await pg.evaluate(()=>{ document.querySelector('#e_name').value='جديد'; document.querySelector('#e_salary').value='3000'; document.querySelector('#e_job').value='عامل'; saveEmployee(''); });
check('موظف جديد بوظيفة', (await pg.evaluate(()=>employees.find(e=>e.name==='جديد').job))==='عامل');

// الاستيراد من شيت فيه عمود وظيفة
const imp = async (rows)=> { await pg.evaluate(async rows=>{
  const ws=XLSX.utils.aoa_to_sheet(rows), wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'الموظفين');
  importEmployees(new File([XLSX.write(wb,{type:'array',bookType:'xlsx'})],'e.xlsx')); await new Promise(r=>setTimeout(r,500)); commitImport(); }, rows); await pg.waitForTimeout(200); };
await imp([['','اسم الموظف','الفرع','الراتب','الأول','الثاني','الوظيفة'],
  [1,'أحمد علي','طنطا',6000,'✔','✔','مدير حسابات'],[2,'سامي حسن','اسكندرية',4000,'✔','✔','']]);
const after = await pg.evaluate(()=>employees.map(e=>e.name+'='+(e.job||'')));
check('الاستيراد بعمود وظيفة', after.includes('أحمد علي=مدير حسابات'), after.join('|'));
// شيت من غير عمود وظيفة: الوظايف المتسجّلة تفضل
await imp([['','اسم الموظف','الفرع','الراتب','الأول','الثاني'],[1,'أحمد علي','طنطا',6500,'✔','✔']]);
check('شيت من غير وظيفة: الوظيفة القديمة بتفضل', (await pg.evaluate(()=>employees.find(e=>e.name==='أحمد علي').job))==='مدير حسابات');

// الشاشات ما بتقعش
await pg.evaluate(()=>{ module='payroll'; for(const t of [0,1,2]){ save('_payTab_',t); render(true); } });
const txt = await pg.evaluate(()=>{ save('_payTab_',0); openGroups.add('emp:طنطا'); render(true); return document.querySelector('#main').innerText; });
check('قايمة العاملين بتعرض الوظيفة', /مدير حسابات/.test(txt), txt.slice(0,160));
check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close(); process.exit(fail?1:0);
