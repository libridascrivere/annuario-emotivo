// ─── ANNUARIO SCOLASTICO EMOTIVO — Service Worker ─────────────────────────────
const CACHE_NAME   = 'annuario-v1.1';
const STATIC_CACHE = 'annuario-static-v1.2';

const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './icon-192-maskable.png',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400;1,700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap',
];

// ── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => Promise.allSettled(
        APP_SHELL.map(url => cache.add(url).catch(() => {}))
      ))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        fetch(req).then(res => {
          if (res && res.status === 200 && res.type === 'basic')
            caches.open(CACHE_NAME).then(c => c.put(req, res.clone()));
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then(res => {
        if (res && res.status === 200)
          caches.open(CACHE_NAME).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => req.destination === 'document' ? caches.match('./index.html') : undefined);
    })
  );
});

// ── NOTIFICA LOCALE via postMessage dall'app ──────────────────────────────────
// L'app manda { type:'SHOW_NOTIF', title, body, tag } al momento giusto
self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'SHOW_NOTIF') return;
  const { title, body, tag } = event.data;
  self.registration.showNotification(title || '📅 Annuario Emotivo', {
    body:  body || '',
    icon:  './icon-192.png',
    badge: './icon-72.png',
    tag:   tag  || 'annuario-notif',
    requireInteraction: true,
    vibrate: [200, 100, 200],
  });
});

// ── PUSH REMOTE (futuro Firebase) ────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || '📅 Annuario Emotivo', {
      body: data.body || 'Hai un promemoria!',
      icon: './icon-192.png',
      tag:  data.tag  || 'annuario-notif',
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('./');
    })
  );
});

console.log('[SW] Annuario Emotivo v1.1 — pronto');


// File da mettere in cache all'installazione (shell dell'app)
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './icon-192-maskable.png',
  // Font Google (se disponibili offline)
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400;1,700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap',
];

// ── INSTALL: pre-carica l'app shell ──────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        // Aggiungi quello che riesci, ignora errori singoli
        return Promise.allSettled(
          APP_SHELL.map(url => cache.add(url).catch(e => console.warn('[SW] Cache miss:', url, e.message)))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: pulisci cache vecchie ──────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Elimino cache vecchia:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: strategia Cache First con fallback rete ────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;

  // Ignora richieste non-GET
  if (req.method !== 'GET') return;

  // Ignora richieste chrome-extension e non-http
  if (!req.url.startsWith('http')) return;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        // Cache hit: restituisci subito, aggiorna in background
        const networkFetch = fetch(req)
          .then(res => {
            if (res && res.status === 200 && res.type === 'basic') {
              caches.open(CACHE_NAME).then(c => c.put(req, res.clone()));
            }
            return res;
          })
          .catch(() => {}); // Ignora errori di rete (siamo offline)
        return cached;
      }

      // Cache miss: prova la rete
      return fetch(req)
        .then(res => {
          if (!res || res.status !== 200) return res;

          // Metti in cache per la prossima volta
          const toCache = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, toCache));
          return res;
        })
        .catch(() => {
          // Offline e non in cache: restituisci la pagina principale se disponibile
          if (req.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});

// ── NOTIFICHE PUSH (preparato per il futuro) ──────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || '📖 Annuario Emotivo', {
      body:  data.body  || 'Hai un promemoria!',
      icon:  data.icon  || './icon-192.png',
      badge: data.badge || './icon-72.png',
      tag:   data.tag   || 'annuario-notif',
      data:  data.url   || '/',
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(clientList => {
      if (clientList.length > 0) return clientList[0].focus();
      return clients.openWindow(event.notification.data || '/');
    })
  );
});

console.log('[SW] Annuario Emotivo v1.1 — pronto');
