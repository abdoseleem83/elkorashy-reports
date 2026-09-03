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

// مفتاح مشترك اختياري. لو حطيت قيمة هنا لازم تحط نفس القيمة في SHARED_TOKEN
// جوه index.html — من غير كده أي حد يعرف رابط الـWeb App يقدر يقرا ويكتب ويمسح البيانات.
// خليها '' لو مش عايز تفعّلها.
var SHARED_TOKEN = '';

function checkToken_(token){
  if(!SHARED_TOKEN) return true;
  return String(token || '') === SHARED_TOKEN;
}

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
  if(sh.getLastRow() < 2) return null;
  // قراءة كل العمودين مرة واحدة أسرع بكتير من getRange لكل صف على حدة
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  var found = [];
  for(var i = 0; i < values.length; i++){
    if(values[i][0] === key) found.push({idx: Number(values[i][1]) || 0, val: values[i][2]});
  }
  if(!found.length) return null;
  found.sort(function(a,b){ return a.idx - b.idx; });
  var parts = [];
  for(var j = 0; j < found.length; j++) parts.push(found[j].val);
  return parts.join('');
}

function kvSet_(key, value){
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    var sh = getSheet_();
    var str = String(value);
    var chunks = [];
    for(var p = 0; p < str.length; p += CHUNK_SIZE){
      chunks.push([key, chunks.length, str.substring(p, p + CHUNK_SIZE)]);
    }
    if(!chunks.length) chunks.push([key, 0, '']);

    // بنكتب فوق صفوف المفتاح نفسه بس، وباقي الشيت ما بيتلمسش.
    // النسخة القديمة كانت بتقرا وتعيد كتابة كل الشيت في كل حفظ — مع بيانات كتير
    // ده كان بيقرّب من مهلة الـ6 دقايق بتاعة Apps Script ويخاطر بضياع بيانات مفاتيح تانية
    // لو الاستدعاء اتقطع في النص.
    var own = findRows_(sh, key).map(function(r){ return r.row; });
    var reuse = Math.min(own.length, chunks.length);
    for(var i = 0; i < reuse; i++){
      sh.getRange(own[i], 1, 1, 3).setValues([chunks[i]]);
    }
    if(chunks.length > own.length){
      var extra = chunks.slice(own.length);
      sh.getRange(sh.getLastRow() + 1, 1, extra.length, 3).setValues(extra);
    } else if(own.length > chunks.length){
      // الصفوف الزيادة تتمسح من تحت لفوق عشان أرقام الصفوف ما تتزحلقش
      var surplus = own.slice(chunks.length).sort(function(a,b){ return b - a; });
      for(var j = 0; j < surplus.length; j++) sh.deleteRow(surplus[j]);
    }
    SpreadsheetApp.flush();
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

// الطلب ممكن يوصل بجسم JSON (POST عادي) أو كباراميترات في الرابط.
// Apps Script بيعمل redirect للـPOST، والـredirect ده أحيانًا بيحوّل الطلب لـGET
// من غير جسم — وساعتها كان الرد "unknown action" من غير أي تفسير. عشان كده
// بنقرا الطلب من الاتنين، والرد بيقول بالظبط إيه اللي وصل لما نفشل.
function readRequest_(e){
  var req = {};
  if(e && e.parameter){
    for(var k in e.parameter) req[k] = e.parameter[k];
  }
  if(e && e.postData && e.postData.contents){
    try{
      var body = JSON.parse(e.postData.contents);
      for(var k2 in body) req[k2] = body[k2];
    }catch(err){
      req._parseError = String(err);
    }
  }
  return req;
}

function handle_(e, method){
  var req = readRequest_(e);
  if(req._parseError){
    return jsonOut_({ok:false, error:'الجسم مش JSON صالح: ' + req._parseError});
  }
  if(!checkToken_(req.token)) return jsonOut_({ok:false, error:'unauthorized'});

  var action = req.action;
  if(action === 'get'){
    var v = kvGet_(req.key);
    if(v === null) return jsonOut_({ok:false, error:'not found'});
    return jsonOut_({ok:true, key:req.key, value:v});
  }
  if(action === 'list'){
    return jsonOut_({ok:true, keys: kvList_(req.prefix || '')});
  }
  if(action === 'set'){
    if(!req.key) return jsonOut_({ok:false, error:'الحفظ وصل من غير مفتاح'});
    kvSet_(req.key, req.value == null ? '' : req.value);
    return jsonOut_({ok:true, key:req.key});
  }
  if(action === 'delete'){
    if(!req.key) return jsonOut_({ok:false, error:'المسح وصل من غير مفتاح'});
    kvDelete_(req.key);
    return jsonOut_({ok:true, key:req.key});
  }
  // رسالة تشخيصية: بتقول الطلب وصل إزاي وكان فيه إيه، بدل "unknown action" الجافة
  return jsonOut_({
    ok: false,
    error: 'unknown action',
    detail: 'وصل طلب ' + method + ' وفيه action=' + (action === undefined ? '(مفيش)' : action) +
            '. لو ده حصل مع حفظ، غالبًا الطلب اتحوّل من POST لـGET وضاع جسمه — التطبيق بيعيد المحاولة تلقائي.',
    hadBody: !!(e && e.postData && e.postData.contents),
    keys: Object.keys(req).join(',')
  });
}

function doGet(e){
  try{ return handle_(e, 'GET'); }
  catch(err){ return jsonOut_({ok:false, error:String(err)}); }
}

function doPost(e){
  try{ return handle_(e, 'POST'); }
  catch(err){ return jsonOut_({ok:false, error:String(err)}); }
}
