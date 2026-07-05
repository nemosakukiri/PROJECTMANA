// PROJECT MANA Service Worker
// 方針：network-first（オンライン時は常に最新を取得＝更新が古いまま止まらない）
//       オフライン時のみキャッシュから返す。同一オリジンのGETだけ扱う（GAS API等の外部通信には干渉しない）。
const CACHE = 'mana-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  // 同一オリジンのみ扱う（フォント・unpkg・GAS API 等の外部はブラウザ任せ＝素通し）
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // 正常なレスポンスだけオフライン用に控える
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')))
  );
});
