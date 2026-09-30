// بونص اكسا: رفع ملف لكل قطاع → تقرير القطاع · صافي المشتريات · النسبة · البونص
// BONUS_FILE=مسار ملف حقيقي (اختياري) بيطابق أرقامه على كشف الربع التاني 2026
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { existsSync, readFileSync } from 'node:fs';
let fail=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(ok?'':'  — '+x)); if(!ok) fail++; };
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:360,height:780}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('dialog',d=>d.accept());
const LIB='/tmp/fin/lib/xlsx.bundle.js';
if(existsSync(LIB)) await pg.route(/xlsx\.bundle\.js/, r=> r.fulfill({body:readFileSync(LIB), contentType:'text/javascript'}));
await pg.addInitScript(()=>{ localStorage.setItem('_sync_', JSON.stringify({off:true})); });
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(800);
if(await pg.evaluate(()=> typeof XLSX==='undefined')){ console.log('⏭️  XLSX مش متاحة — تخطّي'); await b.close(); process.exit(0); }

ck('أيقونة «بونص اكسا» في الرئيسية', /بونص اكسا/.test(await pg.locator('.hgrid').innerText()));
await pg.evaluate(()=> switchModule('bonus')); await pg.waitForTimeout(200);
ck('تاب الملفات فيه ٥ خانات', (await pg.locator('#bn_c .card').count())===5);

// ملف بالشكل البسيط لكل قطاع (عناوين في الصف التاني، أرقام كنص، صنف مكرر)
const mk = async (fk, rows)=> pg.evaluate(({fk,rows})=>{
  const ws=XLSX.utils.aoa_to_sheet(rows), wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Sheet1');
  const buf=XLSX.write(wb,{type:'array',bookType:'xlsx'});
  const dt=new DataTransfer(); dt.items.add(new File([buf], fk+'.xlsx'));
  const inp=document.querySelector(`input[onchange*="'${fk}'"]`); inp.files=dt.files; inp.dispatchEvent(new Event('change'));
}, {fk,rows});
await mk('kraft', [['مشتريات كرافت'],['الصنف','الكمية','صافي قيمة المشتريات'],['ضلفه كرافت',10,'1,000,000'],['حلق كرافت',5,500000],['ضلفه كرافت',1,'250,000'],['الإجمالي','', 1750000]]);
await pg.waitForTimeout(500);
await mk('acc', [['الصنف','القيمه'],['سلك بليسيه 2.2',100000],['سيلكون ماستيك ابيض',40000],['فوم 900 جم',60000],['تراك المونيوم',300000],['فرش 5*7 باللفه',10000]]);
await pg.waitForTimeout(500);
let st=await pg.evaluate(()=> ({k:bonusFile('kraft'), a:bonusFile('acc')}));
ck('كرافت: صنفين (المكرر اتجمع والإجمالي اتشال)', st.k && st.k.rows.length===2 && st.k.rows[0].val===1250000, JSON.stringify(st.k&&st.k.rows));
let md=await pg.evaluate(()=> bonusModel());
const row=l=> (md.body.find(r=>r.cells[0]===l)||{}).cells;
ck('كرافت 1,750,000 × 2% = 35,000', JSON.stringify(row('كرافت لاين'))===JSON.stringify(['كرافت لاين',1750000,'2%',35000]), JSON.stringify(row('كرافت لاين')));
ck('اكسسوارات عام 300,000 × 5%', row('اكسسوارات عام')[3]===15000, JSON.stringify(row('اكسسوارات عام')));
ck('بلسيه لوحده', row('اكسسوارات ( بلسيه )')[1]===100000);
ck('سيلكون وفوم مع بعض 100,000', row('اكسسوارات ( سيلكون وفوم)')[1]===100000);
ck('الفرش برّه البونص 0%', row('خارج البونص')[2]==='0%' && row('خارج البونص')[3]===0);
const tot=md.body[md.body.length-1].cells;
ck('الإجمالي', tot[1]===2260000 && tot[3]===35000+15000+5000+5000, JSON.stringify(tot));
ck('العنوان والأعمدة', md.header.join('|')==='القطاع|صافي المشتريات|نسبة البونص|البونص المستحق');

// تعديل النسبة ونقل صنف
await pg.evaluate(()=>{ setBonusTab('rep'); }); await pg.waitForTimeout(200);
ck('التقرير اتعرض', /البونص المستحق/.test(await pg.locator('#bn_c').innerText()));
ck('بيقول إن فيه ملفات لسه ما اترفعتش', /لسه ما اترفعش: كومبن ابيض/.test(await pg.locator('#bn_c').innerText()));
await pg.locator('#bn_c td', {hasText:'كرافت لاين'}).first().click(); await pg.waitForTimeout(200);
await pg.fill('#bn_rate','2.5'); await pg.locator('#sheet .btn-save').click(); await pg.waitForTimeout(200);
md=await pg.evaluate(()=> bonusModel());
ck('النسبة اتعدلت 2.5%', JSON.stringify(row('كرافت لاين'))===JSON.stringify(['كرافت لاين',1750000,'2.5%',43750]), JSON.stringify(row('كرافت لاين')));
await pg.evaluate(()=>{ bonusLineSheet('خارج البونص'); bonusMoveItem('فرش 5*7 باللفه','اكسسوارات عام','خارج البونص'); });
md=await pg.evaluate(()=> bonusModel());
ck('نقل الفرش لعام', !row('خارج البونص') && row('اكسسوارات عام')[1]===310000, JSON.stringify(md.body));
ck('مفيش سكرول عرضي', await pg.evaluate(()=> document.documentElement.scrollWidth<=362));

// الملف الحقيقي (كشف الربع التاني 2026): نفس الملف في كل خانة، وعمود «النوع» بيفرز
const REAL=process.env.BONUS_FILE;
if(REAL && existsSync(REAL)){
  await pg.evaluate(()=>{ bonusData={period:'',files:{},rates:{},itemLine:{}}; bonusSave(); setBonusTab('files'); });
  const b64=readFileSync(REAL).toString('base64');
  for(const fk of ['kraft','kw','kb','new','acc']){
    await pg.evaluate(({fk,b64})=>{ const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
      const dt=new DataTransfer(); dt.items.add(new File([bin],'aksa.xlsx'));
      const inp=document.querySelector(`input[onchange*="'${fk}'"]`); inp.files=dt.files; inp.dispatchEvent(new Event('change')); }, {fk,b64});
    await pg.waitForTimeout(900);
  }
  md=await pg.evaluate(()=> bonusModel());
  const exp={'كرافت لاين':[54383565,1087671.3],'نيو لاين':[9192261,183845.22],'كومبن ابيض':[11554899,231097.98],'كومبن بيج':[17279734,345594.68],
    'اكسسوارات عام':[6237234,311861.7],'اكسسوارات ( بلسيه )':[496068,24803.4],'اكسسوارات ( سيلكون وفوم)':[689159,34457.95]};
  const bad=Object.entries(exp).filter(([l,[n,bb]])=>{ const r=row(l); return !r || r[1]!==n || Math.abs(r[3]-bb)>0.5; });
  ck('الأرقام زي كشف الربع التاني 2026 بالظبط', !bad.length, JSON.stringify(md.body.map(r=>r.cells)));
  ck('إجمالي البونص 2,219,332', md.body[md.body.length-1].cells[3]===2219332, JSON.stringify(md.body[md.body.length-1].cells));
}
ck('مفيش أخطاء', !errs.length, errs.join('|'));
await b.close(); process.exit(fail?1:0);
