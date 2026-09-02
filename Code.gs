/**
 * باك إند تخزين مركزي لتطبيق "تقارير مبيعات القرشي".
 *
 * مهم: خلية جوجل شيت الواحدة بتستحمل 50 ألف حرف بس، وبيانات المبيعات ممكن توصل
 * لملايين الحروف — عشان كده القيمة الواحدة بتتقسّم على كذا صف (chunks) وبتترجع
 * متجمّعة تاني عند القراءة. ده اللي بيخلي الحفظ والتزامن يشتغلوا فعليًا.
 *
 * التركيب:
 * 1) افتح مشروع Apps Script بتاعك على script.google.com
 * 2) امسح كل اللي في Code.gs والصق الكود ده مكانه، واحفظ (Ctrl+S)
 * 3) نشر > إدارة عمليات النشر > ✏️ تعديل > الإصدار: إصدار جديد > نشر
 */

var CHUNK_SIZE = 40000; // أقل من حد الـ50 ألف بهامش أمان

function getSpreadsheet_(){
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SS_ID');
  var ss = null;
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
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName('KV');
  if(!sh){
    sh = ss.insertSheet('KV');
    sh.appendRow(['key', 'chunk_index', 'value']);
    sh.setFrozenRows(1);
  }
  var def = ss.getSheetByName('Sheet1');
  if(def && def.getName() !== sh.getName() && def.getLastRow() === 0) ss.deleteSheet(def);
  return sh;
}

// بيرجع كل الصفوف الخاصة بمفتاح معيّن مرتبة حسب ترتيب الأجزاء
function findRows_(sh, key){
  if(sh.getLastRow() < 2) return [];
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  var rows = [];
  for(var i = 0; i < values.length; i++){
    if(values[i][0] === key) rows.push({row: i + 2, idx: Number(values[i][1]) || 0});
  }
  rows.sort(function(a,b){ return a.idx - b.idx; });
  return rows;
}

function kvGet_(key){
  var sh = getSheet_();
  var rows = findRows_(sh, key);
  if(!rows.length) return null;
  var parts = [];
  for(var i = 0; i < rows.length; i++){
    parts.push(sh.getRange(rows[i].row, 3).getValue());
  }
  return parts.join('');
}

function kvSet_(key, value){
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    var sh = getSheet_();
    // امسح الأجزاء القديمة الأول (من تحت لفوق عشان أرقام الصفوف ما تتلخبطش)
    var old = findRows_(sh, key).map(function(r){ return r.row; }).sort(function(a,b){ return b - a; });
    for(var i = 0; i < old.length; i++) sh.deleteRow(old[i]);

    var str = String(value);
    var chunks = [];
    for(var p = 0; p < str.length; p += CHUNK_SIZE){
      chunks.push([key, chunks.length, str.substring(p, p + CHUNK_SIZE)]);
    }
    if(!chunks.length) chunks.push([key, 0, '']);
    // كتابة كل الأجزاء دفعة واحدة أسرع بكتير من appendRow لكل جزء
    sh.getRange(sh.getLastRow() + 1, 1, chunks.length, 3).setValues(chunks);
  } finally {
    lock.releaseLock();
  }
}

function kvDelete_(key){
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    var sh = getSheet_();
    var rows = findRows_(sh, key).map(function(r){ return r.row; }).sort(function(a,b){ return b - a; });
    for(var i = 0; i < rows.length; i++) sh.deleteRow(rows[i]);
  } finally {
    lock.releaseLock();
  }
}

function kvList_(prefix){
  var sh = getSheet_();
  if(sh.getLastRow() < 2) return [];
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  var seen = {};
  var keys = [];
  for(var i = 0; i < values.length; i++){
    var k = values[i][0];
    if(k && !seen[k] && (!prefix || String(k).indexOf(prefix) === 0)){
      seen[k] = true;
      keys.push(k);
    }
  }
  return keys;
}

function jsonOut_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e){
  try{
    var action = e.parameter.action;
    if(action === 'get'){
      var v = kvGet_(e.parameter.key);
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
    var body = JSON.parse(e.postData.contents);
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
