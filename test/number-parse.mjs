// أرقام الشيتات: «12,345.50» و«١٢٣» و«(500)» بتتقري صح + تاريخ النهارده بتوقيت الجهاز
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { existsSync, readFileSync } from 'node:fs';
let fail=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(ok?'':'  — '+x)); if(!ok) fail++; };
const b=await chromium.launch();
const ctx=await b.newContext({timezoneId:'Africa/Cairo'});
const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
const LIB='/tmp/fin/lib/xlsx.bundle.js';
if(existsSync(LIB)) await pg.route(/xlsx\.bundle\.js/, r=> r.fulfill({body:readFileSync(LIB), contentType:'text/javascript'}));
// الساعة ١ الفجر في القاهرة = ١١ بالليل جرينتش يوم امبارح
await pg.clock.install({time:new Date('2026-10-01T01:30:00+03:00')});
await pg.addInitScript(()=>{ localStorage.setItem('_sync_', JSON.stringify({off:true})); });
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(800);

const r=await pg.evaluate(()=>[nz('12,345.50'), nz('١٢٣'), nz('(500)'), nz('1 250'), nz('٣٤٫٥'), nz(''), nz(null), nz('abc'), nz(7), nz(NaN), nz('300-')]);
ck('nz بيقرا كل الأشكال', JSON.stringify(r)===JSON.stringify([12345.5,123,-500,1250,34.5,0,0,0,7,0,-300]), JSON.stringify(r));
ck('تاريخ النهارده بتوقيت مصر مش جرينتش', await pg.evaluate(()=>todayStr())==='2026-10-01', await pg.evaluate(()=>todayStr()));

// رصيد متخزّن كنص بفاصلة (شيت قديم) بيتحسب
const q=await pg.evaluate(()=>{ warehouses=[{id:'w1',name:'طنطا'}]; whStock={w1:{'صنف':{balance:'1,200'}}}; return qtyOf('w1','صنف'); });
ck('رصيد «1,200» = 1200', q===1200, String(q));

if(await pg.evaluate(()=> typeof XLSX!=='undefined')){
  await pg.evaluate(()=>{
    items=[{id:'i1',name:'باب ارو 80 سم A01',mainGroup:'ابواب WPC',subGroup:'ابواب'},{id:'i2',name:'قطاع كومبن أبيض',mainGroup:'قطاعات PVC كومبن'}];
    itemsByName={}; items.forEach(i=>itemsByName[i.name]=i);
    const ws=XLSX.utils.aoa_to_sheet([['c_name','Item_Name','vout','vin','qout'],
      ['موزع أ','باب ارو 80 سم A01','12,345.50','','٢'],
      ['موزع أ','قطاع  كومبن ابيض','(1,000)','0','1'],     // مسافة زيادة + ا بدل أ + سالب بين قوسين
      ['موزع ب','قطاع كومبن أبيض',5000,'1,000',3]]);
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Header_Wide');
    const out=XLSX.write(wb,{type:'array',bookType:'xlsx'});
    importSales(new File([out],'s.xlsx'));
  });
  await pg.waitForTimeout(1200);
  const p=await pg.evaluate(()=> pendingImport && {c:pendingImport.custMap, s:pendingImport.sectorMap, d:pendingImport.doorMap});
  ck('المبلغ «12,345.50» اتقرا كامل مش 12', p && Math.abs(p.c['موزع أ']-(12345.5-1000))<0.01, JSON.stringify(p&&p.c));
  ck('vin «1,000» اتطرح', p && p.c['موزع ب']===4000, JSON.stringify(p&&p.c));
  ck('اسم الصنف بفرق بسيط راح لمجموعته مش «غير معروف»', p && p.s['موزع أ']['قطاعات PVC كومبن']===-1000, JSON.stringify(p&&p.s));
  ck('كمية «٢» بالعربي اتقرت', p && p.d['موزع أ']['باب ارو 80 سم A01'].qty===2, JSON.stringify(p&&p.d));
} else console.log('⏭️  XLSX مش متاحة — تخطّي جزء الاستيراد');
ck('مفيش أخطاء', !errs.length, errs.join('|'));
await b.close(); process.exit(fail?1:0);
