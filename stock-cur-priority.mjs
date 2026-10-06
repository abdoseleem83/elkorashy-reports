// عمود cur له الأولوية على أي عمود تاني فيه «رصيد/كمية»، وشيت الإسكندرية (اسم الصنف / الرصيد) لسه بيتقرا.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const APP = process.env.APP_URL, XL = process.env.XLSX_LOCAL;
const errs=[];
const pg = await (await b.newContext()).newPage();
pg.on('pageerror', e=>errs.push(e.message));
if(XL) await pg.route('**/xlsx-js-style*/**', r=>r.fulfill({path:XL, contentType:'application/javascript'}));
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('warehouses_v1', JSON.stringify([{id:'w1',name:'طنطا'},{id:'w2',name:'الاسكندرية'}]));
});
await pg.goto(APP); await pg.waitForTimeout(1500);
const toW2 = () => pg.evaluate(()=>{ module='warehouses'; save('_whTab_','w2'); save('_whSub_',0); render(true); });
const run = async (file) => { await toW2(); await pg.waitForTimeout(250); await pg.setInputFiles('#impStock', file); await pg.waitForTimeout(900);
  await pg.evaluate(()=>commitImport()); await pg.waitForTimeout(300); return pg.evaluate(()=>whStock.w2); };

// ١) شيت فيه عمود «رصيد سابق» قبل cur → لازم ياخد cur
const mk = await pg.evaluate(()=>{
  const rows=[[],['رصيد سابق','Item_Name','tot_out','cur','الكمية'],[999,'صنف أ',5,40,888],[999,'صنف ب',0,7,888]];
  const ws=XLSX.utils.aoa_to_sheet(rows), wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Header');
  return Array.from(new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})));
});
fs.writeFileSync('/tmp/cur-decoy.xlsx', Buffer.from(mk));
let st = await run('/tmp/cur-decoy.xlsx');
check('cur ليه الأولوية (٤٠ مش ٩٩٩ ولا ٨٨٨)', st['صنف أ']?.balance===40 && st['صنف ب']?.balance===7, JSON.stringify([st['صنف أ'],st['صنف ب']]));

// ٢) شيت الإسكندرية الحقيقي (اسم الصنف / الرصيد)
const alex = new URL('./fixtures/stock-alex.xlsx', import.meta.url).pathname;
st = await run(alex);
check('شيت الإسكندرية: ٣٦١ صنف', Object.keys(st).length===361, String(Object.keys(st).length));
check('«باكته دبل جرار ابيض kom» = ١٧١', st['باكته دبل جرار ابيض kom']?.balance===171);
check('«وش تسكيك كالون كبير aksa» = ٢٧٥', st['وش تسكيك كالون كبير aksa']?.balance===275);
check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close(); process.exit(fail?1:0);
