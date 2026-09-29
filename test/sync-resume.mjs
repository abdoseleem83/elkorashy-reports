// المزامنة بتتقطع في النص (شاشة الموبايل بتتقفل / النت بيروح) على سيرفر بطيء.
// المفروض المجهود اللي خلص ما يضيعش، والمزامنة اللي بعدها تكمّل من حيث وقفت.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const APP = process.env.APP_URL;
const errs=[];

const SRV = {};                 // «السيرفر» المشترك
let writes = 0, cut = Infinity;  // بعد كام كتابة نقطع الاتصال

async function device(name, seed){
  const ctx = await b.newContext();
  const pg = await ctx.newPage();
  pg.on('pageerror', e=>errs.push(name+': '+e.message));
  await pg.exposeFunction('__srvCall', async (p)=>{
    if(p.action==='set' && ++writes > cut) throw new Error('cut');
    if(p.action==='get') return SRV[p.key]===undefined ? {ok:false,error:'not found'} : {ok:true,value:SRV[p.key]};
    if(p.action==='set'){ SRV[p.key]=p.value; return {ok:true}; }
    if(p.action==='list') return {ok:true, keys:Object.keys(SRV)};
    return {ok:false,error:'unknown action'};
  });
  await pg.addInitScript(({seed})=>{
    window.fetch = async (url, opt)=>{
      const body = opt && opt.body ? JSON.parse(opt.body) : null;
      const p = body || Object.fromEntries(new URL(url,'https://x/').searchParams);
      let d; try{ d = await window.__srvCall(p); }catch(e){ throw new TypeError('Failed to fetch'); }
      return { ok:true, status:200, json: async()=>d };
    };
    for(const [k,v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
  }, {seed});
  await pg.goto(APP); await pg.waitForTimeout(1200);
  return pg;
}

// القطع لازم يتظبط قبل ما الجهاز يفتح — التطبيق بيزامن لوحده أول ما يفتح
cut = 2;

// موبايل فيه ٤ أنواع بيانات اتحطت قبل ما المزامنة تتضاف
const mob = await device('موبايل', {
  items_v1: [{id:'i1',name:'صنف',mainGroup:'ك',unit:'لفة'}],
  units_v1: ['لفة','عود'],
  employees_v1: [{id:'e1',name:'أحمد'}],
  customers_v1: [{id:'c1',name:'عميل'}],
  _sync_: {url:'https://x/exec', token:'', device:'موبايل'},
});

// ── المزامنة التلقائية اشتغلت وهي مقطوعة بعد كتابتين
await mob.waitForTimeout(4000);

const pulled = await mob.evaluate(()=>load('_syncPulled_',{}));
const doneKeys = Object.keys(pulled);
check('المجهود اللي خلص اتسجّل مش ضاع', doneKeys.length>0, 'اتسجّل: '+JSON.stringify(doneKeys));

// أي حاجة متسجّلة مرفوعة لازم تكون فعلاً على السيرفر **و** في الفهرس،
// وإلا الأجهزة التانية عمرها ما هتشوفها وإحنا مش هنرفعها تاني.
const idx = SRV['elk2:index'] ? JSON.parse(SRV['elk2:index']) : {};
for(const k of doneKeys){
  check(k+' موجود فعلاً على السيرفر', SRV['elk2:'+k]!==undefined);
  check(k+' مكتوب في الفهرس', (idx[k]||0)>0);
}

// ── رجوع الشبكة: لازم يكمّل لحد ما مفيش حاجة مستنية
cut = Infinity;
await mob.evaluate(()=>syncNow(true)); await mob.waitForTimeout(3000);
await mob.evaluate(()=>syncNow(true)); await mob.waitForTimeout(3000);
const pend = await mob.evaluate(()=>SYNC_KEYS.filter(k=>(syncRevs[k]||0)>(syncPulled[k]||0)));
check('بعد رجوع الشبكة مفيش حاجة مستنية', pend.length===0, JSON.stringify(pend));

// ── كمبيوتر فاضي لازم ياخد كل حاجة
const pc = await device('كمبيوتر', { _sync_: {url:'https://x/exec', token:'', device:'كمبيوتر'} });
await pc.evaluate(()=>syncNow(true)); await pc.waitForTimeout(3000);
check('الكمبيوتر خد الأصناف',   (await pc.evaluate(()=>load('items_v1',[]))).length===1);
check('الكمبيوتر خد الموظفين',  (await pc.evaluate(()=>load('employees_v1',[]))).length===1);
check('الكمبيوتر خد العملاء',   (await pc.evaluate(()=>load('customers_v1',[]))).length===1);
check('الكمبيوتر خد الوحدات',   (await pc.evaluate(()=>load('units_v1',[]))).length===2);

check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close();
process.exit(fail?1:0);
