/* LAST — Service worker (réseau d'abord, repli cache hors-ligne, même origine). */
const CACHE = 'last-v4';
const CORE = ['./', './index.html'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then((res) => { const c = res.clone(); caches.open(CACHE).then((k) => k.put(req, c).catch(() => {})); return res; }).catch(() => caches.match(req).then((m) => m || caches.match('./index.html'))));
});
