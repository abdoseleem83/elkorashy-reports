// كشف الإرسال: نفس شكل الورقة اللي بتتبعت للحسابات
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
  const emps=[['عبدالخالق عادل','pvc',20000],['حاتم سمير','pvc',12000],['وائل محمد','pvc',9500],
              ['علاء شعبان','pvc',9500],['محمد فوزي','الاسكندريه',11000],['ممدوح باز','pvc',24000]];
  localStorage.setItem('employees_v1', JSON.stringify(emps.map((e,i)=>({id:'e'+i,name:e[0],branch:e[1],salary:e[2],h1:true,h2:true}))));
  localStorage.setItem('payData_v1', JSON.stringify({'2026-09':{h2:{
    e0:{adv:2000}, e1:{bonus:200,note:'حاويه'}, e2:{ot:6}, e3:{ot:2,abP:2},
    e5:{bonus:2000,ins:350,note:'بيات الاسكندريه'} }}}));
  localStorage.setItem('_payMonth_', JSON.stringify('2026-09'));
  localStorage.setItem('_payHalf_', JSON.stringify(2));
  localStorage.setItem('_payKind_', JSON.stringify('send'));
});
await pg.goto(APP); await pg.waitForTimeout(1200);
await pg.evaluate(()=>{ module='payroll'; save('_payTab_',2); render(true); });
await pg.waitForTimeout(500);

const md = await pg.evaluate(()=>payModel());
// ── الأعمدة بالترتيب اللي في الورقة
check('أعمدة الكشف بالترتيب الصح',
  md.header.join('|')==='م|الموظف|الفرع|راتب النصف|غياب بإذن (أيام)|غياب بدون إذن (أيام)|تأخيرات (ساعات)|إضافي (ساعات)|سلف (جنيه)|تأمينات|حوافز (جنيه)|صافي الراتب|ملاحظات',
  md.header.join('|'));
check('الساعات والأيام خام مش مبالغ محسوبة', md.header.includes('إضافي (ساعات)') && !md.header.includes('مبلغ إضافي'));
check('فيه عمود ملاحظات', md.header[md.header.length-1]==='ملاحظات');

// ── مسطّح: مفيش سطور تقسيم على الفروع
check('مفيش سطور فروع ولا إجماليات فرعية',
  !md.body.some(r=>r.type==='branch'||r.type==='sub'), md.body.map(r=>r.type).join(','));
check('سطر إجمالي واحد في الآخر',
  md.body.filter(r=>r.type==='tot').length===1 && md.body[md.body.length-1].type==='tot');
check('الفرع عمود جنب الموظف', md.body[0].cells[2]==='pvc');

// ── القيم
const row = n=> md.body.find(r=> r.cells[1]===n);
check('عبدالخالق: ١٠٬٠٠٠ ناقص ٢٬٠٠٠ سلف = ٨٬٠٠٠',
  row('عبدالخالق عادل').cells[3]===10000 && row('عبدالخالق عادل').cells[8]===2000 && row('عبدالخالق عادل').cells[11]===8000,
  JSON.stringify(row('عبدالخالق عادل').cells));
check('حاتم: ٦٬٠٠٠ + ٢٠٠ حوافز = ٦٬٢٠٠', row('حاتم سمير').cells[11]===6200);
check('الملاحظة بتظهر في سطرها', row('حاتم سمير').cells[12]==='حاويه');
check('علاء: غياب بإذن ٢ يوم مسجّل', row('علاء شعبان').cells[4]===2);
check('ممدوح: تأمينات ٣٥٠ وحوافز ٢٬٠٠٠', row('ممدوح باز').cells[9]===350 && row('ممدوح باز').cells[10]===2000);

// ── الخانات الفاضية تفضل فاضية مش صفر
check('الخانة اللي مافيهاش حاجة فاضية مش صفر', row('حاتم سمير').cells[4]==='' && row('حاتم سمير').cells[8]==='',
  JSON.stringify(row('حاتم سمير').cells));
check('الراتب والصافي أرقام دايمًا', typeof row('محمد فوزي').cells[3]==='number' && typeof row('محمد فوزي').cells[11]==='number');

// ── الإجمالي
const tot = md.body[md.body.length-1].cells;
const dataRows = md.body.filter(r=>r.type==='row');
const colSum = i=> dataRows.reduce((a,r)=> a + (Number(r.cells[i])||0), 0);
check('إجمالي راتب النصف = مجموع السطور', tot[3]===colSum(3) && tot[3]===43000, tot[3]+' / '+colSum(3));
check('إجمالي الصافي = مجموع السطور', tot[11]===colSum(11), tot[11]+' / '+colSum(11));
check('إجمالي السلف والتأمينات والحوافز', tot[8]===2000 && tot[9]===350 && tot[10]===2200,
  [tot[8],tot[9],tot[10]].join('/'));
check('إجمالي الساعات والأيام', tot[7]===8 && tot[4]===2, [tot[4],tot[7]].join('/'));

// ── العنوان بشكل الورقة
check('العنوان: الفترة ١٦ الى آخر الشهر', /كشف مرتبات النصف الثاني/.test(md.title) && /١٦ الى آخر الشهر/.test(md.title), md.title);
check('السنة بأرقام عربية', /٢٠٢٦/.test(md.title), md.title);

// ── شكل المستند
const doc = await pg.evaluate(()=>payDocBody());
check('عنوان الشركة فوق', /شركة القرشي — كشف المرتبات/.test(doc));
check('جدول الكشف له كلاس مخصوص', /<table class="pay">/.test(doc));
check('أعمدة الفلوس خضرا وخانات الإدخال كريمي', /class="money"/.test(doc) && /class="inp/.test(doc));
check('الفرع بلون مميز', /class="[^"]*br[^"]*"/.test(doc));
check('الساعات بخانتين عشريتين', /6\.00/.test(doc), (doc.match(/>6[.\d]*</g)||[]).join(','));
check('الفلوس بفواصل الآلاف', /10,000/.test(doc));

// ── المعاينة على الشاشة
check('الكشف بيتعرض في الشاشة قبل التصدير',
  (await pg.evaluate(()=>document.body.innerText)).includes('شكل الكشف اللي هيتبعت'));

// ── الإكسل
const x = await pg.evaluate(()=>{
  let got=null; const real=window.saveAoaXlsx;
  window.saveAoaXlsx=(d,sh,fn,w,o)=>{ got={d,w,o}; };
  try{ exportPayExcel(); } finally { window.saveAoaXlsx=real; }
  return got;
});
check('الإكسل مفيهوش عنوان مكرر', x.d[0][0]==='م', String(x.d[0][0]));
check('ألوان الأعمدة متمرّرة للإكسل',
  x.o.colFill && x.o.colFill[3]==='E2EFDA' && x.o.colFill[4]==='FFF2CC' && x.o.colFill[11]==='E2EFDA',
  JSON.stringify(x.o.colFill));
check('عرض الأعمدة مطابق للعدد', x.w.length===x.d[0].length, x.w.length+' vs '+x.d[0].length);

// ── الكشف التفصيلي لسه بالفروع زي ما كان
const full = await pg.evaluate(()=>{ payKind='full'; const m=payModel(); payKind='send'; return m; });
check('الكشف التفصيلي لسه مقسّم بالفروع', full.body.some(r=>r.type==='branch') && full.body.some(r=>r.type==='sub'));

check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close();
process.exit(fail?1:0);
