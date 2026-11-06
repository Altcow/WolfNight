const VERSION = 'v17';               // 每次更新內容都要遞增,否則舊快取不會換
const CACHE_NAME = 'wolfnight-' + VERSION;
const PRECACHE = [
  './', './index.html', './parent.html', './manifest.webmanifest', './css/style.css?v=5',
  './js/firebase-config.js?v=3', './js/net.js?v=3', './js/sfx.js', './js/game.js?v=14',
  './lib/three.min.js', './lib/GLTFLoader.js', './img/wolf_toon.jpg', './img/wolf_scary.jpg', './img/lunge_crouch.webp', './img/lunge_strip.webp', './icons/icon.svg',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('wolfnight-') && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
