// زحف على كل الشاشات والضغط على كل زرار — بأسماء فيها ' و " و < و & — ومفيش ولا خطأ JS
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); if(!ok) bad++; };
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:412,height:880}});
const errs=[];
pg.on('pageerror',e=> errs.push('pageerror: '+e.message));
pg.on('console',m=>{ if(m.type()==='error' && !/Failed to load resource|net::ERR|jsdelivr|script\.google|lib /i.test(m.text())) errs.push('console: '+m.text()); });
pg.on('dialog', d=> d.dismiss());      // confirm/prompt = لأ، فمفيش حذف
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  const Q=`باب 2" O'Neil <ع> & شركاه`;          // اسم صعب
  const items=[]; ['قطاعات كرافت لاين','نيو لاين','قطاعات PVC كومبن','ابواب WPC','جيفيز',"شاتر 'خاص'"].forEach((g,gi)=>{
    for(let i=1;i<=3;i++) items.push({id:'i'+gi+i,name:(i===1?Q+' ':'')+g+' صنف '+i,mainGroup:g,
      subGroup:gi===3?'ابواب':'فرعي "'+gi+'"',unit:gi<3?'لفة':'كرتونة',rollQty:6,color:['ابيض','خشبي'][i%2]}); });
  localStorage.setItem('items_v1', JSON.stringify(items));
  localStorage.setItem('units_v1', JSON.stringify(['لفة','كرتونة',"قطعة 'x'"]));
  const whs=[{id:'w1',name:'طنطا'},{id:'w2',name:"الاسكندرية 'ب'"}];
  localStorage.setItem('warehouses_v1', JSON.stringify(whs));
  const st={}; whs.forEach((w,wi)=>{ st[w.id]={}; items.forEach((it,i)=> st[w.id][it.name]={balance:(i+1)*(wi+2)}); });
  localStorage.setItem('whStock_v1', JSON.stringify(st));
  localStorage.setItem('whShortage_v1', JSON.stringify({w1:{[items[0].name]:{q1:2,q2:1}}}));
  const cs=[{id:'c1',name:Q,cls:'موزع'},{id:'c2',name:'موزع "طنطا"',cls:'موزع'},{id:'c3',name:"جملة 'أ'",cls:'مبيعات جملة'},
    {id:'c4',name:'خاص',cls:'مبيعات خاصة'},{id:'c5',name:'ابواب',cls:'عميل ابواب'},{id:'c6',name:"جديد 'x'",cls:''}];
  localStorage.setItem('customers_v1', JSON.stringify(cs));
  const ms={},sec={},dr={},im={};
  ['2026-07','2026-08'].forEach(mo=>{ ms[mo]={}; sec[mo]={}; dr[mo]={}; im[mo]={};
    cs.forEach((c,i)=>{ ms[mo][c.name]=(9-i)*100000;
      sec[mo][c.name]={'قطاعات كرافت لاين':(9-i)*40000,'قطاعات PVC كومبن':(9-i)*30000,"شاتر 'خاص'":(9-i)*5000};
      dr[mo][c.name]={[Q+' 90 سم A02']:{qty:3,val:9000,code:'A02',sub:'ابواب'},['خدمة قص']:{qty:1,val:100,code:'',sub:'ابواب'},
        ['باب رشدي 80 سم']:{qty:2,val:5000,code:'',sub:'ابواب'}}; });
    items.forEach((it,i)=> im[mo][it.name]={qty:i,val:i*1000}); });
  localStorage.setItem('monthlySales_v1', JSON.stringify(ms));
  localStorage.setItem('monthlySector_v1', JSON.stringify(sec));
  localStorage.setItem('monthlyDoors_v1', JSON.stringify(dr));
  localStorage.setItem('monthlyItems_v1', JSON.stringify(im));
  localStorage.setItem('gvcodes_v1', JSON.stringify(items.slice(12).map((it,i)=>({id:'g'+i,name:it.name,code:'GV '+i,perCarton:'10',weight:'1',price:'2'}))));
  localStorage.setItem('gvOrders_v1', JSON.stringify([{id:'o1',name:"طلبية 'سبتمبر'",date:'2026-09-01',containers:'1',cap:'28000',
    rows:items.slice(12).map((it,i)=>({gid:'g'+i,qty:'100',recv:'90'}))}]));
  localStorage.setItem('employees_v1', JSON.stringify([{id:'e1',name:Q,branch:"الاسكندرية 'ب'",salary:'9000',half:2},
    {id:'e2',name:'جمال',branch:'طنطا',salary:'8000',half:1}]));
  localStorage.setItem('trialBal_v1', JSON.stringify({'2026-08':[
    {code:'12',name:'متداولة',debit:500,credit:0},{code:'1201',name:Q,debit:500,credit:0},
    {code:'4102',name:'مبيعات PVC',debit:0,credit:900},{code:'3211',name:'تكلفة',debit:400,credit:0},
    {code:'2101',name:'رأس المال',debit:0,credit:0}]}));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(1000);
await pg.evaluate(()=>{ finUnlocked=true; });

// كل الشاشات اللي هنزورها
const screens = await pg.evaluate(()=>{
  const S=[];
  S.push({mod:null});
  [0,1,2].forEach(t=> S.push({mod:'items', k:'_itemsTab_', v:t}));
  ['cmpx', ...warehouses.map(w=>w.id)].forEach(t=> S.push({mod:'warehouses', k:'_whTab_', v:t}));
  ['compare','colors','gvbox'].forEach(v=> S.push({mod:'warehouses', k:'_whTab_', v:'cmpx', k2:'_cmpView_', v2:v}));
  warehouses.forEach(w=> [0,1,2,3].forEach(n=> S.push({mod:'warehouses', k:'_whTab_', v:w.id, k2:'_whSub_', v2:n})));
  [0,1,2].forEach(t=> S.push({mod:'sales', k:'_salesTab_', v:t}));
  SALES_REPORTS.forEach(r=> S.push({mod:'sales', k:'_salesTab_', v:2, k2:'_salesRep_', v2:r.id}));
  ['month','quarter','year'].forEach(g=> S.push({mod:'sales', k:'_salesTab_', v:2, k2:'_salesRep_', v2:'dist', k3:'_moGroup_', v3:g}));
  [0,1,2].forEach(t=> S.push({mod:'gv', gv:t}));
  [0,1,2].forEach(t=> S.push({mod:'payroll', k:'_payTab_', v:t}));
  FIN_VIEWS.forEach(v=> S.push({mod:'fin', k:'_finView_', v:v.id}));
  return S; });

let clicks=0, visited=0;
for(const sc of screens){
  const go=async()=> pg.evaluate(sc2=>{
    try{ closeSheet(); }catch(e){}
    module=sc2.mod;
    if(sc2.k) save(sc2.k, sc2.v); if(sc2.k2) save(sc2.k2, sc2.v2); if(sc2.k3) save(sc2.k3, sc2.v3);
    if(sc2.gv!==undefined){ gvTab=sc2.gv; gvCur='o1'; }
    render(true); }, sc);
  await go(); await pg.waitForTimeout(120); visited++;
  // عدد العناصر القابلة للضغط في الشاشة
  const n = await pg.evaluate(()=> document.querySelectorAll('#main [onclick]').length);
  for(let i=0;i<Math.min(n,60);i++){
    const did = await pg.evaluate(i=>{
      const els=[...document.querySelectorAll('#main [onclick]')];
      const el=els[i]; if(!el) return false;
      const code=el.getAttribute('onclick')||'';
      if(/export|Pdf|Excel|Image|syncNow|location\.reload|finLock|del[A-Z]|reset|Clear|payColsAll|goHome|switchModule|setFinView|setSalesTab|setWhTab|setItemsTab|setPayTab|setGvTab|setCmpView|setSalesReport/.test(code)) return false;
      el.click(); return true; }, i);
    if(did){ clicks++; await pg.waitForTimeout(40);
      // الشيت اللي اتفتح: نضغط أزراره اللي مش حفظ/حذف
      await pg.evaluate(()=>{
        const sh=document.querySelector('.overlay.show .sheet'); if(!sh) return;
        [...sh.querySelectorAll('[onclick]')].slice(0,12).forEach(b=>{
          const c=b.getAttribute('onclick')||'';
          if(!/save|Save|del|merge|Merge|commit|Hide|finUnlock|pdfGo|noCodeSave|doorCodeSave/.test(c)) try{ b.click(); }catch(e){}
        }); });
      await pg.evaluate(()=>{ try{ closeSheet(); }catch(e){} });
      await go(); await pg.waitForTimeout(60);
    }
  }
}
ck('زرت '+visited+' شاشة وضغطت '+clicks+' زرار', visited>40 && clicks>150, visited+' / '+clicks);
ck('مفيش ولا خطأ JS', errs.length===0, [...new Set(errs)].slice(0,8).join(' ‖ '));
console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
