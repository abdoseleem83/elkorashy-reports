// صورة طلبية النواقص: دقة عالية (مش بتتبكسل لما تتكبّر) وفي حدود ذاكرة الموبايل
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(ok?'':(x?'  — '+x:''))); if(!ok) bad++; };
const b=await chromium.launch(); const pg=await (await b.newContext({viewport:{width:420,height:900}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('warehouses_v1', JSON.stringify([{id:'w1',name:'طنطا'}]));
  const its=[], sh={}; for(let i=1;i<=30;i++){ const n='حلق كرافت '+i; its.push({id:'i'+i,name:n,mainGroup:i%2?'كرافت':'نيو',subGroup:'٢٥',baseName:'',color:'',unit:'لفة',rollQty:''}); sh[n]={q1:i,u1:'لفة',q2:0,u2:''}; }
  localStorage.setItem('items_v1', JSON.stringify(its)); localStorage.setItem('whShortage_v1', JSON.stringify({w1:sh}));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(900);
const r=await pg.evaluate(async()=>{
  const el=mkDoc(shortDocBody('w1'), true); const w=el.offsetWidth, h=el.offsetHeight;
  const c=await docToCanvas(el,4,16e6); const out={w,h,cw:c.width,ch:c.height}; el.remove(); return out; });
const sc=r.cw/r.w;
ck('دقة الصورة ×٣ على الأقل', sc>=2.9, 'scale='+sc.toFixed(2)+' ('+r.cw+'x'+r.ch+')');
ck('في حدود ذاكرة الموبايل (≤ ١٦٫٨ مليون بكسل)', r.cw*r.ch<=16.8e6, String(r.cw*r.ch));
const pdfSc=await pg.evaluate(async()=>{ const el=mkDoc(shortDocBody('w1'), true); const c=await docToCanvas(el); const s=c.width/el.offsetWidth; el.remove(); return s; });
ck('الـPDF لسه ×٢ (ملف أخف)', Math.abs(pdfSc-2)<0.11, pdfSc.toFixed(2));
ck('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join('|'));
console.log(bad?('❌ فشل '+bad):'✅ كله تمام'); await b.close(); process.exit(bad?1:0);
