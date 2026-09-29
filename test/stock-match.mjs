// المقارنات كانت بتطلع فاضية لو اسم الصنف في شيت الأرصدة مختلف حرف واحد
// عن اسمه في شيت الأصناف. المفروض تتطابق تلقائي وتقول على اللي مش لاقي.
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
  localStorage.setItem('warehouses_v1', JSON.stringify([{id:'w1',name:'طنطا'},{id:'w2',name:'الاسكندرية'}]));
  localStorage.setItem('items_v1', JSON.stringify([
    {id:'1',name:'كرافت لاين 25 ابيض', mainGroup:'قطاعات كرافت لاين',subGroup:'٢٥',baseName:'كرافت 25',color:'ابيض',unit:'لفة'},
    {id:'2',name:'كومبن أبيض 30',        mainGroup:'قطاعات PVC كومبن', subGroup:'٣٠',baseName:'كومبن 30',color:'ابيض',unit:'عود'},
    {id:'3',name:'زاويه اكسا بيضاء',     mainGroup:'اكسسورات pvc اكسا',subGroup:'زوايا',baseName:'زاوية',color:'ابيض',unit:'قطعة'},
    {id:'4',name:'باب 80 A05',           mainGroup:'ابواب WPC',        subGroup:'٨٠',baseName:'باب 80',color:'بني',unit:'قطعة'}]));
  localStorage.setItem('gvcodes_v1', JSON.stringify([{id:'g1',name:'زاوية اكسا بيضاء',code:'A1',perCarton:'20'}]));
  // نفس الأصناف بس مكتوبة بفروق بسيطة: مسافة زيادة · ة/ه · أ/ا · رقم هندي · شرطة
  localStorage.setItem('whStock_v1', JSON.stringify({
    w1:{ 'كرافت لاين 25 ابيض ':{balance:10},      // مسافة في الآخر
         'كومبن ابيض 30':{balance:40},             // أ → ا
         'زاوية اكسا بيضاء':{balance:100},         // ه → ة
         'باب ٨٠ A05':{balance:5},                 // أرقام هندية
         'صنف مش في الأصناف':{balance:7} },
    w2:{ 'كرافت-لاين 25 ابيض':{balance:3},         // شرطة
         'زاوية اكسا بيضاء':{balance:60} }}));
});
await pg.goto(APP); await pg.waitForTimeout(1200);

// ── الرصيد بيتلاقى رغم فروق الكتابة
const q = await pg.evaluate(()=>({
  kraft1: qtyOf('w1','كرافت لاين 25 ابيض'), kraft2: qtyOf('w2','كرافت لاين 25 ابيض'),
  komben: qtyOf('w1','كومبن أبيض 30'), zawya1: qtyOf('w1','زاويه اكسا بيضاء'),
  zawya2: qtyOf('w2','زاويه اكسا بيضاء'), bab: qtyOf('w1','باب 80 A05') }));
check('مسافة زيادة في آخر الاسم', q.kraft1===10, String(q.kraft1));
check('شرطة جوه الاسم', q.kraft2===3, String(q.kraft2));
check('أ بدل ا', q.komben===40, String(q.komben));
check('ه بدل ة', q.zawya1===100 && q.zawya2===60, q.zawya1+'/'+q.zawya2);
check('أرقام هندية بدل عربية', q.bab===5, String(q.bab));

// ── مقارنة الفروع مابقتش فاضية
const tree = await pg.evaluate(()=>buildCompareTree());
const allItems = tree.flatMap(t=>t.subs.flatMap(s=>s.items));
check('مقارنة الفروع فيها كل الأصناف الأربعة', allItems.length===4, allItems.map(i=>i.name).join('، '));
check('الإجماليات صح', allItems.find(i=>i.name==='زاويه اكسا بيضاء').cells.join('/')==='100/60');

// ── مقارنة الألوان
const ct = await pg.evaluate(()=>buildColorTable());
check('مقارنة الألوان مش فاضية', ct.rows.filter(r=>r.type==='item').length>0, String(ct.rows.length));
check('الأبيض ظاهر كلون', ct.colors.includes('ابيض'), ct.colors.join('، '));

// ── جيفز بالكراتين
const gv = await pg.evaluate(()=>buildGvCompare());
check('جيفز لاقى رصيده رغم فرق الاسم', gv.rows.length===1 && gv.rows[0].total===160,
  JSON.stringify(gv.rows.map(r=>({n:r.name,t:r.total}))));
check('كراتين جيفز = ١٦٠ ÷ ٢٠ = ٨', gv.rows[0].totalCartons===8, String(gv.rows[0]?.totalCartons));

// ── الأصناف اللي في الأرصدة ومش في قايمة الأصناف بتتقال
const orph = await pg.evaluate(()=>stockOrphans());
check('الصنف الغريب اتحدّد', orph.length===1 && orph[0]==='صنف مش في الأصناف', JSON.stringify(orph));
await pg.evaluate(()=>{ module='warehouses'; save('_whTab_','compare'); render(true); });
await pg.waitForTimeout(400);
const txt = await pg.evaluate(()=>document.body.innerText);
check('التنبيه ظاهر في مقارنة الفروع', txt.includes('مالوش مقابل في قايمة الأصناف'));
check('التنبيه بيسمّي الصنف', txt.includes('صنف مش في الأصناف'));

// ── شاشة الأرصدة والنواقص كمان بتوري الرصيد الصح
await pg.evaluate(()=>{ save('_whTab_','w1'); save('_whSub_',1);
  shortMain=new Set(['قطاعات كرافت لاين','اكسسورات pvc اكسا']); render(true); });
await pg.waitForTimeout(400);
const t2 = await pg.evaluate(()=>document.querySelector('#wh_sub').innerText);
check('النواقص بتوري الرصيد مش صفر', /الرصيد: 10/.test(t2) && /الرصيد: 100/.test(t2),
  (t2.match(/الرصيد: [^\n]*/g)||[]).join(' | '));

check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close();
process.exit(fail?1:0);
