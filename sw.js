/* Ayam Kremez Mbak Indar — Service Worker
   - App shell: stale-while-revalidate (UI keeps loading offline)
   - Supabase API (other origin): NEVER cached, always live data */
const VERSION = 'wk-pos-v2.0.0';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './vendor/supabase.js', './vendor/qrcode.js',
  './js/config.js', './js/ui.js', './js/pages.js', './js/db.js', './js/orders.js', './js/pos.js', './js/app.js',
  './pesan/', './pesan/index.html', './pesan/pesan.css', './pesan/pesan.js',
  './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Stale-while-revalidate for same-origin GET; app shell fallback for navigations */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  if (req.mode === 'navigate') {
    const key = new URL(req.url).pathname.includes('/pesan') ? './pesan/index.html' : './index.html';
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(key, copy));
        return res;
      }).catch(() => caches.match(key))
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      const net = fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
