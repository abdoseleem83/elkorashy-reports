// نتيجة الجرد: كل مجموعة (كرافت / نيو / …) عجزها وزيادتها مع بعض — في الشاشة وPDF/الصورة والإكسل.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const APP = process.env.APP_URL, XL = process.env.XLSX_LOCAL;
const errs=[];
const pg = await (await b.newContext({viewport:{width:420,height:800}})).newPage();
pg.on('pageerror', e=>errs.push(e.message));
if(XL) await pg.route('**/xlsx-js-style*/**', r=>r.fulfill({path:XL, contentType:'application/javascript'}));
await pg.addInitScript(()=>{
  const mk=(id,name,g)=>({id,name,mainGroup:g,subGroup:'',baseName:'',color:'',unit:'قطعة',rollQty:''});
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  localStorage.setItem('warehouses_v1', JSON.stringify([{id:'w1',name:'طنطا'}]));
  localStorage.setItem('items_v1', JSON.stringify([
    mk('1','كرافت أبيض','كرافت'), mk('2','كرافت أسود','كرافت'), mk('3','كرافت بيج','كرافت'),
    mk('4','نيو أبيض','نيو'), mk('5','نيو رمادي','نيو'),
    mk('6','kom أبيض','kom'), mk('7','صنف بلا مجموعة','')]));
  localStorage.setItem('whStock_v1', JSON.stringify({w1:{'كرافت أبيض':{balance:10},'كرافت أسود':{balance:10},'كرافت بيج':{balance:10},'نيو أبيض':{balance:10},'نيو رمادي':{balance:10},'kom أبيض':{balance:10},'صنف بلا مجموعة':{balance:10}}}));
  // كرافت: عجز ٣ + ٢ وزيادة ٤ | نيو: عجز ١ + زيادة ٥ | kom: مطابق | بلا مجموعة: عجز ٩
  localStorage.setItem('invCounts_v1', JSON.stringify({w1:{date:'2026-10-06',counts:{
    'كرافت أبيض':{actual:7},'كرافت أسود':{actual:14},'كرافت بيج':{actual:8},
    'نيو أبيض':{actual:15},'نيو رمادي':{actual:9},'kom أبيض':{actual:10},'صنف بلا مجموعة':{actual:1}}}}));
});
await pg.goto(APP); await pg.waitForTimeout(1500);
await pg.evaluate(()=>{ module='warehouses'; save('_whTab_','w1'); save('_whSub_',2); invView=1; render(true); });
await pg.waitForTimeout(400);

const groups = await pg.locator('.invgrp').evaluateAll(els=>els.map(e=>({head:e.firstElementChild.innerText.replace(/\s+/g,' ').trim(), rows:[...e.querySelectorAll('.card')].map(c=>c.querySelector('.name').innerText+'='+c.querySelector('b').innerText)})));
check('٣ مجموعات بس (kom مطابق ما بيظهرش)', groups.length===3, groups.map(g=>g.head).join(' || '));
check('الترتيب: كرافت ثم نيو ثم «غير مصنف» في الآخر', /كرافت/.test(groups[0].head) && /نيو/.test(groups[1].head) && /غير مصنف/.test(groups[2].head));
check('كرافت: العجز (٣ و٢) وبعده الزيادة (٤) في نفس المجموعة', JSON.stringify(groups[0].rows)===JSON.stringify(['كرافت أبيض=-3','كرافت بيج=-2','كرافت أسود=+4']), groups[0].rows.join(' | '));
check('عنوان كرافت: عجز ٢ بإجمالي ٥ وزيادة ١ بإجمالي ٤', /عجز 2/.test(groups[0].head) && /-5|-٥/.test(groups[0].head) && /زيادة 1/.test(groups[0].head) && /\+4|\+٤/.test(groups[0].head), groups[0].head);
check('نيو: عجز ١ وزيادة ٥ مع بعض', JSON.stringify(groups[1].rows)===JSON.stringify(['نيو رمادي=-1','نيو أبيض=+5']), groups[1].rows.join(' | '));
check('مجموعة kom (مطابقة) مش ظاهرة', !(await pg.locator('body').innerText()).includes('kom أبيض'));
check('مفيش العناوين القديمة «تفاصيل العجز / تفاصيل الزيادة»', !(await pg.locator('body').innerText()).includes('تفاصيل العجز'));
check('بطاقات الإحصائيات فوق لسه موجودة', (await pg.locator('body').innerText()).includes('أصناف مجرودة'));

// PDF / صورة
const doc = await pg.evaluate(()=>invDocBody('w1'));
const h3 = [...doc.matchAll(/<h3>(.*?)<\/h3>/g)].map(m=>m[1]);
check('المستند: عنوان لكل مجموعة (٣)', h3.length===3 && h3[0].startsWith('كرافت') && h3[1].startsWith('نيو'), h3.join(' || '));
check('المستند: فيه الفرق بإشارته وماعادش فيه «تفاصيل العجز»', doc.includes('>-3<') && doc.includes('>+4<') && !doc.includes('تفاصيل العجز'));
const iK = doc.indexOf('كرافت أبيض'), iN = doc.indexOf('نيو أبيض');
check('أصناف كرافت كلها قبل أصناف نيو', iK>0 && iN>iK && doc.indexOf('كرافت أسود')<iN);

// إكسل
const aoa = await pg.evaluate(()=>{ let got=null; const o=window.saveAoaXlsx; window.saveAoaXlsx=a=>{ got=a; }; exportInvExcel('w1'); window.saveAoaXlsx=o; return got; });
check('الإكسل: صف عنوان لكل مجموعة ثم أصنافها', aoa && aoa[2][0].startsWith('كرافت') && aoa[3][1]==='كرافت أبيض' && aoa[3][4]===-3 && aoa[5][1]==='كرافت أسود' && aoa[5][4]===4 && aoa[6][0].startsWith('نيو'), aoa && aoa.slice(1,8).map(r=>r.join('~')).join(' || '));
check('الإكسل: مفيش «تفاصيل العجز»', !JSON.stringify(aoa).includes('تفاصيل العجز'));

// لا يوجد فروق → رسالة مطابقة
await pg.evaluate(()=>{ invCounts.w1.counts={'kom أبيض':{actual:10}}; save('invCounts_v1',invCounts); render(true); }); await pg.waitForTimeout(300);
check('كله مطابق → رسالة «كل الأصناف المجرودة مطابقة»', (await pg.locator('body').innerText()).includes('كل الأصناف المجرودة مطابقة'));
check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح · ${fail} فشل`);
await b.close(); process.exit(fail?1:0);
