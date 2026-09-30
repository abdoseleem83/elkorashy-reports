// اختيار أعمدة كشف المرتبات الكامل وكشف الإرسال
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); if(!ok) bad++; };
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:412,height:880}});
pg.on('pageerror',e=>{bad++;console.log('❌ JS:',e.message)});
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('employees_v1', JSON.stringify([
    {id:'e1',name:'محمد فوزي',branch:'الاسكندريه',salary:'11000',half:2},
    {id:'e2',name:'جمال رمضان',branch:'طنطا',salary:'8500',half:2}]));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(900);
await pg.evaluate(()=>{ module='payroll'; save('_payTab_',2); payKind='full'; payMonth='2026-09'; payHalf=2; render(true); });
await pg.waitForTimeout(350);
ck('زرار اختيار الأعمدة ظاهر في الكشف الكامل',
  /اختيار الأعمدة \(15 من 15\)/.test(await pg.evaluate(()=>document.body.innerText)));
let h=await pg.evaluate(()=> payModel().header);
ck('الكشف الكامل ١٥ عمود + م والموظف والفرع', h.length===18, String(h.length));

await pg.evaluate(()=> payColsSheet()); await pg.waitForTimeout(250);
ck('الشيت فيه كل الأعمدة', (await pg.locator('.sheet .clschip').count())===15);
// نشيل ٣ أعمدة
for(const k of ['dAb','dLate','dPen']) await pg.evaluate(x=> payColToggle(x), k);
await pg.waitForTimeout(250);
h=await pg.evaluate(()=> payModel().header);
ck('بعد شيل ٣ أعمدة بقى ١٥', h.length===15, h.join('|'));
ck('خصم الغياب والتأخير والجزاءات اتشالوا',
  !h.includes('خصم غياب') && !h.includes('خصم تأخير') && !h.includes('خصم جزاءات'), '');
ck('الاختيار اتحفظ',
  (await pg.evaluate(()=> JSON.parse(localStorage.getItem('payFullCols_v1')).length))===12);
// «الصافي بس»
await pg.evaluate(()=> payColsAll(0)); await pg.waitForTimeout(250);
h=await pg.evaluate(()=> payModel().header);
ck('«الصافي بس» = م والموظف والفرع والصافي', h.join('|')==='م|الموظف|الفرع|الصافي', h.join('|'));
await pg.evaluate(()=> payColsAll(1)); await pg.waitForTimeout(250);
ck('«الكل» رجّعهم', (await pg.evaluate(()=> payModel().header.length))===18);

// فرع واحد = عمود الفرع وسطر الفرع مالهمش لازمة
await pg.evaluate(()=> setPayExportBranch('الاسكندريه')); await pg.waitForTimeout(250);
const md=await pg.evaluate(()=> payModel());
ck('فرع واحد: عمود «الفرع» اتشال', !md.header.includes('الفرع'), md.header.slice(0,4).join('|'));
ck('ومفيش سطر فرع ولا إجمالي فرع مكرر',
  !md.body.some(r=>r.type==='branch') && !md.body.some(r=>r.type==='sub'), '');
await pg.evaluate(()=> setPayExportBranch('')); await pg.waitForTimeout(200);
ck('كل الفروع: الفرع رجع', (await pg.evaluate(()=> payModel().header)).includes('الفرع'));

// كشف الإرسال ليه اختياره لوحده
await pg.evaluate(()=>{ setPayKind('send'); }); await pg.waitForTimeout(250);
ck('كشف الإرسال زرار بعدده هو',
  /اختيار الأعمدة \(9 من 10\)/.test(await pg.evaluate(()=>document.body.innerText)), '');
// المستند العريض بيدخل كامل
const w=await pg.evaluate(()=>{ payKind='full'; const el=mkDoc(payDocBody(), true);
  const t=el.querySelector('table'); const r={cut: t.getBoundingClientRect().width > el.clientWidth+2};
  el.remove(); return r; });
ck('الكشف الكامل مش بيتقص', !w.cut, JSON.stringify(w));
console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
