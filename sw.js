/* Service worker Blue Carbon Field App
   - Menyimpan aplikasi di perangkat agar tetap terbuka tanpa internet.
   - Naikkan VERSION setiap kali index.html diperbarui. */
const VERSION = 'bcfa-1.1.3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];
const RUNTIME = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Jangan pernah menyimpan data server (Supabase) di cache
  if (/supabase\.(co|in)$/.test(url.hostname) || url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/') || url.pathname.includes('/functions/v1/')) return;
  // Halaman aplikasi: coba jaringan (3 detik) lalu pakai salinan di perangkat
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const net = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))]);
        if (net && net.ok) cache.put('./index.html', net.clone());
        return net;
      } catch (err) { return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error(); }
    })());
    return;
  }
  // Berkas aplikasi sendiri, font, dan pemindai QR: pakai cache, perbarui di latar belakang
  if (url.origin === location.origin || RUNTIME.includes(url.hostname)) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req);
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()); return r; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
});
