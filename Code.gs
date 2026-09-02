/**
 * تخزين مشترك (Key-Value) لتطبيق تقارير مبيعات القرشي.
 * ينشئ شيت باسم "KV" فيه عمودين: key و value، ويقرأ/يكتب فيه.
 *
 * طريقة الاستخدام:
 * 1. Extensions > Apps Script من جوا Google Sheet جديد فاضي.
 * 2. امسح أي كود موجود، والصق هذا الملف كامل.
 * 3. Deploy > New deployment > نوع "Web app".
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. انسخ الرابط (ينتهي بـ /exec) وابعته.
 */

const SHEET_NAME = 'KV';

function getSheet_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if(!sheet){
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['key', 'value', 'updated_at']);
  }
  return sheet;
}

function findRow_(sheet, key){
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(data[i][0] === key) return i + 1; // 1-indexed row number
  }
  return -1;
}

function kvGet_(key){
  const sheet = getSheet_();
  const row = findRow_(sheet, key);
  if(row === -1) return {found:false};
  const value = sheet.getRange(row, 2).getValue();
  return {found:true, value: value};
}

function kvSet_(key, value){
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try{
    const sheet = getSheet_();
    const row = findRow_(sheet, key);
    const now = new Date().toISOString();
    if(row === -1){
      sheet.appendRow([key, value, now]);
    } else {
      sheet.getRange(row, 2, 1, 2).setValues([[value, now]]);
    }
  } finally {
    lock.releaseLock();
  }
  return {ok:true};
}

function kvDelete_(key){
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try{
    const sheet = getSheet_();
    const row = findRow_(sheet, key);
    if(row !== -1) sheet.deleteRow(row);
  } finally {
    lock.releaseLock();
  }
  return {ok:true};
}

function kvList_(prefix){
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  const keys = [];
  for(let i = 1; i < data.length; i++){
    const k = data[i][0];
    if(!prefix || (k && k.toString().indexOf(prefix) === 0)) keys.push(k);
  }
  return {keys: keys};
}

function handle_(params){
  const action = params.action;
  const key = params.key;
  let result;
  if(action === 'get'){
    result = kvGet_(key);
  } else if(action === 'set'){
    result = kvSet_(key, params.value);
  } else if(action === 'delete'){
    result = kvDelete_(key);
  } else if(action === 'list'){
    result = kvList_(params.prefix || '');
  } else {
    result = {error: 'unknown action'};
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e){
  const params = e.parameter || {};
  return handle_(params);
}

function doPost(e){
  let params = {};
  try{
    params = JSON.parse(e.postData.contents);
  }catch(err){
    params = e.parameter || {};
  }
  return handle_(params);
}
