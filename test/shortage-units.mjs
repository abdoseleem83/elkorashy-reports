// النواقص: خانتين بوحدتين حسب المجموعة · إجمالي ظاهر · تصفير · الوحدة في التصدير
//   القطاعات (كرافت/نيو لاين/PVC كومبن) → لفة / عود
//   الاكسسوارات وغيرها                   → كرتونة / قطعة
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const APP = process.env.APP_URL;
const errs=[];
const ctx = await b.newContext();
const pg = await ctx.newPage();
pg.on('pageerror', e=>errs.push(e.message));
pg.on('dialog', d=>d.accept());
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('warehouses_v1', JSON.stringify([{id:'w1',name:'طنطا'}]));
  localStorage.setItem('items_v1', JSON.stringify([
    {id:'i1',name:'كرافت لاين 25 ابيض', mainGroup:'قطاعات كرافت لاين', subGroup:'٢٥', unit:'لفة'},
    {id:'i2',name:'كومبن ابيض 30',       mainGroup:'قطاعات PVC كومبن',  subGroup:'٣٠', unit:'عود'},
    {id:'i3',name:'زاوية اكسا',          mainGroup:'اكسسورات pvc اكسا', subGroup:'زوايا', unit:'قطعة'},
    {id:'i4',name:'نيو لاين 20',         mainGroup:'نيو لاين',          subGroup:'٢٠', unit:'لفة'},
    {id:'i5',name:'باب كامل 80',         mainGroup:'ابواب WPC',         subGroup:'٨٠', unit:'قطعة'}]));
  localStorage.setItem('whStock_v1', JSON.stringify({w1:{}}));
  // سجل قديم بالشكل الأقدم {order, unit}
  localStorage.setItem('whShortage_v1', JSON.stringify({w1:{
    'باب كامل 80': {order:'7', unit:'كرتونة', note:'قديم'} }}));
});
await pg.goto(APP); await pg.waitForTimeout(1200);
await pg.evaluate(()=>{ module='warehouses'; save('_whTab_','w1'); save('_whSub_',1);
  shortMain=new Set(['قطاعات كرافت لاين','قطاعات PVC كومبن','اكسسورات pvc اكسا','نيو لاين','ابواب WPC']);
  render(true); });
await pg.waitForTimeout(500);

// ── الوحدتين حسب المجموعة
const u = await pg.evaluate(()=>({
  kraft: shortUnits('كرافت لاين 25 ابيض'), komben: shortUnits('كومبن ابيض 30'),
  newline: shortUnits('نيو لاين 20'), acc: shortUnits('زاوية اكسا'), door: shortUnits('باب كامل 80') }));
check('كرافت لاين → لفة/عود',  u.kraft.join('/')==='لفة/عود', u.kraft.join('/'));
check('PVC كومبن → لفة/عود',   u.komben.join('/')==='لفة/عود', u.komben.join('/'));
check('نيو لاين → لفة/عود',    u.newline.join('/')==='لفة/عود', u.newline.join('/'));
check('اكسسوارات → كرتونة/قطعة', u.acc.join('/')==='كرتونة/قطعة', u.acc.join('/'));
check('الأبواب (الافتراضي) → كرتونة/قطعة', u.door.join('/')==='كرتونة/قطعة', u.door.join('/'));

// ── العناوين على الشاشة
const labels = await pg.evaluate(()=>[...document.querySelectorAll('#wh_sub label span')].map(s=>s.textContent));
check('العناوين في الشاشة صح',
  labels.join(',')==='لفة,عود,لفة,عود,كرتونة,قطعة,لفة,عود,كرتونة,قطعة', labels.join(','));
check('مفيش قايمة وحدات منسدلة', (await pg.evaluate(()=>document.querySelectorAll('#wh_sub select').length))===0);

// ── السجل القديم اتقرا صح (كرتونة = الخانة الأولى للأبواب)
const legacy = await pg.evaluate(()=>shortRec('w1','باب كامل 80'));
check('سجل قديم بالكرتونة راح لخانة الكرتونة', legacy.q1==='7' && !legacy.q2 && legacy.u1==='كرتونة', JSON.stringify(legacy));
check('الملاحظة القديمة ما ضاعتش', legacy.note==='قديم');

// ── الكتابة
await pg.evaluate(()=>{
  setShortQty('w1','كرافت لاين 25 ابيض','q1','3');    // ٣ لفة
  setShortQty('w1','كرافت لاين 25 ابيض','q2','12');   // ١٢ عود
  setShortQty('w1','كومبن ابيض 30','q1','5');         // ٥ لفة
  setShortQty('w1','زاوية اكسا','q1','4');            // ٤ كرتونة
  setShortQty('w1','زاوية اكسا','q2','30');           // ٣٠ قطعة
});
await pg.waitForTimeout(200);
const r1 = await pg.evaluate(()=>shortRec('w1','كرافت لاين 25 ابيض'));
check('اتحفظ باللفة والعود', r1.q1==='3' && r1.q2==='12' && r1.u1==='لفة' && r1.u2==='عود', JSON.stringify(r1));

// ── الإجماليات: كل وحدة لوحدها
const t = await pg.evaluate(()=>shortTotals('w1'));
check('عدد الأصناف = ٤', t.items===4, JSON.stringify(t));
check('لفة = ٣+٥ = ٨',   t.byUnit['لفة']===8, JSON.stringify(t.byUnit));
check('عود = ١٢',        t.byUnit['عود']===12);
check('كرتونة = ٤+٧ = ١١', t.byUnit['كرتونة']===11);
check('قطعة = ٣٠',       t.byUnit['قطعة']===30);
check('مفيش خلط بين اللفة والكرتونة', Object.keys(t.byUnit).sort().join(',')==='عود,قطعة,كرتونة,لفة', Object.keys(t.byUnit).join(','));

// ── الشريط الظاهر
const totTxt = await pg.evaluate(()=>document.querySelector('#shTot').innerText);
check('الشريط بيعرض كل وحدة', /لفة: 8/.test(totTxt) && /عود: 12/.test(totTxt) && /كرتونة: 11/.test(totTxt) && /قطعة: 30/.test(totTxt), totTxt);
await pg.evaluate(()=>setShortQty('w1','كومبن ابيض 30','q1','15'));
await pg.waitForTimeout(150);
check('الشريط بيتحدّث لحظيًا', /لفة: 18/.test(await pg.evaluate(()=>document.querySelector('#shTot').innerText)),
  await pg.evaluate(()=>document.querySelector('#shTot').innerText));

// ── المستند: عمود لكل وحدة
const doc = await pg.evaluate(()=>shortDocBody('w1'));
check('أعمدة المستند بالترتيب: لفة عود كرتونة قطعة',
  /<th>الصنف<\/th><th>لفة<\/th><th>عود<\/th><th>كرتونة<\/th><th>قطعة<\/th>/.test(doc),
  (doc.match(/<tr><th>الصنف[^]*?<\/tr>/)||[''])[0]);
check('الكرافت في عمود اللفة والعود مش الكرتونة', /<td>كرافت لاين 25 ابيض<\/td><td>3<\/td><td>12<\/td><td><\/td><td><\/td>/.test(doc));
check('الاكسسوار في عمود الكرتونة والقطعة', /<td>زاوية اكسا<\/td><td><\/td><td><\/td><td>4<\/td><td>30<\/td>/.test(doc));
check('سطر الإجمالي في المستند', /<b>18<\/b><\/td><td><b>12<\/b>/.test(doc));

// ── الإكسل
const aoa = await pg.evaluate(()=>{
  let got=null; const real=window.saveAoaXlsx;
  window.saveAoaXlsx=(d,sh,fn,w,o)=>{ got={d,w}; };
  try{ exportShortExcel('w1'); } finally { window.saveAoaXlsx=real; }
  return got;
});
check('رأس الإكسل: الصنف + الوحدات + ملاحظة',
  aoa && aoa.d[0].join('|')==='الصنف|لفة|عود|كرتونة|قطعة|ملاحظة', aoa? aoa.d[0].join('|') : 'مفيش');
check('عدد أعمدة العرض مطابق', aoa.w.length===aoa.d[0].length, aoa.w.length+' vs '+aoa.d[0].length);
const rowAcc = aoa.d.find(r=> r[0]==='زاوية اكسا');
check('سطر الاكسسوار: ٤ كرتونة و٣٠ قطعة', rowAcc && rowAcc[1]==='' && rowAcc[3]===4 && rowAcc[4]===30, JSON.stringify(rowAcc));
const rowTot = aoa.d.find(r=> r[0]==='الإجمالي');
check('سطر الإجمالي في الإكسل', rowTot && rowTot[1]===18 && rowTot[2]===12 && rowTot[3]===11 && rowTot[4]===30, JSON.stringify(rowTot));

// ── التصفير
await pg.evaluate(()=>resetShortage('w1')); await pg.waitForTimeout(400);
check('التصفير مسح الطلب كله', (await pg.evaluate(()=>shortTotals('w1'))).items===0);
check('الأصناف نفسها ما اتمستش', (await pg.evaluate(()=>load('items_v1',[]))).length===5);

check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close();
process.exit(fail?1:0);
