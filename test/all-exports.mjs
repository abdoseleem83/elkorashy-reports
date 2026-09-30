// كل التصديرات: مفيش جدول بيتقص في المستند، ومفيش عمود إكسل أضيق من محتواه
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); if(!ok) bad++; };
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:412,height:880}});
pg.on('pageerror',e=>{bad++;console.log('❌ JS:',e.message)});
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  const LONG='احمد المصري الدوليه للاستيراد والتصدير (اسكان الشرقيه)';
  // أصناف ومخازن وأرصدة
  const items=[]; ['قطاعات كرافت لاين','نيو لاين','قطاعات PVC كومبن','ابواب WPC','جيفيز'].forEach((g,gi)=>{
    for(let i=1;i<=5;i++) items.push({id:'i'+gi+i,name:g+' — صنف طويل الاسم رقم '+i,mainGroup:g,
      subGroup:'قطاع فرعي '+gi, unit:gi<3?'لفة':'كرتونة', rollQty:6, color:['ابيض','خشبي','رمادي'][i%3]});
  });
  localStorage.setItem('items_v1', JSON.stringify(items));
  const whs=[{id:'w1',name:'طنطا'},{id:'w2',name:'الاسكندرية'},{id:'w3',name:'المحلة'}];
  localStorage.setItem('warehouses_v1', JSON.stringify(whs));
  const st={}; whs.forEach((w,wi)=>{ st[w.id]={};
    items.forEach((it,i)=> st[w.id][it.name]={balance:(i+1)*(wi+2)*7, big:i, small:wi}); });
  localStorage.setItem('whStock_v1', JSON.stringify(st));
  const sh={w1:{}}; items.slice(0,8).forEach((it,i)=> sh.w1[it.name]={q1:i+1,q2:i,u1:'لفة',u2:'عود'});
  localStorage.setItem('whShortage_v1', JSON.stringify(sh));
  localStorage.setItem('invCounts_v1', JSON.stringify({w1:{date:'2026-08-01',
    counts:Object.fromEntries(items.slice(0,10).map((it,i)=>[it.name,(i+1)*3]))}}));
  // عملاء ومبيعات
  const cs=[]; for(let i=1;i<=12;i++) cs.push({id:'c'+i,name:'موزع '+i+' — '+LONG,cls:'موزع'});
  cs.push({id:'g',name:'محل جملة '+LONG,cls:'مبيعات جملة'});
  cs.push({id:'s',name:'عميل خاص '+LONG,cls:'مبيعات خاصة'});
  localStorage.setItem('customers_v1', JSON.stringify(cs));
  const ms={},sec={},dr={},im={};
  ['2026-07','2026-08'].forEach((mo,k)=>{ ms[mo]={}; sec[mo]={}; dr[mo]={}; im[mo]={};
    cs.forEach((c,i)=>{ ms[mo][c.name]=(14-i)*1234567+k*1000;
      sec[mo][c.name]={'كرافت لاين':(14-i)*400000,'نيو لاين':(14-i)*234567,'كومبن':(14-i)*345678,
        'اكسسوارات':(14-i)*98765,'جيفز':(14-i)*45678,'ابواب':(14-i)*23456};
      dr[mo][c.name]={'باب كامل خشبي 90 سم A02':{qty:(14-i)*3,val:(14-i)*45678,code:'A02',sub:'ابواب'},
                      'باب كامل ارو 80 سم A05':{qty:(14-i)*2,val:(14-i)*34567,code:'A05',sub:'ابواب'}}; });
    items.forEach((it,i)=> im[mo][it.name]={qty:i*3,val:i*98765}); });
  localStorage.setItem('monthlySales_v1', JSON.stringify(ms));
  localStorage.setItem('monthlySector_v1', JSON.stringify(sec));
  localStorage.setItem('monthlyDoors_v1', JSON.stringify(dr));
  localStorage.setItem('monthlyItems_v1', JSON.stringify(im));
  // جيفز
  localStorage.setItem('gvcodes_v1', JSON.stringify(items.slice(20).map((it,i)=>
    ({id:'g'+i,name:it.name,code:'GV'+i,perCarton:'20',weight:'1.5',price:'3.25'}))));
  localStorage.setItem('gvOrders_v1', JSON.stringify([{id:'o1',name:'حاوية سبتمبر الكبيرة',date:'2026-09-01',
    containers:'2',cap:'28',rows:items.slice(20).map((it,i)=>({gid:'g'+i,qty:String((i+1)*100),recv:String((i+1)*95)}))}]));
  // مرتبات
  const emps=[]; for(let i=1;i<=9;i++) emps.push({id:'e'+i,name:'الموظف رقم '+i+' عبد الرحمن محمد',
    branch:i%2?'طنطا':'الاسكندرية', salary:String(4000+i*250)});
  localStorage.setItem('employees_v1', JSON.stringify(emps));
  const pd={}; emps.forEach((e,i)=> pd['2026-08|1|'+e.id]={absent:i,late:i*2,extra:i*3,bonus:i*100,adv:i*50,ins:i*20,note:'ملاحظة طويلة للموظف '+i});
  localStorage.setItem('payData_v1', JSON.stringify(pd));
  // ميزان مراجعة
  localStorage.setItem('trialBal_v1', JSON.stringify({'2026-08':[
    {code:'1',name:'الأصول',debit:9000000,credit:0},
    {code:'12',name:'الأصول المتداولة',debit:9000000,credit:0},
    {code:'1201',name:'الخزينة والبنوك والعملاء والموردين',debit:9000000,credit:0},
    {code:'4',name:'الإيرادات',debit:0,credit:9000000},
    {code:'41',name:'المبيعات',debit:0,credit:6000000},
    {code:'4102',name:'مبيعات - مخزن الاسكندرية PVC',debit:0,credit:6000000},
    {code:'32',name:'المشتريات',debit:5000000,credit:0},
    {code:'3211',name:'تكلفة البضاعة المباعه - مخزن الاسكندرية',debit:5000000,credit:0},
    {code:'31',name:'المصروفات العمومية',debit:100000,credit:0},
    {code:'3177',name:'فرع طنطا',debit:100000,credit:0},
    {code:'21',name:'الإلتزامات الثابتة',debit:0,credit:5100000},
    {code:'2101',name:'رأس المال',debit:0,credit:5100000}]}));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(1100);
await pg.evaluate(()=>{ finUnlocked=true; save('_finPer_','2026-08'); finAutoSeg('2026-08');
  gvCur='o1'; save('_gvCur_','o1'); render(true); });
await pg.waitForTimeout(300);

// ═══ ١) كل مستندات الـPDF/الصورة: مفيش جدول بيتقص
const docs = await pg.evaluate(()=>{
  const list=[
    ['نواقص',            ()=> shortDocBody('w1'), false],
    ['مقارنة الفروع',    ()=> compareDocBody(), false],
    ['مقارنة الألوان',   ()=> colorsDocBody(), true],
    ['جيفز بالكراتين',   ()=> gvCompareDocBody(), true],
    ['جرد',              ()=> invDocBody('w1'), false],
    ['كشف المرتبات',     ()=> payDocBody(), true],
    ['طلبية جيفز',       ()=> gvDocBody(), true],
    ['استلام جيفز',      ()=> gvRecvDocBody(), true],
    ['تسعير جيفز',       ()=> gvPriceDocBody(), true],
  ];
  ['dist','distsec','doorcode','distdoor','special','cmpmo'].forEach(id=>
    list.push(['تقرير '+id, ()=>{ const md=repModel(id); md.hiLo=modelHiLo(md);
      return `<div class="dx"><h2>${md.title}</h2><div class="sub">x</div>${docTableHtml(md)}</div>`; }, true]));
  ['tb','fin_isco','fin_bs'].forEach(id=>
    list.push(['مالية '+id, ()=>{ const md=repModel(id); md.hiLo=modelHiLo(md);
      return `<div class="dx"><h2>${md.title}</h2><div class="sub">x</div>${docTableHtml(md)}</div>`; }, false]));
  const out=[];
  list.forEach(([name, fn, ls])=>{
    let body; try{ body=fn(); }catch(e){ out.push({name, err:String(e).slice(0,60)}); return; }
    if(!body){ out.push({name, err:'فاضي'}); return; }
    [false,true].forEach(land=>{
      const el=mkDoc(body, land);
      const t=el.querySelector('table');
      const cut = t ? t.getBoundingClientRect().width > el.clientWidth + 2 : false;
      // خانة فيها نص متقصّ
      const over=[...el.querySelectorAll('td,th')].filter(c=> c.scrollWidth > c.clientWidth+1).length;
      out.push({name, land, doc:el.clientWidth, tbl:t?Math.round(t.getBoundingClientRect().width):0, cut, over});
      el.remove();
    });
  });
  return out;
});
const errs=docs.filter(d=>d.err);
ck('كل المستندات بتتبني من غير أخطاء', errs.length===0, JSON.stringify(errs));
const cuts=docs.filter(d=>d.cut);
ck('مفيش جدول بيتقص في أي تصدير (طولي وأفقي)', cuts.length===0,
  cuts.map(c=>c.name+(c.land?' أفقي':' طولي')+' '+c.tbl+'>'+c.doc).join(' · '));
const ovs=docs.filter(d=>d.over>0);
ck('مفيش خانة نصها متقصّ', ovs.length===0, ovs.map(o=>o.name+':'+o.over).join(' · '));
ck('اتفحص '+docs.length+' مستند', docs.length>=30, String(docs.length));
const widened=docs.filter(d=>!d.land && d.doc>780).length;
ck('المستندات العريضة وسّعت نفسها في الطولي', widened>0, 'عدد='+widened);

// ═══ ٢) كل ملفات الإكسل: مفيش عمود أضيق من محتواه
const xl = await pg.evaluate(()=>{
  const out=[]; const real=window.saveAoaXlsx;
  const runs=[
    ['نواقص', ()=> exportShortExcel('w1')],
    ['مقارنة الفروع', ()=> exportCompareExcel()],
    ['جيفز كراتين', ()=> exportGvCompareExcel()],
    ['جرد', ()=> exportInvExcel('w1')],
    ['مرتبات', ()=> exportPayExcel()],
    ['طلبية جيفز', ()=> exportGvExcel()],
    ['استلام جيفز', ()=> exportGvRecvExcel()],
    ['تسعير جيفز', ()=> exportGvPriceExcel()],
  ];
  ['dist','distsec','doorcode','distdoor','special','cmpmo','tb','fin_isco','fin_bs'].forEach(id=>
    runs.push(['إكسل '+id, ()=> exportRep(id,'x')]));
  runs.forEach(([name, fn])=>{
    let got=null;
    window.saveAoaXlsx=(d,sh,fname,w,o)=>{ got={d,w}; };
    try{ fn(); }catch(e){ out.push({name, err:String(e).slice(0,60)}); }
    window.saveAoaXlsx=real;
    if(!got){ if(!out.some(x=>x.name===name)) out.push({name, skip:true}); return; }
    const ncol=Math.max(...got.d.map(r=>(r||[]).length));
    const fit=xlsxColWidths(got.d, got.w, ncol);   // العرض الفعلي في الملف
    const narrow=[];
    for(let c=0;c<ncol;c++){
      let mx=0;
      got.d.forEach(r=>{ const v=(r||[])[c]; if(v===undefined||v===null||v==='') return;
        const t=typeof v==='number'? Math.round(v).toLocaleString('en-US') : String(v);
        if(t.length>mx) mx=t.length; });
      const w=(fit&&fit[c])||0;
      if(mx && w < Math.min(48, mx+2) - 0.001) narrow.push(c+':'+w+'<'+(mx+2));
    }
    out.push({name, cols:ncol, wlen:fit.length, narrow});
  });
  return out;
});
const xerr=xl.filter(x=>x.err);
ck('كل ملفات الإكسل بتتبني من غير أخطاء', xerr.length===0, JSON.stringify(xerr));
const skipped=xl.filter(x=>x.skip);
ck('كل التصديرات اشتغلت', skipped.length===0, skipped.map(x=>x.name).join('، '));
const badw=xl.filter(x=>x.narrow && x.narrow.length);
ck('مفيش عمود إكسل أضيق من محتواه', badw.length===0,
  badw.map(x=>x.name+' ['+x.narrow.join(',')+']').join(' · '));
const mism=xl.filter(x=>x.cols && x.wlen && x.wlen!==x.cols);
ck('عدد الأعرض = عدد الأعمدة في كل ملف', mism.length===0,
  mism.map(x=>x.name+' '+x.wlen+'/'+x.cols).join(' · '));
ck('اتفحص '+xl.length+' ملف إكسل', xl.length>=15, String(xl.length));
console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
