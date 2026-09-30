// قوائم مالية: كلمة السر · الأيقونات · رفع ميزان المراجعة
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); if(!ok) bad++; };
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:412,height:880}});
pg.on('pageerror',e=>{bad++;console.log('❌ JS:',e.message)});
await pg.addInitScript(()=> localStorage.setItem('_sync_', JSON.stringify({off:true})));
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(900);

ck('أيقونة «قوائم مالية» في الرئيسية وفي الشريط',
  /قوائم مالية/.test(await pg.evaluate(()=>document.body.innerText)));
ck('مكتوب إنها محمية', /محمي بكلمة سر/.test(await pg.evaluate(()=>document.body.innerText)));

await pg.evaluate(()=>{ switchModule('fin'); }); await pg.waitForTimeout(300);
ck('مقفولة ومفيش أيقونات جواها',
  /محمية بكلمة سر/.test(await pg.evaluate(()=>document.body.innerText)) &&
  (await pg.locator('#main > .stabs .stab').count())===0);

await pg.evaluate(()=> finAskPass()); await pg.waitForTimeout(250);
await pg.fill('#fin_pw','1111');
await pg.evaluate(()=> finUnlock()); await pg.waitForTimeout(300);
ck('كلمة سر غلط مش بتفتح', (await pg.evaluate(()=>finUnlocked))===false);
await pg.fill('#fin_pw','2372010');
await pg.evaluate(()=> finUnlock()); await pg.waitForTimeout(350);
ck('كلمة السر الصح بتفتح', (await pg.evaluate(()=>finUnlocked))===true);
ck("٦ أيقونات جواها", (await pg.locator("#main > .stabs .stab").count())===6);
const names=await pg.locator('#main > .stabs .stab').allInnerTexts();
ck('الأسماء صح',
  names.join('|')==='⚖️ موازين المراجعة|🏢 دخل الشركة|🧱 دخل PVC|🏭 دخل المصنع|📊 المركز المالي|🏷️ توزيع القطاعات',
  names.join('|'));

// رفع ميزان مراجعة
await pg.evaluate(()=>{ setFinView('tb'); }); await pg.waitForTimeout(300);
ck('شاشة الميزان فيها زرار الرفع', /رفع ميزان مراجعة/.test(await pg.evaluate(()=>document.body.innerText)));
await pg.evaluate(()=>{
  // بنحقن الميزان مباشرة (مكتبة الإكسل مش متحمّلة في بيئة الاختبار)
  trialBal['2026-08']=[
    {code:'1201',name:'الخزينة',debit:250000,credit:0},
    {code:'4102',name:'المبيعات',debit:0,credit:900000},
    {code:'3211',name:'تكلفة المبيعات',debit:650000,credit:0}];
  save('trialBal_v1',trialBal); save('_finPer_','2026-08'); render(true); });
await pg.waitForTimeout(350);
const md=await pg.evaluate(()=> trialBalModel('2026-08'));
ck('أعمدة الميزان', md.header.join('|')==='الحساب|الكود|مدين|دائن', md.header.join('|'));
const t=md.body[md.body.length-1].cells;
ck('الإجماليات صح', t[2]===900000 && t[3]===900000, t.join('/'));
ck('مفيش تحذير عدم توازن', !/مش متوازن/.test(await pg.evaluate(()=>document.body.innerText)));
await pg.evaluate(()=>{ trialBal['2026-08'].push({code:'9',name:'زيادة',debit:5,credit:0});
  save('trialBal_v1',trialBal); render(true); }); await pg.waitForTimeout(300);
ck('تحذير لما الميزان مش متوازن', /مش متوازن/.test(await pg.evaluate(()=>document.body.innerText)));

// قائمة الدخل بتتحسب من الميزان على طول
await pg.evaluate(()=>{ setFinView('isco'); }); await pg.waitForTimeout(350);
const st=await pg.evaluate(()=>document.body.innerText);
ck('قائمة دخل الشركة بتتبني من الميزان',
  /قائمة دخل الشركة/.test(st) && /المبيعات/.test(st) && /صافي الربح/.test(st), '');
const V=await pg.evaluate(()=> finStatement('2026-08','isco').V);
ck('المبيعات ٩٠٠ ألف والتكلفة ٦٥٠ ألف',
  Math.round(V.sales)===900000 && Math.round(V.cogs)===650000, JSON.stringify(V));
ck('صافي الربح ٢٥٠ ألف', Math.round(V.profit)===250000, String(Math.round(V.profit)));

// القفل
await pg.evaluate(()=>{ setFinView('isco'); finLock(); }); await pg.waitForTimeout(300);
ck('القفل شغّال', /محمية بكلمة سر/.test(await pg.evaluate(()=>document.body.innerText)));
console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
