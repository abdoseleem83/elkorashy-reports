// مساحة المتصفح اتملت ببقايا التطبيق القديم → الحفظ بيفشل بـ«تعذر الحفظ محلياً»
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const APP = process.env.APP_URL;
const errs=[];

const ctx = await b.newContext();
const pg = await ctx.newPage();
pg.on('pageerror', e=>errs.push(e.message));
// بقايا التطبيق القديم قبل ما التطبيق الجديد يفتح
await pg.addInitScript(()=>{
  const big = 'x'.repeat(200000);
  for(const k of ['cache:monthsData','cache:whBalances','cache:finData','cache:sectorSheets'])
    localStorage.setItem(k, big);
  localStorage.setItem('activeModule','wh');
  localStorage.setItem('whUnkDraft','{}');
  localStorage.setItem('items_v1', JSON.stringify([{id:'i1',name:'صنف',mainGroup:'ك',unit:'لفة'}]));
});
await pg.goto(APP); await pg.waitForTimeout(1800);

const left = await pg.evaluate(()=> Object.keys(localStorage).filter(k=>k.indexOf('cache:')===0 || k==='activeModule' || k==='whUnkDraft'));
check('بقايا التطبيق القديم اتمسحت أول ما فتح', left.length===0, JSON.stringify(left));
check('بيانات التطبيق الجديد ما اتمستش', (await pg.evaluate(()=>load('items_v1',[]))).length===1);

// السيناريو الحقيقي: المساحة متملية ببقايا التطبيق القديم لدرجة إن الحفظ بيرمي
const r1 = await pg.evaluate(()=>{
  let n = 0;
  try{ for(; n < 200; n++) localStorage.setItem('cache:junk'+n, 'y'.repeat(100000)); }catch(e){}
  let threw = false;
  try{ localStorage.setItem('__probe__', 'z'.repeat(100000)); }catch(e){ threw = true; }
  try{ localStorage.removeItem('__probe__'); }catch(e){}
  // نواقص كبيرة بحيث الحفظ نفسه يفشل ما لم يتنضف مكان
  whShortage = {w1:{}};
  for(let i=0;i<4000;i++) whShortage.w1['صنف رقم '+i] = {order:i, unit:'لفة', note:'ملاحظة طويلة شوية'};
  save('whShortage_v1', whShortage);
  return { threw, n,
    saved: JSON.stringify(load('whShortage_v1',null)) === JSON.stringify(whShortage),
    junkLeft: Object.keys(localStorage).filter(k=>k.indexOf('cache:')===0).length,
    toast: document.querySelector('#toast').textContent };
});
check('المساحة اتملت فعلاً في الاختبار', r1.threw, 'اتحط '+r1.n+' مفتاح');
check('الحفظ نجح بدل «تعذر الحفظ محلياً»', r1.saved, r1.toast);
check('بقايا التطبيق القديم اتشالت عشان يفضى مكان', r1.junkLeft===0, 'فاضل '+r1.junkLeft);

// مفيش بقايا قديمة خالص — ساعتها بيشيل النسخ الاحتياطية القديمة
const r2 = await pg.evaluate(async ()=>{
  let n = 0;
  try{ for(; n < 200; n++) localStorage.setItem('_backup_old'+String(n).padStart(3,'0'), 'z'.repeat(100000)); }catch(e){}
  // حفظة كبيرة تفشل من غير تنضيف — مفيش بقايا قديمة، يبقى النسخ الاحتياطية هي اللي تروح
  const big = {}; for(let i=0;i<4000;i++) big['وحدة '+i] = 'قيمة طويلة شوية عشان تكبر';
  save('units_v1', big);
  await new Promise(r=>setTimeout(r,100));
  return { saved: JSON.stringify(load('units_v1',null))===JSON.stringify(big),
           backupsLeft: Object.keys(localStorage).filter(k=>k.indexOf('_backup_')===0).length,
           toast: document.querySelector('#toast').textContent };
});
check('الحفظ نجح بعد ما شال النسخ الاحتياطية القديمة', r2.saved, r2.toast);
check('سايب أحدث نسختين احتياطيتين بس', r2.backupsLeft<=2, 'فاضل '+r2.backupsLeft);

// زرار التنضيف اليدوي في ⚙️
const r3 = await pg.evaluate(()=>{
  localStorage.setItem('cache:x','1'); localStorage.setItem('activeModule','wh');
  doCleanStorage();
  return Object.keys(localStorage).filter(k=>isOldAppKey(k)).length;
});
check('زرار «نضّف مساحة الجهاز» بيشيل البقايا', r3===0, 'فاضل '+r3);

check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close();
process.exit(fail?1:0);
