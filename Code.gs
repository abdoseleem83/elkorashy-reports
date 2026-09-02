/**
 * باك إند تخزين مركزي لتطبيق "تقارير مبيعات القرشي".
 * بيحفظ كل حاجة (الشهور، التصنيفات، القطاعات...) في Google Sheet واحد
 * بدل ما تتخزن على متصفح كل جهاز لوحده — عشان الشغل يتفتح ويتزامن من أي جهاز.
 *
 * التركيب:
 * 1) افتح script.google.com على نفس المشروع اللي رابطه:
 *    https://script.google.com/macros/s/AKfycbz9B3WIqHNQ1wkIDCb3lZklF2RESJW0kIz-WZxmi6W6VP2IuPhr0yVCx-mpJ4HE6oyh/exec
 * 2) امسح أي كود موجود في Code.gs، والصق الكود ده مكانه، واحفظ (Ctrl+S).
 * 3) Deploy > Manage deployments > دوس على قلم التعديل (Edit) بجانب الـ deployment الموجود
 *    > في "Version" اختار "New version" > Deploy.
 *    (السطر ده مهم عشان يفضل نفس اللينك شغال زي ما هو من غير ما يتغيّر)
 * 4) لو أول مرة تعمل deploy: خليك متأكد إن "Execute as" = Me، و"Who has access" = Anyone.
 */

function getSpreadsheet_(){
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('SS_ID');
  let ss = null;
  if(id){
    try{ ss = SpreadsheetApp.openById(id); }catch(e){ id = null; }
  }
  if(!ss){
    ss = SpreadsheetApp.create('elkorashy-reports-data');
    props.setProperty('SS_ID', ss.getId());
  }
  return ss;
}

function getSheet_(){
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName('KV');
  if(!sh){
    sh = ss.insertSheet('KV');
    sh.appendRow(['key', 'value']);
    sh.setFrozenRows(1);
  }
  // امسح الشيت الافتراضي الفاضي اللي بيتعمل تلقائي مع أي Spreadsheet جديد
  const def = ss.getSheetByName('Sheet1');
  if(def && def.getName() !== sh.getName() && def.getLastRow() === 0) ss.deleteSheet(def);
  return sh;
}

function findRow_(sh, key){
  const values = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 0), 1).getValues();
  for(let i = 0; i < values.length; i++){
    if(values[i][0] === key) return i + 2; // +2: صف العنوان + الفهرسة من 1
  }
  return -1;
}

function kvGet_(key){
  const sh = getSheet_();
  const row = findRow_(sh, key);
  if(row === -1) return null;
  return sh.getRange(row, 2).getValue();
}

function kvSet_(key, value){
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try{
    const sh = getSheet_();
    const row = findRow_(sh, key);
    if(row === -1) sh.appendRow([key, value]);
    else sh.getRange(row, 2).setValue(value);
  } finally {
    lock.releaseLock();
  }
}

function kvDelete_(key){
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try{
    const sh = getSheet_();
    const row = findRow_(sh, key);
    if(row !== -1) sh.deleteRow(row);
  } finally {
    lock.releaseLock();
  }
}

function kvList_(prefix){
  const sh = getSheet_();
  const values = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 0), 1).getValues();
  const keys = [];
  values.forEach(r => {
    const k = r[0];
    if(k && (!prefix || String(k).indexOf(prefix) === 0)) keys.push(k);
  });
  return keys;
}

function jsonOut_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e){
  try{
    const action = e.parameter.action;
    if(action === 'get'){
      const v = kvGet_(e.parameter.key);
      if(v === null) return jsonOut_({ok:false, error:'not found'});
      return jsonOut_({ok:true, key:e.parameter.key, value:v});
    }
    if(action === 'list'){
      return jsonOut_({ok:true, keys: kvList_(e.parameter.prefix || '')});
    }
    return jsonOut_({ok:false, error:'unknown action'});
  }catch(err){
    return jsonOut_({ok:false, error:String(err)});
  }
}

function doPost(e){
  try{
    const body = JSON.parse(e.postData.contents);
    if(body.action === 'set'){
      kvSet_(body.key, body.value);
      return jsonOut_({ok:true});
    }
    if(body.action === 'delete'){
      kvDelete_(body.key);
      return jsonOut_({ok:true});
    }
    return jsonOut_({ok:false, error:'unknown action'});
  }catch(err){
    return jsonOut_({ok:false, error:String(err)});
  }
}
