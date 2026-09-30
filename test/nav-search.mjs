// 🔍 البحث في كل حاجة + مربعات الأرقام + القايمة الجانبية على الكمبيوتر
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let fail=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(ok?'':'  — '+x)); if(!ok) fail++; };
const b=await chromium.launch(); const errs=[];
const seed=()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('items_v1', JSON.stringify([{id:'i1',name:'ضلفه شباك مفصلي كرافت بيج',mainGroup:'قطاعات كرافت لاين',subGroup:'بيج',unit:'لفة'},
    {id:'i2',name:'سيلكون ماستيك ابيض',mainGroup:'اكسسوارات pvc اكسا',unit:'كرتونة'}]));
  localStorage.setItem('warehouses_v1', JSON.stringify([{id:'w1',name:'طنطا'},{id:'w2',name:"اسكندرية 'ب'"}]));
  localStorage.setItem('whStock_v1', JSON.stringify({w1:{'ضلفه شباك مفصلي كرافت بيج':{balance:12}}}));
  localStorage.setItem('customers_v1', JSON.stringify([{id:'c1',name:'مؤسسة الأمل للتجارة',cls:'موزع'},{id:'c2',name:'جديد',cls:''}]));
  localStorage.setItem('monthlySales_v1', JSON.stringify({'2026-08':{'مؤسسة الأمل للتجارة':2500000}}));
  localStorage.setItem('employees_v1', JSON.stringify([{id:'e1',name:'محمد فوزي',branch:'طنطا',salary:11000}]));
};
// ── موبايل
let pg=await (await b.newContext({viewport:{width:360,height:780}})).newPage();
pg.on('pageerror',e=>errs.push(e.message)); await pg.addInitScript(seed);
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(700);
ck('زرار 🔍 ظاهر في الهيدر على الموبايل', await pg.locator('#hdrSearch').isVisible());
ck('القايمة مقفولة على الموبايل (درج برّه الشاشة)', !(await pg.locator('.nav-search').isVisible()));
await pg.locator('#menuBtn').click(); await pg.waitForTimeout(300);
let db=await pg.locator('#nav').boundingBox();
ck('☰ بيفتح الدرج من اليمين بنفس شكل الكمبيوتر', await pg.locator('.nav-search').isVisible() && db.x+db.width>=358 && db.width<=302, JSON.stringify(db));
await pg.locator('#nav .nav-btn', {hasText:'المبيعات'}).click(); await pg.waitForTimeout(300);
ck('اختيار قسم بيقفل الدرج ويفتح القسم', await pg.evaluate(()=> module==='sales' && !document.body.classList.contains('menu-open')));
await pg.locator('#menuBtn').click(); await pg.waitForTimeout(300);
ck('تحت القسم المفتوح شاشاته في الدرج', (await pg.locator('#nav .nav-sub').allInnerTexts()).some(x=>/موزعين قطاعات/.test(x)));
await pg.locator('.menu-bd').click({position:{x:20,y:400}}); await pg.waitForTimeout(300);
ck('الضغط برّه الدرج بيقفله', await pg.evaluate(()=> !document.body.classList.contains('menu-open')));
await pg.locator('#hdrLogo').click(); await pg.waitForTimeout(200);
ck('الضغط على اسم التطبيق بيرجّع للرئيسية', await pg.evaluate(()=> module===null));
await pg.locator('#hdrSearch').click(); await pg.waitForTimeout(150);
await pg.fill('#srch','كرافت'); await pg.waitForTimeout(120);
let t=await pg.locator('#srch_r').innerText();
ck('بيلاقي الصنف ومعاه رصيده', /ضلفه شباك مفصلي كرافت بيج/.test(t) && /رصيد 12/.test(t), t.slice(0,200));
await pg.locator('#srch_r .srch-r', {hasText:'ضلفه شباك'}).click(); await pg.waitForTimeout(200);
ck('فتح الأصناف ومفلتر على الصنف', await pg.evaluate(()=> module==='items' && load('_itemsTab_',null)===0 && q==='ضلفه شباك مفصلي كرافت بيج'));
await pg.evaluate(()=> openSearch()); await pg.fill('#srch','الامل'); await pg.waitForTimeout(120);
ck('البحث بيتجاهل الهمزة (الامل = الأمل)', /مؤسسة الأمل/.test(await pg.locator('#srch_r').innerText()));
await pg.locator('#srch_r .srch-r').first().click(); await pg.waitForTimeout(200);
ck('العميل بيفتح شاشة العملاء مفلترة', await pg.evaluate(()=> module==='sales' && load('_salesTab_',null)===1 && q==='مؤسسة الأمل للتجارة'));
await pg.evaluate(()=> openSearch()); await pg.fill('#srch','مقارنة شهور'); await pg.waitForTimeout(120);
await pg.locator('#srch_r .srch-r').first().click(); await pg.waitForTimeout(200);
ck('اسم تقرير بيفتحه', await pg.evaluate(()=> module==='sales' && load('_salesRep_',null)==='cmpmo'));
await pg.evaluate(()=> openSearch()); await pg.fill('#srch','فوزي'); await pg.waitForTimeout(120);
await pg.locator('#srch_r .srch-r').first().click(); await pg.waitForTimeout(250);
ck('الموظف بيفتح شاشة تعديله', await pg.evaluate(()=> module==='payroll' && document.querySelector('#overlay').classList.contains('show')));
await pg.evaluate(()=> openSearch()); await pg.fill('#srch','zzzz'); await pg.waitForTimeout(120);
ck('مفيش نتايج بيقول كده', /مفيش نتايج/.test(await pg.locator('#srch_r').innerText()));
// مربعات الأرقام
for(const m of ['items','warehouses','sales','gv','payroll','bonus']){
  await pg.evaluate(mm=>{ closeSheet(); navTo(mm,{}); }, m); await pg.waitForTimeout(80);
  const n=await pg.locator('#main .stats .stat').count();
  if(n<3){ ck('مربعات الأرقام في '+m, false, String(n)); }
}
ck('مربعات الأرقام في كل الأقسام', true);
await pg.evaluate(()=> navTo('sales',{})); await pg.waitForTimeout(80);
const st=await pg.locator('#main .stats').innerText();
ck('أرقام المبيعات: 2.5 م وعميل غير مصنّف', /2\.5 م/.test(st) && /غير مصنّف/.test(st), st);
await pg.locator('#main .stat', {hasText:'غير مصنّف'}).click(); await pg.waitForTimeout(150);
ck('الضغط على المربع بيفتح شاشته', await pg.evaluate(()=> load('_salesTab_',null)===1));
ck('مفيش سكرول عرضي على الموبايل', await pg.evaluate(()=> document.documentElement.scrollWidth<=362));

// ── كمبيوتر
pg=await (await b.newContext({viewport:{width:1366,height:800}})).newPage();
pg.on('pageerror',e=>errs.push(e.message)); await pg.addInitScript(seed);
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(700);
const nb=await pg.locator('#nav').boundingBox(), mb=await pg.locator('#main').boundingBox();
ck('القايمة على اليمين والشغل جنبها', nb.x > mb.x && nb.width<300 && nb.height>600 && Math.abs(nb.y-mb.y)<2, JSON.stringify({nb,mb}));
ck('خانة البحث في القايمة', await pg.locator('.nav-search').isVisible());
ck('🔍 و☰ مستخبيين على الكمبيوتر', !(await pg.locator('#hdrSearch').isVisible()) && !(await pg.locator('#menuBtn').isVisible()));
await pg.locator('#nav .nav-btn', {hasText:'المبيعات'}).click(); await pg.waitForTimeout(200);
const subs=await pg.locator('#nav .nav-sub').allInnerTexts();
ck('تحت المبيعات شاشاته', subs.some(x=>/موزعين قطاعات/.test(x)) && subs.some(x=>/العملاء/.test(x)), subs.join('|'));
await pg.locator('#nav .nav-sub', {hasText:'موزعين قطاعات'}).click(); await pg.waitForTimeout(200);
ck('الضغط على الشاشة بيفتحها ويعلّمها', await pg.evaluate(()=> load('_salesRep_',null)==='distsec') && (await pg.locator('#nav .nav-sub.on').innerText()).includes('موزعين قطاعات'));
await pg.locator('#nav .nav-sub', {hasText:'موزعين قطاعات'}).click(); await pg.waitForTimeout(200);
ck('ضغطة تانية ما بتقفلهاش', await pg.evaluate(()=> load('_salesRep_',null)==='distsec'));
await pg.locator('#nav .nav-sub', {hasText:'موزعين إجمالي'}).click(); await pg.waitForTimeout(200);
const fb=(await pg.locator('.fbar').count())? await pg.locator('.fbar').boundingBox() : null;
ck('فيه شريط تصدير نقيسه', !!fb);
ck('شريط التصدير ما بيغطيش القايمة', !fb || fb.x+fb.width <= nb.x+1, JSON.stringify(fb));
await pg.locator('.nav-search').click(); await pg.waitForTimeout(150);
const sb=await pg.locator('#sheet').boundingBox();
ck('البحث بيفتح في النص على الكمبيوتر', sb && sb.width<=660 && sb.y>20, JSON.stringify(sb));
ck('مفيش أخطاء', !errs.length, errs.join('|'));
await b.close(); process.exit(fail?1:0);
