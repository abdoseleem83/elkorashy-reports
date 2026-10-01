// إعادة رفع أكواد جيفز / العملاء / الموظفين ما تبوّظش الطلبيات ولا التصنيفات ولا الحضور
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let fail=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(ok?'':'  — '+x)); if(!ok) fail++; };
const b=await chromium.launch(); const pg=await b.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.addInitScript(()=>{ localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('gvcodes_v1', JSON.stringify([{id:'g1',name:'سبلونه 40 GEVIS',code:'ISP 40',perCarton:'10',weight:'0.5',price:'2'}]));
  localStorage.setItem('gvOrders_v1', JSON.stringify([{id:'o1',name:'ط',date:'2026-09-01',containers:'1',cap:'28000',rows:[{gid:'g1',name:'سبلونه 40 GEVIS',code:'ISP 40',qty:'100'}]},
    {id:'o2',name:'قديمة',date:'2026-08-01',containers:'1',cap:'28000',rows:[{gid:'ضايع',name:'سبلونه 40 GEVIS',code:'ISP 40',qty:'50'}]}]));
  localStorage.setItem('customers_v1', JSON.stringify([{id:'c1',name:'موزع أ',cls:'موزع'}]));
  localStorage.setItem('employees_v1', JSON.stringify([{id:'e1',name:'محمد فوزي',branch:'طنطا',salary:9000}]));
  localStorage.setItem('payData_v1', JSON.stringify({'2026-09':{h1:{e1:{ot:5}}}}));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(600);
const r=await pg.evaluate(()=>{
  pendingImport={type:'gvcodes', list:[{id:'NEW1',name:'سبلونه 40 GEVIS',code:'ISP 40',perCarton:'12',weight:'0.5',price:'2.5'},{id:'NEW2',name:'جديد',code:'X',perCarton:'1',weight:'1',price:'1'}]}; commitImport();
  pendingImport={type:'customers', list:[{id:'x1',name:'موزع أ',cls:''},{id:'x2',name:'عميل جديد',cls:''}]}; commitImport();
  pendingImport={type:'employees', list:[{id:'y1',name:'محمد فوزي',branch:'طنطا',salary:9500}]}; commitImport();
  const o1=gvCalc(gvOrders.find(o=>o.id==='o1')), o2=gvCalc(gvOrders.find(o=>o.id==='o2'));
  return {gid:gvcodes[0].id, pc:gvcodes[0].perCarton, w1:o1.tot.weight, v1:o1.tot.value, w2:o2.tot.weight,
    cls:customers.find(c=>c.name==='موزع أ').cls, nc:customers.length, eid:employees[0].id, sal:employees[0].salary,
    ot:payEntry('2026-09',1,employees[0].id).ot};
});
ck('كود جيفز الموجود فضل بنفس الـid وبياناته الجديدة', r.gid==='g1' && r.pc==='12', JSON.stringify(r));
ck('الطلبية لسه ليها وزن وسعر', r.w1===50 && r.v1===250, JSON.stringify(r));
ck('طلبية قديمة ربطها ضايع اتلقت بالاسم', r.w2===25, JSON.stringify(r));
ck('العميل الموجود فضل بتصنيفه والجديد اتضاف', r.cls==='موزع' && r.nc===2, JSON.stringify(r));
ck('الموظف بنفس الـid فالحضور فضل', r.eid==='e1' && r.sal===9500 && r.ot===5, JSON.stringify(r));

// حذف صنف بيشيله من الفهرس (كان بيفضل يتلقى في المقارنات والاستيراد)
const d=await pg.evaluate(()=>{ items=[{id:'i1',name:'صنف للحذف',mainGroup:'x'}]; reindexItems();
  const before=!!itemFind('صنف  للحذف'); window.confirm=()=>true; delItem('i1');
  return {before, after: !!itemsByName['صنف للحذف'] || !!itemFind('صنف للحذف')}; });
ck('الصنف المحذوف ما بقاش بيتلقى', d.before && !d.after, JSON.stringify(d));

// تغيير اسم عميل بينقل مبيعاته، والاسم المكرر مرفوض
const rn=await pg.evaluate(()=>{
  customers=[{id:'k1',name:'قديم',cls:'موزع'},{id:'k2',name:'تاني',cls:'موزع'}];
  monthlySales={'2026-08':{'قديم':700}}; monthlySector={'2026-08':{'قديم':{'كومبن':700}}}; monthlyDoors={};
  editCustomer('k1'); document.querySelector('#c_name').value='جديد'; saveCustomer('k1');
  const a={sales:monthlySales['2026-08'], sec:monthlySector['2026-08'], alias:custAlias['قديم']};
  editCustomer('k2'); document.querySelector('#c_name').value='جديد'; saveCustomer('k2');
  return Object.assign(a,{k2:customers.find(c=>c.id==='k2').name});
});
ck('تغيير الاسم نقل المبيعات والقطاعات والاسم القديم بيتحوّل', JSON.stringify(rn.sales)==='{"جديد":700}' && rn.sec['جديد'] && rn.alias==='جديد', JSON.stringify(rn));
ck('اسم مكرر مرفوض', rn.k2==='تاني', JSON.stringify(rn));
ck('مفيش أخطاء', !errs.length, errs.join('|'));
await b.close(); process.exit(fail?1:0);
