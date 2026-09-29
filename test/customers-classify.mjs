import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
const URL=process.env.APP_URL;
const b=await chromium.launch(); const pg=await b.newPage();
let bad=0; pg.on('pageerror',e=>{bad++;console.log('❌ JS:',e.message)});
await pg.goto(URL); await pg.waitForTimeout(400);
// زرع عملاء من غير تصنيف
await pg.evaluate(()=>{
  const cs=[]; for(let i=1;i<=30;i++) cs.push({id:'c'+i,name:'عميل '+i,cls:''});
  localStorage.setItem('customers_v1', JSON.stringify(cs));
});
await pg.reload(); await pg.waitForTimeout(400);
await pg.evaluate(()=>{ switchModule('sales'); });
await pg.waitForTimeout(200);
await pg.evaluate(()=>{ setSalesTab(1); });
await pg.waitForTimeout(300);
const chips=await pg.locator('#cls_c1 .clschip').count();
console.log(chips===5?'✅ 5 تصنيفات قدام العميل':'❌ عدد التصنيفات '+chips);
if(chips!==5) bad++;
// تعليم تصنيفين
await pg.locator('#cls_c1 .clschip[data-cls="موزع"]').click();
await pg.locator('#cls_c2 .clschip[data-cls="عميل ابواب"]').click();
await pg.waitForTimeout(150);
const pend=await pg.locator('#cls_c1 .clschip.pend').count();
console.log(pend===1?'✅ التصنيف المعلّم باين أصفر':'❌ مفيش علامة'); if(pend!==1) bad++;
const btn=await pg.locator('#clsSaveBtn').textContent();
console.log(/\(2\)/.test(btn)?'✅ زرار الحفظ بيعدّ 2':'❌ الزرار: '+btn); if(!/\(2\)/.test(btn)) bad++;
// لسه ماتحفظش
let saved=await pg.evaluate(()=> JSON.parse(localStorage.getItem('customers_v1')).find(c=>c.id==='c1').cls);
console.log(saved===''?'✅ ماتحفظش قبل الضغط':'❌ اتحفظ بدري'); if(saved!=='') bad++;
// إلغاء بالضغط تاني
await pg.locator('#cls_c2 .clschip[data-cls="عميل ابواب"]').click();
await pg.waitForTimeout(100);
const b2=await pg.locator('#clsSaveBtn').textContent();
console.log(/\(1\)/.test(b2)?'✅ ضغطة تانية بتلغي':'❌ '+b2); if(!/\(1\)/.test(b2)) bad++;
// حفظ
await pg.locator('#clsSaveBtn').click(); await pg.waitForTimeout(400);
saved=await pg.evaluate(()=> JSON.parse(localStorage.getItem('customers_v1')).find(c=>c.id==='c1').cls);
console.log(saved==='موزع'?'✅ اتحفظ بعد الضغط':'❌ '+saved); if(saved!=='موزع') bad++;
const g=await pg.evaluate(()=> [...document.querySelectorAll('.grp-h span')].map(x=>x.textContent).join('|'));
console.log(/موزع/.test(g)?'✅ العميل اتنقل لمجموعة موزع':'❌ '+g); if(!/موزع/.test(g)) bad++;
// أيقونة التعديل لسه موجودة وشغالة
await pg.evaluate(()=> editCustomer('c1')); await pg.waitForTimeout(200);
const hasSel=await pg.locator('#c_cls').count();
console.log(hasSel===1?'✅ أيقونة التعديل شغالة':'❌ شيت التعديل مفتحش'); if(hasSel!==1) bad++;
// المكان ما يرجعش لفوق بعد التعليم
await pg.evaluate(()=> closeSheet()); await pg.waitForTimeout(200);
await pg.evaluate(()=>{ document.querySelector('#main').scrollTop = 400; });
await pg.locator('#cls_c20 .clschip[data-cls="مستبعد"]').click();
await pg.waitForTimeout(150);
const top=await pg.evaluate(()=> document.querySelector('#main').scrollTop);
console.log(top>200?'✅ الشاشة ما رجعتش لفوق ('+top+')':'❌ رجعت لفوق '+top); if(top<=200) bad++;
console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
