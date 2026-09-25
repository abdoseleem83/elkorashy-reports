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
// أرقام الصفوف المتتالية بتتجمع في مجموعة واحدة. أجزاء أي مفتاح بتتكتب
// ورا بعضها، فده بيحوّل ٧٥ نداء على الشيت لنداء واحد.
function runs_(rowNums){
  var sorted = rowNums.slice().sort(function(a,b){ return a - b; });
  var out = [];
  for(var i = 0; i < sorted.length; i++){
    if(out.length && sorted[i] === out[out.length-1].start + out[out.length-1].len){
      out[out.length-1].len++;
    } else {
      out.push({start: sorted[i], len: 1});
    }
  }
  return out;
}

/* ---- فهرس المفاتيح (key -> أرقام صفوفه) ----
   قبل كده findRows_ كان بيقرا عمود A كامل (كل صفوف الشيت) في **كل** get/set/merge/union
   — يعني كل ما البيانات تكبر (شهور أكتر، مخازن أكتر) كل عملية بقت بتاخد وقت أطول،
   وده أكبر سبب في إن الحفظ بقى بطيء وبيوصل لمهلة السيرفر (وبالتبعية بيانات تتضيع
   بسبب طلبات بتقطع في نصها). دلوقتي بنبني فهرس {key: [rows...]} مرة، ونخزنه في
   CacheService (6 ساعات)، وبعد كده كل عملية بتروح على طول لصفوفها من غير ما تمسح
   الشيت كله. الفهرس بيتحدّث تلقائي مع كل كتابة (kvSetLocked_/kvDelete_). */
var INDEX_CACHE_KEY_ = 'kv_index_v1';

function rebuildIndex_(sh){
  var idx = {};
  var last = sh.getLastRow();
  if(last >= 2){
    var n = last - 1;
    var head = sh.getRange(2, 1, n, 1).getValues();
    for(var i = 0; i < head.length; i++){
      var k = head[i][0];
      if(!k) continue; // صف متفضّي (تومبستون) من مسح/تصغير قديم
      (idx[k] = idx[k] || []).push(i + 2);
    }
  }
  saveIndex_(idx);
  return idx;
}

function saveIndex_(idx){
  try{ CacheService.getScriptCache().put(INDEX_CACHE_KEY_, JSON.stringify(idx), 21600); }catch(e){}
}

function loadIndex_(sh){
  try{
    var raw = CacheService.getScriptCache().get(INDEX_CACHE_KEY_);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return rebuildIndex_(sh);
}

// بيرجع صفوف مفتاح معيّن. بيستخدم الفهرس (نداء واحد بدل مسح الشيت كله)، وبيتحقق
// إن عمود A لسه فعلًا نفس المفتاح في الصفوف دي (دفاعًا عن فهرس قديم/كاش فاضل من
// قبل تعديل حصل من نداء تاني) — لو مش متطابق بيعيد بناء الفهرس مرة واحدة ويجرب تاني.
function findRows_(sh, key, _retried){
  var idx = loadIndex_(sh);
  var rowNums = (idx[key] || []).slice().sort(function(a,b){ return a - b; });
  if(!rowNums.length) return [];
  var rr = runs_(rowNums);
  var rows = [];
  var stale = false;
  for(var r = 0; r < rr.length; r++){
    var head = sh.getRange(rr[r].start, 1, rr[r].len, 2).getValues(); // A,B
    var vers = sh.getRange(rr[r].start, 4, rr[r].len, 1).getValues(); // D
    for(var i = 0; i < rr[r].len; i++){
      if(head[i][0] !== key){ stale = true; continue; }
      rows.push({row: rr[r].start + i, idx: Number(head[i][1]) || 0, ver: String((vers[i] && vers[i][0]) || '')});
    }
  }
  if(stale && !_retried){
    rebuildIndex_(sh);
    return findRows_(sh, key, true);
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
  // بنقرا عمود القيمة للصفوف بتاعة المفتاح ده بس، مش الشيت كله — وبنقراهم
  // في مجموعات متتالية. قبل كده كانت قراءة لكل صف لوحده، يعني مفتاح فيه
  // ٧٥ جزء = ٧٥ نداء على الشيت، وده اللي كان بيخلي التحميل والرفع بطيئين
  // جدًا وساعات يوصلوا لمهلة Apps Script.
  var byRow = {};
  var rr = runs_(group.map(function(g){ return g.row; }));
  for(var r = 0; r < rr.length; r++){
    var vals = sh.getRange(rr[r].start, 3, rr[r].len, 1).getValues();
    for(var v = 0; v < vals.length; v++) byRow[rr[r].start + v] = vals[v][0];
  }
  var parts = [];
  for(var i = 0; i < group.length; i++) parts.push(byRow[group[i].row]);
  return parts.join('');
}

function kvSet_(key, value){
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    kvSetLocked_(key, value);
  } finally {
    lock.releaseLock();
  }
}

// نفس الكتابة بالظبط بس من غير ما تاخد القفل — بتتنادى من جوه قفل مأخود
// أصلًا (زي action=merge). القفل مش reentrant مضمون في Apps Script، فأخذه
// مرتين في نفس التنفيذ ممكن يعلّق لحد المهلة.
// بيمسح مجموعة صفوف (تمسح محتواها بس، من غير deleteRow) — دفعة واحدة لكل
// مجموعة متتالية. أهم حاجة: ما بتزحلقش أرقام صفوف المفاتيح التانية.
function blankRows_(sh, rowNums){
  var rr = runs_(rowNums);
  for(var r = 0; r < rr.length; r++){
    var blanks = [];
    for(var i = 0; i < rr[r].len; i++) blanks.push(['', 0, '', '']);
    sh.getRange(rr[r].start, 1, rr[r].len, 4).setValues(blanks);
  }
}

function kvSetLocked_(key, value){
  {
    var sh = getSheet_();
    var idx = loadIndex_(sh);
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
    // own جاي من الفهرس، مش من مسح الشيت كله (findRows_ بيتحقق ويصلّح الفهرس
    // لوحده لو كان قديم).
    var own = findRows_(sh, key).map(function(r){ return r.row; });
    own.sort(function(a,b){ return a - b; });
    var reuse = Math.min(own.length, chunks.length);
    // نفس الفكرة في الكتابة: الصفوف المتتالية تتكتب مرة واحدة بدل نداء لكل صف.
    var used = own.slice(0, reuse);
    var wr = runs_(used);
    var done = 0;
    for(var w = 0; w < wr.length; w++){
      sh.getRange(wr[w].start, 1, wr[w].len, 4).setValues(chunks.slice(done, done + wr[w].len));
      done += wr[w].len;
    }
    var finalRows = used.slice();
    if(chunks.length > own.length){
      var extra = chunks.slice(own.length);
      var startRow = sh.getLastRow() + 1;
      sh.getRange(startRow, 1, extra.length, 4).setValues(extra);
      for(var e = 0; e < extra.length; e++) finalRows.push(startRow + e);
    } else if(own.length > chunks.length){
      // الصفوف الزيادة تتفضّى بس (تومبستون) — مش تتمسح بـdeleteRow. مسح الصف
      // بيزحلق كل الصفوف اللي تحته صف لفوق، وده كان بيبوّظ فهرس أي مفتاح تاني
      // مخزّن بعده في الشيت. الصف الفاضي بيرجع يتلمّ لوحده مع action=compact.
      var surplus = own.slice(chunks.length);
      blankRows_(sh, surplus);
    }
    idx[key] = finalRows;
    saveIndex_(idx);
    SpreadsheetApp.flush();
  }
}

function kvDelete_(key){
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    var sh = getSheet_();
    var idx = loadIndex_(sh);
    var rows = findRows_(sh, key).map(function(r){ return r.row; });
    if(rows.length) blankRows_(sh, rows);
    delete idx[key];
    saveIndex_(idx);
  } finally {
    lock.releaseLock();
  }
}

function kvList_(prefix){
  var sh = getSheet_();
  var idx = loadIndex_(sh);
  var keys = [];
  for(var k in idx){
    if(idx[k] && idx[k].length && (!prefix || String(k).indexOf(prefix) === 0)) keys.push(k);
  }
  return keys;
}

// صيانة اختيارية (action=compact): بتلمّ الصفوف الفاضية اللي خلّفها التومبستون
// فعليًا (deleteRow حقيقي) وتعيد بناء الفهرس. مش لازم تتنادى كل مرة — الفهرس
// شغال عادي من غيرها. شغّلها من وقت للتاني (مرة كل شهرين مثلًا) لو حابب تقلّل
// حجم الشيت. بتاخد قفل كامل عشان ماتتعارضش مع حفظ شغال في نفس اللحظة.
function compact_(){
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    var sh = getSheet_();
    var last = sh.getLastRow();
    if(last < 2) return {ok:true, removed:0};
    var n = last - 1;
    var keys = sh.getRange(2, 1, n, 1).getValues();
    var removed = 0;
    for(var i = n; i >= 1; i--){
      if(!keys[i - 1][0]){ sh.deleteRow(i + 1); removed++; }
    }
    rebuildIndex_(sh);
    return {ok:true, removed: removed};
  } finally {
    lock.releaseLock();
  }
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
  // دمج ذرّي: التطبيق بيبعت التعديلات بتاعته بس (مش الخريطة كلها)، والسيرفر
  // بيقرا آخر نسخة ويدمج عليها ويكتب — كله جوه قفل واحد. من غير ده لو جهازين
  // حفظوا في نفس اللحظة، اللي يكتب الأخير كان بيمسح تعديل التاني.
  // شكل الـpatch: {"المخزن": {"اسم الصنف": رقم أو null للمسح}}
  // و wipe: ["المخزن"] بيمسح المخزن كله قبل الدمج.
  if(action === 'merge'){
    if(!req.key) return jsonOut_({ok:false, error:'الدمج وصل من غير مفتاح'});
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try{
      var cur = kvGet_(req.key);
      if(cur === PARTIAL_) return jsonOut_({ok:false, error:'busy: write in progress'});
      var base = {};
      if(cur !== null){
        try{ base = JSON.parse(cur) || {}; }catch(err2){ base = {}; }
      }
      var patch = {};
      try{ patch = JSON.parse(req.patch || '{}') || {}; }
      catch(err3){ return jsonOut_({ok:false, error:'patch مش JSON صالح'}); }
      var wipe = [];
      try{ wipe = JSON.parse(req.wipe || '[]') || []; }catch(err4){ wipe = []; }
      for(var w = 0; w < wipe.length; w++) delete base[wipe[w]];
      // دمج على مستويين: لو القيمة القديمة والجديدة الاتنين كائنات بندمج
      // المفاتيح جواهم (وnull جوه بيمسح)، غير كده بنحط الجديدة مكان القديمة.
      // ده بيخدم whOrder/whCount (مخزن > صنف) و whCatalog (صنف > بيانات).
      for(var k in patch){
        var v = patch[k];
        if(v === null){ delete base[k]; continue; }
        if(v && typeof v === 'object' && !(v instanceof Array)
           && base[k] && typeof base[k] === 'object' && !(base[k] instanceof Array)){
          for(var nm in v){
            if(v[nm] === null) delete base[k][nm];
            else base[k][nm] = v[nm];
          }
          if(!Object.keys(base[k]).length) delete base[k];
        } else {
          base[k] = v;
        }
      }
      var out = JSON.stringify(base);
      kvSetLocked_(req.key, out);
      return jsonOut_({ok:true, key:req.key, value: out});
    } finally {
      lock.releaseLock();
    }
  }
  // اتحاد مصفوفة جوه قفل واحد. الدمج العادي مابيعرفش المصفوفات (بيستبدلها)،
  // فجهازين بيضيفوا شهر أو قطاع في نفس اللحظة كان واحد فيهم بيضيع.
  // add = عناصر تتضاف لو مش موجودة، remove = عناصر تتشال بعد الإضافة.
  if(action === 'union'){
    if(!req.key) return jsonOut_({ok:false, error:'الاتحاد وصل من غير مفتاح'});
    var ulock = LockService.getScriptLock();
    ulock.waitLock(30000);
    try{
      var ucur = kvGet_(req.key);
      if(ucur === PARTIAL_) return jsonOut_({ok:false, error:'busy: write in progress'});
      var arr = [];
      if(ucur !== null){
        try{ var parsed = JSON.parse(ucur); if(parsed instanceof Array) arr = parsed; }catch(e5){ arr = []; }
      }
      var add = [], rem = [];
      try{ add = JSON.parse(req.add || '[]') || []; }catch(e6){ add = []; }
      try{ rem = JSON.parse(req.remove || '[]') || []; }catch(e7){ rem = []; }
      for(var a2 = 0; a2 < add.length; a2++){
        if(arr.indexOf(add[a2]) === -1) arr.push(add[a2]);
      }
      if(rem.length){
        var kept = [];
        for(var b2 = 0; b2 < arr.length; b2++){
          if(rem.indexOf(arr[b2]) === -1) kept.push(arr[b2]);
        }
        arr = kept;
      }
      var uout = JSON.stringify(arr);
      kvSetLocked_(req.key, uout);
      return jsonOut_({ok:true, key:req.key, value: uout});
    } finally {
      ulock.releaseLock();
    }
  }

  if(action === 'delete'){
    if(!req.key) return jsonOut_({ok:false, error:'المسح وصل من غير مفتاح'});
    kvDelete_(req.key);
    return jsonOut_({ok:true, key:req.key});
  }
  // صيانة اختيارية: ?action=compact — بتلمّ الصفوف الفاضية وتقلّل حجم الشيت.
  // مش لازمة للتشغيل العادي، شغّلها بنفسك من وقت للتاني لو حابب.
  if(action === 'compact'){
    var res = compact_();
    return jsonOut_({ok:true, removedRows: res.removed});
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
