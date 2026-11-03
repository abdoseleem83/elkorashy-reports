// النواقص والجرد: الأصناف أبجدياً عبر كل القطاعات المختارة (الحلوق تحت بعض)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(ok?'':(x?'  — '+x:''))); if(!ok) bad++; };
const b=await chromium.launch(); const pg=await (await b.newContext({viewport:{width:420,height:900}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('warehouses_v1', JSON.stringify([{id:'w1',name:'طنطا'}]));
  localStorage.setItem('units_v1', JSON.stringify(['قطعة']));
  // قطاع «كرافت» وقطاع «نيو» فيهم حلوق وأصناف تانية بترتيب إدخال مخلوط
  const mk=(id,name,g)=>({id,name,mainGroup:g,subGroup:'',baseName:'',color:'',unit:'قطعة',rollQty:''});
  localStorage.setItem('items_v1', JSON.stringify([
    mk('1','ستارة كرافت','كرافت'), mk('2','حلق كرافت ابيض','كرافت'), mk('3','باب نيو','نيو'),
    mk('4','حلق نيو بيج','نيو'), mk('5','أبواب كرافت','كرافت'), mk('6','حلق كرافت بيج','كرافت'), mk('7','حلق نيو ابيض','نيو')]));
  const st={}; ['ستارة كرافت','حلق كرافت ابيض','باب نيو','حلق نيو بيج','أبواب كرافت','حلق كرافت بيج','حلق نيو ابيض'].forEach(n=>st[n]={balance:5});
  localStorage.setItem('whStock_v1', JSON.stringify({w1:st}));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(900);
const want=['أبواب كرافت','باب نيو','حلق كرافت ابيض','حلق كرافت بيج','حلق نيو ابيض','حلق نيو بيج','ستارة كرافت'];

// الجرد
await pg.evaluate(()=>{ module='warehouses'; save('_whTab_','w1'); save('_whSub_',2); invView=0; invMain=new Set(['كرافت','نيو']); render(true); });
await pg.waitForTimeout(400);
const inv=await pg.locator('#invList .invc').evaluateAll(e=>e.map(x=>x.dataset.nm));
ck('الجرد: أبجدي عبر القطاعين (الحلوق تحت بعض)', JSON.stringify(inv)===JSON.stringify(want), inv.join('|'));

// النواقص
await pg.evaluate(()=>{ save('_whSub_',1); shortMain=new Set(['كرافت','نيو']); render(true); }); await pg.waitForTimeout(400);
const txt=await pg.evaluate(()=>document.body.innerText);
const pos=want.map(n=>txt.indexOf(n));
ck('النواقص: الأصناف ظاهرة بالترتيب الأبجدي', pos.every(p=>p>=0) && pos.every((p,i)=>i===0||p>pos[i-1]), pos.join(','));

// مستند النواقص (PDF/صورة) والإكسل
await pg.evaluate(()=>{ whShortage={w1:{}}; ['ستارة كرافت','حلق نيو بيج','باب نيو','حلق كرافت ابيض'].forEach((n,i)=>{ whShortage.w1[n]={q1:i+1,u1:'قطعة',q2:0,u2:'',note:''}; }); });
const doc=await pg.evaluate(()=>shortDocBody('w1'));
const dn=[...doc.matchAll(/<td class="n">([^<]+)<\/td>/g)].map(m=>m[1]).filter(Boolean);
// كل مجموعة رئيسية جدول: «كرافت» الأول ثم «نيو»، والأصناف جواها أبجدي
const expectAll=['حلق كرافت ابيض','ستارة كرافت','باب نيو','حلق نيو بيج'];
ck('مستند النواقص: المجموعات والأصناف أبجدي', JSON.stringify(dn)===JSON.stringify(expectAll), dn.join('|'));
const xl=await pg.evaluate(()=>{ let got=null; const real=window.saveAoaXlsx; window.saveAoaXlsx=(d)=>{ got=d; }; try{ exportShortExcel('w1'); } finally { window.saveAoaXlsx=real; } return got? got.slice(1).map(r=>r[0]).filter(n=>['ستارة كرافت','حلق نيو بيج','باب نيو','حلق كرافت ابيض'].includes(n)) : null; });
ck('إكسل النواقص: مرتّب أبجدي', JSON.stringify(xl)===JSON.stringify(expectAll), JSON.stringify(xl));
ck('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join('|'));
console.log(bad?('❌ فشل '+bad):'✅ كله تمام'); await b.close(); process.exit(bad?1:0);
