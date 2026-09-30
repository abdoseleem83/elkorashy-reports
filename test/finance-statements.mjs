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
ck('شاشة التأكيد ظهرت', /تأكيد ميزان المراجعة/.test(await pg.evaluate(()=>document.body.innerText)));
await pg.selectOption('#tb_mo','01'); await pg.selectOption('#tb_yr','2026');
await pg.evaluate(()=> commitTrialBalance()); await pg.waitForTimeout(800);

const n=await pg.evaluate(()=> (trialBal['2026-01']||[]).length);
ck('اتحمّل ٢٧٢ حساب (اللي رصيده صفر مش بيتخزّن)', n===272, 'عدد='+n);
const leaves=await pg.evaluate(()=> finLeaves('2026-01').length);
ck('٢٣٩ حساب طرفي — الحساب الأب مش بيتحسب مرتين', leaves===239, 'عدد='+leaves);

const V=await pg.evaluate(()=> finStatement('2026-01','isco').V);
const r=x=>Math.round(x);
ck('المبيعات REDACTED', r(V.sales)===REDACTED, String(r(V.sales)));
ck('مردود المبيعات REDACTED', r(V.ret)===REDACTED, String(r(V.ret)));
ck('صافي المبيعات REDACTED', r(V.net)===REDACTED, String(r(V.net)));
ck('تكلفة البضاعة REDACTED', r(V.cogs)===REDACTED, String(r(V.cogs)));
ck('مجمل الربح REDACTED', r(V.gross)===REDACTED, String(r(V.gross)));
ck('إيرادات أخرى REDACTED', r(V.oth)===REDACTED, String(r(V.oth)));
ck('المصروفات العمومية REDACTED', r(V.exp)===REDACTED, String(r(V.exp)));
ck('صافي الربح REDACTED', r(V.profit)===REDACTED, String(r(V.profit)));

const B=await pg.evaluate(()=> finStatement('2026-01','bs').V);
ck('الأصول الثابتة REDACTED', r(B.fixed)===REDACTED, String(r(B.fixed)));
ck('الأصول المتداولة REDACTED', r(B.cur)===REDACTED, String(r(B.cur)));
ck('إجمالي الأصول REDACTED', r(B.assets)===REDACTED, String(r(B.assets)));
ck('رأس المال REDACTED', r(B.cap)===REDACTED, String(r(B.cap)));
ck('المركز متوازن بالظبط', r(B.assets)===r(B.total), r(B.assets)+' / '+r(B.total));
await pg.evaluate(()=>{ setFinView('bs'); }); await pg.waitForTimeout(400);
ck('الشاشة بتقول متوازن', /متوازن/.test(await pg.evaluate(()=>document.body.innerText)));

// قطاع PVC اتخمّن لوحده من أسماء الحسابات
const pvc=await pg.evaluate(()=> Object.values(finSeg).filter(v=>v==='pvc').length);
ck('حسابات PVC اتخمّنت من الاسم', pvc>0, 'عدد='+pvc);
const P=await pg.evaluate(()=> finStatement('2026-01','ispvc').V);
ck('قائمة PVC بتحسب مبيعاتها بس', r(P.sales)>0 && r(P.sales)<r(V.sales),
  r(P.sales)+' من '+r(V.sales));
await pg.evaluate(()=>{ setFinView('ispvc'); }); await pg.waitForTimeout(400);
ck('تحذير الحسابات غير المخصّصة',
  /مش متخصّص لقطاع/.test(await pg.evaluate(()=>document.body.innerText)));

// تخصيص حساب للمصنع بيغيّر قائمة المصنع
await pg.evaluate(()=>{ setFinSeg('4103','fac','isfac','sales'); closeSheet(); });
await pg.waitForTimeout(400);
const F=await pg.evaluate(()=> finStatement('2026-01','isfac').V);
ck('مبيعات المصنع بقت REDACTED', r(F.sales)===REDACTED, String(r(F.sales)));

// مفيش ميداليات في القوائم المالية
await pg.evaluate(()=>{ setFinView('isco'); }); await pg.waitForTimeout(400);
ck('مفيش ميداليات في القائمة',
  !/🥇/.test(await pg.evaluate(()=> document.querySelector('table.rep').innerText)));
ck('صفوف الإجمالي مميّزة', (await pg.locator('table.rep tr.m').count())===3);
// الضغط على بند بيوري حساباته
await pg.evaluate(()=> finLineSheet('isco','sales')); await pg.waitForTimeout(300);
ck('الضغط على المبيعات بيوري حساباتها',
  /مبيعات - مخزن الاسكندرية PVC/.test(await pg.evaluate(()=>document.body.innerText)));
console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
