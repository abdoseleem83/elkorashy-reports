// النواقص: خانتين (كراتين + قطع) · إجمالي ظاهر · تصفير · الوحدة في التصدير
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const APP = process.env.APP_URL;
const errs=[];
const ctx = await b.newContext({ acceptDownloads:true });
const pg = await ctx.newPage();
pg.on('pageerror', e=>errs.push(e.message));
pg.on('dialog', d=>d.accept());
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('warehouses_v1', JSON.stringify([{id:'w1',name:'طنطا',type:'مخزن رئيسي'}]));
  localStorage.setItem('items_v1', JSON.stringify([
    {id:'i1',name:'كرافت لاين 25 ابيض',mainGroup:'كرافت',subGroup:'٢٥',unit:'لفة'},
    {id:'i2',name:'كومبن ابيض 30',      mainGroup:'كومبن',subGroup:'٣٠',unit:'عود'},
    {id:'i3',name:'باب كامل 80',        mainGroup:'ابواب',subGroup:'٨٠',unit:'قطعة'}]));
  localStorage.setItem('whStock_v1', JSON.stringify({w1:{'كرافت لاين 25 ابيض':{balance:10},'كومبن ابيض 30':{balance:5},'باب كامل 80':{balance:2}}}));
  // سجل قديم بالشكل القديم {order, unit} — لازم يفضل مقروء
  localStorage.setItem('whShortage_v1', JSON.stringify({w1:{
    'باب كامل 80': {order:'7', unit:'كرتونة', note:'قديم'} }}));
});
await pg.goto(APP); await pg.waitForTimeout(1200);
await pg.evaluate(()=>{ module='warehouses'; save('_whTab_','w1'); save('_whSub_',1);
  shortMain=new Set(['كرافت','كومبن','ابواب']); render(true); });
await pg.waitForTimeout(500);

// ── وحدة القطع بتيجي من الصنف نفسه، مش من قايمة
check('وحدة الكرافت = لفة',  await pg.evaluate(()=>pieceUnit('كرافت لاين 25 ابيض'))==='لفة');
check('وحدة الكومبن = عود',  await pg.evaluate(()=>pieceUnit('كومبن ابيض 30'))==='عود');

// ── السجل القديم اتقرا صح: كان بالكرتونة
const legacy = await pg.evaluate(()=>shortRec('w1','باب كامل 80'));
check('سجل قديم بالكرتونة اتحوّل لخانة الكراتين', legacy.cartons==='7' && !legacy.pieces, JSON.stringify(legacy));
check('الملاحظة القديمة ما ضاعتش', legacy.note==='قديم');

// ── خانتين لكل صنف في الشاشة
const boxes = await pg.evaluate(()=>[...document.querySelectorAll('#wh_sub input[type=number]')].length);
check('خانتين لكل صنف (٣ أصناف = ٦ خانات)', boxes===6, 'لقينا '+boxes);
const labels = await pg.evaluate(()=>[...document.querySelectorAll('#wh_sub label span')].map(s=>s.textContent));
check('العناوين: كرتونة + وحدة الصنف', labels.join(',')==='كرتونة,لفة,كرتونة,عود,كرتونة,قطعة', labels.join(','));
check('مفيش قايمة وحدات منسدلة', (await pg.evaluate(()=>document.querySelectorAll('#wh_sub select').length))===0);

// ── الكتابة في الخانتين
await pg.evaluate(()=>{ setShortQty('w1','كرافت لاين 25 ابيض','cartons','3');
                        setShortQty('w1','كرافت لاين 25 ابيض','pieces','12');
                        setShortQty('w1','كومبن ابيض 30','pieces','40'); });
await pg.waitForTimeout(200);
const r1 = await pg.evaluate(()=>shortRec('w1','كرافت لاين 25 ابيض'));
check('الكراتين والقطع اتحفظوا مع بعض', r1.cartons==='3' && r1.pieces==='12' && r1.unit==='لفة', JSON.stringify(r1));

// ── الإجمالي
const t = await pg.evaluate(()=>shortTotals('w1'));
check('عدد الأصناف = ٣', t.items===3, JSON.stringify(t));
check('إجمالي الكراتين = ٣+٧ = ١٠', t.cartons===10);
check('القطع مقسّمة على وحدتها', t.byUnit['لفة']===12 && t.byUnit['عود']===40, JSON.stringify(t.byUnit));

// ── الإجمالي ظاهر قدامك وبيتحدّث من غير إعادة رسم
const totTxt = await pg.evaluate(()=>document.querySelector('#shTot').innerText);
check('شريط الإجمالي ظاهر', /أصناف/.test(totTxt) && /كراتين/.test(totTxt) && /لفة/.test(totTxt), totTxt);
await pg.evaluate(()=>setShortQty('w1','كومبن ابيض 30','cartons','5'));
await pg.waitForTimeout(150);
check('الإجمالي بيتحدّث لحظيًا', /15/.test(await pg.evaluate(()=>document.querySelector('#shTot').innerText)),
  await pg.evaluate(()=>document.querySelector('#shTot').innerText));

// ── الوحدة بتظهر جنب كل صنف في المستند
const doc = await pg.evaluate(()=>shortDocBody('w1'));
check('المستند فيه عمود كراتين وقطع والوحدة', /كراتين/.test(doc) && /<th>قطع/.test(doc) && /<th>الوحدة/.test(doc));
check('وحدة كل صنف ظاهرة في سطره', /<td>لفة<\/td>/.test(doc) && /<td>عود<\/td>/.test(doc), '');
check('الإجمالي مكتوب في ترويسة المستند', /3 صنف/.test(doc) && /كراتين: 15/.test(doc) && /لفة: 12/.test(doc) && /عود: 40/.test(doc),
  (doc.match(/<div class="sub">[^<]*/)||[''])[0]);

// ── الإكسل: الأعمدة والمجاميع (من غير ما نحمّل المكتبة — بنعترض النداء)
const aoa = await pg.evaluate(()=>{
  let got=null; const real=window.saveAoaXlsx;
  window.saveAoaXlsx=(d,sh,fn,w,o)=>{ got={d,fn,o}; };
  try{ exportShortExcel('w1'); } finally { window.saveAoaXlsx=real; }
  return got;
});
check('الإكسل رأسه: الصنف · كراتين · قطع · الوحدة · ملاحظة',
  aoa && aoa.d[0].join('|')==='الصنف|كراتين|قطع|الوحدة|ملاحظة', aoa? aoa.d[0].join('|') : 'مفيش');
const rowKr = aoa.d.find(r=> r[0]==='كرافت لاين 25 ابيض');
check('سطر الصنف فيه الكراتين والقطع والوحدة', rowKr && rowKr[1]===3 && rowKr[2]===12 && rowKr[3]==='لفة', JSON.stringify(rowKr));
const rowTot = aoa.d.find(r=> r[0]==='الإجمالي');
check('سطر الإجمالي في الإكسل', rowTot && rowTot[1]===15 && rowTot[2]===52, JSON.stringify(rowTot));

// ── التصفير
await pg.evaluate(()=>resetShortage('w1')); await pg.waitForTimeout(400);
check('التصفير مسح الطلب كله', (await pg.evaluate(()=>shortTotals('w1'))).items===0);
check('الأصناف نفسها ما اتمستش', (await pg.evaluate(()=>load('items_v1',[]))).length===3);

check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close();
process.exit(fail?1:0);
