const CACHE_VERSION = 'v44';
const CACHE_NAME = 'elkorashy-reports-' + CACHE_VERSION;
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('message', (e) => {
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// الصفحة نفسها: الشبكة الأول عشان أي نسخة جديدة توصل من غير ما المستخدم يدوس "تحديث"،
// والكاش احتياطي لو مفيش نت. باقي الملفات: الكاش الأول عشان الفتح يفضل فوري.
function isPageRequest(req){
  return req.mode === 'navigate' || (req.destination === 'document');
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // أي طلب خارج موقعنا (الباك إند، أي API) بيروح للشبكة دايمًا ومبيتخزّنش أبدًا.
  // كان الاستثناء مربوط باسم script.google.com بالاسم، فأي باك إند على دومين
  // تاني كان بيتكاش وبيرجّع بيانات قديمة — وده أخطر نوع باج لأنه صامت.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isPageRequest(req)) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
