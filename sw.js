const CACHE_VERSION = 'v97';
const CACHE_NAME = 'elkorashy-reports-' + CACHE_VERSION;
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

// مهم: cache.addAll بتفشل كلها لو ملف واحد بس فشل (مفقود أو الشبكة قطعت
// في نص التحميل — عادي جدًا على الموبايل). وساعتها التثبيت بيفشل، والنسخة
// الجديدة **مش بتتفعّل أبدًا** والمستخدم يفضل على نسخة قديمة من غير ما
// يعرف. عشان كده بنخزّن كل ملف لوحده وبنتحمّل فشل أي واحد فيهم.
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(ASSETS.map(url => cache.add(url).catch(() => null)))
    ).catch(() => null)
  );
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
      }).catch(() => cached || Response.error());
      return cached || network;
    })
  );
});
