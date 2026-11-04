// صورة المستند: صفحات بعرض ~١٨٠٠ بكسل (واتساب مابيصغّرهاش)، والقصير صورة واحدة
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(ok?'':(x?'  — '+x:''))); if(!ok) bad++; };
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:420,height:900},acceptDownloads:true}); const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
const seed=(n)=>()=>{};
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('warehouses_v1', JSON.stringify([{id:'w1',name:'طنطا'}]));
  const its=[], sh={}; for(let i=1;i<=60;i++){ const n='حلق كرافت رقم '+i; its.push({id:'i'+i,name:n,mainGroup:i<=40?'كرافت':'نيو',subGroup:'٢٥',baseName:'',color:'',unit:'لفة',rollQty:''}); sh[n]={q1:i,u1:'لفة',q2:0,u2:''}; }
  localStorage.setItem('items_v1', JSON.stringify(its)); localStorage.setItem('whShortage_v1', JSON.stringify({w1:sh}));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(900);
const grab=async(js)=>{ const got=[]; const h=async d=>{ const p='/tmp/t-'+got.length+'.png'; await d.saveAs(p); got.push(p); }; pg.on('download',h);
  await pg.evaluate(js); await pg.waitForTimeout(7000); pg.off('download',h); return got; };
const dim=async p=>{ const fs=await import('fs'); const b=fs.readFileSync(p); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const many=await grab(()=>exportDocImage(shortDocBody('w1'),'نواقص',true,true));
const dims=[]; for(const p of many) dims.push(await dim(p));
ck('الطلبية الطويلة اتقسمت لصفحات (٢ على الأقل)', many.length>=2, String(many.length));
ck('عرض كل صفحة ~١٨٠٠ بكسل', dims.every(d=>d[0]>=1500 && d[0]<=2000), JSON.stringify(dims));
ck('طول كل صفحة في حدود ٢٣٠٠ بكسل', dims.every(d=>d[1]<=2300), JSON.stringify(dims));
await pg.evaluate(()=>{ whShortage={w1:{'حلق كرافت رقم 1':{q1:1,u1:'لفة',q2:0,u2:''}}}; });
const one=await grab(()=>exportDocImage(shortDocBody('w1'),'نواقص',true,true));
ck('الطلبية القصيرة صورة واحدة', one.length===1, String(one.length));
ck('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join('|'));
console.log(bad?('❌ فشل '+bad):'✅ كله تمام'); await b.close(); process.exit(bad?1:0);
