// جيفز: ٣ شاشات — الطلبيات (قوايم بالتاريخ) · الاستلام · التسعير
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const APP = process.env.APP_URL;
const errs=[];
const pg = await (await b.newContext()).newPage();
pg.on('pageerror', e=>errs.push(e.message));
pg.on('dialog', d=>d.accept());
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('gvcodes_v1', JSON.stringify([
    {id:'g1',name:'سبلونة 30',code:'M300',perCarton:'20',weight:'0.128',price:'0.522'},
    {id:'g2',name:'سبلونة 40',code:'M400',perCarton:'20',weight:'0.17',price:'0.62'},
    {id:'g3',name:'مقص جيفز',code:'A1', perCarton:'50',weight:'0.4',  price:'3'}]));
  localStorage.setItem('gvOrders_v1', JSON.stringify([
    {id:'o1',name:'طلبية أ',date:'2026-08-17',containers:1,cap:28000,archived:false,
     rows:[{gid:'g1',qty:2500},{gid:'g2',qty:2000},{gid:'g3',qty:500}]},
    {id:'o2',name:'طلبية ب',date:'2026-09-01',containers:1,cap:28000,archived:false,rows:[{gid:'g3',qty:1000}]},
    {id:'o3',name:'طلبية قديمة',date:'2026-07-01',containers:1,cap:28000,archived:true,rows:[{gid:'g1',qty:100}]}]));
});
await pg.goto(APP); await pg.waitForTimeout(1200);

// ── الصفحة الرئيسية أول ما تفتح
check('التطبيق بيفتح على الصفحة الرئيسية', (await pg.evaluate(()=>module))===null, String(await pg.evaluate(()=>module)));

await pg.evaluate(()=>{ module='gv'; render(true); }); await pg.waitForTimeout(400);
const tabs = await pg.evaluate(()=>[...document.querySelectorAll('#main button')].map(x=>x.textContent.trim()).filter(t=>/الطلبيات|الاستلام|التسعير/.test(t)));
check('٣ أيقونات في جيفز', tabs.join('|')==='📋 الطلبيات|📥 الاستلام|💵 التسعير', tabs.join('|'));

// ── الطلبيات مجمّعة بالتاريخ، والمؤرشفة مخفية
let g = await pg.evaluate(()=>gvDateGroups().map(x=>({d:x.date,n:x.orders.length})));
check('مجموعتين بالتاريخ (المؤرشفة مخفية)', g.length===2 && g[0].date!=='2026-07-01', JSON.stringify(g));
check('الأحدث فوق', g[0].d==='2026-09-01', g.map(x=>x.d).join('،'));
g = await pg.evaluate(()=>{ gvShowArch=true; const r=gvDateGroups().map(x=>x.date); gvShowArch=false; return r; });
check('خانة المؤرشفة بتظهرها', g.includes('2026-07-01'), g.join('،'));
const txt0 = await pg.evaluate(()=>document.body.innerText);
check('التاريخ ظاهر كقايمة منسدلة', txt0.includes('2026-08-17') && txt0.includes('2026-09-01'));
// الضغط على الطلبية بيفتح محرّرها
await pg.evaluate(()=>{ toggleGroup('gvd:2026-08-17'); gvSelect('o1'); }); await pg.waitForTimeout(400);
check('الضغط بيفتح أصناف الطلبية', (await pg.evaluate(()=>document.body.innerText)).includes('سبلونة 30'));

// ── الاستلام بالكرتونة أو القطعة
await pg.evaluate(()=>setGvTab(1)); await pg.waitForTimeout(300);
await pg.evaluate(()=>{ gvRecvSet(0,'c','120'); gvRecvSet(1,'q','1950'); gvRecvSet(2,'c','10'); });
await pg.waitForTimeout(200);
const t = await pg.evaluate(()=>gvRecvTot(gvGet()).t);
check('الكرتونة بتتحول قطع: ١٢٠×٢٠=٢٤٠٠', (await pg.evaluate(()=>gvGet().rows[0].recv))===2400);
check('إجمالي المستلم ٤٨٥٠', t.recv===4850, String(t.recv));
check('الفرق ناقص ١٥٠', t.diff===-150, String(t.diff));
check('عدّ الأصناف الناقصة', t.short===2 && t.over===0, t.short+'/'+t.over);
check('الكراتين المستلمة ٢٢٧٫٥', Math.round(t.cartons*10)/10===227.5, String(t.cartons));
await pg.evaluate(()=>gvMarkReceived()); await pg.waitForTimeout(300);
check('الطلبية اتسجّلت مستلمة', (await pg.evaluate(()=>gvGet().received))===true);
check('حالتها بقت «مستلمة»', (await pg.evaluate(()=>gvStatus(gvGet()).t))==='مستلمة');
await pg.evaluate(()=>gvArchive()); await pg.waitForTimeout(300);
check('الأرشفة شغالة', (await pg.evaluate(()=>gvOrders.find(o=>o.id==='o1').archived))===true);
await pg.evaluate(()=>{ gvShowArch=true; gvSelect('o1'); render(true); }); await pg.waitForTimeout(300);

// ── التسعير بياخد المستلم مش المطلوب
await pg.evaluate(()=>setGvTab(2)); await pg.waitForTimeout(300);
await pg.evaluate(()=>{ gvCostSet('invoice','3000'); gvCostSet('bankUsd','50'); gvCostSet('bankEgp','800');
  gvCostSet('customs','12000'); gvCostSet('shipUsd','900'); gvCostSet('rate','48.5'); });
await pg.waitForTimeout(300);
const P = await pg.evaluate(()=>gvPricing(gvGet()));
check('قيمة البضاعة = ٣٠٠٠ × ٤٨٫٥', Math.round(P.goodsEgp)===145500, String(Math.round(P.goodsEgp)));
check('المصاريف = ٥٨٬٨٧٥', Math.round(P.extrasEgp)===58875, String(Math.round(P.extrasEgp)));
check('الإجمالي = ٢٠٤٬٣٧٥', Math.round(P.totalEgp)===204375, String(Math.round(P.totalEgp)));
const mq = P.rows.find(r=>r.code==='A1');
check('التسعير على المستلم (٥٠٠ مش ١٠٠٠)', mq.recv===500, String(mq.recv));
check('تكلفة القطعة = نصيبه ÷ كميته', mq.unitEgp>0 && Math.abs(mq.unitEgp - P.totalEgp*mq.share/500) < 1e-6, String(mq.unitEgp));
check('نصيب المقص بنسبة قيمته', Math.abs(mq.share - 1500/3961.8) < 1e-9, String(mq.share));
check('مجموع تكاليف الأصناف = الإجمالي',
  Math.abs(P.rows.reduce((a,r)=>a+r.costEgp,0) - P.totalEgp) < 1,
  P.rows.reduce((a,r)=>a+r.costEgp,0)+' vs '+P.totalEgp);

// ── التسعير مايظهرش في ورقة الطلبية ولا ورقة الاستلام
const ordHdr = await pg.evaluate(()=>gvModel().header.join('|'));
const recvHdr = await pg.evaluate(()=>gvRecvModel().header.join('|'));
const prcHdr = await pg.evaluate(()=>gvPriceModel().header.join('|'));
check('ورقة الطلبية مفيهاش تكلفة بالجنيه', !/تكلفة/.test(ordHdr), ordHdr);
check('ورقة الاستلام مفيهاش تكلفة ولا أسعار', !/تكلفة|سعر|قيمة/.test(recvHdr), recvHdr);
check('ورقة التسعير هي اللي فيها التكلفة', /تكلفة القطعة/.test(prcHdr) && /تكلفة الكرتونة/.test(prcHdr), prcHdr);
check('ورقة الاستلام فيها المطلوب والمستلم والفرق',
  /المطلوب/.test(recvHdr) && /المستلم/.test(recvHdr) && /الفرق/.test(recvHdr), recvHdr);

// ── التصديرات الثلاثة شغالة
for(const [name, fn] of [['الطلبية','gvModel'],['الاستلام','gvRecvModel'],['التسعير','gvPriceModel']]){
  const n = await pg.evaluate(f=>window[f]().body.length, fn);
  check('نموذج '+name+' بيطلّع سطور', n>0, String(n));
}
const x = await pg.evaluate(()=>{
  let got=null; const real=window.saveAoaXlsx;
  window.saveAoaXlsx=(d,sh,fn,w,o)=>{ got={d,w,fn}; };
  try{ exportGvPriceExcel(); } finally { window.saveAoaXlsx=real; }
  return got;
});
check('إكسل التسعير فيه المصاريف', JSON.stringify(x.d).includes('سعر صرف الدولار'));
check('اسم ملف التسعير', /تسعير_جيفز/.test(x.fn), x.fn);

check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close();
process.exit(fail?1:0);
