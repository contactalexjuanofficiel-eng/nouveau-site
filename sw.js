/*
 * Service worker de Devizo : l'appli s'installe sur l'écran d'accueil et
 * s'ouvre même sans réseau (les données sont déjà enregistrées sur l'appareil).
 *
 * - Pages (.html) : réseau d'abord, copie en cache si pas de réseau. Les mises
 *   à jour arrivent donc toujours dès qu'il y a du réseau.
 * - Fichiers versionnés (?v=…) : cache d'abord (une nouvelle version a une
 *   nouvelle adresse) ; les anciennes versions sont effacées.
 * - Autres fichiers du site : cache, mis à jour en arrière-plan.
 * - Supabase, Stripe, polices, etc. : jamais interceptés.
 */
const CACHE = 'devizo-v1';
const COQUILLE = ['/app.html', '/img/logo.svg', '/img/logo-192.png', '/js/vendor/supabase.js',
  '/js/vendor/jspdf.umd.min.js', '/js/vendor/jspdf.plugin.autotable.min.js'];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUILLE)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    for (const nom of await caches.keys()) if (nom !== CACHE) await caches.delete(nom);
    await self.clients.claim();
  })());
});

async function reseauDabord(req) {
  const cache = await caches.open(CACHE);
  try {
    const rep = await fetch(req);
    if (rep.ok) cache.put(req.url.split('#')[0].split('?')[0], rep.clone());
    return rep;
  } catch (e) {
    const copie = await cache.match(req.url.split('#')[0].split('?')[0]);
    if (copie) return copie;
    throw e;
  }
}

async function versionne(req, url) {
  const cache = await caches.open(CACHE);
  const copie = await cache.match(req);
  if (copie) return copie;
  const rep = await fetch(req);
  if (rep.ok) {
    // On ne garde qu'une version de chaque fichier.
    for (const ancienne of await cache.keys()) {
      const a = new URL(ancienne.url);
      if (a.pathname === url.pathname && a.search !== url.search) cache.delete(ancienne);
    }
    cache.put(req, rep.clone());
  }
  return rep;
}

async function cacheEtMaj(req) {
  const cache = await caches.open(CACHE);
  const copie = await cache.match(req);
  const maj = fetch(req).then((rep) => {
    if (rep.ok) cache.put(req, rep.clone());
    return rep;
  }).catch(() => copie);
  return copie || maj;
}

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/supabase/') || url.pathname === '/sw.js') return;
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    ev.respondWith(reseauDabord(req));
  } else if (url.searchParams.has('v')) {
    ev.respondWith(versionne(req, url));
  } else if (/\.(js|css|png|svg|jpg|webmanifest)$/.test(url.pathname)) {
    ev.respondWith(cacheEtMaj(req));
  }
});
