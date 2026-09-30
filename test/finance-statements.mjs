// القوائم المالية على ميزان المراجعة الحقيقي
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {fileURLToPath} from 'url'; import {dirname, join} from 'path';
const here=dirname(fileURLToPath(import.meta.url));
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); if(!ok) bad++; };
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:412,height:880}});
pg.on('pageerror',e=>{bad++;console.log('❌ JS:',e.message)});
await pg.addInitScript(()=> localStorage.setItem('_sync_', JSON.stringify({off:true})));
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(1200);
if(await pg.evaluate(()=> typeof XLSX === 'undefined')){
  console.log('⏭️  مكتبة XLSX مش متحمّلة (مفيش إنترنت) — تخطّي');
  await b.close(); process.exit(0);
}
await pg.evaluate(()=>{ switchModule('fin'); finUnlocked=true; setFinView('tb'); }); await pg.waitForTimeout(400);
await pg.setInputFiles('#impTB', join(here,'fixtures','trial-balance.xls'));
await pg.waitForTimeout(1500);
const conf=await pg.evaluate(()=>document.body.innerText);
ck('شاشة التأكيد ظهرت', /تأكيد ميزان المراجعة/.test(conf));
ck('التأكيد بيقول متوازن — الحساب الأب مش بيتعدّ مرتين',
  /متوازن/.test(conf) && !/مش متوازن/.test(conf),
  (conf.match(/\d[\d,]*\s*(مدين|دائن)|الفرق [^\n]*/g)||[]).join(' · '));
ck('وبيقول عدد الطرفي', /٢٣٩|239 طرفي/.test(conf) || /\(239 طرفي\)/.test(conf), '');
await pg.selectOption('#tb_mo','01'); await pg.selectOption('#tb_yr','2026');
await pg.evaluate(()=> commitTrialBalance()); await pg.waitForTimeout(800);

const n=await pg.evaluate(()=> (trialBal['2026-01']||[]).length);
ck('اتحمّل ٢٧٢ حساب (اللي رصيده صفر مش بيتخزّن)', n===272, 'عدد='+n);
const leaves=await pg.evaluate(()=> finLeaves('2026-01').length);
ck('٢٣٩ حساب طرفي — الحساب الأب مش بيتحسب مرتين', leaves===239, 'عدد='+leaves);

// إجمالي الميزان نفسه لازم يتوازن على الحسابات الطرفية
const T=await pg.evaluate(()=>{
  const md=trialBalModel('2026-01'); const t=md.body[md.body.length-1].cells;
  return {d:t[2], c:t[3], leaves:md.lf.length}; });
ck('إجمالي الميزان متوازن ٩٩,٩٥٧,٧٦٢', T.d===99957762 && T.c===99957762, JSON.stringify(T));
ck('محسوب على ٢٣٩ حساب طرفي', T.leaves===239, String(T.leaves));
const scr=await pg.evaluate(()=>document.body.innerText);
ck('الشاشة بتقول متوازن مش العكس', /✅ متوازن/.test(scr) && !/مش متوازن/.test(scr), '');
const parents=await pg.evaluate(()=> trialBalModel('2026-01').body.filter(r=>r.type==='sub').length);
ck('الحسابات الأب سطورها رمادية (٣٣ حساب)', parents===33, String(parents));

const V=await pg.evaluate(()=> finStatement('2026-01','isco').V);
const r=x=>Math.round(x);
ck('المبيعات ٤٣,٤٥٥,٠٣٦', r(V.sales)===43455036, String(r(V.sales)));
ck('مردود المبيعات ٢٧٣,٨٣١', r(V.ret)===273831, String(r(V.ret)));
ck('صافي المبيعات ٤٣,١٨١,٢١١', r(V.net)===43181211, String(r(V.net)));
ck('تكلفة البضاعة ٤١,٨٨٤,٤٣٩', r(V.cogs)===41884439, String(r(V.cogs)));
ck('مجمل الربح ١,٢٩٦,٧٧٢', r(V.gross)===1296772, String(r(V.gross)));
ck('إيرادات أخرى ١,٦٧٣,٩٨٣', r(V.oth)===1673983, String(r(V.oth)));
ck('المصروفات العمومية ٣١٠,٦٧١', r(V.exp)===310671, String(r(V.exp)));
ck('صافي الربح ٢,٦٦٠,٠٨٣', r(V.profit)===2660083, String(r(V.profit)));

const B=await pg.evaluate(()=> finStatement('2026-01','bs').V);
ck('الأصول الثابتة ٥,٩٣٣,٠٧٩', r(B.fixed)===5933079, String(r(B.fixed)));
ck('الأصول المتداولة ٤١,٤٤٠,٩٥٣', r(B.cur)===41440953, String(r(B.cur)));
ck('إجمالي الأصول ٤٧,٣٧٤,٠٣٢', r(B.assets)===47374032, String(r(B.assets)));
ck('رأس المال ٤٥,٠٤٥,٠٠٩', r(B.cap)===45045009, String(r(B.cap)));
ck('المركز متوازن بالظبط', r(B.assets)===r(B.total), r(B.assets)+' / '+r(B.total));
await pg.evaluate(()=>{ setFinView('bs'); }); await pg.waitForTimeout(400);
ck('الشاشة بتقول متوازن', /متوازن/.test(await pg.evaluate(()=>document.body.innerText)));

// ── توزيع القطاعات: فروع PVC اتخصّصت لوحدها وقت الرفع
const par=await pg.evaluate(()=> finParents('2026-01').length);
ck('٢٥ حساب أب في الأرباح والخسائر', par===25, 'عدد='+par);
const seg=await pg.evaluate(()=> finParents('2026-01').map(a=>({c:a.code, s:finSegOf(a.code)})));
const pvcN=seg.filter(x=>x.s==='pvc').length, noN=seg.filter(x=>!x.s).length;
ck('٢١ حساب راحوا PVC و٤ لسه من غير قطاع', pvcN===21 && noN===4, 'PVC='+pvcN+' بلا='+noN);
ck('فروع PVC كلها اتخصّصت',
  ['4102','4103','4104','4107','3211','3214','3216','3224','3169','3177','3165','3166']
    .every(c=> seg.find(x=>x.c===c && x.s==='pvc')),
  seg.filter(x=>!x.s).map(x=>x.c).join(','));
ck('عمولات البنك وفودافون وانستاباي والنقل مش PVC',
  ['3164','4317','4318','4501'].every(c=> seg.find(x=>x.c===c && !x.s)),
  seg.filter(x=>!x.s).map(x=>x.c).join(','));

// قائمة PVC = كل المبيعات لأن كل الفروع PVC
const P=await pg.evaluate(()=> finStatement('2026-01','ispvc').V);
ck('مبيعات PVC = كل المبيعات ٤٣,٤٥٥,٠٣٦', r(P.sales)===43455036, String(r(P.sales)));
ck('تكلفة PVC = كل التكلفة', r(P.cogs)===41884439, String(r(P.cogs)));
ck('مصروفات PVC ٣١٠,٣٢١ (من غير عمولات البنك ٣٥٠)',
  r(P.exp)===310321, String(r(P.exp)));
ck('مجمل ربح PVC زي الشركة', r(P.gross)===r(V.gross), r(P.gross)+' / '+r(V.gross));

await pg.evaluate(()=>{ setFinView('ispvc'); }); await pg.waitForTimeout(400);
ck('تحذير بالحسابات اللي من غير قطاع',
  /من غير قطاع/.test(await pg.evaluate(()=>document.body.innerText)));

// شاشة توزيع القطاعات
await pg.evaluate(()=>{ setFinView('seg'); }); await pg.waitForTimeout(400);
ck('شاشة التوزيع بتوري كل الحسابات الأب',
  (await pg.locator('#fin_c > .card').count())===25);
// نحوّل اكسا للمصنع بضغطة
await pg.evaluate(()=> segPick('4103','fac')); await pg.waitForTimeout(400);
const F=await pg.evaluate(()=> finStatement('2026-01','isfac').V);
ck('مبيعات المصنع بقت ١٩,٤٩٨,٢٦٠', r(F.sales)===19498260, String(r(F.sales)));
const P2=await pg.evaluate(()=> finStatement('2026-01','ispvc').V);
ck('ومبيعات PVC نقصت بنفس الرقم', r(P2.sales)===43455036-19498260, String(r(P2.sales)));
// الحساب الطرفي بيرث من الأب
ck('الحساب الطرفي بيرث قطاع الأب',
  (await pg.evaluate(()=> finSegOf('31770001')))==='pvc');
await pg.evaluate(()=> segPick('4103','pvc')); await pg.waitForTimeout(300);

// ── البنود منسدلة جوه الجدول، من غير شيت بينط
await pg.evaluate(()=>{ setFinView('isco'); finOpen={}; setFinDetail(0); }); await pg.waitForTimeout(400);
ck('البنود مقفولة في الأول', (await pg.locator('tr.dcexp').count())===0);
ck('علامة الفتح على البنود',
  /▸/.test(await pg.evaluate(()=> document.querySelector('table.rep').innerText)));
await pg.evaluate(()=> toggleFinLine('isco','cogs')); await pg.waitForTimeout(400);
ck('البند فتح جوه الجدول مش في شيت',
  (await pg.locator('tr.dcexp').count())===1 &&
  (await pg.evaluate(()=> document.querySelector('.overlay.show')))===null);
ck('وفيه حسابات التكلفة الأربعة', (await pg.locator('tr.dcexp .finrow').count())===4);

// ── تكلفة البضاعة في قائمة المصنع: الحسابات بتبان وينفع تعلّمها
await pg.evaluate(()=>{ setFinView('isfac'); finOpen={}; toggleFinLine('isfac','cogs'); });
await pg.waitForTimeout(450);
const nrow=await pg.locator('tr.dcexp .finrow').count();
ck('حسابات التكلفة بتبان في قائمة المصنع كمان', nrow===4, 'عدد='+nrow);
ck('ومكتوب إنهم برّه القطاع',
  /قطاع/.test(await pg.evaluate(()=> document.querySelector('tr.dcexp').innerText)));
await pg.locator('tr.dcexp .finrow').first().locator('.clschip', {hasText:'المصنع'}).click();
await pg.waitForTimeout(450);
const F2=await pg.evaluate(()=> finStatement('2026-01','isfac').V);
ck('التعليم اشتغل وتكلفة المصنع بقت أكبر من صفر', Math.round(F2.cogs)>0, String(Math.round(F2.cogs)));
ck('والشريحة بقت مضيّة',
  (await pg.locator('tr.dcexp .finrow').first().locator('.clschip.on', {hasText:'المصنع'}).count())===1);

// ── وضع «مفصّل» بيحط الحسابات في القائمة نفسها عشان الطباعة
await pg.evaluate(()=>{ setFinView('isco'); setFinDetail(1); }); await pg.waitForTimeout(450);
const mdD=await pg.evaluate(()=> repModel('fin_isco'));
ck('المفصّل فيه صفوف حسابات', mdD.body.filter(r=>r.type==='sub').length>20,
  String(mdD.body.filter(r=>r.type==='sub').length));
const mdS=await pg.evaluate(()=>{ setFinDetail(0); return repModel('fin_isco'); });
ck('المختصر ٩ بنود بس', mdS.body.length===9 && !mdS.body.some(r=>r.type==='sub'),
  String(mdS.body.length));
await pg.evaluate(()=>{ segPick('3211',''); }); await pg.waitForTimeout(300);

// مفيش ميداليات في القوائم المالية
await pg.evaluate(()=>{ save('_finView_','isco'); finOpen={}; render(true); }); await pg.waitForTimeout(400);
ck('مفيش ميداليات في القائمة',
  !/🥇/.test(await pg.evaluate(()=> document.querySelector('table.rep').innerText)));
ck('صفوف الإجمالي مميّزة', (await pg.locator('table.rep tr.m').count())===3);
// الضغط على المبيعات بيوري حساباتها جوه الجدول
await pg.evaluate(()=> toggleFinLine('isco','sales')); await pg.waitForTimeout(350);
ck('الضغط على المبيعات بيوري حساباتها',
  /مبيعات - مخزن الاسكندرية PVC/.test(await pg.evaluate(()=> document.querySelector('tr.dcexp').innerText)));
console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
