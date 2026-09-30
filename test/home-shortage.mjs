// عدّاد النواقص في الرئيسية يعدّ الأصناف اللي فيها كمية بس + الأيقونات ٣ في الصف على الموبايل
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'path';
const url='file://'+path.resolve('index.html');
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:400,height:800}});
let fail=0; const ck=(n,c,x='')=>{ console.log((c?'✅ ':'❌ ')+n+(c?'':'  — '+x)); if(!c) fail++; };
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(url); await pg.waitForTimeout(300);
await pg.evaluate(()=>{
  const w={id:'w1',name:'طنطا'}; warehouses.push(w); save('warehouses_v1',warehouses);
  whShortage.w1={'صنف أ':{q1:'',q2:''},'صنف ب':{q1:0,q2:0},'صنف ج':{note:'x'}};
  whShortage.gone={'صنف د':{q1:5}};   // مخزن اتمسح
  goHome();
});
await pg.waitForTimeout(200);
let t=await pg.locator('.kpi').nth(1).innerText();
ck('من غير كميات = مفيش نواقص', t.includes('مفيش نواقص'), t);
ck('ولا تنبيه نواقص', !(await pg.locator('.hnote').allInnerTexts()).join('|').includes('النواقص'));
await pg.evaluate(()=>{ whShortage.w1['صنف أ']={q1:3}; whShortage.w1['صنف ب']={q2:2}; goHome(); });
await pg.waitForTimeout(200);
t=await pg.locator('.kpi').nth(1).innerText();
ck('صنفين فيهم كمية = 2', /^2\b/.test(t.trim()), t);
const tops=await pg.locator('.htile').evaluateAll(els=>els.slice(0,3).map(e=>Math.round(e.getBoundingClientRect().top)));
ck('٣ أيقونات في الصف', tops.length===3 && tops[0]===tops[2], JSON.stringify(tops));
const sw=await pg.evaluate(()=>document.documentElement.scrollWidth);
ck('مفيش سكرول عرضي', sw<=400, sw);
ck('مفيش أخطاء', !errs.length, errs.join('|'));
await b.close(); if(fail){ console.log('❌ فشل '+fail); process.exit(1); }
