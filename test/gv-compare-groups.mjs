// مقارنة جيفز بالكراتين: الصفوف متجمّعة بالمجموعة الفرعية
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); if(!ok) bad++; };
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:412,height:880}});
pg.on('pageerror',e=>{bad++;console.log('❌ JS:',e.message)});
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('items_v1', JSON.stringify([
    {id:'i1',name:'كالون سلندر نحاس',mainGroup:'جيفيز',subGroup:'كوالين'},
    {id:'i2',name:'كالون سلندر ستيل',mainGroup:'جيفيز',subGroup:'كوالين'},
    {id:'i3',name:'مفصلة 4 بوصة',mainGroup:'جيفيز',subGroup:'مفصلات'},
    {id:'i4',name:'صنف بلا مجموعة',mainGroup:'',subGroup:''}]));
  localStorage.setItem('gvcodes_v1', JSON.stringify([
    {id:'g1',name:'كالون سلندر نحاس',code:'K1',perCarton:'10'},
    {id:'g2',name:'كالون سلندر ستيل',code:'K2',perCarton:'10'},
    {id:'g3',name:'مفصلة 4 بوصة',code:'M1',perCarton:'20'},
    {id:'g4',name:'صنف بلا مجموعة',code:'X1',perCarton:'5'}]));
  localStorage.setItem('warehouses_v1', JSON.stringify([{id:'w1',name:'طنطا'},{id:'w2',name:'الاسكندرية'}]));
  localStorage.setItem('whStock_v1', JSON.stringify({
    w1:{'كالون سلندر نحاس':{balance:100},'كالون سلندر ستيل':{balance:50},'مفصلة 4 بوصة':{balance:200},'صنف بلا مجموعة':{balance:5}},
    w2:{'كالون سلندر نحاس':{balance:30},'مفصلة 4 بوصة':{balance:100}}}));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(900);
await pg.evaluate(()=>{ switchModule('warehouses'); save('_whTab_','cmpx'); save('_cmpView_','gvbox'); render(true); });
await pg.waitForTimeout(450);

const g=await pg.evaluate(()=> buildGvCompare().groups.map(x=>({n:x.name, r:x.rows.length, c:x.totalCartons})));
ck('٣ مجموعات', g.length===3, JSON.stringify(g));
ck('الكوالين مع بعض في مجموعة واحدة',
  g.some(x=>x.n==='كوالين' && x.r===2), JSON.stringify(g));
ck('المفصلات لوحدها', g.some(x=>x.n==='مفصلات' && x.r===1), JSON.stringify(g));
ck('اللي مالوش مجموعة تحت «بدون مجموعة»',
  g.some(x=>x.n==='بدون مجموعة' && x.r===1), JSON.stringify(g));
// كراتين: مفصلات 300/20 = 15، كوالين (130+50)/10 = 18
ck('إجمالي كراتين الكوالين ١٨', Math.round(g.find(x=>x.n==='كوالين').c)===18,
  String(g.find(x=>x.n==='كوالين').c));
ck('إجمالي كراتين المفصلات ١٥', Math.round(g.find(x=>x.n==='مفصلات').c)===15,
  String(g.find(x=>x.n==='مفصلات').c));
ck('المجموعات مرتبة من الأكبر للأصغر', g[0].c>=g[1].c && g[1].c>=g[2].c, g.map(x=>x.c).join('/'));

// الجدول على الشاشة
const t=await pg.evaluate(()=> document.querySelector('table.rep').innerText);
ck('عنوان المجموعة ظاهر في الجدول', /◆ كوالين/.test(t) && /◆ مفصلات/.test(t), '');
ck('إجمالي لكل مجموعة', /إجمالي كوالين/.test(t) && /إجمالي مفصلات/.test(t), '');
ck('الإجمالي العام في الآخر', /الإجمالي العام/.test(t), '');
// صنفي الكوالين ورا بعض مباشرة
const order=await pg.evaluate(()=> [...document.querySelectorAll('table.rep tr')].map(r=>r.innerText.split('\t')[0]));
const i1=order.findIndex(x=>/◆ كوالين/.test(x)), i2=order.findIndex(x=>/إجمالي كوالين/.test(x));
ck('صفوف الكوالين بين عنوانها وإجماليها', i2-i1===3, i1+'→'+i2);

// الإكسل فيه عمود المجموعة
const x=await pg.evaluate(()=>{
  let got=null; const real=window.saveAoaXlsx;
  window.saveAoaXlsx=(d)=>{ got=d; };
  try{ exportGvCompareExcel(); } finally { window.saveAoaXlsx=real; }
  return got; });
ck('الإكسل أول عمود فيه المجموعة', x && x[0][0]==='المجموعة', x? x[0].slice(0,3).join('|'):'مفيش');
ck('وفيه سطر إجمالي لكل مجموعة',
  x && x.filter(r=>/^إجمالي /.test(String(r[1]||''))).length===3,
  x? String(x.filter(r=>/^إجمالي /.test(String(r[1]||''))).length):'مفيش');
console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
