/* Service worker de Alcanza: primero la red (siempre la versión más nueva) y, sin internet, la copia guardada. */
const CACHE = 'alcanza-v1';
const CORE = ['./', 'index.html', 'css/styles.css', 'js/data.js', 'js/logic.js', 'js/app.js', 'js/pwa.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com')) return; // la sincronización va siempre directa
  const same = url.origin === self.location.origin;
  e.respondWith(
    fetch(same ? new Request(req, { cache: 'no-cache' }) : req)   // no-cache: revisa si hay versión nueva en GitHub
      .then(res => { if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});
