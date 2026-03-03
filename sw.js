const CACHE_NAME = 'elmeks-cache-v14'; 
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './script.js',
  './js/modules/ui.js',
  './js/modules/avatar.js',
  './manifest.json',
  './lib/jspdf.umd.min.js',
  './lib/jspdf.plugin.autotable.min.js',
  './lib/three/three.module.js',
  './lib/three/OrbitControls.js',
  './lib/three/GLTFLoader.js',
  './lib/three/OBJLoader.js',
  './lib/three/DRACOLoader.js',
  './lib/utils/BufferGeometryUtils.js',
  './fonts/Inter-Regular.woff2'
  './fonts/Inter-Bold.woff2'
];

// 1. Installieren: Sofort Cache füllen & Aktivierung erzwingen
self.addEventListener('install', (event) => {
  // WICHTIG: skipWaiting zwingt den neuen SW sofort aktiv zu werden
  self.skipWaiting(); 
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Fehler ignorieren, falls eine Datei fehlt (damit die App trotzdem installiert)
      return cache.addAll(ASSETS_TO_CACHE).catch(err => console.log("Caching partial warning", err));
    })
  );
});

// 2. Aktivieren: Sofort Kontrolle über alle offenen Tabs übernehmen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Alte Caches löschen
      caches.keys().then((keyList) => {
        return Promise.all(keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        }));
      }),
      // WICHTIG: Sofortige Kontrolle über Clients (kein Reload nötig)
      self.clients.claim() 
    ])
  );
});

// 3. Fetch: Offline-First Strategie
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
            if(event.request.url.startsWith('http')) {
                cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
        });
      });
    })
  );
});