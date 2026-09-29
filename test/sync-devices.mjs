// سيناريو المستخدم بالظبط: موبايل مليان بيانات (متحطّة قبل ما المزامنة تتضاف)
// وكمبيوتر فاضي خالص. المفروض بعد المزامنة الاتنين يبقوا زي بعض.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const APP = process.env.APP_URL;
const errs=[];

// «سيرفر» مشترك بين الجهازين — بيتخزّن هنا في node
const SRV = {};
async function device(name, seed){
  const ctx = await b.newContext();
  const pg = await ctx.newPage();
  pg.on('pageerror', e=>errs.push(name+': '+e.message));
  // كل نداء fetch من الصفحة بيتحوّل لنداء على السيرفر بتاعنا في node
  await pg.exposeFunction('__srvCall', async (p)=>{
    if(p.action==='get') return SRV[p.key]===undefined ? {ok:false,error:'not found'} : {ok:true,value:SRV[p.key]};
    if(p.action==='set'){ SRV[p.key]=p.value; return {ok:true}; }
    return {ok:false,error:'unknown action'};
  });
  await pg.addInitScript(({seed})=>{
    window.fetch = async (url, opt)=>{
      const body = opt && opt.body ? JSON.parse(opt.body) : null;
      const p = body || Object.fromEntries(new URL(url,'https://x/').searchParams);
      const d = await window.__srvCall(p);
      return { ok:true, json: async()=>d };
    };
    for(const [k,v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
  }, {seed});
  await pg.goto(APP,{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(700);
  return pg;
}

const أصناف = [
  {name:'حلق مفصلي بدون بار ابيض kom', main:'قطاعات PVC كومبن', sub:'كومبن ابيض', color:'ابيض', unit:'لفه'},
  {name:'حلق مفصلي ببار 6 سم بيج kom', main:'قطاعات PVC كومبن', sub:'كومبن بيج', color:'بيج', unit:'لفه'}
];

// ═══ ١) الموبايل: بيانات من غير أي ختم (زي ما هي قبل ما المزامنة تتضاف) ═══
const موبايل = await device('موبايل', { items_v1: أصناف, gvcodes_v1: [{code:'G1',name:'كود'}] });
const بذرة = await موبايل.evaluate(()=> ({
  ختم: JSON.parse(localStorage.getItem('_syncRevs_')||'{}'),
  متختوم: load('_syncSeeded_', false)
}));
check('البيانات القديمة اتختمت أول ما التطبيق فتح',
  بذرة.ختم.items_v1===1 && بذرة.ختم.gvcodes_v1===1, JSON.stringify(بذرة.ختم));
check('والختم بيتعمل مرة واحدة بس', بذرة.متختوم===true);

const رفع = await موبايل.evaluate(async()=>{ await syncNow(true);
  return { ختم: JSON.parse(localStorage.getItem('_syncRevs_')||'{}') }; });
check('الموبايل رفع الأصناف فعلاً', SRV['elk2:items_v1']!==undefined,
  'اللي على السيرفر: '+Object.keys(SRV).join(', '));
check('ورفع أكواد جيفز كمان', SRV['elk2:gvcodes_v1']!==undefined);
check('والفهرس اتكتب', SRV['elk2:index']!==undefined);
check('والمرفوع هو نفس اللي على الجهاز',
  JSON.parse(SRV['elk2:items_v1']||'[]').length===2, SRV['elk2:items_v1']||'');

// ═══ ٢) الكمبيوتر: فاضي خالص ═══
const كمبيوتر = await device('كمبيوتر', {});
const نزل = await كمبيوتر.evaluate(async()=>{
  const قبل = JSON.parse(localStorage.getItem('items_v1')||'[]').length;
  await syncNow(true);
  return { قبل, بعد: JSON.parse(localStorage.getItem('items_v1')||'[]').length,
           في_الذاكرة: items.length, أكواد: gvcodes.length };
});
check('الكمبيوتر كان فاضي', نزل.قبل===0);
check('ونزّل الأصناف من السيرفر', نزل.بعد===2, String(نزل.بعد));
check('والشاشة شايفاها فعلاً (مش محتاج يقفل ويفتح)', نزل.في_الذاكرة===2, String(نزل.في_الذاكرة));
check('وأكواد جيفز كمان', نزل.أكواد===1, String(نزل.أكواد));

// ═══ ٣) تعديل على الكمبيوتر يرجع للموبايل ═══
await كمبيوتر.evaluate(async()=>{
  items.push({name:'صنف اتضاف من الكمبيوتر', main:'قطاعات PVC كومبن', sub:'كومبن ابيض', color:'ابيض', unit:'لفه'});
  save('items_v1', items);   // بتجدول مزامنة تلقائية بعد ٤ ثواني كمان
  // ⚠️ لازم نستنى المزامنة تخلص فعلاً: syncNow وهي مشغولة بترجع على طول
  // وبتسيب الشغل لنداء تاني — لو مستنيناش، الاختبار بيقرا قبل ما الرفع يتم
  for(let i=0;i<40 && (syncBusy || syncAgain);i++) await new Promise(r=>setTimeout(r,100));
  await syncNow(true);
  for(let i=0;i<40 && (syncBusy || syncAgain);i++) await new Promise(r=>setTimeout(r,100));
});
const رجوع = await موبايل.evaluate(async()=>{ await syncNow(true);
  return { n: items.length, revs: syncRevs, pulled: syncPulled }; });
console.log('   فهرس السيرفر:', SRV['elk2:index']);
console.log('   ختم الموبايل:', JSON.stringify(رجوع.revs), 'نزّل:', JSON.stringify(رجوع.pulled));
check('التعديل من الكمبيوتر وصل الموبايل', رجوع.n===3, String(رجوع.n));

// ═══ ٤) جهاز فاضي مابيمسحش شغل السيرفر ═══
const فاضي = await device('فاضي', {});
const بعد_الفاضي = await فاضي.evaluate(async()=>{ await syncNow(true); return items.length; });
check('جهاز فاضي بينزّل كل حاجة', بعد_الفاضي===3, String(بعد_الفاضي));
check('والسيرفر لسه فيه الـ٣ أصناف', JSON.parse(SRV['elk2:items_v1']||'[]').length===3,
  String(JSON.parse(SRV['elk2:items_v1']||'[]').length));

// ═══ ٥) زرار «ارفع كل اللي على الجهاز ده» ═══
const دفع = await موبايل.evaluate(async()=>{
  window.confirm = ()=>true; window.closeSheet = ()=>{};
  items.push({name:'صنف من زرار الرفع', main:'قطاعات PVC كومبن', sub:'كومبن بيج', color:'بيج', unit:'لفه'});
  try{ localStorage.setItem('items_v1', JSON.stringify(items)); }catch(e){}   // من غير ختم عمدًا
  await syncPushAll();
  return items.length;
});
check('زرار الرفع بيرفع حتى اللي مالوش ختم',
  JSON.parse(SRV['elk2:items_v1']||'[]').length===4,
  String(JSON.parse(SRV['elk2:items_v1']||'[]').length));

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
