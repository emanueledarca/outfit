// Service worker: l'app funziona anche offline.
// Rete prima, cache come riserva; meteo e Gemini non passano dalla cache.

// Cambiare CACHE a ogni rilascio: così il telefono butta la versione vecchia.
const CACHE = 'app-outfit-v2';
const CDN = 'https://cdn.jsdelivr.net/';
const ICONS_CSS = 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.31.0/dist/tabler-icons.min.css';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/rules.js', 'js/style.js', 'js/care.js', 'js/shop.js', 'js/stats.js',
  'js/db.js', 'js/ui.js', 'js/weather.js', 'js/gemini.js', 'js/images.js', 'js/sheet.js', 'js/demo.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  // Foto dei modelli della capsule, usate anche in "Acquisti".
  'demo/01.jpg', 'demo/02.jpg', 'demo/03.jpg', 'demo/05.jpg', 'demo/06.jpg', 'demo/07.jpg', 'demo/08.jpg', 'demo/09.jpg', 'demo/10.jpg', 'demo/11.jpg', 'demo/12.jpg', 'demo/13.jpg', 'demo/14.jpg', 'demo/15.jpg', 'demo/16.jpg', 'demo/17.jpg', 'demo/18.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).then(() => c.add(ICONS_CSS).catch(() => {}))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin || request.url.startsWith(CDN)) event.respondWith(networkFirst(request));
});
