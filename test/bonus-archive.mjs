// أرشيف البونص: كل فترة ليها اسم بتتحفظ نسخة كاملة لوحدها (اكسا + الموزعين) وتتعرض وتتسترجع وتتحذف
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const errs=[];
const pg = await (await b.newContext()).newPage();
pg.on('pageerror', e=>errs.push(e.message));
pg.on('dialog', d=> d.accept('الربع الثالث 2026'));          // confirm/prompt
await pg.addInitScript(()=>{ localStorage.setItem('_sync_', JSON.stringify({off:true})); });
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(1200);

const fk = await pg.evaluate(()=>BONUS_FILES[0].k);
const setAxa = (period, val)=> pg.evaluate(([period,val,fk])=>{
  bonusData={period, files:{[fk]:{file:'a.xlsx', at:'2026-04-01', rows:[{name:'صنف 1', type:'', val}]}}, rates:{}, itemLine:{}, aksa:{}};
  bonusSave(); }, [period,val,fk]);

// ── بونص اكسا
await setAxa('الربع الأول 2026', 100000);
check('أول فترة اتحفظت تلقائي', (await pg.evaluate(()=>bonusArchive.map(x=>x.period))).join('|')==='الربع الأول 2026');
await setAxa('الربع الثاني 2026', 50000);
const ar = await pg.evaluate(()=>bonusArchive.map(x=>x.period));
check('الفترتين متحفوظين لوحدهم (الجديدة ما مسحتش القديمة)', ar.length===2, ar.join('|'));
await pg.evaluate(()=>{ bonusData.rates={}; bonusSave(); bonusSave(); });
check('نفس الفترة بتتحدّث ومش بتتكرر', (await pg.evaluate(()=>bonusArchive.length))===2);

await pg.evaluate(()=>{ module='bonus'; save('_bonusTab_','arch'); render(true); }); await pg.waitForTimeout(300);
const txt = await pg.evaluate(()=>document.querySelector('#main').innerText);
check('تاب الأرشيف بيعرض الفترتين', /الربع الأول 2026/.test(txt) && /الربع الثاني 2026/.test(txt), txt.slice(0,120));
check('وفيه ملخّص الصافي والبونص', /صافي/.test(txt) && /بونص/.test(txt));

const id1 = await pg.evaluate(()=>bonusArchive.find(x=>x.period==='الربع الأول 2026').id);
await pg.evaluate(id=>bnPreview('aksa', id), id1); await pg.waitForTimeout(200);
const sh = await pg.evaluate(()=>document.querySelector('#sheet').innerText);
check('العرض بيفتح الجدول بتاع الفترة', /الربع الأول 2026/.test(sh) && /100,000/.test(sh), sh.slice(0,160));
check('العرض ما غيّرش الشغل الحالي', (await pg.evaluate(()=>bonusData.period))==='الربع الثاني 2026');
await pg.evaluate(()=>closeSheet());

await pg.evaluate(id=>bnRestore('aksa', id), id1); await pg.waitForTimeout(200);
check('الاسترجاع حمّل الفترة كشغل حالي', (await pg.evaluate(()=>bonusData.period))==='الربع الأول 2026' && (await pg.evaluate(()=>bonusLines().reduce((a,o)=>a+o.net,0)))===100000);
check('والفترة الثانية لسه محفوظة', (await pg.evaluate(()=>bonusArchive.some(x=>x.period==='الربع الثاني 2026'))));

// ── فترة جديدة: القديمة تفضل في الأرشيف
await pg.evaluate(()=>{ window.confirm=()=>true; bonusNewPeriod(); }); await pg.waitForTimeout(200);
check('فترة جديدة فضّت الشغل الحالي', (await pg.evaluate(()=>Object.keys(bonusData.files).length))===0);
check('والأرشيف لسه فيه الفترتين', (await pg.evaluate(()=>bonusArchive.length))===2);

await pg.evaluate(id=>{ window.confirm=()=>true; bnDelete('aksa', id); }, id1);
check('الحذف شغال', (await pg.evaluate(()=>bonusArchive.map(x=>x.period).join('|')))==='الربع الثاني 2026');

// ── بونص الموزعين
await pg.evaluate(()=>{
  distBonus={period:'الربع الأول 2026', files:{ghamry:{file:'g.xlsx', at:'2026-04-01', cats:[{name:'قطاعات', net:200000}]}}, cfg:{}, show:{}};
  dbSave(); });
check('بونص الموزعين اتحفظ تلقائي', (await pg.evaluate(()=>distBonusArchive.map(x=>x.period).join('|')))==='الربع الأول 2026');
await pg.evaluate(()=>{ module='dbonus'; save('_dbTab_','arch'); render(true); }); await pg.waitForTimeout(300);
check('تاب الأرشيف عند الموزعين', /الربع الأول 2026/.test(await pg.evaluate(()=>document.querySelector('#main').innerText)));
const did = await pg.evaluate(()=>distBonusArchive[0].id);
await pg.evaluate(id=>bnPreview('dist', id), did); await pg.waitForTimeout(200);
check('عرض نسخة الموزعين بيفتح', /الربع الأول 2026/.test(await pg.evaluate(()=>document.querySelector('#sheet').innerText)));
await pg.evaluate(()=>closeSheet());

// ── بيتخزن ويفضل بعد إعادة التحميل
await pg.reload(); await pg.waitForTimeout(1200);
check('الأرشيف فاضل بعد إعادة التحميل', (await pg.evaluate(()=>bonusArchive.length+'/'+distBonusArchive.length))==='1/1');
check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close(); process.exit(fail?1:0);
