// ============================================================
//  iPad 網頁版 APP：離線用的背景程式（Service Worker）
//  所有遊戲檔案由 pwa.js 先下載進「快取」；之後打開遊戲都從快取拿，不用網路
//  pwa_files.json（檔案清單）每次都先問網路，拿不到才用快取（離線時）
// ============================================================
const CACHE = 'mom-files';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
const scopePath = () => new URL(self.registration.scope).pathname;
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== location.origin) return;
  const rel = decodeURIComponent(u.pathname.slice(scopePath().length)) || 'index.html';
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (rel === 'pwa_files.json') {
      try { return await fetch(req, { cache: 'no-store' }); } catch (x) { const hit = await c.match(rel); if (hit) return hit; throw x; }
    }
    const hit = await c.match(rel) || (rel.endsWith('/') ? await c.match(rel + 'index.html') : null);
    if (hit) return hit;
    try { return await fetch(req); } catch (x) {
      return new Response('', { status: 504, statusText: 'offline' });
    }
  })());
});
