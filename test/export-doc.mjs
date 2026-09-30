// المستند المصدَّر: ألوان الأعلى/الأقل، الميداليات، وشريط الإجمالي اللي بيتكرر
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); if(!ok) bad++; };
const b=await chromium.launch(); const pg=await b.newPage();
pg.on('pageerror',e=>{bad++;console.log('❌ JS:',e.message)});
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('customers_v1', JSON.stringify([
    {id:'a',name:'موزع أ',cls:'موزع'},{id:'b',name:'موزع ب',cls:'موزع'},
    {id:'c',name:'موزع ج',cls:'موزع'},{id:'w',name:'محل جملة',cls:'مبيعات جملة'}]));
  localStorage.setItem('monthlySales_v1', JSON.stringify({
    '2026-01':{'موزع أ':300000,'موزع ب':200000,'موزع ج':100000,'محل جملة':50000}}));
  localStorage.setItem('monthlySector_v1', JSON.stringify({'2026-01':{
    'موزع أ':{'كرافت لاين':200000,'كومبن':100000},
    'موزع ب':{'كرافت لاين':150000,'كومبن':50000},
    'موزع ج':{'كرافت لاين':90000,'كومبن':10000},
    'محل جملة':{'كرافت لاين':50000}}}));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(800);
await pg.evaluate(()=>{ module='sales'; save('_salesTab_',2); save('_salesRep_','distsec'); render(true); });
await pg.waitForTimeout(400);

// القطاعات بتطابق موزعين إجمالي
const [a,c]=await pg.evaluate(()=>[repModel('dist'),repModel('distsec')]);
const gt=r=>r.body.filter(x=>x.type==='tot')[0].cells.slice(-1)[0];
ck('إجمالي القطاعات = إجمالي موزعين إجمالي', gt(a)===gt(c), gt(a)+' / '+gt(c));
ck('مبيعات الجملة في تقرير القطاعات',
  c.body.some(r=> r.cells[0]==='مبيعات جملة'),
  c.body.filter(r=>r.type==='row').map(r=>r.cells[0]).join('|'));

// المستند: ألوان وميداليات
const html=await pg.evaluate(()=>{
  const md=repModel('distsec');
  md.hiLo = modelHiLo(md);
  let i=0; md.body.forEach(r=>{ if(r.type==='row'){ if(i<3) r.cells[0]=MEDALS[i]; i++; } });
  return docTableHtml(md); });
ck('المستند فيه خانة خضرا وخانة حمرا', /class="[^"]*hi/.test(html) && /class="[^"]*lo/.test(html));
ck('المستند فيه ميداليات', /🥇/.test(html) && /🥈/.test(html) && /🥉/.test(html));
ck('صف الإجمالي class=m', /<tr class="m">/.test(html));

// الأعلى/الأقل في كل عمود رقمي مش عمود واحد بس
const hl=await pg.evaluate(()=> modelHiLo(repModel('distsec')));
ck('التلوين في أعمدة كرافت وكومبن والإجمالي', Object.keys(hl).length>=3, JSON.stringify(Object.keys(hl)));

// ألوان الشاشة فوق تخطيط الصفوف
const painted=await pg.evaluate(()=>{
  const t=[...document.querySelectorAll('table.rep td.hi, table.rep td.lo')];
  return t.map(td=> getComputedStyle(td).backgroundColor).filter(c=> c!=='rgba(0, 0, 0, 0)');
});
ck('خانات الشاشة الملوّنة ليها خلفية فعلاً', painted.length>=4, JSON.stringify(painted.slice(0,3)));
console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
