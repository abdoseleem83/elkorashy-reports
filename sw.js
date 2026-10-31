/* يشغّل التطبيق من غير نت: الصفحة والمكتبات بتتحفظ على الجهاز.
   - index.html: النت الأول (عشان التحديثات توصل)، ولو النت وقع بياخد النسخة المحفوظة.
   - lib/ والأيقونات: المحفوظ الأول (ثابتة).
   - أي طلب لموقع تاني (المزامنة / Apps Script) ما بيتلمسش خالص. */
const CACHE = 'elkorashy-reports-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './lib/xlsx.bundle.js', './lib/html2canvas.min.js', './lib/jspdf.umd.min.js', './lib/exceljs.min.js'];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=> Promise.all(CORE.map(u=> c.add(u).catch(()=>{})))).then(()=> self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(ks=> Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=> self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const req=e.request, url=new URL(req.url);
  if(req.method!=='GET' || url.origin!==location.origin) return;
  const isStatic = /\/(lib|icons)\//.test(url.pathname);
  if(isStatic){
    e.respondWith(caches.match(req).then(hit=> hit || fetch(req).then(r=>{ const cp=r.clone(); caches.open(CACHE).then(c=>c.put(req,cp)); return r; })));
    return;
  }
  e.respondWith(fetch(req).then(r=>{ if(r.ok){ const cp=r.clone(); caches.open(CACHE).then(c=>c.put(req,cp)); } return r; })
    .catch(()=> caches.match(req).then(hit=> hit || caches.match('./index.html'))));
});
