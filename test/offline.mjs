// تشغيل من غير نت: المكتبات محلية، والـservice worker بيحفظ التطبيق، والـCDN احتياطي بس
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(ok?'':(x?'  — '+x:''))); if(!ok) bad++; };
const APP=process.env.APP_URL, ORIGIN=new URL(APP).origin;
const b=await chromium.launch(); const ctx=await b.newContext();
const external=[]; await ctx.route(u=>new URL(u).origin!==ORIGIN, r=>{ external.push(r.request().url()); r.abort(); });
const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.addInitScript(()=>{ localStorage.setItem('_sync_', JSON.stringify({off:true})); });
await pg.goto(APP); await pg.waitForTimeout(1200);
ck('الإكسل اتحمّل من الملف المحلي (من غير نت)', await pg.evaluate(()=> typeof XLSX!=='undefined' && !!XLSX.utils));
ck('مفيش طلب لأي موقع خارجي أثناء الفتح', external.length===0, external.join(' | '));
const libs=await pg.evaluate(async()=>{ const r={};
  await loadLib('html2canvas',()=>window.html2canvas); r.h=typeof window.html2canvas;
  await loadLib('jspdf',()=>window.jspdf); r.p=typeof window.jspdf;
  await loadLib('exceljs',()=>window.ExcelJS); r.e=typeof window.ExcelJS; return r; });
ck('PDF وصورة وإكسل المنسّق بيتحمّلوا محلياً', libs.h==='function' && libs.p==='object' && libs.e==='object', JSON.stringify(libs));
ck('لسه مفيش طلب خارجي', external.length===0, external.join(' | '));

// service worker
const sw=await pg.evaluate(async()=>{ if(!navigator.serviceWorker) return 'no'; const r=await navigator.serviceWorker.ready; return r.active? 'active':'none'; });
ck('الـservice worker اشتغل', sw==='active', sw);
await pg.reload(); await pg.waitForTimeout(800);   // الصفحة تبقى تحت سيطرة الـSW
const cached=await pg.evaluate(async()=> (await (await caches.open('elkorashy-reports-v1')).keys()).map(r=>new URL(r.url).pathname));
ck('الصفحة والمكتبات اتحفظت على الجهاز', ['/index.html','/lib/xlsx.bundle.js','/lib/exceljs.min.js','/lib/jspdf.umd.min.js','/lib/html2canvas.min.js','/manifest.webmanifest'].every(p=>cached.some(c=>c.endsWith(p))), cached.join(','));

// قطع النت عن السيرفر نفسه → التطبيق لازم يفتح من المحفوظ
await ctx.setOffline(true);
await pg.goto(APP); await pg.waitForTimeout(1000);
ck('التطبيق بيفتح بعد قطع النت', await pg.evaluate(()=> typeof render==='function' && document.body.innerText.length>50));
ck('الإكسل شغال أوفلاين', await pg.evaluate(()=> typeof XLSX!=='undefined' && !!XLSX.utils));
await ctx.setOffline(false);

// الاحتياطي: لو الملف المحلي ضاع بنجرّب الـCDN
const ctx2=await b.newContext({serviceWorkers:'block'}); const urls=[];
await ctx2.route('**/lib/xlsx.bundle.js', r=>r.abort());
await ctx2.route(u=>new URL(u).origin!==ORIGIN, r=>{ urls.push(r.request().url()); r.abort(); });
const p2=await ctx2.newPage(); await p2.addInitScript(()=>{ localStorage.setItem('_sync_', JSON.stringify({off:true})); });
await p2.goto(APP); await p2.waitForTimeout(1000);
ck('لو الملف المحلي ضاع بيحاول الـCDN', urls.some(u=>/cdn\.jsdelivr\.net.*xlsx/.test(u)), urls.join(' | '));
ck('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(bad?('❌ فشل '+bad):'✅ كله تمام'); await b.close(); process.exit(bad?1:0);
