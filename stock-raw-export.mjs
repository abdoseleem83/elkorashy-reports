// شيت الأرصدة اللي بيتصدّر خام من برنامج الحسابات (Item_Name / cur وفي أوله صف فاضي)
// لازم يتقرا في مخزن طنطا ومخزن الاسكندرية زي الشيت العربي بالظبط.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const APP = process.env.APP_URL;
const XLSX_LOCAL = process.env.XLSX_LOCAL;   // اختياري: نسخة محلية من المكتبة لو مفيش إنترنت
const errs=[];
const pg = await (await b.newContext()).newPage();
pg.on('pageerror', e=>errs.push(e.message));
if(XLSX_LOCAL) await pg.route('**/xlsx-js-style*/**', r=>r.fulfill({path:XLSX_LOCAL, contentType:'application/javascript'}));
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('warehouses_v1', JSON.stringify([{id:'w1',name:'طنطا'},{id:'w2',name:'الاسكندرية'}]));
  localStorage.setItem('whStock_v1', JSON.stringify({}));
});
await pg.goto(APP); await pg.waitForTimeout(1500);
const FILE = new URL('./fixtures/stock-raw-tanta.xls', import.meta.url).pathname;

for(const [wid, tabName] of [['w1','طنطا'],['w2','الاسكندرية']]){
  await pg.evaluate(id=>{ module='warehouses'; save('_whTab_',id); save('_whSub_',0); render(true); }, wid);
  await pg.waitForTimeout(400);
  await pg.setInputFiles('#impStock', FILE);
  await pg.waitForTimeout(800);
  const sheet = await pg.evaluate(()=>document.body.innerText);
  check(tabName+': شاشة التأكيد ظهرت بعدد الأصناف', /219\s*صنف/.test(sheet), (sheet.match(/\d+\s*صنف/)||[''])[0]);
  check(tabName+': اسم الملف ظاهر في التأكيد', sheet.includes('stock-raw-tanta.xls'));
  await pg.evaluate(()=>commitImport()); await pg.waitForTimeout(400);
  const st = await pg.evaluate(id=>whStock[id], wid);
  const names = Object.keys(st||{});
  check(tabName+': اتخزّن ٢١٩ صنف', names.length===219, String(names.length));
  check(tabName+': رصيد باب كامل بني 70 سم A07 = 1', st['باب كامل بني 70 سم A07']?.balance===1);
  check(tabName+': رصيد باكته دبل جرار ابيض kom = 252', st['باكته دبل جرار ابيض kom']?.balance===252);
  check(tabName+': رصيد باكته سنجل جرار كرافت ابيض = 75 (الحالي مش السابق)', st['باكته سنجل جرار كرافت ابيض']?.balance===75, String(st['باكته سنجل جرار كرافت ابيض']?.balance));
  check(tabName+': سطر الإجماليات اتجاهل', !names.some(n=>/total_|Item_Count/i.test(n)));
}
const other = await pg.evaluate(()=>Object.keys(whStock.w1).length===Object.keys(whStock.w2).length);
check('المخزنين اتخزّنوا منفصلين', other);

// الشيت العربي القديم لسه شغال
const arb = await pg.evaluate(()=>{
  const rows=[['الصنف','الرصيد'],['صنف تجريبي',7]];
  const ws=XLSX.utils.aoa_to_sheet(rows), wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'ارصدة');
  return Array.from(new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})));
});
fs.writeFileSync('/tmp/arb-stock.xlsx', Buffer.from(arb));
await pg.evaluate(()=>{ save('_whTab_','w2'); save('_whSub_',0); render(true); }); await pg.waitForTimeout(300);
await pg.setInputFiles('#impStock', '/tmp/arb-stock.xlsx'); await pg.waitForTimeout(600);
await pg.evaluate(()=>commitImport()); await pg.waitForTimeout(300);
check('الشيت العربي القديم لسه بيتقرا', (await pg.evaluate(()=>whStock.w2['صنف تجريبي']?.balance))===7);

check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close(); process.exit(fail?1:0);
