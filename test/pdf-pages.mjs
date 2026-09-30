// الـPDF الحقيقي: عناوين الجدول بتتكرر في كل ورقة، والإجمالي في آخر ورقة بس،
// و«أعلى ٣» في أول ورقة بس، ورقم الصفحة تحت كل ورقة
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {existsSync} from 'fs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); if(!ok) bad++; };
const LIB='/tmp/fin/lib';
if(!existsSync(LIB+'/jspdf.umd.min.js')){ console.log('⏭️  مكتبات الـPDF مش موجودة محليًا — تخطّي'); process.exit(0); }
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:412,height:880}});
pg.on('pageerror',e=>{bad++;console.log('❌ JS:',e.message)});
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  const g=[], rows=[];
  for(let i=1;i<=70;i++){ g.push({id:'g'+i,name:'سبلونه مفصلي '+(i*10)+'-'+(i*10+50)+' GEVIS',code:'ISP 202 - '+i,perCarton:'10',weight:'0.4',price:'1.2'});
    rows.push({gid:'g'+i,qty:String(i*100)}); }
  localStorage.setItem('gvcodes_v1', JSON.stringify(g));
  localStorage.setItem('gvOrders_v1', JSON.stringify([{id:'o1',name:'طلبية جيفز 30/08/2026',date:'2026-08-30',containers:'1',cap:'28000',rows}]));
  localStorage.setItem('_gvCur_', JSON.stringify('o1'));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(900);
await pg.addScriptTag({path:LIB+'/html2canvas.min.js'});
await pg.addScriptTag({path:LIB+'/jspdf.umd.min.js'});
const r=await pg.evaluate(async ()=>{
  gvCur='o1';
  // نمسك الـPDF بدل ما يتنزّل
  let saved=null; const J=window.jspdf.jsPDF;
  window.jspdf.jsPDF=function(o){ const d=new J(o); d.save=()=>{ saved=d; }; return d; };
  const title=gvModel().title;
  await doExportDocPdf(gvDocBody(), 'x', false);
  const pages=saved.getNumberOfPages();
  // كل صورة في كل صفحة: ارتفاعها
  const per=[];
  for(let i=1;i<=pages;i++){ saved.setPage(i);
    const imgs=saved.internal.getCurrentPageInfo().pageContext.objId; per.push(i); }
  // كل صفحة: عدد الصور المرسومة فيها (رأس + شريحة + إجمالي)
  const raw=saved.output();
  const streams=[...raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)].map(m=>m[1])
    .filter(t=>/ Do/.test(t) && t.length<3000);
  const perPageDo=streams.map(t=>(t.match(/ Do/g)||[]).length);
  // أول صورة (الرأس) لازم تتكرر في كل صفحة
  const heads=streams.map(t=>(t.match(/\/(I\d+) Do/)||[])[1]);
  const imgs=streams.map(t=>[...t.matchAll(/\/(I\d+) Do/g)].map(m=>m[1]));
  return {pages, title, perPageDo, heads, imgs};
});
ck('العنوان من غير تاريخ متكرر', r.title==='طلبية جيفز 30/08/2026', r.title);
ck('٧٠ صنف = أكتر من صفحة', r.pages>=2, 'صفحات='+r.pages);
ck('كل صفحة فيها رأس + شريحة + رقم الصفحة',
  r.perPageDo.length===r.pages && r.perPageDo.every(n=>n>=3), JSON.stringify(r.perPageDo));
ck('الإجمالي في آخر صفحة بس (صورة زيادة في الأخيرة)',
  r.perPageDo.slice(0,-1).every(n=>n===3) && r.perPageDo[r.pages-1]>=4, JSON.stringify(r.perPageDo));
ck('نفس صورة الرأس في كل الصفحات', r.heads.every(h=>h===r.heads[0]), JSON.stringify(r.heads));


// ── تقرير مبيعات فيه «أعلى ٣»: المربعات في أول صفحة بس
const r2=await pg.evaluate(async ()=>{
  const cs=[]; for(let i=0;i<90;i++) cs.push({id:'c'+i,name:'موزع رقم '+i,cls:'موزع'});
  customers=cs; monthlySales={'2026-08':{}}; cs.forEach((c,i)=> monthlySales['2026-08'][c.name]=(100-i)*1000);
  let saved=null; const J=window.jspdf.jsPDF;
  window.jspdf.jsPDF=function(o){ const d=new J(o); d.save=()=>{ saved=d; }; return d; };
  window.exportDocPdf=(body,fn,land)=> doExportDocPdf(body,fn,land);
  const md=repModel('dist'); md.hiLo=modelHiLo(md);
  const body=`<div class="dx"><h2>${md.title}</h2><div class="sub">x</div>${docBoxesHtml(md)}${docTableHtml(md)}</div>`;
  await doExportDocPdf(body,'x',false);
  const raw=saved.output();
  const streams=[...raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)].map(m=>m[1]).filter(t=>/ Do/.test(t) && t.length<3000);
  return {pages:saved.getNumberOfPages(), hasBoxes:/dxtop/.test(body), imgs:streams.map(t=>[...t.matchAll(/\/(I\d+) Do/g)].map(m=>m[1]))};
});
ck('تقرير المبيعات فيه «أعلى ٣» وأكتر من صفحتين', r2.hasBoxes && r2.pages>=3, JSON.stringify(r2));
const first=r2.imgs[0][0], later=r2.imgs.slice(1).map(a=>a[0]);
ck('صورة الرأس اللي فيها المربعات في أول صفحة بس', later.every(x=>x!==first), JSON.stringify(r2.imgs));
ck('باقي الصفحات: فوق + عناوين الجدول + شريحة + رقم', r2.imgs.slice(1,-1).every(a=>a.length===4), JSON.stringify(r2.imgs));
ck('آخر صفحة فيها الإجمالي', r2.imgs[r2.pages-1].length===5, JSON.stringify(r2.imgs));
ck('أرقام الصفحات مختلفة لكل صفحة', new Set(r2.imgs.map(a=>a[a.length-1])).size===r2.pages, JSON.stringify(r2.imgs));

// عمود الاسم عريض كفاية
const w=await pg.evaluate(()=>{
  gvCur='o1';
  const el=mkDoc(gvDocBody(), false);
  const th=[...el.querySelectorAll('table:first-of-type th')];
  const nm=th.find(t=>t.innerText.trim()==='اسم الصنف'), ix=th.find(t=>t.innerText.trim()==='م');
  const rowsH=[...el.querySelectorAll('table:first-of-type tr.z')].map(tr=>tr.getBoundingClientRect().height);
  const out={nm:Math.round(nm.getBoundingClientRect().width), ix:Math.round(ix.getBoundingClientRect().width),
    maxRow:Math.round(Math.max(...rowsH)), minRow:Math.round(Math.min(...rowsH)),
    name:el.querySelector('table:first-of-type tr.z td.nm').innerText};
  el.remove(); return out; });
ck('عمود الاسم عريض (٢٣٠ على الأقل)', w.nm>=230, JSON.stringify(w));
ck('عمود «م» صغير', w.ix<60, JSON.stringify(w));
ck('الصفوف مش بتتلف ٣ سطور', w.maxRow < w.minRow*1.8, JSON.stringify(w));
ck('الاسم مختصر بالعربي من غير GEVIS', !/GEVIS/i.test(w.name), w.name);
console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
