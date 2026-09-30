// الضغط على الكود في «أبواب بالكود»: يوري الأصناف ويسمح بتعديل الكود
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); if(!ok) bad++; };
const b=await chromium.launch(); const pg=await b.newPage();
pg.on('pageerror',e=>{bad++;console.log('❌ JS:',e.message)});
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('customers_v1', JSON.stringify([{id:'a',name:'موزع أ',cls:'موزع'}]));
  localStorage.setItem('monthlySales_v1', JSON.stringify({'2026-01':{'موزع أ':100000}}));
  localStorage.setItem('monthlyDoors_v1', JSON.stringify({'2026-01':{'موزع أ':{
    'باب كامل 90 سم A02':{qty:10,val:40000,code:'A02',sub:'ابواب'},
    'خدمة قص ابواب':{qty:5,val:2000,code:'',sub:'ابواب'},
    'باب رشدي 80 سم':{qty:3,val:9000,code:'',sub:'ابواب'}}}}));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(800);
await pg.evaluate(()=>{ module='sales'; save('_salesTab_',2); save('_salesRep_','doorcode'); render(true); });
await pg.waitForTimeout(400);

let d=await pg.evaluate(()=> repModel('doorcode'));
ck('«بدون كود» مش بتظهر في الجدول خالص',
  !d.body.some(r=> r.cells[0]==='بدون كود'),
  d.body.filter(r=>r.type==='row').map(r=>r.cells[0]).join('|'));
ck('خلايا الكود قابلة للضغط', d.tapCol===0 && (d.rowTap||[]).length===d.body.filter(r=>r.type==='row').length,
  JSON.stringify(d.rowTap));
ck('العلامة ⚙️ ظاهرة في عمود الكود',
  (await pg.evaluate(()=> document.querySelector('table.rep').innerText)).includes('⚙️'));
ck('شريط «من غير كود» بيعدّ الصنف اللي اتشال',
  /1 صنف من غير كود/.test(await pg.evaluate(()=>document.body.innerText)), '');

// الضغط على الكود بيفتح قائمة بأصنافه جوه الجدول
const cell = pg.locator('table.rep td', {hasText:'A02'}).first();
await cell.click(); await pg.waitForTimeout(350);
ck('القائمة المنسدلة فتحت تحت الكود', (await pg.locator('tr.dcexp .dcrow').count())===1);
ck('وفيها اسم الصنف',
  /باب كامل 90 سم A02/.test(await pg.evaluate(()=> document.querySelector('tr.dcexp').innerText)));
// تغيير الكود من القائمة
await pg.fill('#dcx_0','b7');
await pg.evaluate(()=> doorCodeSaveRow(['باب كامل 90 سم A02'])); await pg.waitForTimeout(400);
ck('الكود اتغيّر من القائمة بحروف كبيرة',
  (await pg.evaluate(()=> JSON.parse(localStorage.getItem('doorCodeMap_v1'))))['باب كامل 90 سم A02']==='B7');

// شيل صنف غلط
await pg.evaluate(()=>{ window.confirm=()=>true; });
await pg.evaluate(()=> doorHideItem('باب كامل 90 سم A02')); await pg.waitForTimeout(400);
d=await pg.evaluate(()=> repModel('doorcode'));
ck('الصنف المتشال خرج من التقرير',
  !d.body.some(r=> r.cells[0]==='B7'), d.body.filter(r=>r.type==='row').map(r=>r.cells[0]).join('|'));
ck('وبيبان في شريط «متشال» عشان ترجّعه',
  /متشال/.test(await pg.evaluate(()=>document.body.innerText)));
await pg.evaluate(()=> doorUnhide('باب كامل 90 سم A02')); await pg.waitForTimeout(400);
d=await pg.evaluate(()=> repModel('doorcode'));
ck('رجع تاني', d.body.some(r=> r.cells[0]==='B7'), d.body.filter(r=>r.type==='row').map(r=>r.cells[0]).join('|'));

// إدّي كود لصنف من غير كود من الشيت
await pg.evaluate(()=> noCodeSheet()); await pg.waitForTimeout(300);
ck('شيت «من غير كود» بيوري الباب', /باب رشدي 80 سم/.test(await pg.evaluate(()=>document.body.innerText)));
await pg.fill('#nc_0','a11');
await pg.evaluate(()=> noCodeSave(['باب رشدي 80 سم'])); await pg.waitForTimeout(400);
d=await pg.evaluate(()=> repModel('doorcode'));
ck('الصنف دخل التقرير بكود A11',
  d.body.some(r=> r.cells[0]==='A11'), d.body.filter(r=>r.type==='row').map(r=>r.cells[0]).join('|'));

console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
