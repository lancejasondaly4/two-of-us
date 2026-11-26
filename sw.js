/* Two of Us service worker. Offline-first for the app shell.
   No analytics, no network beyond Google Fonts. Bump CACHE on each release. */
const CACHE = 'twoofus-v100';
const SHELL = [
  './',
  './index.html',
  './emoji-lexicon.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon-180.png'
];

self.addEventListener('install', e => {
  // cache:'reload' = take the files fresh from the server, never from the browser's own
  // short-term copy (GitHub Pages lets browsers reuse a file for 10 minutes).
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, {cache:'reload'})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com';

  // Navigations: serve the app shell, fall back to cache when offline.
  if (req.mode === 'navigate') {
    // cache:'no-cache' = always ask the server whether the page changed (a quick check),
    // so a new release shows on the next open instead of up to 10 minutes later.
    e.respondWith(fetch(req.url, {cache:'no-cache', credentials:'same-origin'}).catch(() => caches.match('./index.html')));
    return;
  }

  // App shell + fonts: cache-first, then network (and cache the font on the way).
  if (url.origin === self.location.origin || isFont) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && res.status === 200 && (url.origin === self.location.origin || isFont)) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit))
    );
  }
});
