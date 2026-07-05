// PROJECT MANA — PWA 登録＆インストール案内
(function () {
  'use strict';

  // ---- Service Worker 登録 ----
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (e) {
        console.warn('SW登録失敗', e);
      });
    });
  }

  // ---- インストール案内バナー ----
  var DISMISS_KEY = 'mana_pwa_dismissed_at';
  var DISMISS_DAYS = 14; // 一度閉じたら14日は再表示しない

  function recentlyDismissed() {
    try {
      var t = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
      return !!t && (Date.now() - t) < DISMISS_DAYS * 86400000;
    } catch (e) { return false; }
  }
  function markDismissed() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
  }
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
           window.navigator.standalone === true;
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  }

  var deferredPrompt = null;

  function injectStyles() {
    if (document.getElementById('pwa-banner-style')) return;
    var css =
      '#pwa-install-banner{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);' +
      'z-index:9999;width:calc(100% - 24px);max-width:460px;display:flex;align-items:center;gap:12px;' +
      'background:#faf9f6;color:#0f0e0d;border:1.5px solid #0f0e0d;border-radius:14px;' +
      'padding:12px 14px;box-shadow:0 8px 30px rgba(0,0,0,0.22);' +
      "font-family:'Noto Sans JP',sans-serif;animation:pwaUp .28s ease}" +
      '@keyframes pwaUp{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}' +
      '#pwa-install-banner .pwa-b-icon{width:40px;height:40px;border-radius:9px;flex-shrink:0;border:1px solid rgba(15,14,13,.15)}' +
      '#pwa-install-banner .pwa-b-text{flex:1;min-width:0;line-height:1.35}' +
      '#pwa-install-banner .pwa-b-text b{display:block;font-size:.86rem;font-weight:700}' +
      '#pwa-install-banner .pwa-b-text span{display:block;font-size:.72rem;color:#6b6764;margin-top:2px}' +
      '#pwa-install-banner .pwa-b-share{display:inline-block;padding:0 .25em;font-weight:700;color:#0f0e0d}' +
      '#pwa-install-banner .pwa-b-add{flex-shrink:0;background:#0f0e0d;color:#faf9f6;border:none;border-radius:9px;' +
      "padding:8px 14px;font-size:.78rem;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif}" +
      '#pwa-install-banner .pwa-b-close{flex-shrink:0;background:transparent;border:none;color:#6b6764;' +
      'font-size:1rem;line-height:1;cursor:pointer;padding:4px;margin:-4px -2px -4px 0}';
    var s = document.createElement('style');
    s.id = 'pwa-banner-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function buildBanner(innerHTML) {
    injectStyles();
    var old = document.getElementById('pwa-install-banner');
    if (old) old.remove();
    var b = document.createElement('div');
    b.id = 'pwa-install-banner';
    b.innerHTML = innerHTML;
    (document.body || document.documentElement).appendChild(b);
    return b;
  }

  function showAndroidBanner() {
    var b = buildBanner(
      '<img src="/icon-192.png" class="pwa-b-icon" alt="">' +
      '<div class="pwa-b-text"><b>MANAをホーム画面に追加</b>' +
      '<span>アプリのように起動できます</span></div>' +
      '<button class="pwa-b-add" type="button">追加</button>' +
      '<button class="pwa-b-close" type="button" aria-label="閉じる">✕</button>'
    );
    b.querySelector('.pwa-b-add').addEventListener('click', function () {
      if (!deferredPrompt) { b.remove(); return; }
      deferredPrompt.prompt();
      var p = deferredPrompt.userChoice;
      var done = function () { deferredPrompt = null; b.remove(); };
      if (p && p.then) { p.then(done, done); } else { done(); }
    });
    b.querySelector('.pwa-b-close').addEventListener('click', function () {
      markDismissed(); b.remove();
    });
  }

  function showIOSBanner() {
    var b = buildBanner(
      '<img src="/icon-192.png" class="pwa-b-icon" alt="">' +
      '<div class="pwa-b-text"><b>MANAをホーム画面に追加</b>' +
      '<span>共有ボタン <span class="pwa-b-share">&#x2B06;</span> から「ホーム画面に追加」を選んでください</span></div>' +
      '<button class="pwa-b-close" type="button" aria-label="閉じる">✕</button>'
    );
    b.querySelector('.pwa-b-close').addEventListener('click', function () {
      markDismissed(); b.remove();
    });
  }

  // Android / Chrome：インストール可能になったら独自バナー
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (isStandalone() || recentlyDismissed()) return;
    showAndroidBanner();
  });

  // iOS / Safari：beforeinstallprompt が無いので手順を案内
  window.addEventListener('load', function () {
    if (!isIOS() || isStandalone() || recentlyDismissed()) return;
    var ua = navigator.userAgent;
    // iOSでホーム追加できるのは実質Safariのみ（Chrome等=CriOS/FxiOS/EdgiOSでは出さない）
    var isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (isSafari) setTimeout(showIOSBanner, 1500);
  });

  // インストール完了したらバナー消去＆再表示抑制
  window.addEventListener('appinstalled', function () {
    markDismissed();
    var b = document.getElementById('pwa-install-banner');
    if (b) b.remove();
  });
})();
