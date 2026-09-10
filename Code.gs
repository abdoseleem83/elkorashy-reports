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
// علامة "القراءة جات في نص كتابة" — مختلفة عن "المفتاح مش موجود"
var PARTIAL_ = {partial: true};

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
    sh.appendRow(['key', 'chunk_index', 'value', 'ver']);
    sh.setFrozenRows(1);
  }
  var def = ss.getSheetByName('Sheet1');
  if(def && def.getName() !== sh.getName() && def.getLastRow() === 0) ss.deleteSheet(def);
  return sh;
}

// بيرجع كل الصفوف الخاصة بمفتاح معيّن مرتبة حسب ترتيب الأجزاء.
// بنقرا الأعمدة الصغيرة بس (المفتاح/الترتيب/الإصدار) — عمود القيمة فيه
// ملايين الحروف والقراءة الكاملة بتاعته كانت أبطأ جزء في كل طلب.
function findRows_(sh, key){
  if(sh.getLastRow() < 2) return [];
  var n = sh.getLastRow() - 1;
  // مهم: نقرا العمودين A و B لوحدهم، والعمود D لوحده — من غير ما نلمس عمود
  // القيمة (C) اللي فيه ملايين الحروف.
  var head = sh.getRange(2, 1, n, 2).getValues();
  var vers = sh.getRange(2, 4, n, 1).getValues();
  var rows = [];
  for(var i = 0; i < head.length; i++){
    if(head[i][0] === key){
      rows.push({row: i + 2, idx: Number(head[i][1]) || 0, ver: String((vers[i] && vers[i][0]) || '')});
    }
  }
  rows.sort(function(a,b){ return a.idx - b.idx; });
  return rows;
}

// ver = "وقت الكتابة:عدد الأجزاء". منها نعرف إن القراءة جات في نص كتابة
// (أجزاء من نسخة جديدة وأجزاء من قديمة) فنعيد المحاولة بدل ما نرجّع JSON مقطوع.
function pickComplete_(rows){
  var legacy = [], byVer = {};
  for(var i = 0; i < rows.length; i++){
    var v = rows[i].ver;
    if(!v){ legacy.push(rows[i]); continue; }
    (byVer[v] = byVer[v] || []).push(rows[i]);
  }
  var vers = Object.keys(byVer).sort();          // الأحدث آخر واحد
  for(var j = vers.length - 1; j >= 0; j--){
    var group = byVer[vers[j]];
    var want = Number(String(vers[j]).split(':')[1]) || 0;
    if(want && group.length === want) return group;   // نسخة كاملة
  }
  if(legacy.length) return legacy;               // بيانات قديمة من غير ver
  return null;
}

function kvGet_(key){
  var sh = getSheet_();
  if(sh.getLastRow() < 2) return null;
  var rows = findRows_(sh, key);
  if(!rows.length) return null;
  var group = pickComplete_(rows);
  if(!group){
    // غالبًا القراءة جات في نص كتابة — استنى شوية وحاول تاني مرة واحدة
    Utilities.sleep(400);
    rows = findRows_(sh, key);
    group = pickComplete_(rows);
    // مهم: ده مش "مفتاح مش موجود". لو رجّعناه كده، التطبيق ممكن يفتكر
    // إن الحساب فاضي ويكتب القيم الافتراضية فوق بيانات المستخدم.
    if(!group) return PARTIAL_;
  }
  group.sort(function(a,b){ return a.idx - b.idx; });
  // بنقرا عمود القيمة للصفوف بتاعة المفتاح ده بس، مش الشيت كله
  var parts = [];
  for(var i = 0; i < group.length; i++){
    parts.push(sh.getRange(group[i].row, 3).getValue());
  }
  return parts.join('');
}

function kvSet_(key, value){
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    var sh = getSheet_();
    var str = String(value);
    var raw = [];
    for(var p = 0; p < str.length; p += CHUNK_SIZE){
      raw.push(str.substring(p, p + CHUNK_SIZE));
    }
    if(!raw.length) raw.push('');
    // ختم واحد لكل الأجزاء: منه القارئ يعرف إنه شايف نسخة كاملة
    var ver = String(Date.now()) + ':' + raw.length;
    var chunks = [];
    for(var q = 0; q < raw.length; q++) chunks.push([key, q, raw[q], ver]);

    // بنكتب فوق صفوف المفتاح نفسه بس، وباقي الشيت ما بيتلمسش.
    // النسخة القديمة كانت بتقرا وتعيد كتابة كل الشيت في كل حفظ — مع بيانات كتير
    // ده كان بيقرّب من مهلة الـ6 دقايق بتاعة Apps Script ويخاطر بضياع بيانات مفاتيح تانية
    // لو الاستدعاء اتقطع في النص.
    var own = findRows_(sh, key).map(function(r){ return r.row; });
    var reuse = Math.min(own.length, chunks.length);
    for(var i = 0; i < reuse; i++){
      sh.getRange(own[i], 1, 1, 4).setValues([chunks[i]]);
    }
    if(chunks.length > own.length){
      var extra = chunks.slice(own.length);
      sh.getRange(sh.getLastRow() + 1, 1, extra.length, 4).setValues(extra);
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
    if(v === PARTIAL_){
      // التطبيق بيعتبرها فشل مؤقت (مش مفتاح ناقص) فبيفضل على نسخته المحلية
      return jsonOut_({ok:false, error:'busy: write in progress'});
    }
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
