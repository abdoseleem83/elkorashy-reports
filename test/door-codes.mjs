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
ck('صف «بدون كود» فيه الباب اللي من غير كود بس',
  d.body.some(r=> r.cells[1]==='بدون كود'),
  d.body.filter(r=>r.type==='row').map(r=>r.cells[1]).join('|'));
ck('خلايا الكود قابلة للضغط', d.tapCol===1 && (d.rowTap||[]).length===d.body.filter(r=>r.type==='row').length,
  JSON.stringify(d.rowTap));
ck('العلامة ⚙️ ظاهرة في عمود الكود',
  (await pg.evaluate(()=> document.querySelector('table.rep').innerText)).includes('⚙️'));
// الضغط الحقيقي على «بدون كود» لازم يفتح الشيت (كان باظ بسبب علامات التنصيص)
await pg.evaluate(()=>{ const sh=document.getElementById('sheet'); if(sh) sh.classList.remove('open'); });
const cell = pg.locator('table.rep td', {hasText:'بدون كود'}).first();
await cell.click(); await pg.waitForTimeout(300);
ck('الضغط على «بدون كود» بيفتح الشيت',
  /الكود «بدون كود»/.test(await pg.evaluate(()=>document.body.innerText)));
await pg.evaluate(()=> closeSheet()); await pg.waitForTimeout(200);

await pg.evaluate(()=> doorCodeSheet('بدون كود')); await pg.waitForTimeout(250);
const sh=await pg.evaluate(()=>document.body.innerText);
ck('الشيت بيوري الباب بس — الخدمة مستبعدة من التقرير',
  /باب رشدي 80 سم/.test(sh) && !/خدمة قص ابواب/.test(sh));
ck('الخانة فاضية لأنه من غير كود',
  (await pg.locator('#dc_0').inputValue())==='' );

// نحط كود لصنف واحد
const names=await pg.evaluate(()=>{
  const d2=buildDoorsByCode(); return d2.list.find(r=>r.code==='بدون كود').names; });
const i=names.indexOf('باب رشدي 80 سم');
await pg.fill('#dc_'+i,'a11');
await pg.evaluate(n=> doorCodeSave(n), names); await pg.waitForTimeout(400);

const map=await pg.evaluate(()=> JSON.parse(localStorage.getItem('doorCodeMap_v1')));
ck('الكود اتحفظ بحروف كبيرة', map['باب رشدي 80 سم']==='A11', JSON.stringify(map));
d=await pg.evaluate(()=> repModel('doorcode'));
const a11=d.body.find(r=> r.cells[1]==='A11');
ck('الصنف اتنقل لكود A11 بقيمته',
  a11 && a11.cells[a11.cells.length-1]===9000, JSON.stringify(a11&&a11.cells));
ck('مبقاش فيه «بدون كود» خالص',
  !d.body.some(r=> r.cells[1]==='بدون كود'),
  d.body.filter(r=>r.type==='row').map(r=>r.cells[1]).join('|'));

// الشيل: خانة فاضية = يرجع من غير كود
await pg.evaluate(()=> doorCodeSheet('A11')); await pg.waitForTimeout(250);
await pg.fill('#dc_0','');
await pg.evaluate(()=> doorCodeSave(['باب رشدي 80 سم'])); await pg.waitForTimeout(400);
ck('مسح الكود بيرجّعه «بدون كود»',
  !(await pg.evaluate(()=> JSON.parse(localStorage.getItem('doorCodeMap_v1'))))['باب رشدي 80 سم']);
console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
