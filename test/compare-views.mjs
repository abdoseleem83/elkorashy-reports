// مقارنة الألوان: اللون الصفري في كل الفروع مالوش عمود
// مقارنة جيفز بالكراتين: تبويب لوحده زي الألوان
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
  localStorage.setItem('warehouses_v1', JSON.stringify([{id:'w1',name:'طنطا'},{id:'w2',name:'اسكندرية'}]));
  localStorage.setItem('items_v1', JSON.stringify([
    {id:'1',name:'كرافت 25 ابيض',mainGroup:'كرافت',baseName:'كرافت 25',color:'ابيض',unit:'لفة'},
    {id:'2',name:'كرافت 25 خشبي',mainGroup:'كرافت',baseName:'كرافت 25',color:'خشبي',unit:'لفة'},
    {id:'3',name:'كرافت 30 ابيض',mainGroup:'كرافت',baseName:'كرافت 30',color:'ابيض',unit:'لفة'},
    {id:'4',name:'كرافت 30 خشبي',mainGroup:'كرافت',baseName:'كرافت 30',color:'خشبي',unit:'لفة'},
    {id:'5',name:'كرافت 30 بيج',  mainGroup:'كرافت',baseName:'كرافت 30',color:'بيج',  unit:'لفة'},
    {id:'6',name:'مقص جيفز A1',   mainGroup:'جيفيز',unit:'قطعة'},
    {id:'7',name:'كالون جيفز B2', mainGroup:'جيفيز',unit:'قطعة'}]));
  localStorage.setItem('gvcodes_v1', JSON.stringify([
    {id:'g1',name:'مقص جيفز A1',   code:'A1', perCarton:'20', weight:'0.4', price:'3'},
    {id:'g2',name:'كالون جيفز B2', code:'B2', perCarton:'10', weight:'1',   price:'5'},
    {id:'g3',name:'صنف مالوش رصيد',code:'C3', perCarton:'5',  weight:'1',   price:'2'},
    {id:'g4',name:'صنف من غير كرتونة',code:'D4', perCarton:'', weight:'1',  price:'2'}]));
  localStorage.setItem('whStock_v1', JSON.stringify({
    w1:{'كرافت 25 ابيض':{balance:10},'كرافت 25 خشبي':{balance:0},'كرافت 30 ابيض':{balance:4},
        'كرافت 30 خشبي':{balance:0},'كرافت 30 بيج':{balance:7},
        'مقص جيفز A1':{balance:100},'كالون جيفز B2':{balance:25},'صنف من غير كرتونة':{balance:9}},
    w2:{'كرافت 25 ابيض':{balance:3},'كرافت 30 خشبي':{balance:0},'مقص جيفز A1':{balance:40}}}));
});
await pg.goto(APP); await pg.waitForTimeout(1200);

// ════ مقارنة الألوان ════
const c1 = await pg.evaluate(()=>buildColorTable().colors);
check('الخشبي (صفر في كل الفروع) مالوش عمود', !c1.includes('خشبي'), c1.join('، '));
check('الألوان اللي فيها رصيد ظاهرة', c1.includes('ابيض') && c1.includes('بيج'), c1.join('، '));
// حتى مع تفعيل «إظهار الأصناف الصفرية» — دي للأصناف مش للألوان
const c2 = await pg.evaluate(()=>{ colZero=true; return buildColorTable().colors; });
check('الخشبي يفضل مخفي حتى مع خانة الصفرية', !c2.includes('خشبي'), c2.join('، '));
const rowsZero = await pg.evaluate(()=>buildColorTable().rows.filter(r=>r.type==='item').length);
await pg.evaluate(()=>{ colZero=false; });
const rowsNoZero = await pg.evaluate(()=>buildColorTable().rows.filter(r=>r.type==='item').length);
check('الخانة لسه بتشتغل على الأصناف', rowsZero>=rowsNoZero, rowsZero+' مقابل '+rowsNoZero);
await pg.evaluate(()=>{ module='warehouses'; save('_whTab_','cmpx'); save('_cmpView_','colors'); render(true); });
await pg.waitForTimeout(400);
const heads = await pg.evaluate(()=>[...document.querySelectorAll('#cmp_c table tr:first-child th')].map(x=>x.textContent.trim()));
check('رؤوس جدول الألوان من غير خشبي', !heads.includes('خشبي') && heads.includes('ابيض'), heads.join('|'));
check('الخانة اتسمّت للأصناف', (await pg.evaluate(()=>document.body.innerText)).includes('إظهار الأصناف الصفرية'));

// ════ مقارنة جيفز بالكراتين ════
await pg.evaluate(()=>{ save('_whTab_','cmpx'); save('_cmpView_','gvbox'); render(true); });
await pg.waitForTimeout(400);
const txt = await pg.evaluate(()=>document.body.innerText);
check('تبويب جيفز جوه مقارنات', txt.includes('جيفز بالكراتين'));
check('المقارنات مجمّعة تحت تبويب واحد',
  (await pg.evaluate(()=>[...document.querySelectorAll('#main .tabs button')].map(x=>x.textContent.trim()))).filter(t=>/مقارنة|مقارنات/.test(t)).length===1,
  (await pg.evaluate(()=>[...document.querySelectorAll('#main .tabs button')].map(x=>x.textContent.trim()))).join('|'));
const gc = await pg.evaluate(()=>buildGvCompare());
const a1 = gc.rows.find(r=>r.code==='A1');
check('مقص A1: ١٠٠ قطعة ÷ ٢٠ = ٥ كراتين في طنطا', a1 && a1.cartons[0]===5, JSON.stringify(a1&&a1.cartons));
check('مقص A1: ٤٠ ÷ ٢٠ = ٢ في اسكندرية', a1 && a1.cartons[1]===2);
check('مقص A1 إجمالي ٧ كراتين', a1 && a1.totalCartons===7, String(a1&&a1.totalCartons));
const b2 = gc.rows.find(r=>r.code==='B2');
check('كالون B2: ٢٥ ÷ ١٠ = ٢٫٥ كرتونة', b2 && b2.totalCartons===2.5, String(b2&&b2.totalCartons));
check('الصنف اللي مالوش رصيد مش ظاهر', !gc.rows.some(r=>r.code==='C3'));
const d4 = gc.rows.find(r=>r.code==='D4');
check('اللي مالوش ق/كرتونة ظاهر بس من غير كراتين', d4 && d4.pc===0 && d4.total===9, JSON.stringify(d4&&{pc:d4.pc,t:d4.total}));
check('وفيه تنبيه بيه', txt.includes('مالوش «عدد القطع بالكرتونة»'));
check('التنبيه بيسمّي الصنف مش بس بيعدّه', txt.includes('صنف من غير كرتونة'), '');
const before = await pg.evaluate(()=>gvcodes.find(g=>g.code==='D4').perCarton);
await pg.evaluate(()=>{ const g=gvcodes.find(x=>x.code==='D4'); gvSetPerCarton(g.id,'25'); });
await pg.waitForTimeout(300);
check('تقدر تكتب ق/كرتونة من التنبيه نفسه',
  (await pg.evaluate(()=>gvcodes.find(g=>g.code==='D4').perCarton))==='25', before+' → 25');
check('والكراتين اتحسبت بعدها',
  (await pg.evaluate(()=>{const r=buildGvCompare().rows.find(x=>x.code==='D4'); return r? r.totalCartons : null;}))>0);
check('إجمالي الكراتين صح ٧+٢٫٥=٩٫٥', gc.tot.totalCartons===9.5, String(gc.tot.totalCartons));
// الصفرية
const withZero = await pg.evaluate(()=>{ gvcZero=true; const n=buildGvCompare().rows.length; gvcZero=false; return n; });
check('خانة الصفرية بتظهر اللي مالوش رصيد', withZero===4, String(withZero));

// التصدير
const doc = await pg.evaluate(()=>gvCompareDocBody());
check('المستند فيه أعمدة الفروع', /طنطا/.test(doc) && /اسكندرية/.test(doc) && /ق\/كرتونة/.test(doc));
const aoa = await pg.evaluate(()=>{
  let got=null; const real=window.saveAoaXlsx;
  window.saveAoaXlsx=(d,sh,fn,w,o)=>{ got={d,w}; };
  try{ exportGvCompareExcel(); } finally { window.saveAoaXlsx=real; }
  return got;
});
check('رأس الإكسل فيه كراتين وقطع لكل فرع',
  aoa && aoa.d[0].join('|')==='الصنف|الكود|ق/كرتونة|طنطا (كرتونة)|اسكندرية (كرتونة)|إجمالي الكراتين|طنطا (قطعة)|اسكندرية (قطعة)|إجمالي القطع',
  aoa? aoa.d[0].join('|') : 'مفيش');
check('عدد أعمدة العرض مطابق', aoa.w.length===aoa.d[0].length, aoa.w.length+' vs '+aoa.d[0].length);
const rA1 = aoa.d.find(r=> r[1]==='A1');
check('سطر A1 في الإكسل: ٥ و٢ كراتين و١٠٠ و٤٠ قطعة',
  rA1 && rA1[3]===5 && rA1[4]===2 && rA1[6]===100 && rA1[7]===40, JSON.stringify(rA1));

// ── مطابقة جيفز مع أسماء الأرصدة المختلفة (ده اللي كان بيخلي المقارنة فاضية)
await pg.evaluate(()=>{
  gvcodes=[{id:'a',name:'سبلونة مفصلى 30 سم GEVIS',code:'ISP-M300',perCarton:'20'},
           {id:'b',name:'سبلونة جرار 160 سم GEVIS',code:'ISP M1600 - SUR / 15',perCarton:'20'},
           {id:'c',name:'زاما 2 ضلفه CKK GEVIS',code:'01',perCarton:'500'},
           {id:'d',name:'حاجة مش موجودة خالص',code:'ZZZ9',perCarton:'10'}];
  save('gvcodes_v1',gvcodes);
  whStock={w1:{'سبلونه مفصلي 30 GEVIS ISP-M300':{balance:400},
               'سبلونة جرار 160 سم GEVIS':{balance:100},
               'زاما ٢ ضلفه ckk gevis':{balance:1000}},
           w2:{'سبلونه مفصلي 30 GEVIS ISP-M300':{balance:200}}};
  save('whStock_v1',whStock); gvMap={}; save('gvMap_v1',gvMap); gvcZero=false; render(true);
});
await pg.waitForTimeout(300);
const G = await pg.evaluate(()=>buildGvCompare().rows);
check('الكود جوه اسم الرصيد بيتلاقى (٤٠٠+٢٠٠)', (G.find(r=>r.code==='ISP-M300')||{}).total===600,
  JSON.stringify(G.map(r=>({c:r.code,t:r.total}))));
check('الاسم بالظبط بيتلاقى', (G.find(r=>r.code.indexOf('M1600')>=0)||{}).total===100);
check('اختلاف ة/ه والأرقام الهندية بيتلاقى', (G.find(r=>r.code==='01')||{}).total===1000);
check('اللي مالوش مقابل مش بيتحسب', !G.some(r=>r.code==='ZZZ9'), G.map(r=>r.code).join('،'));
check('بيقول اسمه في الأرصدة لما يختلف',
  /سبلونه مفصلي 30 GEVIS ISP-M300/.test((G.find(r=>r.code==='ISP-M300')||{}).stockName||''),
  (G.find(r=>r.code==='ISP-M300')||{}).stockName);
check('الكراتين اتحسبت ٦٠٠÷٢٠=٣٠', (G.find(r=>r.code==='ISP-M300')||{}).totalCartons===30);
// الربط اليدوي
const linkTxt = await pg.evaluate(()=>document.body.innerText);
check('لوحة الربط اليدوي ظاهرة للي مش لاقي', linkTxt.includes('ربط أصناف جيفز بالأرصدة'));
await pg.evaluate(()=>gvMapSet('d','زاما ٢ ضلفه ckk gevis')); await pg.waitForTimeout(300);
check('الربط اليدوي بيشتغل', (await pg.evaluate(()=>buildGvCompare().rows.find(r=>r.code==='ZZZ9')||null))?.total===1000);
check('الربط بيتزامن', (await pg.evaluate(()=>SYNC_KEYS.includes('gvMap_v1')))===true);

// ── الاسم المختصر لأصناف جيفز
const sn = await pg.evaluate(()=>[
  gvShortName('سبلونة مفصلى 40 سم GEVIS','ISP - M400'),
  gvShortName('سبلونة جرار 40 سم GEVIS','ISP M400 - SUR / 15'),
  gvShortName('زاما 2 ضلفه CKK GEVIS','01'),
  gvShortName('حلق باب 10 سم','A01'),
  gvShortName('GEVIS','ISP')]);
check('بيشيل GEVIS والكود من الاسم', sn[0]==='سبلونة مفصلى 40 سم', sn[0]);
check('بيشيل SUR وأجزاء الكود كمان', sn[1]==='سبلونة جرار 40 سم', sn[1]);
check('كود قصير (٠١) مابيتشالش من جوه الاسم', sn[2]==='زاما 2 ضلفه CKK', sn[2]);
check('الاسم اللي مفيهوش تكرار مابيتغيرش', sn[3]==='حلق باب 10 سم', sn[3]);
check('مابيرجعش اسم فاضي أبدًا', sn[4]==='GEVIS', sn[4]);
const cellTxt = await pg.evaluate(()=>{
  const td=[...document.querySelectorAll('#cmp_c table td')].find(x=>/سبلونة|زاما/.test(x.textContent));
  return td? {t:td.textContent.trim(), title:td.getAttribute('title')||''} : null; });
check('الجدول بيعرض الاسم المختصر', cellTxt && !/GEVIS/.test(cellTxt.t), JSON.stringify(cellTxt&&cellTxt.t));
check('والاسم الكامل في tooltip', cellTxt && /GEVIS/.test(cellTxt.title), JSON.stringify(cellTxt&&cellTxt.title));
const xg = await pg.evaluate(()=>{
  let got=null; const real=window.saveAoaXlsx;
  window.saveAoaXlsx=(d)=>{ got=d; };
  try{ exportGvCompareExcel(); } finally { window.saveAoaXlsx=real; }
  return got; });
check('الإكسل كمان بالاسم المختصر', xg && !xg.slice(1).some(r=> /GEVIS/.test(String(r[0]||''))),
  JSON.stringify((xg||[]).slice(1,3).map(r=>r[0])));

check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close();
process.exit(fail?1:0);
