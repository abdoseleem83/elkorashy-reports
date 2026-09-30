// المستند المصدَّر: جدول عريض ما يتقصّش في الطولي
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
let bad=0; const ck=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); if(!ok) bad++; };
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:412,height:880}});
pg.on('pageerror',e=>{bad++;console.log('❌ JS:',e.message)});
await pg.addInitScript(()=>{
  localStorage.setItem('_sync_', JSON.stringify({off:true}));
  const cs=[],ms={},sec={};
  for(let i=1;i<=14;i++) cs.push({id:'c'+i,name:'موزع '+i+' (احمد المصري الدوليه للاستيراد)',cls:'موزع'});
  ms['2026-08']={}; sec['2026-08']={};
  cs.forEach((c,i)=>{ ms['2026-08'][c.name]=(15-i)*1234567;
    sec['2026-08'][c.name]={'كرافت لاين':(15-i)*1234567,'نيو لاين':(15-i)*234567,'كومبن':(15-i)*345678,
      'اكسسوارات':(15-i)*98765,'جيفز':(15-i)*45678,'ابواب':(15-i)*23456}; });
  localStorage.setItem('customers_v1', JSON.stringify(cs));
  localStorage.setItem('monthlySales_v1', JSON.stringify(ms));
  localStorage.setItem('monthlySector_v1', JSON.stringify(sec));
});
await pg.goto(process.env.APP_URL); await pg.waitForTimeout(900);
const m=await pg.evaluate(()=>{
  const md=repModel('distsec'); md.hiLo=modelHiLo(md);
  const body=`<div class="dx"><h2>${md.title}</h2><div class="sub">x</div>${docTableHtml(md)}</div>`;
  const res={};
  [['p',false],['l',true]].forEach(([k,ls])=>{
    const el=mkDoc(body,ls); const t=el.querySelector('table');
    res[k]={doc:el.clientWidth, tbl:Math.round(t.getBoundingClientRect().width),
            cut: t.getBoundingClientRect().width > el.clientWidth+2};
    el.remove();
  });
  res.cols=md.header.length;
  return res; });
ck('التقرير ٨ أعمدة', m.cols===8, String(m.cols));
ck('الطولي ما بيقصّش الجدول', !m.p.cut, JSON.stringify(m.p));
ck('والمستند وسّع نفسه أكبر من ٧٨٠', m.p.doc>780, JSON.stringify(m.p));
ck('الأفقي ما بيقصّش كمان', !m.l.cut, JSON.stringify(m.l));
// الأرقام ما بتتلفّش على سطرين
const nw=await pg.evaluate(()=>{
  const md=repModel('distsec'); md.hiLo=modelHiLo(md);
  const el=mkDoc(`<div class="dx">${docTableHtml(md)}</div>`,false);
  const tds=[...el.querySelectorAll('td')];
  const num=tds.filter(td=>/^[\d,]+$/.test(td.innerText.trim()));
  const wrapNum=num.filter(td=> getComputedStyle(td).whiteSpace!=='nowrap').length;
  const first=[...el.querySelectorAll('td:first-child')];
  const wrapName=first.filter(td=> getComputedStyle(td).whiteSpace==='normal').length;
  // الرقم ما يتقصّش جوه خانته
  const clipped=num.filter(td=> td.scrollWidth > td.clientWidth+1).length;
  el.remove(); return {n:num.length, wrapNum, names:first.length, wrapName, clipped}; });
ck('الأرقام كلها nowrap', nw.n>50 && nw.wrapNum===0, JSON.stringify(nw));
ck('وعمود الأسماء بيلفّ عادي', nw.wrapName===nw.names, JSON.stringify(nw));
ck('ومفيش رقم متقصّ في خانته', nw.clipped===0, JSON.stringify(nw));
// شيت اتجاه الورقة بينبّه لما الأعمدة كتير
await pg.evaluate(()=>{ module='sales'; save('_salesTab_',2); save('_salesRep_','distsec'); render(true); });
await pg.waitForTimeout(350);
await pg.evaluate(()=> exportRep('distsec','p')); await pg.waitForTimeout(300);
ck('الشيت بينصح بالأفقي لما الأعمدة كتير',
  /الأفقي بيطلع أوضح/.test(await pg.evaluate(()=>document.body.innerText)));
console.log(bad?('❌ فشل '+bad):'✅ كله تمام');
await b.close(); process.exit(bad?1:0);
