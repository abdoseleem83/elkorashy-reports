// عمود القطاعات: دوس على البند تشوف أصنافه + عمود جديد (الومنيوم) تنقل له البنود
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let fail=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(ok?'':'  — '+x)); if(!ok) fail++; };
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:360,height:780}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('dialog',d=> d.type()==='prompt'? d.accept('ومنيوم وشاتر') : d.accept());
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('items_v1', JSON.stringify([
    {id:'1',name:'قطاع ومنيوم 1',mainGroup:'الومنيوم'},{id:'2',name:'قطاع ومنيوم 2',mainGroup:'الومنيوم'},
    {id:'3',name:'شاتر ابيض',mainGroup:'شاتر'},{id:'4',name:'كومبن ابيض',mainGroup:'قطاعات PVC كومبن'}]));
  localStorage.setItem('customers_v1', JSON.stringify([{id:'c1',name:'موزع أ',cls:'موزع'}]));
  // يوليو: شيت قديم — الومنيوم والشاتر متجمّعين في «أخرى» · أغسطس: جديد بالمجموعات
  localStorage.setItem('monthlySales_v1', JSON.stringify({'2026-07':{'موزع أ':1000},'2026-08':{'موزع أ':1000}}));
  localStorage.setItem('monthlySector_v1', JSON.stringify({
    '2026-07':{'موزع أ':{'أخرى':700,'كومبن':300}},
    '2026-08':{'موزع أ':{'الومنيوم':500,'شاتر':200,'قطاعات PVC كومبن':300}}}));
  localStorage.setItem('monthlyItems_v1', JSON.stringify({
    '2026-07':{'قطاع ومنيوم 1':{qty:1,val:400},'شاتر ابيض':{qty:1,val:300},'كومبن ابيض':{qty:1,val:300}},
    '2026-08':{'قطاع ومنيوم 1':{qty:1,val:300},'قطاع  ومنيوم 2':{qty:1,val:200},'شاتر ابيض':{qty:1,val:200},'كومبن ابيض':{qty:1,val:300}}}));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(700);

const al=await pg.evaluate(()=> secGroupItems('الومنيوم'));
ck('أصناف مجموعة الومنيوم (أغسطس بس) — والاسم بفرق مسافة اتعرف',
  al.list.map(r=>r.name+':'+r.val).join('|')==='قطاع ومنيوم 1:300|قطاع  ومنيوم 2:200' && !al.legacy, JSON.stringify(al));
const ot=await pg.evaluate(()=> secGroupItems('أخرى'));
ck('«أخرى» القديمة بتفرد أصنافها من يوليو بس ومتعلّمة قديمة',
  ot.legacy && ot.list.map(r=>r.name+':'+r.val).join('|')==='قطاع ومنيوم 1:400|شاتر ابيض:300', JSON.stringify(ot));

// الشيت: البند بيتفتح على أصنافه
await pg.evaluate(()=>{ module='sales'; save('_salesTab_',2); save('_salesRep_','distsec'); render(true); secSheet('أخرى'); });
await pg.waitForTimeout(250);
const sum=pg.locator('#sheet details summary').first();
ck('البند مقفول الأول', !(await pg.locator('#sheet details').first().evaluate(e=>e.open)));
await sum.click(); await pg.waitForTimeout(150);
const txt=await pg.locator('#sheet details').first().innerText();
ck('دوست عليه ظهرت الأصناف', /قطاع ومنيوم 1/.test(txt) && /ارفع شيت الشهور دي تاني/.test(txt), txt.slice(0,200));
ck('الشيت مش بيعمل سكرول عرضي', await pg.evaluate(()=> document.documentElement.scrollWidth<=362));

// عمود جديد + نقل الومنيوم له
await pg.locator('#sheet button', {hasText:'➕ عمود جديد'}).first().click(); await pg.waitForTimeout(200);
ck('العمود الجديد اتعمل', await pg.evaluate(()=> secCustomCols().join('|'))==='ومنيوم وشاتر');
ck('وظهر كزرار في الشيت', (await pg.locator('#sheet .clschip', {hasText:'ومنيوم وشاتر'}).count())>0);
await pg.evaluate(()=>{ secMoveTo('الومنيوم','ومنيوم وشاتر','أخرى'); secMoveTo('شاتر','ومنيوم وشاتر'); });
await pg.waitForTimeout(200);
let md=await pg.evaluate(()=> repModel('distsec'));
const ci=md.header.indexOf('ومنيوم وشاتر');
ck('العمود الجديد في التقرير قبل «أخرى»', ci>0 && ci<md.header.indexOf('أخرى'), md.header.join('|'));
ck('قيمته 500+200', md.body[0].cells[ci]===700, JSON.stringify(md.body[0]));
ck('الشيت فضل مفتوح بعد النقل', await pg.evaluate(()=> document.querySelector('#overlay').classList.contains('show')));

// حذف العمود يرجّع البنود
await pg.evaluate(()=>{ secSheet('ومنيوم وشاتر'); }); await pg.waitForTimeout(150);
await pg.locator('#sheet button', {hasText:'حذف العمود'}).click(); await pg.waitForTimeout(200);
md=await pg.evaluate(()=> repModel('distsec'));
ck('بعد الحذف البنود رجعت أعمدتها (الشاتر لـ«أخرى»)', md.header.includes('الومنيوم') && md.header.includes('أخرى') && !md.header.includes('ومنيوم وشاتر'), md.header.join('|'));
ck('secMove اتنضف', await pg.evaluate(()=> !Object.values(secMove).includes('ومنيوم وشاتر') && !secCustomCols().length));

// ── الضغط على صنف جوه البند = تعديل مجموعته
await pg.evaluate(()=>{ secSheet('أخرى'); }); await pg.waitForTimeout(150);
await pg.locator('#sheet details summary').first().click(); await pg.waitForTimeout(100);
await pg.locator('#sheet details div[onclick*="itemGroupSheet"]', {hasText:'شاتر ابيض'}).first().click(); await pg.waitForTimeout(150);
ck('اتفتح شيت مجموعة الصنف', /مجموعة الصنف/.test(await pg.locator('#sheet').innerText()) && /المجموعة دلوقتي: شاتر/.test(await pg.locator('#sheet').innerText()));
await pg.fill('#ig_new','اكسسوارات شاتر'); await pg.locator('#sheet .btn-save').click(); await pg.waitForTimeout(150);
ck('الصنف اتنقل لمجموعة جديدة واتحفظ', await pg.evaluate(()=> itemsByName['شاتر ابيض'].mainGroup==='اكسسوارات شاتر' && JSON.parse(localStorage.getItem('items_v1')).find(i=>i.name==='شاتر ابيض').mainGroup==='اكسسوارات شاتر'));
ck('ورجع لشيت العمود', /عمود «أخرى»/.test(await pg.locator('#sheet').innerText()));
// صنف مش موجود في الأصناف بيتضاف بالمجموعة
await pg.evaluate(()=> itemSetGroup('صنف جديد خالص','الومنيوم',''));
ck('صنف غير معروف اتضاف للأصناف بمجموعته', await pg.evaluate(()=> (itemsByName['صنف جديد خالص']||{}).mainGroup==='الومنيوم'));

// ── زرار الأعمدة: ظاهر / مخفي / فاضي
await pg.evaluate(()=>{ closeSheet(); module='sales'; save('_salesTab_',2); save('_salesRep_','distsec'); render(true); }); await pg.waitForTimeout(200);
const bar=await pg.locator('.morow .mochip', {hasText:'🧩'}).innerText();
ck('شريط «🧩 الأعمدة» فيه العدد', /🧩 الأعمدة \(\d+ ظاهر/.test(bar) && /فاضي/.test(bar), bar);
await pg.locator('.morow .mochip', {hasText:'🧩'}).click(); await pg.waitForTimeout(150);
let sh=await pg.locator('#sheet').innerText();
ck('الشيت بيوري كل عمود وحالته', /كومبن/.test(sh) && /ظاهر/.test(sh) && /فاضي — مفيش مبيعات/.test(sh), sh.slice(0,300));
await pg.evaluate(()=> secToggleHide('كومبن')); await pg.waitForTimeout(150);
ck('إخفاء من الشيت', await pg.evaluate(()=> secHidden('كومبن') && repModel('distsec').header.indexOf('كومبن')<0) && /مخفي/.test(await pg.locator('#sheet').innerText()));
await pg.evaluate(()=> secToggleHide('كومبن')); await pg.waitForTimeout(150);
ck('وإظهار تاني', await pg.evaluate(()=> !secHidden('كومبن') && repModel('distsec').header.indexOf('كومبن')>0));
ck('مفيش أخطاء', !errs.length, errs.join('|'));
await b.close(); process.exit(fail?1:0);
