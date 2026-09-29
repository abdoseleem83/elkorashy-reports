// جهازين بيشتغلوا في نفس الوقت على نفس الملف بس في أصناف مختلفة:
// المفروض الشغل يتدمج من غير تنبيه ومن غير ما حاجة تضيع.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const APP = process.env.APP_URL;
const errs=[], alerts=[];
const SRV = {};
async function device(name, seed){
  const ctx = await b.newContext();
  const pg = await ctx.newPage();
  pg.on('pageerror', e=>errs.push(name+': '+e.message));
  pg.on('dialog', d=>{ alerts.push(name+': '+d.message()); d.accept(); });
  await pg.exposeFunction('__srvCall', async (p)=>{
    if(p.action==='get') return SRV[p.key]===undefined ? {ok:false,error:'not found'} : {ok:true,value:SRV[p.key]};
    if(p.action==='set'){ SRV[p.key]=p.value; return {ok:true}; }
    return {ok:false,error:'unknown action'};
  });
  await pg.addInitScript(({seed})=>{
    window.fetch = async (url, opt)=>{
      const body = opt && opt.body ? JSON.parse(opt.body) : null;
      const p = body || Object.fromEntries(new URL(url,'https://x/').searchParams);
      return { ok:true, status:200, json: async()=> await window.__srvCall(p) };
    };
    for(const [k,v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
  }, {seed});
  await pg.goto(APP); await pg.waitForTimeout(1100);
  return pg;
}
const cfg = {url:'https://x/exec', token:'', device:'d'};
const items = [
  {id:'i1',name:'كرافت 25',mainGroup:'قطاعات كرافت لاين',unit:'لفة'},
  {id:'i2',name:'كومبن 30',mainGroup:'قطاعات PVC كومبن',unit:'عود'},
  {id:'i3',name:'زاوية اكسا',mainGroup:'اكسسورات pvc اكسا',unit:'قطعة'}];
const seed = { _sync_:cfg, warehouses_v1:[{id:'w1',name:'طنطا'}], items_v1:items };

// الجهازين يبدأوا من نفس النقطة
const A = await device('A', seed); await A.evaluate(()=>syncNow(true)); await A.waitForTimeout(700);
const B = await device('B', seed); await B.evaluate(()=>syncNow(true)); await B.waitForTimeout(700);
await A.evaluate(()=>syncNow(true)); await A.waitForTimeout(700);

// ── كل جهاز يكتب نواقص لصنف مختلف، من غير ما يزامنوا بينهم
await A.evaluate(()=>{ setShortQty('w1','كرافت 25','q1','5'); });
await B.evaluate(()=>{ setShortQty('w1','زاوية اكسا','q1','9'); });
await A.evaluate(()=>syncNow(true)); await A.waitForTimeout(800);
await B.evaluate(()=>syncNow(true)); await B.waitForTimeout(900);
await A.evaluate(()=>syncNow(true)); await A.waitForTimeout(900);

const sa = await A.evaluate(()=>load('whShortage_v1',{}).w1 || {});
const sb = await B.evaluate(()=>load('whShortage_v1',{}).w1 || {});
check('A شايف نواقصه', sa['كرافت 25'] && sa['كرافت 25'].q1==='5', JSON.stringify(sa));
check('A شايف نواقص B كمان', sa['زاوية اكسا'] && sa['زاوية اكسا'].q1==='9', JSON.stringify(sa));
check('B شايف الاتنين', sb['كرافت 25'] && sb['زاوية اكسا'], JSON.stringify(sb));
check('مفيش رسالة تعارض قطعت الشغل', alerts.length===0, alerts.join(' | '));
check('مفيش نسخ احتياطية (مفيش تعارض حقيقي)',
  (await A.evaluate(()=>Object.keys(localStorage).filter(k=>k.indexOf('_backup_')===0).length))===0);

// ── تعديل ملفين مختلفين في نفس الوقت (زي اللي في الصورة)
await A.evaluate(()=>{ whStock={w1:{'كرافت 25':{balance:100}}}; save('whStock_v1',whStock); });
await B.evaluate(()=>{ setShortQty('w1','كومبن 30','q2','40'); });
await A.evaluate(()=>syncNow(true)); await A.waitForTimeout(800);
await B.evaluate(()=>syncNow(true)); await B.waitForTimeout(900);
await A.evaluate(()=>syncNow(true)); await A.waitForTimeout(900);
check('الرصيد وصل للجهاز التاني', (await B.evaluate(()=>load('whStock_v1',{}).w1||{}))['كرافت 25']?.balance===100);
check('نواقص B وصلت للأول', (await A.evaluate(()=>load('whShortage_v1',{}).w1||{}))['كومبن 30']?.q2==='40');
check('لسه مفيش تنبيه', alerts.length===0, alerts.join(' | '));

// ── تعارض حقيقي: نفس الصنف بالظبط من الجهازين
await A.evaluate(()=>{ setShortQty('w1','كرافت 25','q1','11'); });
await B.evaluate(()=>{ setShortQty('w1','كرافت 25','q1','22'); });
await A.evaluate(()=>syncNow(true)); await A.waitForTimeout(800);
await B.evaluate(()=>syncNow(true)); await B.waitForTimeout(900);
await A.evaluate(()=>syncNow(true)); await A.waitForTimeout(900);
const fa = (await A.evaluate(()=>load('whShortage_v1',{}).w1||{}))['كرافت 25'];
const fb = (await B.evaluate(()=>load('whShortage_v1',{}).w1||{}))['كرافت 25'];
check('الجهازين اتفقوا على قيمة واحدة', JSON.stringify(fa)===JSON.stringify(fb), JSON.stringify(fa)+' vs '+JSON.stringify(fb));
check('التعارض الحقيقي اتحفظ نسخة احتياطية',
  (await B.evaluate(()=>Object.keys(localStorage).filter(k=>k.indexOf('_backup_')===0).length))>0);
check('والتنبيه فضل من غير نافذة تقطع الشغل', alerts.length===0, alerts.join(' | '));
check('باقي الأصناف ما اتأثرتش',
  (await A.evaluate(()=>load('whShortage_v1',{}).w1||{}))['زاوية اكسا']?.q1==='9');

// ── الحذف بيوصل: A يشيل صنف من الطلب
await A.evaluate(()=>{ unmarkShort('w1','زاوية اكسا'); });
await A.evaluate(()=>syncNow(true)); await A.waitForTimeout(800);
await B.evaluate(()=>syncNow(true)); await B.waitForTimeout(900);
check('الحذف وصل للجهاز التاني', !(await B.evaluate(()=>load('whShortage_v1',{}).w1||{}))['زاوية اكسا'],
  JSON.stringify(await B.evaluate(()=>load('whShortage_v1',{}).w1||{})));
check('واللي مااتحذفش فضل', !!(await B.evaluate(()=>load('whShortage_v1',{}).w1||{}))['كومبن 30']);

// ── إضافة صنف جديد من كل جهاز: الاتنين يفضلوا
await A.evaluate(()=>{ items=[...items,{id:'a9',name:'صنف A',mainGroup:'قطاعات كرافت لاين',unit:'لفة'}];
  itemsByName={}; items.forEach(i=>itemsByName[i.name]=i); save('items_v1',items); });
await B.evaluate(()=>{ items=[...items,{id:'b9',name:'صنف B',mainGroup:'اكسسورات pvc اكسا',unit:'قطعة'}];
  itemsByName={}; items.forEach(i=>itemsByName[i.name]=i); save('items_v1',items); });
await A.evaluate(()=>syncNow(true)); await A.waitForTimeout(800);
await B.evaluate(()=>syncNow(true)); await B.waitForTimeout(900);
await A.evaluate(()=>syncNow(true)); await A.waitForTimeout(900);
const names = await A.evaluate(()=>load('items_v1',[]).map(i=>i.name));
check('الصنفين الجداد الاتنين موجودين', names.includes('صنف A') && names.includes('صنف B'), names.join('، '));
check('الأصناف القديمة ما ضاعتش', names.length===5, names.length+' صنف');

// ── قايمة الوحدات: كل جهاز يضيف وحدة → الاتنين يفضلوا
await A.evaluate(()=>{ units=[...units,'شكارة']; save('units_v1',units); });
await B.evaluate(()=>{ units=[...units,'طبلية']; save('units_v1',units); });
await A.evaluate(()=>syncNow(true)); await A.waitForTimeout(800);
await B.evaluate(()=>syncNow(true)); await B.waitForTimeout(900);
await A.evaluate(()=>syncNow(true)); await A.waitForTimeout(900);
const ua = await A.evaluate(()=>load('units_v1',[]));
check('الوحدتين الجداد الاتنين موجودين', ua.includes('شكارة') && ua.includes('طبلية'), ua.join('، '));
check('الوحدات الأصلية ما ضاعتش', ua.includes('لفة') && ua.includes('عود'), ua.join('، '));
check('الجهازين متطابقين', JSON.stringify(ua)===JSON.stringify(await B.evaluate(()=>load('units_v1',[]))));

// ── الحذف من قايمة الوحدات بيوصل ومابيرجعش تاني
await A.evaluate(()=>{ units=units.filter(u=>u!=='شكارة'); save('units_v1',units); });
await A.evaluate(()=>syncNow(true)); await A.waitForTimeout(800);
await B.evaluate(()=>syncNow(true)); await B.waitForTimeout(900);
await A.evaluate(()=>syncNow(true)); await A.waitForTimeout(900);
check('المحذوف اتشال من الجهازين', !(await A.evaluate(()=>load('units_v1',[]))).includes('شكارة')
  && !(await B.evaluate(()=>load('units_v1',[]))).includes('شكارة'),
  (await B.evaluate(()=>load('units_v1',[]))).join('، '));
check('والباقي ما اتأثرش', (await B.evaluate(()=>load('units_v1',[]))).includes('طبلية'));

check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close();
process.exit(fail?1:0);
