import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); if(!ok) bad++; };
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:412,height:800}});
pg.on('pageerror',e=>{bad++;console.log('❌ JS:',e.message)});
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('warehouses_v1', JSON.stringify([
    {id:'w1',name:'طنطا'},{id:'w2',name:'الاسكندرية'},{id:'w3',name:'طنطا'}]));
  localStorage.setItem('whStock_v1', JSON.stringify({w1:{'صنف أ':{balance:5}}, w3:{'صنف ب':{balance:7}}}));
  localStorage.setItem('customers_v1', JSON.stringify([{id:'a',name:'موزع أ',cls:'موزع'}]));
  localStorage.setItem('monthlySales_v1', JSON.stringify({'2026-01':{'موزع أ':100000}}));
  localStorage.setItem('monthlyDoors_v1', JSON.stringify({'2026-01':{'موزع أ':{
    'باب كامل 90 سم A02':{qty:10,val:40000,code:'A02',sub:'ابواب'}}}}));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(800);

// ١) المخازن المكررة
await pg.evaluate(()=>{ module='warehouses'; render(true); }); await pg.waitForTimeout(300);
ck('تحذير المخازن المكررة ظاهر', /مخازن متكررة/.test(await pg.evaluate(()=>document.body.innerText)));
await pg.evaluate(()=>{ window.confirm=()=>true; mergeDupWarehouse('طنطا'); }); await pg.waitForTimeout(400);
const w=await pg.evaluate(()=>({n:warehouses.length, st:Object.keys(whStock['w1']||{})}));
ck('اتدمجوا في مخزن واحد وأرصدته اتجمعت', w.n===2 && w.st.length===2, JSON.stringify(w));

// ٢) الميدالية جنب الكود ومفيش عمود م
await pg.evaluate(()=>{ module='sales'; save('_salesTab_',2); save('_salesRep_','doorcode'); render(true); });
await pg.waitForTimeout(400);
const hd=await pg.evaluate(()=> repModel('doorcode').header);
ck('مفيش عمود «م» ومفيش عمود كمية في الآخر',
  hd.join('|')==='الكود|90|الإجمالي', hd.join('|'));
const firstCell=await pg.evaluate(()=> document.querySelector('table.rep tr:nth-child(2) td').innerText);
ck('الميدالية جنب الكود', /🥇/.test(firstCell) && /A02/.test(firstCell), firstCell);

// ٣) شريط التصدير مثبّت
await pg.evaluate(()=>{ const m=document.getElementById('main'); m.scrollTop=m.scrollHeight; });
await pg.waitForTimeout(200);
const barOk=await pg.evaluate(()=>{
  const bar=document.querySelector('.fbar'); if(!bar) return 'مفيش';
  const r=bar.getBoundingClientRect();
  return (r.bottom<=innerHeight+2 && r.top<innerHeight && getComputedStyle(bar).position==='fixed')? 'ok' : JSON.stringify(r);
});
ck('شريط التصدير مثبّت في آخر الشاشة', barOk==='ok', barOk);

// ٤) اختيار اتجاه الـPDF
await pg.evaluate(()=> exportRep('doorcode','p')); await pg.waitForTimeout(300);
const t=await pg.evaluate(()=>document.body.innerText);
ck('بيسأل عن اتجاه الورقة', /اتجاه ورقة/.test(t) && /طولي/.test(t) && /أفقي/.test(t));
await pg.evaluate(()=>{ window.__land=null;
  window.doExportDocPdf=(b2,f,l)=>{ window.__land=l; };
  pdfGo(1); }); await pg.waitForTimeout(250);
ck('اختيار أفقي بيوصل للتصدير', (await pg.evaluate(()=>window.__land))===true);
ck('الاختيار اتفكر', (await pg.evaluate(()=> load('_pdfLand_',null)))===1);
console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
