import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
const URL=process.env.APP_URL;
const b=await chromium.launch(); const pg=await b.newPage();
let bad=0; pg.on('pageerror',e=>{bad++;console.log('❌ JS:',e.message)});
await pg.goto(URL); await pg.waitForTimeout(400);
await pg.evaluate(()=>{
  localStorage.setItem('customers_v1', JSON.stringify([
    {id:'d1',name:'موزع أ',cls:'موزع'},
    {id:'d2',name:'موزع ب',cls:'موزع'},
    {id:'w1',name:'عميل جملة',cls:'مبيعات جملة'},
    {id:'x1',name:'مستبعد واحد',cls:'مستبعد'},
    {id:'u1',name:'مش مصنف',cls:''}]));
  localStorage.setItem('monthlySales_v1', JSON.stringify({
    '2026-01':{'موزع أ':100000,'موزع ب':50000,'عميل جملة':20000,'مستبعد واحد':9e9,'مش مصنف':9e9},
    '2026-02':{'موزع أ':150000,'موزع ب':25000,'عميل جملة':20000,'مستبعد واحد':9e9,'مش مصنف':9e9}}));
});
await pg.reload(); await pg.waitForTimeout(400);
await pg.evaluate(()=>{ switchModule('sales'); }); await pg.waitForTimeout(150);
await pg.evaluate(()=>{ setSalesTab(2); }); await pg.waitForTimeout(200);
// الأيقونة موجودة
const hasBtn=await pg.locator('button', {hasText:'مقارنة شهور'}).count();
console.log(hasBtn?'✅ أيقونة «مقارنة شهور» موجودة':'❌ الأيقونة مش موجودة'); if(!hasBtn) bad++;
await pg.evaluate(()=>{ setSalesReport('cmpmo'); }); await pg.waitForTimeout(300);
const d=await pg.evaluate(()=> buildMonthCompare());
console.log(d.a==='2026-01'&&d.b==='2026-02'?'✅ بيختار آخر شهرين لوحده':'❌ '+d.a+'/'+d.b);
if(!(d.a==='2026-01'&&d.b==='2026-02')) bad++;
const names=d.list.map(r=>r.name).sort().join(',');
console.log(names==='مبيعات جملة,موزع أ,موزع ب'?'✅ غير المصنف والمستبعد مستبعدين، والجملة مجمّعة باسم تصنيفها':'❌ '+names);
if(names!=='مبيعات جملة,موزع أ,موزع ب') bad++;
const a=d.list.find(r=>r.name==='موزع أ'), b2=d.list.find(r=>r.name==='موزع ب');
console.log(a.diff===50000&&a.pct===50?'✅ الزيادة والنسبة صح (+50,000 / +50%)':'❌ '+a.diff+'/'+a.pct);
if(!(a.diff===50000&&a.pct===50)) bad++;
console.log(b2.diff===-25000&&b2.pct===-50?'✅ النقص صح (−25,000 / −50%)':'❌ '+b2.diff+'/'+b2.pct);
if(!(b2.diff===-25000&&b2.pct===-50)) bad++;
console.log(d.ta===170000&&d.tb===195000?'✅ الإجماليات صح':'❌ '+d.ta+'/'+d.tb);
if(!(d.ta===170000&&d.tb===195000)) bad++;
// الترتيب تنازلي على الشهر التاني
console.log(d.list[0].name==='موزع أ'?'✅ مرتّب تنازلي':'❌ '+d.list[0].name);
if(d.list[0].name!=='موزع أ') bad++;
// ألوان الشاشة
const greens=await pg.evaluate(()=> [...document.querySelectorAll('table.rep td')]
  .filter(t=>/^\+/.test(t.textContent)).length);
const reds=await pg.evaluate(()=> [...document.querySelectorAll('table.rep td')]
  .filter(t=>/^−/.test(t.textContent)).length);
console.log(greens>=2&&reds>=1?'✅ إشارات + و − ظاهرة':'❌ +'+greens+' −'+reds);
if(!(greens>=2&&reds>=1)) bad++;
// تغيير الشهر من القائمة
await pg.evaluate(()=> setCmpMo('a','2026-02')); await pg.waitForTimeout(300);
const d2=await pg.evaluate(()=> buildMonthCompare());
console.log(d2.a==='2026-02'?'✅ اختيار الشهر شغّال':'❌ '+d2.a); if(d2.a!=='2026-02') bad++;
// النموذج المصدَّر
await pg.evaluate(()=> setCmpMo('a','2026-01')); await pg.waitForTimeout(300);
const md=await pg.evaluate(()=> repMonthCompareModel());
console.log(md.header.length===5&&md.sign[3]==='auto'&&md.sign[4]==='auto'
  ?'✅ نموذج التصدير فيه أعمدة الفرق والنسبة ملوّنة':'❌ '+JSON.stringify(md.header)+JSON.stringify(md.sign));
if(!(md.header.length===5&&md.sign[3]==='auto'&&md.sign[4]==='auto')) bad++;
const last=md.body[md.body.length-1];
console.log(last.cells[4]==='+15%'?'✅ نسبة الإجمالي +15%':'❌ '+last.cells[4]);
if(last.cells[4]!=='+15%') bad++;
// شريط التصدير ظاهر فعلاً
const vis=await pg.evaluate(()=>{
  const btns=[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('إكسل'));
  if(!btns.length) return 'مفيش';
  const r=btns[0].getBoundingClientRect();
  const el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
  return btns[0].contains(el)||el===btns[0] ? 'ok' : 'متغطي';
});
console.log(vis==='ok'?'✅ شريط التصدير ظاهر':'❌ '+vis); if(vis!=='ok') bad++;
// شهر واحد بس = رسالة واضحة مش شاشة فاضية
await pg.evaluate(()=>{
  const ms=JSON.parse(localStorage.getItem('monthlySales_v1')); delete ms['2026-02'];
  localStorage.setItem('monthlySales_v1', JSON.stringify(ms));
});
await pg.reload(); await pg.waitForTimeout(400);
await pg.evaluate(()=>{ switchModule('sales'); }); await pg.waitForTimeout(150);
await pg.evaluate(()=>{ setSalesTab(2); setSalesReport('cmpmo'); }); await pg.waitForTimeout(300);
const txt=await pg.evaluate(()=> document.body.innerText);
console.log(/شهرين على الأقل/.test(txt)?'✅ رسالة واضحة لما يكون فيه شهر واحد':'❌ مفيش رسالة');
if(!/شهرين على الأقل/.test(txt)) bad++;
console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
