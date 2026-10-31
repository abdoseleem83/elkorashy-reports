// نسخة احتياطية على ملف + استرجاع بالرقم السري + التقاط الأخطاء المفاجئة
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(ok?'':(x?'  — '+x:''))); if(!ok) bad++; };
const b=await chromium.launch(); const ctx=await b.newContext({acceptDownloads:true}); const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.addInitScript(()=>{
  if(sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded','1');
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('items_v1', JSON.stringify([{id:'i1',name:'صنف أصلي',mainGroup:'x'}]));
  localStorage.setItem('customers_v1', JSON.stringify([{id:'c1',name:'عميل أصلي',cls:'موزع'}]));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(800);
await pg.evaluate(()=>openSyncSheet()); await pg.waitForTimeout(250);
ck('أزرار النسخة الاحتياطية ظاهرة', /نزّل نسخة/.test(await pg.locator('#sheet').innerText()) && /استرجع من ملف/.test(await pg.locator('#sheet').innerText()));

// ── تنزيل نسخة
const [dl]=await Promise.all([pg.waitForEvent('download'), pg.evaluate(()=>backupDownload())]);
const path='/tmp/bk-test.json'; await dl.saveAs(path);
const o=JSON.parse(fs.readFileSync(path,'utf8'));
ck('اسم الملف فيه التاريخ و.json', /^elkorashy-backup-\d{4}-\d{2}-\d{2}_\d{4}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
ck('الملف فيه علامة التطبيق والبيانات', o.app==='elkorashy-reports' && o.data.items_v1[0].name==='صنف أصلي' && o.data.customers_v1[0].name==='عميل أصلي');
ck('مفيش مفاتيح غريبة (زي إعدادات المزامنة)', !('_sync_' in o.data));

// ── نغيّر البيانات ونسترجع
await pg.evaluate(()=>{ save('items_v1',[{id:'i9',name:'صنف اتغيّر',mainGroup:'y'}]); items=load('items_v1',[]); });
await pg.evaluate(()=>openSyncSheet()); await pg.waitForTimeout(200);
// ملف مش نسخة → يترفض ومايحصلش تغيير
fs.writeFileSync('/tmp/bk-bad.json', JSON.stringify({hello:1}));
await pg.setInputFiles('#bk_file','/tmp/bk-bad.json'); await pg.waitForTimeout(300);
ck('ملف غلط بيترفض من غير ما يفتح تأكيد', !(await pg.locator('#del_pw').count()));
// ملف صح → بيطلب الرقم السري
await pg.setInputFiles('#bk_file', path); await pg.waitForTimeout(400);
ck('الاسترجاع بيطلب الرقم السري', (await pg.locator('#del_pw').count())===1);
await pg.fill('#del_pw','000'); await pg.evaluate(()=>delPinOk()); await pg.waitForTimeout(200);
ck('رقم سري غلط مابيسترجعش', await pg.evaluate(()=> load('items_v1',[])[0].name==='صنف اتغيّر'));
await pg.fill('#del_pw', await pg.evaluate(()=>FIN_PASS));
await Promise.all([pg.waitForEvent('load'), pg.evaluate(()=>delPinOk())]);
await pg.waitForTimeout(800);
const r=await pg.evaluate(()=>({it:load('items_v1',[])[0].name, snap:!!localStorage.getItem('_preRestore_')}));
ck('البيانات اتسترجعت', r.it==='صنف أصلي', JSON.stringify(r));
ck('اتحفظت نسخة من الحالي قبل الاستبدال', r.snap);

// ── التقاط الأخطاء
await pg.evaluate(()=>{ setTimeout(()=>{ throw new Error('اختبار خطأ'); },0); }); await pg.waitForTimeout(300);
ck('الخطأ المفاجئ اتسجّل', await pg.evaluate(()=> /اختبار خطأ/.test((load('_lastJsErr_',{})||{}).msg||'')));
ck('اتعرضت رسالة للمستخدم', /خطأ غير متوقع/.test(await pg.locator('#toast').innerText()));
errs.length=0; // الخطأ المقصود اتسجّل في pageerror
ck('مفيش أخطاء تانية', errs.length===0, errs.join('|'));
console.log(bad?('❌ فشل '+bad):'✅ كله تمام'); await b.close(); process.exit(bad?1:0);
