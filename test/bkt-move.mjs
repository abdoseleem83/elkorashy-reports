// «عمود جديد ونقل أصناف»: الصنف المنقول بيظهر في طلبية النواقص تحت العمود ده بدل مجموعته الأصلية
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(ok?'':(x?'  — '+x:''))); if(!ok) bad++; };
const b=await chromium.launch(); const pg=await (await b.newContext({viewport:{width:420,height:900}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('warehouses_v1', JSON.stringify([{id:'w1',name:'طنطا'}]));
  const mk=(id,name,g,sg)=>({id,name,mainGroup:g,subGroup:sg,baseName:'',color:'',unit:'قطعة',rollQty:''});
  localStorage.setItem('items_v1', JSON.stringify([mk('1','باب 80 ابيض','ابواب WPC','٨٠'), mk('2','ضلفة 80 ابيض','ابواب WPC','ضلف'), mk('3','حلق كرافت','كرافت','٢٥')]));
  localStorage.setItem('whShortage_v1', JSON.stringify({w1:{'باب 80 ابيض':{q1:2,u1:'كرتونة',q2:0,u2:''},'ضلفة 80 ابيض':{q1:3,u1:'كرتونة',q2:0,u2:''},'حلق كرافت':{q1:4,u1:'لفة',q2:0,u2:''}}}));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(900);
ck('الميزة موجودة (bkSheet / bktMove)', await pg.evaluate(()=> typeof bkSheet==='function' && typeof bktMove==='object'));
let doc=await pg.evaluate(()=>shortDocBody('w1'));
ck('من غير نقل: المجموعة الأصلية «كرافت» جدول', doc.includes('>كرافت</td>') || />كرافت</.test(doc));
await pg.evaluate(()=>{ bktMove['ضلفة 80 ابيض']='ضلف فقط'; });
doc=await pg.evaluate(()=>shortDocBody('w1'));
ck('بعد النقل: «ضلف فقط» جدول منفصل فيه الضلفة', /class="gm"[^>]*><span class="gt">[^<]*<\/span>ضلف فقط</.test(doc) && doc.includes('ضلفة 80 ابيض'));
ck('عمود «ضلف فقط» في أحجام الأبواب', await pg.evaluate(()=> DOOR_SIZES.includes('ضلف فقط')));
await pg.evaluate(()=>{ module='warehouses'; save('_whTab_','w1'); save('_whSub_',1); render(true); }); await pg.waitForTimeout(300);
ck('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join('|'));
console.log(bad?('❌ فشل '+bad):'✅ كله تمام'); await b.close(); process.exit(bad?1:0);
