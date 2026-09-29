// الربط مع برنامج الموزعين: ⬆️ رفع رصيد طنطا · ⬇️ جلب الطلبات وخصمها
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const APP = process.env.APP_URL;
const errs=[];

// «برنامج الطلبات» الوهمي
const ORD = {
  MANAGE_PIN:'1111', ADMIN_PIN:'2222',
  catalog:['باب كامل 80 سم A05','كرافت لاين 25 ابيض','حاجة عندهم بس'],
  stock:{}, uploads:0,
  orders:[
    {id:'o1', orderNo:'101', distName:'موزع طنطا', status:'تم استلام الطلب', ts:Date.now(),
     items:[{name:'باب كامل 80 سم A05', qty:3},{name:'كرافت لاين 25 ابيض', qty:10}]},
    {id:'o2', orderNo:'102', distName:'موزع المحلة', status:'تم تنفيذ الطلب', ts:Date.now(),
     items:[{name:'باب كامل 80 سم A05', qty:99}]},   // منفّذ — المفروض ما يتحسبش
  ],
};

const ctx = await b.newContext();
const pg = await ctx.newPage();
pg.on('pageerror', e=>errs.push(e.message));
await pg.exposeFunction('__ord', async (url, body)=>{
  const u = new URL(url, 'https://x/');
  const a = body ? body.action : u.searchParams.get('action');
  if(a==='manageLogin') return u.searchParams.get('pin')===ORD.MANAGE_PIN?{ok:true,token:'MT'}:{ok:false,reason:'wrong_pin'};
  if(a==='adminLogin')  return u.searchParams.get('pin')===ORD.ADMIN_PIN ?{ok:true,token:'AT'}:{ok:false,reason:'wrong_pin'};
  if(a==='catalog') return {items: ORD.catalog.map(n=>({name:n}))};
  if(a==='lookup'){ if(u.searchParams.get('token')!=='AT') return {ok:false,error:'unauthorized'}; return ORD.orders; }
  if(a==='manageUploadCatalog'){
    if(body.token!=='MT') return {ok:false,error:'unauthorized'};
    ORD.uploads++;
    let updated=0; const notFound=[];
    (body.rows||[]).forEach(r=> ORD.catalog.includes(r.name) ? (ORD.stock[r.name]=r.stock, updated++) : notFound.push(r.name));
    return {ok:true, updated, notFound};
  }
  return {ok:false,error:'unknown action'};
});
await pg.addInitScript(()=>{
  const real = window.fetch;
  window.fetch = async (url, opt)=>{
    if(String(url).indexOf('script.google.com')<0) return real(url,opt);
    const body = opt && opt.body ? JSON.parse(opt.body) : null;
    const d = await window.__ord(String(url), body);
    return { ok:true, status:200, json: async()=>d };
  };
  localStorage.setItem('_sync_', JSON.stringify({off:true}));   // المزامنة برّه الاختبار ده
  localStorage.setItem('warehouses_v1', JSON.stringify([{id:'w1',name:'طنطا',type:'مخزن رئيسي'},{id:'w2',name:'الاسكندرية',type:'مخزن رئيسي'}]));
  localStorage.setItem('items_v1', JSON.stringify([
    {id:'i1',name:'باب كامل 80 سم A05',mainGroup:'ابواب',unit:'قطعة'},
    {id:'i2',name:'كرافت لاين 25 ابيض',mainGroup:'كرافت',unit:'لفة'},
    {id:'i3',name:'صنف عندنا بس',mainGroup:'كرافت',unit:'لفة'}]));
  localStorage.setItem('whStock_v1', JSON.stringify({w1:{
    'باب كامل 80 سم A05':{balance:12}, 'كرافت لاين 25 ابيض':{balance:100}, 'صنف عندنا بس':{balance:5}}}));
});
await pg.goto(APP); await pg.waitForTimeout(1200);

// تبويب «الموزعين» يظهر في طنطا بس
await pg.evaluate(()=>{ module='warehouses'; save('_whTab_','w1'); save('_whSub_',3); render(true); });
await pg.waitForTimeout(400);
check('تبويب الموزعين ظاهر في طنطا', (await pg.evaluate(()=>document.body.innerText)).includes('ابعت رصيد طنطا'));
await pg.evaluate(()=>{ save('_whTab_','w2'); render(true); });
await pg.waitForTimeout(300);
check('مش ظاهر في مخزن تاني', !(await pg.evaluate(()=>document.body.innerText)).includes('ابعت رصيد طنطا'));
await pg.evaluate(()=>{ save('_whTab_','w1'); save('_whSub_',3); render(true); });
await pg.waitForTimeout(300);

// ── رقم سري غلط = رسالة مفهومة، ومفيش رفع
await pg.evaluate(()=>{ document.querySelector('#ord_mpin').value='0000'; });
pg.on('dialog', d=>d.accept());
await pg.evaluate(()=>ordSendStock()); await pg.waitForTimeout(600);
check('رقم غلط = رسالة واضحة', (await pg.evaluate(()=>document.querySelector('#ordMsg').innerText)).includes('غلط'));
check('مفيش رفع حصل برقم غلط', ORD.uploads===0);

// ── ⬆️ الرفع الصح
await pg.evaluate(()=>{ document.querySelector('#ord_mpin').value='1111'; });
await pg.evaluate(()=>ordSendStock()); await pg.waitForTimeout(800);
check('الرصيد اترفع', ORD.stock['باب كامل 80 سم A05']===12 && ORD.stock['كرافت لاين 25 ابيض']===100,
  JSON.stringify(ORD.stock));
check('الصنف اللي مش عندهم اتبلّغ عنه', (await pg.evaluate(()=>document.querySelector('#ordMsg').innerText)).includes('صنف عندنا بس'));

// ── 🔍 المطابقة: اربط الصنف اللي مش عندهم أو تجاهله
await pg.evaluate(()=>ordSkip('صنف عندنا بس')); await pg.waitForTimeout(300);
ORD.stock = {}; 
await pg.evaluate(()=>{ save('_whSub_',3); render(true); });
await pg.waitForTimeout(300);
await pg.evaluate(()=>{ document.querySelector('#ord_mpin').value='1111'; ordSendStock(); }); await pg.waitForTimeout(800);
check('المتجاهَل ما اتبعتش تاني', !(await pg.evaluate(()=>document.querySelector('#ordMsg').innerText)).includes('صنف عندنا بس'));

// ── ⬇️ جلب الطلبات
await pg.evaluate(()=>{ document.querySelector('#ord_apin').value='2222'; });
await pg.evaluate(()=>ordGetOrders()); await pg.waitForTimeout(900);
const txt = await pg.evaluate(()=>document.body.innerText);
check('الطلبات وصلت', txt.includes('موزع طنطا') && txt.includes('101'));
check('المطلوب من الطلبات المفتوحة ظهر', txt.includes('المطلوب من الطلبات المفتوحة'));

// المنفّذ ما يتحسبش: باب = ٣ (مش ١٠٢)
const dem = await pg.evaluate(()=>ordDemand(true));
check('الطلب المنفّذ ما اتحسبش', dem['باب كامل 80 سم A05']===3, JSON.stringify(dem));
check('الكرافت اتحسب صح', dem['كرافت لاين 25 ابيض']===10);

// ── ➖ الخصم من الرصيد
await pg.evaluate(()=>ordDeductStock()); await pg.waitForTimeout(600);
const st = await pg.evaluate(()=>load('whStock_v1',{}).w1);
check('الباب اتخصم ١٢-٣=٩', st['باب كامل 80 سم A05'].balance===9, JSON.stringify(st['باب كامل 80 سم A05']));
check('الكرافت اتخصم ١٠٠-١٠=٩٠', st['كرافت لاين 25 ابيض'].balance===90);
check('الصنف اللي مالوش طلب ما اتلمسش', st['صنف عندنا بس'].balance===5);

check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close();
process.exit(fail?1:0);
