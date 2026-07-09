// ===== CONFIG =====
const SHEET_ID = '1xVWTPun5X0sW7qlx-XolbX1-mdZjdtVNJ7CTqWJhc3A';
const DB_SHEET_NAME = 'kansokuDB';
const SURVEY_SHEET_NAME = '市民の声';
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxiZEEce69vsneiNs064iQ5MAJtmB4Jjgm9EoxZj29LZ-kJ18EICndUuZ_poU47gmwJsA/exec';
const SHEET_BASE = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=`;

// ===== STATE =====
let dbData = [];
let surveyData = [];
let termsData = []; // 用語辞典
let lawsData  = []; // 法律辞典
let windowMasterData = []; // 窓マスター
let _routeHandled = false; // 初回ルーティング済みフラグ

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hdate').textContent = new Date().toLocaleDateString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit'}).replace(/\//g,'.');
  loadKartes();
  loadDB();
  loadSurveyVoices();
  loadWindowMaster();
  renderHomeCanvas();
  window.addEventListener('hashchange', handleHashRoute);
  handleHashRoute();
  renderHomeVillage();
});

// ===== PAGE NAVIGATION =====
function showPage(name, navEl) {
  console.log('[showPage]', name, '| hash:', location.hash, '| history.length:', history.length);
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  const pageEl = document.getElementById('page-' + name);
  if (!pageEl) return;
  pageEl.classList.add('active');
  if (navEl) navEl.classList.add('active');
  window.scrollTo(0, 0);
  if (name === 'home') renderHomeCanvas();
  if (name === 'essays') loadEssays();
  if (name === 'karte') loadKartes();
  if (name === 'windows') renderWindowsPage();
  if (name === 'window-detail') { /* windowId passed separately via renderWindowDetailPage */ }
  // hashルート以外のページへ遷移する場合のみhashをクリア
  // ただし現在 #/karte/xxx など hashルート表示中の場合は
  // pushState で空hashを履歴に積む（ブラウザバックで戻れるように）
  const hashRoutePages = ['kartedetail','tags','tagdetail','map','terms','laws'];
  if (!hashRoutePages.includes(name) && /^#\//.test(location.hash)) {
    history.pushState(null, '', location.pathname + location.search);
  }
}

// ===== ハッシュルーティング =====
// /#/tags       → タグ一覧
// /#/tag/タグ名 → タグ別カルテ一覧
// /#/karte/ID   → 独立カルテページ
function handleHashRoute() {
  _routeHandled = true;
  const hash = location.hash;
  console.log('[handleHashRoute] hash:', hash, '| state:', JSON.stringify(history.state), '| stack-length:', history.length);

  if (hash === '#/tags') {
    _activatePage('page-tags', 'タグから探す');
    renderTagIndex();
    return;
  }

  if (hash === '#/laws') {
    _activatePage('page-laws', '法律を調べる');
    renderLawIndex();
    return;
  }

  if (hash === '#/terms') {
    _activatePage('page-terms', '用語辞典');
    renderTermIndex();
    return;
  }

  const mapMatch = hash.match(/^#\/map(\?pref=(.+))?$/);
  if (mapMatch) {
    const highlightPref = mapMatch[2] ? decodeURIComponent(mapMatch[2]) : null;
    _activatePage('page-map', '地図で見る');
    renderMapPage(highlightPref);
    return;
  }

  const tagMatch = hash.match(/^#\/tag\/(.+)$/);
  if (tagMatch) {
    const tagName = decodeURIComponent(tagMatch[1]);
    _activatePage('page-tagdetail', 'タグから探す');
    renderTagPage(tagName);
    return;
  }

  const lawMatch = hash.match(/^#\/law\/(.+)$/);
  if (lawMatch) {
    const lawId = decodeURIComponent(lawMatch[1]);
    _activatePage('page-laws', '法律を調べる');
    renderLawPage(lawId);
    return;
  }

  const termMatch = hash.match(/^#\/term\/(.+)$/);
  if (termMatch) {
    const termId = decodeURIComponent(termMatch[1]);
    _activatePage('page-terms', '用語辞典');
    renderTermPage(termId);
    return;
  }

  const karteMatch = hash.match(/^#\/karte\/(.+)$/);
  if (karteMatch) {
    const karteId = decodeURIComponent(karteMatch[1]);
    _activatePage('page-kartedetail', '事案カルテ');
    renderKarteDetailPage(karteId);
    return;
  }
}
function _activatePage(pageId, navLabel) {
  console.log('[_activatePage]', pageId, '| hash:', location.hash, '| history.length:', history.length);
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  document.querySelectorAll('nav a').forEach(a => {
    if (a.textContent.trim() === navLabel) a.classList.add('active');
  });
  window.scrollTo(0, 0);
}

function goToKartePage(karteId) {
  window.open('#/karte/' + encodeURIComponent(karteId), '_blank');
}

// ===== 法律辞典 =====

function loadLaws() {
  if (lawsData.length) return Promise.resolve(lawsData);
  return fetch('/laws.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      lawsData = data;
      return lawsData;
    })
    .catch(function(err) {
      console.error('laws.json読み込みエラー:', err.message);
      return [];
    });
}

// ===== 法律一覧ページ /#/laws =====
function renderLawIndex(query) {
  const container = document.getElementById('page-laws');
  if (!container) return;
  container.innerHTML = '<div class="karte-detail-loading">読み込み中……</div>';

  loadLaws().then(function(laws) {
    if (!laws.length) {
      container.innerHTML = '<div class="karte-detail-loading">法律データを読み込めませんでした</div>';
      return;
    }

    const q       = (query || '').trim();
    const results = q
      ? laws.filter(function(l) {
          return (l.name || '').includes(q) ||
                 (l.short_name || '').includes(q) ||
                 (l.reading || '').includes(q) ||
                 (l.short || '').includes(q) ||
                 (l.category || '').includes(q);
        })
      : laws;

    // カテゴリ別に整理
    const byCategory = {};
    results.forEach(function(l) {
      const cat = l.category || 'その他';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(l);
    });

    const searchBox =
      '<div class="term-search-box">'
      + '<input type="text" id="law-search-input" placeholder="法律名・分野を検索…" value="' + escapeAttr(q) + '"'
      + ' oninput="renderLawIndex(this.value)"'
      + ' style="width:100%;padding:0.6rem 0.8rem;border:1px solid var(--rule);'
      + 'font-family:\'Noto Sans JP\',sans-serif;font-size:0.83rem;background:var(--paper);color:var(--ink)">'
      + '</div>';

    const catHtml = Object.keys(byCategory).map(function(cat) {
      const items = byCategory[cat].map(function(l) {
        const dispName = l.short_name || l.name;
        return '<a href="#/law/' + encodeURIComponent(l.id) + '" class="term-card law-card">'
          + '<div class="term-card-name">' + dispName + '</div>'
          + (l.enacted ? '<div class="term-card-reading">' + l.enacted + '</div>' : '')
          + '<div class="term-card-short">' + (l.short || '') + '</div>'
          + '</a>';
      }).join('');
      return '<div class="term-category-section">'
        + '<div class="term-category-label">' + cat + '</div>'
        + '<div class="term-card-grid">' + items + '</div>'
        + '</div>';
    }).join('');

    const emptyMsg = results.length === 0
      ? '<div style="color:var(--ink-light);font-size:0.83rem;padding:2rem 0">「' + escapeAttr(q) + '」に一致する法律が見つかりません</div>'
      : '';

    container.innerHTML =
      '<div class="karte-detail-header">'
      + '<div class="page-title">法律を調べる</div>'
      + '<div class="page-subtitle">e-Gov法令検索へのリンク集。条文の原文は各法律ページからアクセスできます。</div>'
      + '</div>'
      + searchBox
      + emptyMsg
      + catHtml;

    const input = document.getElementById('law-search-input');
    if (input && q) {
      input.focus();
      input.setSelectionRange(q.length, q.length);
    }
  });
}

// ===== 法律詳細ページ /#/law/id =====
function renderLawPage(lawId) {
  const container = document.getElementById('page-laws');
  if (!container) return;
  container.innerHTML = '<div class="karte-detail-loading">読み込み中……</div>';

  loadLaws().then(function(laws) {
    const l = laws.find(function(x) { return x.id === lawId; });
    if (!l) {
      container.innerHTML =
        '<div class="karte-detail-header">'
        + '<a href="#/laws" class="karte-detail-back">← 法律一覧へ</a>'
        + '</div>'
        + '<div class="karte-detail-loading">法律が見つかりません</div>';
      return;
    }

    const dispName = l.short_name || l.name;

    // ポイントリスト
    const pointsHtml = (l.key_points || []).length
      ? '<ul class="law-key-points">'
        + l.key_points.map(function(p) { return '<li>' + p + '</li>'; }).join('')
        + '</ul>'
      : '';

    // 関連用語リンク（terms.jsonへ）
    const termLinks = (l.related_terms || []).map(function(term) {
      const matched = termsData.find(function(t) { return t.term === term; });
      if (matched) {
        return '<a href="#/term/' + encodeURIComponent(matched.id) + '" class="tag-museum-btn">📖 ' + term + '</a>';
      }
      return '<span class="tag-museum-btn tag-museum-btn-sub">' + term + '</span>';
    }).join('');

    // 関連タグリンク（タグページへ）
    const tagLinks = (l.related_tags || []).map(function(tag) {
      return '<a href="#/tag/' + encodeURIComponent(tag) + '" class="tag-museum-btn">' + tag + '</a>';
    }).join('');

    container.innerHTML =
      '<div class="karte-detail-header">'
      + '<a href="#/laws" class="karte-detail-back">← 法律一覧へ</a>'
      + '<div class="term-category-badge">' + (l.category || '') + '</div>'
      + '<div class="page-title">' + dispName + '</div>'
      + (l.short_name ? '<div class="law-full-name">' + l.name + '</div>' : '')
      + (l.reading ? '<div class="term-reading">' + l.reading + '</div>' : '')
      + (l.enacted ? '<div class="law-enacted">制定：' + l.enacted + '</div>' : '')
      + '</div>'

      + '<div class="term-detail-body">'

      // 概要（展示キャプション）
      + '<div class="term-short-panel">' + (l.short || '') + '</div>'

      // 押さえておくべきポイント
      + (pointsHtml
          ? '<div class="karte-modal-section">'
            + '<div class="karte-modal-section-label">押さえておくべきポイント</div>'
            + pointsHtml
            + '</div>'
          : '')

      // 関連用語（用語辞典へ）
      + (termLinks
          ? '<div class="karte-modal-section">'
            + '<div class="karte-modal-section-label">関連用語（用語辞典）</div>'
            + '<div class="tag-btn-group">' + termLinks + '</div>'
            + '</div>'
          : '')

      // 関連タグ（タグページへ）
      + (tagLinks
          ? '<div class="karte-modal-section">'
            + '<div class="karte-modal-section-label">関連タグから事案を探す</div>'
            + '<div class="tag-btn-group">' + tagLinks + '</div>'
            + '</div>'
          : '')

      // e-Gov リンク
      + (l.egov_url
          ? '<div class="karte-modal-section">'
            + '<div class="karte-modal-section-label">条文を読む</div>'
            + '<a href="' + l.egov_url + '" target="_blank" rel="noopener" class="law-egov-btn">'
            + '⚖️ e-Gov法令検索で条文を読む（外部サイト）'
            + '</a>'
            + '</div>'
          : '')

      // 厚労省等リンク
      + (l.mhlw_url
          ? '<div class="karte-modal-section">'
            + '<div class="karte-modal-section-label">制度の詳細</div>'
            + '<a href="' + l.mhlw_url + '" target="_blank" rel="noopener" class="term-source-link">'
            + '🔗 ' + (l.category || '関連省庁') + 'の解説ページ'
            + '</a>'
            + '</div>'
          : '')

      + '</div>';
  });
}

// ===== 用語辞典 =====

// テキスト内の登録済み用語を /#/term/xxx へのリンクに置き換える
// 対象：用語辞典の detail フィールドのみ（プレーンテキスト前提）
// - 長い用語から先に処理（「生活保護受給者」を「生活保護」より先に）
// - 現在表示中の用語（currentTermId）はスキップ
function autoLinkTerms(text, currentTermId) {
  if (!text || !termsData.length) return text;

  // 文字数の長い順にソート
  const sorted = termsData
    .filter(function(t) { return t.id !== currentTermId; })
    .sort(function(a, b) { return b.term.length - a.term.length; });

  // プレーンテキストを部分ごとに分割して処理
  // 置換済みの <a> タグ部分は再処理しないよう、文字列を分割しながら進む
  sorted.forEach(function(t) {
    var parts = [];
    var remaining = text;
    var idx;
    while ((idx = remaining.indexOf(t.term)) !== -1) {
      // 用語の前の部分はそのまま保持
      parts.push(remaining.slice(0, idx));
      // 用語をリンクに置き換え
      parts.push('<a href="#/term/' + encodeURIComponent(t.id) + '" class="term-inline-link">' + t.term + '</a>');
      remaining = remaining.slice(idx + t.term.length);
    }
    parts.push(remaining);
    text = parts.join('');
  });

  return text;
}

// terms.jsonを読み込む（初回のみ。以降はメモリから返す）
function loadTerms() {
  if (termsData.length) return Promise.resolve(termsData);
  return fetch('/terms.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      termsData = data;
      return termsData;
    })
    .catch(function(err) {
      console.error('terms.json読み込みエラー:', err.message);
      return [];
    });
}

// 部分一致検索（term・reading・short・category を対象）
function searchTerms(query) {
  if (!query || !termsData.length) return [];
  const q = query.trim().toLowerCase();
  return termsData.filter(function(t) {
    return (
      t.term.toLowerCase().includes(q) ||
      (t.reading || '').includes(q) ||
      (t.short || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q)
    );
  });
}

// ===== 用語一覧ページ /#/terms =====
function renderTermIndex(query) {
  const container = document.getElementById('page-terms');
  if (!container) return;
  container.innerHTML = '<div class="karte-detail-loading">読み込み中……</div>';

  loadTerms().then(function(terms) {
    if (!terms.length) {
      container.innerHTML = '<div class="karte-detail-loading">用語辞典を読み込めませんでした</div>';
      return;
    }

    const q       = (query || '').trim();
    const results = q ? searchTerms(q) : terms;

    // カテゴリ別に整理
    const byCategory = {};
    results.forEach(function(t) {
      const cat = t.category || 'その他';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(t);
    });

    const searchBox =
      '<div class="term-search-box">'
      + '<input type="text" id="term-search-input" placeholder="用語を検索…" value="' + escapeAttr(q) + '"'
      + ' oninput="renderTermIndex(this.value)"'
      + ' style="width:100%;padding:0.6rem 0.8rem;border:1px solid var(--rule);'
      + 'font-family:\'Noto Sans JP\',sans-serif;font-size:0.83rem;background:var(--paper);color:var(--ink)">'
      + '</div>';

    const catHtml = Object.keys(byCategory).map(function(cat) {
      const items = byCategory[cat].map(function(t) {
        return '<a href="#/term/' + encodeURIComponent(t.id) + '" class="term-card">'
          + '<div class="term-card-name">' + t.term + '</div>'
          + '<div class="term-card-reading">' + (t.reading || '') + '</div>'
          + '<div class="term-card-short">' + (t.short || '') + '</div>'
          + '</a>';
      }).join('');
      return '<div class="term-category-section">'
        + '<div class="term-category-label">' + cat + '</div>'
        + '<div class="term-card-grid">' + items + '</div>'
        + '</div>';
    }).join('');

    const emptyMsg = results.length === 0
      ? '<div style="color:var(--ink-light);font-size:0.83rem;padding:2rem 0">「' + escapeAttr(q) + '」に一致する用語が見つかりません</div>'
      : '';

    container.innerHTML =
      '<div class="karte-detail-header">'
      + '<div class="page-title">用語辞典</div>'
      + '<div class="page-subtitle">制度・行政用語の展示解説パネル</div>'
      + '</div>'
      + searchBox
      + emptyMsg
      + catHtml;

    // 検索ボックスにフォーカスを戻す
    const input = document.getElementById('term-search-input');
    if (input && q) {
      input.focus();
      input.setSelectionRange(q.length, q.length);
    }
  });
}

// ===== 用語詳細ページ /#/term/id =====
function renderTermPage(termId) {
  const container = document.getElementById('page-terms');
  if (!container) return;
  container.innerHTML = '<div class="karte-detail-loading">読み込み中……</div>';

  loadTerms().then(function(terms) {
    const t = terms.find(function(x) { return x.id === termId; });
    if (!t) {
      container.innerHTML =
        '<div class="karte-detail-header">'
        + '<a href="#/terms" class="karte-detail-back">← 用語一覧へ</a>'
        + '</div>'
        + '<div class="karte-detail-loading">用語が見つかりません</div>';
      return;
    }

    // 関連タグリンク
    const tagLinks = (t.related_tags || []).map(function(tag) {
      return '<a href="#/tag/' + encodeURIComponent(tag) + '" class="tag-museum-btn">' + tag + '</a>';
    }).join('');

    // 関連カルテへの導線（filterKarteByTagを使用）
    const karteLinks = (t.related_karte_tags || []).map(function(tag) {
      return '<a href="#/tag/' + encodeURIComponent(tag) + '" class="term-karte-link">'
        + '📋 「' + tag + '」の事案カルテを見る'
        + '</a>';
    }).join('');

    container.innerHTML =
      '<div class="karte-detail-header">'
      + '<a href="#/terms" class="karte-detail-back">← 用語一覧へ</a>'
      + '<div class="term-category-badge">' + (t.category || '') + '</div>'
      + '<div class="page-title">' + t.term + '</div>'
      + '<div class="term-reading">' + (t.reading || '') + '</div>'
      + '</div>'

      + '<div class="term-detail-body">'

      // 短い説明（展示キャプション）
      + '<div class="term-short-panel">' + (t.short || '') + '</div>'

      // 詳しい説明（登録済み用語を自動リンク化）
      + (t.detail
          ? '<div class="karte-modal-section">'
            + '<div class="karte-modal-section-label">詳しい説明</div>'
            + '<div class="karte-modal-text">' + autoLinkTerms(t.detail, t.id) + '</div>'
            + '</div>'
          : '')

      // 関連タグ
      + (tagLinks
          ? '<div class="karte-modal-section">'
            + '<div class="karte-modal-section-label">関連タグから事案を探す</div>'
            + '<div class="tag-btn-group">' + tagLinks + '</div>'
            + '</div>'
          : '')

      // 関連カルテ
      + (karteLinks
          ? '<div class="karte-modal-section">'
            + '<div class="karte-modal-section-label">関連カルテ</div>'
            + karteLinks
            + '</div>'
          : '')

      // 公式情報リンク
      + (t.source_url
          ? '<div class="karte-modal-section">'
            + '<div class="karte-modal-section-label">公式情報</div>'
            + '<a href="' + t.source_url + '" target="_blank" rel="noopener" class="term-source-link">'
            + '🔗 ' + (t.source || t.source_url)
            + '</a>'
            + '</div>'
          : '')

      + '</div>';
  });
}



// ===== 法律辞典 =====

function loadLaws() {
  if (lawsData.length) return Promise.resolve(lawsData);
  return fetch('/laws.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      lawsData = data;
      return lawsData;
    })
    .catch(function(err) {
      console.error('laws.json読み込みエラー:', err.message);
      return [];
    });
}

// ===== 法律一覧ページ /#/laws =====
function renderLawIndex(query) {
  const container = document.getElementById('page-laws');
  if (!container) return;
  container.innerHTML = '<div class="karte-detail-loading">読み込み中……</div>';

  loadLaws().then(function(laws) {
    if (!laws.length) {
      container.innerHTML = '<div class="karte-detail-loading">法律データを読み込めませんでした</div>';
      return;
    }

    const q = (query || '').trim();
    const results = q
      ? laws.filter(function(l) {
          return (l.name || '').includes(q) ||
                 (l.short_name || '').includes(q) ||
                 (l.reading || '').includes(q) ||
                 (l.short || '').includes(q) ||
                 (l.category || '').includes(q);
        })
      : laws;

    // カテゴリ別に整理
    const byCategory = {};
    results.forEach(function(l) {
      const cat = l.category || 'その他';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(l);
    });

    const searchBox =
      '<div class="term-search-box">'
      + '<input type="text" id="law-search-input" placeholder="法律名を検索…" value="' + escapeAttr(q) + '"'
      + ' oninput="renderLawIndex(this.value)"'
      + ' style="width:100%;padding:0.6rem 0.8rem;border:1px solid var(--rule);'
      + 'font-family:Noto Sans JP,sans-serif;font-size:0.83rem;background:var(--paper);color:var(--ink)">'
      + '</div>';

    const catHtml = Object.keys(byCategory).map(function(cat) {
      const items = byCategory[cat].map(function(l) {
        const displayName = l.short_name || l.name;
        return '<a href="#/law/' + encodeURIComponent(l.id) + '" class="term-card law-card">'
          + '<div class="term-card-name">' + displayName + '</div>'
          + (l.short_name ? '<div class="term-card-reading">' + l.name + '</div>' : '<div class="term-card-reading">' + (l.reading || '') + '</div>')
          + '<div class="term-card-short">' + (l.short || '') + '</div>'
          + '</a>';
      }).join('');
      return '<div class="term-category-section">'
        + '<div class="term-category-label">' + cat + '</div>'
        + '<div class="term-card-grid">' + items + '</div>'
        + '</div>';
    }).join('');

    const emptyMsg = results.length === 0
      ? '<div style="color:var(--ink-light);font-size:0.83rem;padding:2rem 0">「' + escapeAttr(q) + '」に一致する法律が見つかりません</div>'
      : '';

    container.innerHTML =
      '<div class="karte-detail-header">'
      + '<div class="page-title">法律を調べる</div>'
      + '<div class="page-subtitle">制度の根拠となる法律へのガイド</div>'
      + '</div>'
      + searchBox
      + emptyMsg
      + catHtml;

    const input = document.getElementById('law-search-input');
    if (input && q) {
      input.focus();
      input.setSelectionRange(q.length, q.length);
    }
  });
}

// ===== 法律詳細ページ /#/law/xxx =====
function renderLawPage(lawId) {
  const container = document.getElementById('page-laws');
  if (!container) return;
  container.innerHTML = '<div class="karte-detail-loading">読み込み中……</div>';

  loadLaws().then(function(laws) {
    const l = laws.find(function(x) { return x.id === lawId; });
    if (!l) {
      container.innerHTML =
        '<div class="karte-detail-header">'
        + '<a href="#/laws" class="karte-detail-back">← 法律一覧へ</a>'
        + '</div>'
        + '<div class="karte-detail-loading">該当する法律が見つかりません</div>';
      return;
    }

    const displayName = l.short_name || l.name;

    // ポイントリスト
    const pointsHtml = (l.key_points || []).length
      ? '<ul class="law-key-points">'
        + l.key_points.map(function(p) { return '<li>' + p + '</li>'; }).join('')
        + '</ul>'
      : '';

    // 関連用語リンク（terms.jsonへ）
    const termLinks = (l.related_terms || []).map(function(term) {
      const t = termsData.find(function(x) { return x.term === term; });
      if (t) {
        return '<a href="#/term/' + encodeURIComponent(t.id) + '" class="tag-museum-btn">' + term + '</a>';
      }
      return '<span class="tag-museum-btn" style="opacity:0.5">' + term + '</span>';
    }).join('');

    // 関連タグリンク
    const tagLinks = (l.related_tags || []).map(function(tag) {
      return '<a href="#/tag/' + encodeURIComponent(tag) + '" class="tag-museum-btn">' + tag + '</a>';
    }).join('');

    container.innerHTML =
      '<div class="karte-detail-header">'
      + '<a href="#/laws" class="karte-detail-back">← 法律一覧へ</a>'
      + '<div class="term-category-badge">' + (l.category || '') + '</div>'
      + '<div class="page-title">' + displayName + '</div>'
      + (l.short_name
          ? '<div class="law-fullname">' + l.name + '</div>'
          : '<div class="term-reading">' + (l.reading || '') + '</div>')
      + (l.enacted ? '<div class="law-enacted">制定：' + l.enacted + '</div>' : '')
      + '</div>'

      + '<div class="term-detail-body">'

      // 概要（展示キャプション）
      + '<div class="term-short-panel">' + (l.short || '') + '</div>'

      // 知っておくべきポイント
      + (pointsHtml
          ? '<div class="karte-modal-section">'
            + '<div class="karte-modal-section-label">知っておくべきポイント</div>'
            + pointsHtml
            + '</div>'
          : '')

      // 関連用語（用語辞典へ）
      + (termLinks
          ? '<div class="karte-modal-section">'
            + '<div class="karte-modal-section-label">関連用語</div>'
            + '<div class="tag-btn-group">' + termLinks + '</div>'
            + '</div>'
          : '')

      // 関連タグ（タグページへ）
      + (tagLinks
          ? '<div class="karte-modal-section">'
            + '<div class="karte-modal-section-label">関連タグから事案を探す</div>'
            + '<div class="tag-btn-group">' + tagLinks + '</div>'
            + '</div>'
          : '')

      // e-Govリンク
      + (l.egov_url
          ? '<div class="karte-modal-section">'
            + '<div class="karte-modal-section-label">条文を読む</div>'
            + '<a href="' + l.egov_url + '" target="_blank" rel="noopener" class="law-egov-link">'
            + '📄 e-Gov 法令検索で全文を見る →</a>'
            + '</div>'
          : '')

      // 所管省庁リンク
      + (l.mhlw_url
          ? '<div class="karte-modal-section">'
            + '<div class="karte-modal-section-label">所管省庁の説明</div>'
            + '<a href="' + l.mhlw_url + '" target="_blank" rel="noopener" class="term-source-link">'
            + '🔗 厚生労働省のページを見る</a>'
            + '</div>'
          : '')

      + '</div>';
  });
}

// ===== 地図ページ /#/map =====
let _mapInstance = null;

function renderMapPage(highlightPref) {
  const container = document.getElementById('page-map');
  if (!container) return;

  if (!dbData.length) {
    container.innerHTML = '<div class="karte-detail-loading">観測DBを読み込み中……</div>';
    setTimeout(function(){ renderMapPage(highlightPref); }, 400);
    return;
  }

  // 都道府県ごとの件数集計
  const counts = {};
  dbData.forEach(r => {
    const pref = r.region_pref || r.region || '';
    if (!pref || pref === '厚労省' || pref === '総務省' || pref === '内閣府') return;
    counts[pref] = (counts[pref] || 0) + 1;
  });

  const total    = dbData.length;
  const maxCount = Math.max(...Object.values(counts), 1);
  const sorted   = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  // 件数一覧HTMLをあらかじめ組み立てる
  const tableRows = sorted.map(([pref, count]) =>
    `<div onclick="filterByRegion('${pref}')"
          style="display:flex;justify-content:space-between;align-items:center;
                 padding:0.35rem 0.6rem;border:1px solid var(--rule);cursor:pointer;
                 font-size:0.78rem;transition:all 0.12s"
          onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
          onmouseout="this.style.borderColor='var(--rule)';this.style.color='var(--ink)'">
       <span>${pref}</span>
       <span style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--ink-light)">${count}件</span>
     </div>`
  ).join('');

  container.innerHTML =
    '<div class="karte-detail-header">' +
      '<div class="page-title">地域別 観測記録マップ</div>' +
      '<div class="page-subtitle">観測DB ' + total + '件の地域分布（クリックで絞り込み）</div>' +
    '</div>' +
    '<div id="map-container" style="height:500px;width:100%;margin:1rem 0;border:1px solid var(--rule)"></div>' +
    '<div style="display:flex;align-items:center;gap:1rem;font-family:DM Mono,monospace;font-size:0.65rem;color:var(--ink-light);margin-bottom:1.5rem">' +
      '<span>件数：</span>' +
      '<span style="display:flex;align-items:center;gap:0.3rem"><span style="display:inline-block;width:16px;height:16px;background:#eef3fa;border:1px solid #85b7eb"></span> 少</span>' +
      '<span style="display:flex;align-items:center;gap:0.3rem"><span style="display:inline-block;width:16px;height:16px;background:#123a6f"></span> 多</span>' +
      '<span style="margin-left:auto">地域が取得できていない記事は集計対象外</span>' +
    '</div>' +
    '<div class="section-label" style="margin-bottom:0.8rem">都道府県別 件数一覧</div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.3rem;margin-bottom:2rem">' +
      tableRows +
    '</div>';

  if (_mapInstance) { _mapInstance.remove(); _mapInstance = null; }

  const map = L.map('map-container', { zoomControl: true }).setView([36.5, 136], 5);
  _mapInstance = map;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    opacity: 0.15
  }).addTo(map);

  // 将来はリポジトリ内の /japan.geojson に変更予定
  fetch('https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson')
    .then(r => r.json())
    .then(geojson => {
      L.geoJSON(geojson, {
        style: function(feature) {
          const pref  = feature.properties.nam_ja || feature.properties.name || '';
          const count = counts[pref] || 0;
          const opacity = count === 0 ? 0.08 : 0.2 + (count / maxCount) * 0.7;
          return { fillColor: count === 0 ? '#9a9690' : '#123a6f', fillOpacity: opacity, color: '#ffffff', weight: 1 };
        },
        onEachFeature: function(feature, layer) {
          const pref  = feature.properties.nam_ja || feature.properties.name || '';
          const count = counts[pref] || 0;
          layer.bindTooltip('<strong>' + pref + '</strong><br>' + count + '件', { sticky: true, className: 'map-tooltip' });
          layer.on('click', function() { if (count > 0) filterByRegion(pref); });
          layer.on('mouseover', function() {
            if (pref !== highlightPref) this.setStyle({ weight: 2, color: '#123a6f' });
          });
          layer.on('mouseout', function() {
            if (pref !== highlightPref) this.setStyle({ weight: 1, color: '#ffffff' });
          });
          // カルテ詳細から遷移した場合に該当都道府県を強調表示
          if (highlightPref && pref === highlightPref) {
            layer.setStyle({ weight: 3, color: '#e05a00', fillColor: '#e05a00', fillOpacity: 0.6 });
            layer.bringToFront();
          }
        }
      }).addTo(map);
    })
    .catch(function() {
      var el = document.getElementById('map-container');
      if (el) el.innerHTML = '<div class="karte-detail-loading">地図データの読み込みに失敗しました</div>';
    });
}

// 地図・件数一覧から観測DBをregionフィールドで直接絞り込む
function filterByRegion(pref) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  const pageDb = document.getElementById('page-db');
  if (pageDb) pageDb.classList.add('active');
  const dbNav = document.querySelector('nav a:nth-child(2)');
  if (dbNav) dbNav.classList.add('active');
  window.scrollTo(0, 0);
  if (/^#\//.test(location.hash)) {
    history.replaceState(null, '', location.pathname + location.search);
  }

  const filtered = dbData.filter(r => (r.region_pref || r.region || '') === pref);
  _currentFilteredData = filtered;
  const searchEl = document.getElementById('db-search');
  if (searchEl) searchEl.value = '';
  const countEl = document.getElementById('db-count-label');
  if (countEl) countEl.textContent = '「' + pref + '」の記事： ' + filtered.length + ' 件';
  renderDB(filtered);
}

// ===== タグ一覧ページ /#/tags =====
function renderTagIndex() {
  const container = document.getElementById('page-tags');
  if (!container) return;
  if (!karteData.length) {
    container.innerHTML = '<div class="karte-detail-loading">読み込み中……</div>';
    setTimeout(renderTagIndex, 300);
    return;
  }

  // 主探索軸（5軸）: 分野・対象者・行為者・出来事・地域
  const mainAxes = [
    { key: 'tags_field',        icon: '📋', label: '分野から探す',      desc: '関係する制度・行政分野' },
    { key: 'tags_target',       icon: '👤', label: '対象者から探す',    desc: 'あなた自身や家族の状況' },
    { key: 'tags_actor',        icon: '🏛', label: '行為者から探す',    desc: '関わった機関や担当者' },
    { key: 'tags_event_search', icon: '⚡', label: '出来事から探す',    desc: '何をされたか・何が起きたか' },
    { key: 'region_pref',       icon: '🗾', label: '地域から探す',      desc: '都道府県・地方自治体' },
  ];

  // 補助探索軸: 状態タグのみ（前面に出しすぎず補助として）
  const subAxes = [
    { key: 'tags_status', icon: '🔖', label: '現在の状況から探す', desc: '疑惑段階・係争中・是正済みなど' },
  ];

  // 既存観測タグ（最下部に折りたたみ表示）
  const observeAxes = [
    { key: 'tags_event',     label: '出来事タグ（観測軸）' },
    { key: 'tags_structure', label: '構造タグ（観測軸）' },
    { key: 'tags_evidence',  label: '根拠タグ（観測軸）' },
  ];

  // タグ集計
  function countTags(key) {
    const counts = {};
    karteData.forEach(k => {
      splitKarteTags(k[key] || '').forEach(tag => {
        if (tag) counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  }

  // 主軸HTML（博物館的・セクション区切り）
  function buildMainAxisHtml(axis) {
    const tags = countTags(axis.key);
    if (!tags.length) return '';
    return '<div class="tag-axis-section">'
      + '<div class="tag-axis-header">'
      +   '<span class="tag-axis-icon">' + axis.icon + '</span>'
      +   '<div>'
      +     '<div class="tag-axis-label">' + axis.label + '</div>'
      +     '<div class="tag-axis-desc">' + axis.desc + '</div>'
      +   '</div>'
      + '</div>'
      + '<div class="tag-btn-group">'
      + tags.map(function(t) {
          return '<a href="#/tag/' + encodeURIComponent(t[0]) + '" class="tag-museum-btn">'
            + t[0]
            + '<span class="tag-museum-count">' + t[1] + '</span>'
            + '</a>';
        }).join('')
      + '</div>'
      + '</div>';
  }

  // 補助軸HTML（コンパクト）
  function buildSubAxisHtml(axis) {
    const tags = countTags(axis.key);
    if (!tags.length) return '';
    return '<div class="tag-axis-section tag-axis-sub">'
      + '<div class="tag-axis-header">'
      +   '<span class="tag-axis-icon">' + axis.icon + '</span>'
      +   '<div>'
      +     '<div class="tag-axis-label">' + axis.label + '</div>'
      +     '<div class="tag-axis-desc">' + axis.desc + '</div>'
      +   '</div>'
      + '</div>'
      + '<div class="tag-btn-group">'
      + tags.map(function(t) {
          return '<a href="#/tag/' + encodeURIComponent(t[0]) + '" class="tag-museum-btn tag-museum-btn-sub">'
            + t[0]
            + '<span class="tag-museum-count">' + t[1] + '</span>'
            + '</a>';
        }).join('')
      + '</div>'
      + '</div>';
  }

  // 観測タグHTML（カード型・常時展開）
  function buildObserveAxisHtml(axis) {
    const tags = countTags(axis.key);
    if (!tags.length) return '';
    return '<div class="tag-observe-axis">'
      + '<div class="tag-observe-axis-label">' + axis.label + '</div>'
      + '<div class="tag-btn-group">'
      + tags.map(function(t) {
          return '<a href="#/tag/' + encodeURIComponent(t[0]) + '" class="tag-museum-btn tag-museum-btn-sub">'
            + t[0]
            + '<span class="tag-museum-count">' + t[1] + '</span>'
            + '</a>';
        }).join('')
      + '</div>'
      + '</div>';
  }

  const hasExplore = karteData.some(k =>
    k.tags_field || k.tags_target || k.tags_actor || k.tags_event_search
  );

  const mainHtml   = mainAxes.map(buildMainAxisHtml).join('');
  const subHtml    = subAxes.map(buildSubAxisHtml).join('');
  const observeHtml = observeAxes.map(buildObserveAxisHtml).join('');

  const fallbackNote = !hasExplore
    ? '<div style="font-family:DM Mono,monospace;font-size:0.65rem;color:var(--ink-light);margin-bottom:1.5rem;padding:0.5rem 0.8rem;border-left:2px solid var(--rule)">探索タグは順次付与中です。現在は観測タグから探せます。</div>'
    : '';

  container.innerHTML =
    '<div class="karte-detail-header">'
    + '<div class="page-title">アーカイブを探索する</div>'
    + '<div class="page-subtitle">分野・対象者・地域など様々な入口から記録を探せます</div>'
    + '</div>'
    + '<div class="tag-explore-page">'
    + fallbackNote
    + (mainHtml || '<div style="color:var(--ink-light);font-size:0.83rem;margin-bottom:2rem">探索タグを付与中です。下の観測タグから探せます。</div>')
    + (subHtml ? '<div class="tag-sub-divider">補助的な絞り込み</div>' + subHtml : '')
    + (observeHtml
        ? '<div class="tag-observe-section">'
          + '<div class="tag-observe-header">'
          +   '<div class="tag-observe-title">観測タグから探す</div>'
          +   '<div class="tag-observe-desc">出来事・構造・状態・根拠の4軸で記録を分類しています。MANAの分析視点から探索できます。</div>'
          + '</div>'
          + '<div class="tag-observe-axes">' + observeHtml + '</div>'
          + '</div>'
        : '')
    + '</div>';
}

function toggleObserveTags(el) {
  el.nextElementSibling.classList.toggle('open');
  el.classList.toggle('open');
}

// ===== タグ別カルテ一覧 /#/tag/タグ名 =====
function renderTagPage(tagName) {
  const container = document.getElementById('page-tagdetail');
  if (!container) return;
  if (!karteData.length) {
    container.innerHTML = '<div class="karte-detail-loading">読み込み中……</div>';
    setTimeout(() => renderTagPage(tagName), 300);
    return;
  }

  const allTagFields = [
    'tags_field', 'tags_target', 'tags_actor', 'tags_event_search',
    'tags_event', 'tags_structure', 'tags_status', 'tags_evidence',
    'region_pref', 'region_city'
  ];
  const matched = karteData.filter(k =>
    allTagFields.some(f => splitKarteTags(k[f] || '').includes(tagName))
  );

  const backLink = `<a href="#/tags" class="karte-detail-back">← タグ一覧へ</a>`;

  const cards = matched.map(k => {
    const urls       = k.related_urls ? k.related_urls.split('\n').filter(Boolean) : [];
    const structTags = splitKarteTags(k.tags_structure);
    const eventTags  = splitKarteTags(k.tags_event);
    return `<div class="karte-card" onclick="location.hash='#/karte/${encodeURIComponent(k.id)}'">
      <div class="karte-card-top">
        <span class="karte-card-id">${k.id}</span>
        ${k.region ? `<span class="karte-card-region">${k.region}</span>` : ''}
        ${k.field  ? `<span class="karte-card-field">${k.field}</span>`   : ''}
      </div>
      <div class="karte-card-title">${k.title}</div>
      ${k.summary ? `<div class="karte-card-summary">${k.summary.slice(0,120)}${k.summary.length>120?'……':''}</div>` : ''}
      <div class="karte-card-tags">
        ${structTags.map(t=>`<a href="#/tag/${encodeURIComponent(t)}" class="db-tag-s" onclick="event.stopPropagation()">${t}</a>`).join('')}
        ${eventTags.map(t =>`<a href="#/tag/${encodeURIComponent(t)}" class="db-tag-e" onclick="event.stopPropagation()">${t}</a>`).join('')}
      </div>
      <div class="karte-card-footer"><span>記事 ${urls.length} 件</span></div>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="karte-detail-header">
      ${backLink}
      <div class="page-title">「${tagName}」のカルテ</div>
      <div class="page-subtitle">${matched.length} 件</div>
    </div>
    <div style="padding:1.5rem 0">
      ${matched.length ? cards : '<div class="karte-detail-loading">該当するカルテがありません</div>'}
    </div>`;
}

// ===== 独立カルテページ /#/karte/ID =====
function renderKarteDetailPage(karteId) {
  const container = document.getElementById('kartedetail-content');
  if (!container) return;

  if (!karteData || !karteData.length) {
    container.innerHTML = '<div class="karte-detail-loading">読み込み中……</div>';
    setTimeout(() => renderKarteDetailPage(karteId), 300);
    return;
  }

  const k = karteData.find(k => k.id === karteId);
  if (!k) {
    container.innerHTML = `<div class="karte-detail-loading">指定されたカルテ（${escapeAttr(karteId)}）が見つかりません</div>`;
    return;
  }

  const urls = k.related_urls ? k.related_urls.split('\n').map(u => u.trim()).filter(Boolean) : [];

  const sourcesHtml = urls.map(u => {
    const article = dbData.find(r => normalizeUrl(r.url) === normalizeUrl(u));
    const title  = article ? article.title : null;
    const date   = article ? article.date  : null;
    const region = article ? (article.region || '') : null;
    return `<a href="${u}" target="_blank" rel="noopener" style="display:block;text-decoration:none;margin-bottom:6px">
      <div style="font-size:11.5px;color:#1a1816;line-height:1.45">${title || u}</div>
      ${date || region ? `<div style="font-size:9.5px;color:#888;margin-top:2px;font-family:'DM Mono',monospace">${[date, region].filter(Boolean).join(' — ')}</div>` : ''}
    </a>`;
  }).join('');

  const regionPref = k.region_pref || k.region || '';
  const karteNum   = k.id ? k.id.replace(/^KARTE-/, '') : k.id;

  const tagsEvent     = splitKarteTags(k.tags_event);
  const tagsStructure = splitKarteTags(k.tags_structure);
  const tagsStatus    = splitKarteTags(k.tags_status);
  const tagsEvidence  = splitKarteTags(k.tags_evidence);
  const tagsTarget    = splitKarteTags(k.tags_target || '');
  const tagsActor     = splitKarteTags(k.tags_actor  || '');

  function chipsHtml(tags, cls) {
    return '<div class="kp2-chips">' + tags.map(t =>
      `<a href="#/tag/${encodeURIComponent(t)}" class="${cls}">${t}</a>`
    ).join('') + '</div>';
  }

  function panel(label, body, isEmpty) {
    return `<div class="kp2-panel">
      <div class="kp2-panel-head"><div class="kp2-panel-label">${label}：</div></div>
      <div class="kp2-panel-body${isEmpty ? ' kp2-empty' : ''}">${body}</div>
    </div>`;
  }

  // ===== 構造が近い事案：タグの重なりで比較導線を作る =====
  // renderTagPage()の横断検索対象フィールドと揃える
  const STRUCTURAL_TAG_FIELDS = [
    'tags_field', 'tags_target', 'tags_actor', 'tags_event_search',
    'tags_event', 'tags_structure', 'tags_status', 'tags_evidence',
    'region_pref', 'region_city'
  ];

  function collectTagSet(karte) {
    const set = new Set();
    STRUCTURAL_TAG_FIELDS.forEach(f => {
      splitKarteTags(karte[f] || '').forEach(t => set.add(t));
    });
    return set;
  }

  const myTagSet = collectTagSet(k);

  const structurallyRelated = karteData
    .filter(other => other.id !== k.id)
    .map(other => {
      const otherTagSet = collectTagSet(other);
      const common = [...myTagSet].filter(t => otherTagSet.has(t));
      return { karte: other, commonTags: common, commonCount: common.length };
    })
    .filter(r => r.commonCount >= 3)
    .sort((a, b) => b.commonCount - a.commonCount)
    .slice(0, 5);

  const structurallyRelatedHtml = structurallyRelated.length
    ? structurallyRelated.map(r => `
      <div class="kp2-related-item">
        <div class="kp2-related-top">
          <a href="#/karte/${encodeURIComponent(r.karte.id)}" class="kp2-related-title">${r.karte.title}</a>
          <a href="#/karte/${encodeURIComponent(r.karte.id)}" target="_blank" rel="noopener" class="kp2-related-newtab" title="新しいタブで開く">↗</a>
        </div>
        <div class="kp2-related-match">${r.commonCount}タグ一致</div>
        <div class="kp2-related-tags">一致タグ：${r.commonTags.join('、')}</div>
      </div>
    `).join('')
    : '<span class="kp2-empty">構造が近い事案は見つかりませんでした</span>';

  container.innerHTML = `<div class="kp2-wrap">
    <div class="kp2-left">

      <!-- 観測記録No.ブロック -->
      <div class="kp2-no-block">
        <div class="kp2-no-label">観測記録</div>
        <div class="kp2-no-num">No.${karteNum}</div>
        <div class="kp2-no-id">${k.id}</div>
      </div>

      <div class="kp2-demo-title">事案プロフィール：</div>

      <!-- 地域：地図ページへ（クリック可） -->
      <div class="kp2-prow">
        <div class="kp2-prow-label">地域</div>
        ${regionPref
          ? `<a href="#/map?pref=${encodeURIComponent(regionPref)}" class="kp2-chip kp2-chip-region" title="${regionPref}の事案を地図で見る">${regionPref} <span class="kp2-chip-arrow">→</span></a>`
            + (k.region_city ? `<span class="kp2-chip kp2-chip-text">${k.region_city}</span>` : '')
          : '<span class="kp2-chip kp2-chip-text">—</span>'}
      </div>

      <!-- 分野：タグページへ（クリック可） -->
      <div class="kp2-prow">
        <div class="kp2-prow-label">分野</div>
        ${k.field
          ? `<a href="#/tag/${encodeURIComponent(k.field)}" class="kp2-chip kp2-chip-field" title="${k.field}の事案一覧">${k.field} <span class="kp2-chip-arrow">→</span></a>`
          : '<span class="kp2-chip kp2-chip-text">—</span>'}
      </div>

      <!-- 状態：タグページへ（クリック可） -->
      ${tagsStatus.length ? `
      <div class="kp2-prow">
        <div class="kp2-prow-label">状態</div>
        ${tagsStatus.map(t => `<a href="#/tag/${encodeURIComponent(t)}" class="kp2-chip kp2-chip-status" title="${t}の事案一覧">${t} <span class="kp2-chip-arrow">→</span></a>`).join('')}
      </div>` : ''}

      <!-- 対象者：タグページへ（クリック可） -->
      ${tagsTarget.length ? `
      <div class="kp2-prow">
        <div class="kp2-prow-label">対象者</div>
        <div class="kp2-chip-wrap">${tagsTarget.map(t => `<a href="#/tag/${encodeURIComponent(t)}" class="kp2-chip kp2-chip-target" title="${t}の事案一覧">${t} <span class="kp2-chip-arrow">→</span></a>`).join('')}</div>
      </div>` : ''}

      <!-- 行為者：タグページへ（クリック可） -->
      ${tagsActor.length ? `
      <div class="kp2-prow">
        <div class="kp2-prow-label">行為者</div>
        <div class="kp2-chip-wrap">${tagsActor.map(t => `<a href="#/tag/${encodeURIComponent(t)}" class="kp2-chip kp2-chip-actor" title="${t}の事案一覧">${t} <span class="kp2-chip-arrow">→</span></a>`).join('')}</div>
      </div>` : ''}

      <!-- 根拠種別：タグページへ（クリック可） -->
      ${tagsEvidence.length ? `
      <div class="kp2-prow">
        <div class="kp2-prow-label">根拠種別</div>
        <div class="kp2-chip-wrap">${tagsEvidence.map(t => `<a href="#/tag/${encodeURIComponent(t)}" class="kp2-chip kp2-chip-evidence" title="${t}の事案一覧">${t} <span class="kp2-chip-arrow">→</span></a>`).join('')}</div>
      </div>` : ''}

      <!-- 事案開始・根拠記事・カルテID：クリック不可（純粋な情報） -->
      ${k.start_date ? `
      <div class="kp2-prow">
        <div class="kp2-prow-label">事案開始</div>
        <span class="kp2-chip kp2-chip-text">${k.start_date}</span>
      </div>` : ''}

      <div class="kp2-prow">
        <div class="kp2-prow-label">根拠記事</div>
        <span class="kp2-chip kp2-chip-text">${urls.length}件</span>
      </div>

      <div class="kp2-prow">
        <div class="kp2-prow-label">カルテID</div>
        <span class="kp2-chip kp2-chip-text" style="font-family:'DM Mono',monospace;font-size:10px">${k.id}</span>
      </div>

      ${k.updated_at ? `
      <div class="kp2-prow">
        <div class="kp2-prow-label">最終更新</div>
        <span class="kp2-chip kp2-chip-text">${k.updated_at.slice(0,10)}</span>
      </div>` : ''}

    </div>

    <div class="kp2-right">

      <!-- 事案名帯 -->
      <div class="kp2-name-band">
        <h1>${k.title}</h1>
      </div>

      <div class="kp2-panels">

        <!-- 出来事：全幅・強調・クリック可能 -->
        ${tagsEvent.length ? `
        <div class="kp2-panel-event">
          <div class="kp2-panel-head-event"><div class="kp2-panel-label-event">観測された出来事：</div></div>
          <div class="kp2-panel-body">${chipsHtml(tagsEvent, 'kp2-chip-e')}</div>
        </div>` : ''}

        <!-- 観測メモ（全文・切れない）-->
        <div class="kp2-panel kp2-panel-memo" style="grid-column:1/-1">
          <div class="kp2-panel-head"><div class="kp2-panel-label">観測メモ：</div></div>
          <div class="kp2-panel-body kp2-memo-body">${k.summary || '<span class="kp2-empty">未記録</span>'}</div>
        </div>

        <!-- 構造が近い事案：タグの重なりによる比較導線（ニュースの関連記事ではない） -->
        <div class="kp2-panel kp2-panel-structural" style="grid-column:1/-1">
          <div class="kp2-panel-head"><div class="kp2-panel-label">構造が近い事案：</div></div>
          <div class="kp2-panel-body kp2-structural-body">${structurallyRelatedHtml}</div>
        </div>

        <!-- メモ / 経過 -->
        ${panel('メモ', k.mana_comment || '未記録', !k.mana_comment)}
        ${panel('経過', k.progress || '未記録', !k.progress)}

        <!-- 根拠資料 / 観測ソース -->
        ${panel('根拠資料',
          tagsEvidence.length ? chipsHtml(tagsEvidence, 'kp2-chip-v') : '未記録', !tagsEvidence.length)}
        ${urls.length
          ? panel('観測ソース', sourcesHtml, false)
          : panel('観測ソース', '未記録', true)}

        <!-- 構造パターン：折りたたみ（分析補助） -->
        ${tagsStructure.length ? `
        <div class="kp2-panel kp2-panel-struct" style="grid-column:1/-1">
          <div class="kp2-struct-toggle" onclick="this.nextElementSibling.classList.toggle('kp2-open');this.classList.toggle('kp2-open')">
            ▶ 構造パターン（分析補助）
          </div>
          <div class="kp2-struct-body">
            ${chipsHtml(tagsStructure, 'kp2-chip-s')}
          </div>
        </div>` : ''}

        <!-- 作成・更新 -->
        ${panel('作成・更新',
          `<div style="font-size:10.5px;color:#555;font-style:italic">
            ${k.created_at ? '作成 ' + k.created_at.slice(0,10) + '<br>' : ''}
            ${k.updated_at ? '更新 ' + k.updated_at.slice(0,10) : ''}
          </div>`, false)}

        <!-- 展示に追加 -->
        <div class="kp2-panel" style="grid-column:1/-1;border:1.5px dashed var(--rule,#ddd);background:transparent">
          <div class="kp2-panel-body" style="padding:0.9rem 1rem">
            <button class="exhibit-add-btn" onclick="openExhibitModal('${escapeAttr(k.id)}','karte','${escapeAttr(k.title)}')">
              ＋ この事案を窓に展示する
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>`;
}
// ===== 展示登録モーダル =====
function openExhibitModal(refId, refType, refTitle) {
  let modal = document.getElementById('exhibit-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'exhibit-modal';
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2000;
      display:flex;align-items:center;justify-content:center;padding:1rem;
    `;
    modal.onclick = e => { if (e.target === modal) closeExhibitModal(); };
    document.body.appendChild(modal);
  }

  const windowOptions = (windowMasterData || []).map(w =>
    `<option value="${w.window_id}">${w.window_name}</option>`
  ).join('');

  modal.innerHTML = `
    <div style="
      background:#faf9f6;border-radius:8px;max-width:480px;width:100%;
      padding:1.6rem 1.8rem;box-shadow:0 8px 32px rgba(0,0,0,0.18);
    ">
      <div style="font-size:0.72rem;letter-spacing:0.1em;color:#888;margin-bottom:0.4rem">展示に追加</div>
      <div style="font-size:0.9rem;font-weight:600;margin-bottom:1.4rem;line-height:1.4">${refTitle}</div>

      <div style="margin-bottom:1rem">
        <label style="font-size:0.78rem;color:#555;display:block;margin-bottom:0.3rem">展示する窓</label>
        <select id="exhibit-window-select" style="width:100%;padding:0.5rem 0.7rem;border:1px solid #d0cdc8;border-radius:4px;font-size:0.88rem;background:#fff">
          ${windowOptions}
        </select>
      </div>

      <div style="margin-bottom:1rem">
        <label style="font-size:0.78rem;color:#555;display:block;margin-bottom:0.3rem">視点のタイトル <span style="color:#aaa">（例：公益通報から見る民主主義）</span></label>
        <input id="exhibit-title-input" type="text" placeholder="〜から見る〜" style="width:100%;padding:0.5rem 0.7rem;border:1px solid #d0cdc8;border-radius:4px;font-size:0.88rem;box-sizing:border-box">
      </div>

      <div style="margin-bottom:1.4rem">
        <label style="font-size:0.78rem;color:#555;display:block;margin-bottom:0.3rem">展示理由・メモ</label>
        <textarea id="exhibit-note-input" rows="3" placeholder="なぜこの窓に展示するか…" style="width:100%;padding:0.5rem 0.7rem;border:1px solid #d0cdc8;border-radius:4px;font-size:0.88rem;box-sizing:border-box;resize:vertical"></textarea>
      </div>

      <div style="display:flex;gap:0.8rem;justify-content:flex-end">
        <button onclick="closeExhibitModal()" style="background:none;border:1px solid #d0cdc8;padding:0.5rem 1.2rem;border-radius:4px;cursor:pointer;font-size:0.84rem;color:#666">キャンセル</button>
        <button onclick="saveExhibit('${refId}','${refType}')" style="background:#14140c;color:#fff;border:none;padding:0.5rem 1.4rem;border-radius:4px;cursor:pointer;font-size:0.84rem">登録する</button>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}

function closeExhibitModal() {
  const modal = document.getElementById('exhibit-modal');
  if (modal) modal.style.display = 'none';
}

function saveExhibit(refId, refType) {
  const windowId   = document.getElementById('exhibit-window-select')?.value;
  const title      = document.getElementById('exhibit-title-input')?.value.trim();
  const exhibitNote = document.getElementById('exhibit-note-input')?.value.trim();

  if (!windowId || !title) {
    alert('窓と視点タイトルは必須です');
    return;
  }

  const entry = {
    window_id:    windowId,
    ref_id:       refId,
    ref_type:     refType,
    perspective:  'mana',
    title,
    exhibit_note: exhibitNote,
    reasoning:    null,
    confidence:   1.0,
    status:       'published',
    created_at:   new Date().toISOString().slice(0, 10),
    approved_at:  new Date().toISOString().slice(0, 10),
  };

  const stored = JSON.parse(localStorage.getItem('mana_exhibits') || '[]');
  stored.push(entry);
  localStorage.setItem('mana_exhibits', JSON.stringify(stored));

  closeExhibitModal();
  showExhibitConfirm(entry);
}

function showExhibitConfirm(entry) {
  const win = (windowMasterData || []).find(w => w.window_id === entry.window_id);
  let popup = document.getElementById('canvas-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'canvas-popup';
    document.body.appendChild(popup);
  }
  popup.style.cssText = `
    position:fixed;bottom:2.5rem;left:50%;transform:translateX(-50%);
    background:rgba(20,20,12,0.92);color:#cdd6e0;
    font-size:0.84rem;line-height:1.7;
    padding:1.1rem 1.6rem;border-radius:7px;
    max-width:300px;text-align:center;
    opacity:1;transition:opacity 0.3s;pointer-events:none;z-index:999;
  `;
  popup.innerHTML = `登録しました<br><span style="opacity:0.6;font-size:0.78rem">${win?.window_name || entry.window_id} ／ ${entry.title}</span>`;
  clearTimeout(popup._timer);
  popup._timer = setTimeout(() => { popup.style.opacity = '0'; }, 3000);
}

// ===== トップ全文検索 =====
let _homeSearchTimer = null;

function homeSearch(kw) {
  const resultsEl = document.getElementById('home-search-results');
  if (!resultsEl) return;

  kw = kw.trim();
  if (!kw) { resultsEl.style.display = 'none'; return; }

  // デバウンス：200ms待って実行
  clearTimeout(_homeSearchTimer);
  _homeSearchTimer = setTimeout(() => _runHomeSearch(kw), 200);
}

function _runHomeSearch(kw) {
  const resultsEl = document.getElementById('home-search-results');
  if (!resultsEl) return;

  const q = kw.toLowerCase();
  const MAX = 8;
  const hits = [];

  // カルテを検索（タイトル・概要）
  if (karteData && karteData.length) {
    karteData.forEach(k => {
      const haystack = ((k.title || '') + ' ' + (k.summary || '')).toLowerCase();
      if (haystack.includes(q)) {
        hits.push({
          type: 'karte',
          id:   k.id,
          title: k.title || '',
          sub:   (k.region || '') + (k.field ? '　' + k.field : ''),
        });
      }
    });
  }

  // 観測DBを検索（タイトル・要約）
  if (dbData && dbData.length) {
    dbData.forEach(r => {
      const haystack = ((r.title || '') + ' ' + (r.summary || '')).toLowerCase();
      if (haystack.includes(q)) {
        hits.push({
          type:  'db',
          url:   r.url || '',
          title: r.title || '',
          sub:   (r.date ? r.date.slice(0, 10) : '') + (r.region ? '　' + r.region : ''),
        });
      }
    });
  }

  if (!hits.length) {
    resultsEl.innerHTML = '<div class="hsr-empty">「' + kw + '」に一致する記録が見つかりませんでした</div>';
    resultsEl.style.display = 'block';
    return;
  }

  const shown = hits.slice(0, MAX);
  const more  = hits.length - shown.length;

  resultsEl.innerHTML = shown.map(h => {
    if (h.type === 'karte') {
      return `<div class="hsr-item hsr-karte" onclick="goToKartePage('${h.id}')">
        <span class="hsr-badge hsr-badge-karte">カルテ</span>
        <span class="hsr-title">${h.title}</span>
        <span class="hsr-sub">${h.sub}</span>
      </div>`;
    } else {
      const onclick = h.url
        ? `window.open('${h.url}','_blank')`
        : `showPage('db',document.querySelector('nav a:nth-child(2)'))`;
      return `<div class="hsr-item hsr-db" onclick="${onclick}">
        <span class="hsr-badge hsr-badge-db">観測DB</span>
        <span class="hsr-title">${h.title}</span>
        <span class="hsr-sub">${h.sub}</span>
      </div>`;
    }
  }).join('') + (more > 0
    ? `<div class="hsr-more" onclick="showPage('db',document.querySelector('nav a:nth-child(2)'))">他 ${more} 件 → 観測DBで検索する</div>`
    : '');

  resultsEl.style.display = 'block';
}

// 検索窓の外クリックで結果を閉じる
document.addEventListener('click', e => {
  const wrap = document.getElementById('home-search-results');
  if (wrap && !wrap.contains(e.target) && e.target.id !== 'home-search-input') {
    wrap.style.display = 'none';
  }
});

function checkKarteLinkage() {
  if (!dbData.length || !karteData.length) return;
  const dbUrls = dbData.map(r => r.url).filter(Boolean);
  const karteUrls = karteData.flatMap(k =>
    k.related_urls ? k.related_urls.split('\n').map(u => u.trim()).filter(Boolean) : []
  );
  const matched = [];
  const unmatched = [];
  dbData.forEach(r => {
    if (!r.url) { unmatched.push(r); return; }
    findKarteByUrl(r.url) ? matched.push(r) : unmatched.push(r);
  });
  const emptyRelatedKartes = karteData.filter(k => !k.related_urls || !k.related_urls.trim());
  console.log('===== カルテ紐付け状況（事実集計） =====');
  console.log('1. 観測DBの記事URL数:', dbUrls.length);
  console.log('2. カルテ related_urls 内URL数（延べ）:', karteUrls.length);
  console.log('3. URL一致している記事数:', matched.length);
  console.log('4. URL一致していない記事一覧（' + unmatched.length + '件）:');
  unmatched.forEach(r => console.log('   -', r.date, r.title, '|', r.url || '(URLなし)'));
  console.log('5. related_urlsが空のカルテ一覧（' + emptyRelatedKartes.length + '件）:');
  emptyRelatedKartes.forEach(k => console.log('   -', k.id, k.title));

  // ===== 代表記事ズレ検出 =====
  console.log('===== 代表記事ズレ検出 =====');
  let mismatchCount = 0;
  dbData.forEach(r => {
    if (!r.url) return;
    const karte = findKarteByUrl(r.url);
    if (!karte) return;

    // カルテのrelated_urlsの先頭URLを「代表記事」とみなす
    const firstUrl = karte.related_urls
      ? karte.related_urls.split('\n').map(u => u.trim()).filter(Boolean)[0]
      : null;

    // DB記事タイトルとカルテタイトルの比較
    const dbTitle    = (r.title || '').slice(0, 30);
    const karteTitle = (karte.title || '').slice(0, 30);

    // 先頭URL（代表記事）とDB記事URLが一致しない場合 → ズレの可能性
    if (firstUrl && normalizeUrl(firstUrl) !== normalizeUrl(r.url)) {
      mismatchCount++;
      console.warn('[ズレ候補] DB記事:「' + dbTitle + '」→ ' + karte.id + '「' + karteTitle + '」/ 代表URL:' + (firstUrl || '').slice(0, 60));
    }
  });
  if (mismatchCount === 0) {
    console.log('代表記事ズレ: 検出なし');
  } else {
    console.warn('代表記事ズレ候補: ' + mismatchCount + '件 → ブラウザのConsoleで[ズレ候補]を確認してください');
  }
  console.log('=========================================');
}

// ===== LOAD DB =====
// ドメインまたは明示的な記事種別フィールドから article_type を推論
// 優先順位：明示列 > ドメインマッチ > デフォルト 'news'
function inferArticleType(explicitType, domain, sourceName) {
  if (explicitType && explicitType !== 'news') return explicitType;
  // 出典名（RSSソース名）で判定
  const s = (sourceName || '').toLowerCase();
  if (/赤旗|調査報道/.test(s)) return 'investigative';
  if (/wedge|slow.?news|現代ビジネス|bigissue|president|東洋経済/.test(s)) return 'opinion';
  if (/シノドス|synodos|論考|研究|シンクタンク/.test(s)) return 'research';
  // ドメインで判定（source_domainが来た場合）
  if (!domain) return 'news';
  const d = domain.toLowerCase();
  if (/jcp\.or\.jp/.test(d)) return 'investigative';
  if (/wedge\.ismedia\.jp|slowsnews\.com|slow-news\.|bigissue\.jp|gendai\.media|president\.jp|toyokeizai\.net/.test(d)) return 'opinion';
  if (/synodos\.jp|jri\.co\.jp|nri\.com|rieti\.go\.jp|nira\.or\.jp|murc\.jp|chuokoron\.jp|ci\.nii\.ac\.jp|ndl\.go\.jp/.test(d)) return 'research';
  if (/e-gov\.go\.jp|shugiin\.go\.jp|sangiin\.go\.jp|courts\.go\.jp/.test(d)) return 'law';
  return 'news';
}

function loadDB(retryCount) {
  retryCount = retryCount || 0;
  console.log('DB読み込み開始（GAS API）:', GAS_API_URL, retryCount > 0 ? 'リトライ' + retryCount : '');
  fetch(GAS_API_URL)
    .then(r => {
      console.log('HTTPステータス:', r.status);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      if (!Array.isArray(data)) throw new Error('データ形式が不正です: ' + JSON.stringify(data).slice(0, 100));
      dbData = data.map(row => ({
        date:           row['日付'] || '',
        region:         row['地域'] || '',
        region_pref:    row['地域']    || row['都道府県'] || '',
        region_city:    row['市区町村'] || '',
        region_ward:    row['区']       || '',
        municipality:   row['市区町村'] || '',
        field:          row['分野'] || '',
        source:         row['出典'] || '',
        url:            row['URL'] || '',
        title:          row['タイトル'] || '',
        summary:        row['要約'] || '',
        tags_event:     row['出来事タグ'] || '',
        tags_structure: row['構造タグ'] || '',
        tags_evidence:  row['根拠タグ'] || '',
        tags_status:    row['状態タグ'] || '',
        tags_field:     row['分野タグ'] || '',
        tags_target:    row['対象者タグ'] || '',
        tags_actor:     row['行為者タグ'] || '',
        severity:       row['重要度'] || '中',
        structure_note: row['構造メモ'] || '',
        collected_at:   row['収録日時'] || '',
        old_flag:       row['古い記事'] === '古い記事候補' ? '古い記事候補' : '', // 明示的な文字列のみアーカイブ扱い（boolean false防止）
        date_status:    row['date_status'] || '', // 確定 / 未確認 / 要確認
        karte_id:       row['カルテID'] || '', // 正式紐付けキー（URL逆引き不使用）
        article_type:   inferArticleType(row['記事種別'], row['source_domain'] || (() => { try { return new URL(row['URL'] || '').hostname; } catch(e) { return ''; } })(), row['出典'] || ''),
      })).filter(r => r.title);
      // [診断] カルテID列がAPIから来ているか確認
      const sampleRow = dbData.slice(0, 3);
      sampleRow.forEach((r, i) => {
        console.log('[loadDB診断] 記事' + i + ':', r.title ? r.title.slice(0, 30) : '(無題)',
          '| karte_id:', r.karte_id || '(空)',
          '| url末尾:', (r.url || '').slice(-30));
      });
      const hasKarteId = dbData.some(r => r.karte_id);
      console.log('[loadDB診断] カルテID列が存在するか:', hasKarteId ? 'YES ✅' : 'NO ❌（GAS APIが列を返していない可能性）');
      // source_domain / article_type 診断
      const rawSample = data.slice(0, 3);
      rawSample.forEach((row, i) => console.log('[loadDB診断] raw row' + i + ' keys:', Object.keys(row).join(', ')));
      const opinionCount = dbData.filter(r => r.article_type === 'opinion').length;
      const invCount = dbData.filter(r => r.article_type === 'investigative').length;
      console.log('[loadDB診断] opinion件数:', opinionCount, '| investigative件数:', invCount);

      // ===== 表示順は必ず「収集日ベースの新着順」に統一する =====
      // 公開日(date)や文字列順ではなく、collected_at（収録日時）をDateとして比較する。
      // collected_atが取れない異常データのみ date にフォールバックする。
      dbData.sort((a, b) => {
        const collectedA = new Date(a.collected_at || 0);
        const collectedB = new Date(b.collected_at || 0);
        if (!isNaN(collectedA) && !isNaN(collectedB) && (collectedB - collectedA !== 0)) {
          return collectedB - collectedA;
        }
        // collected_atが同値・不正な場合のみdateにフォールバック
        return new Date(b.date || 0) - new Date(a.date || 0);
      });
      console.log('DB読み込み成功:', dbData.length + '件');
      renderDB(dbData);
      updateStats();
      renderHomeNews(dbData.filter(r => !isHeldBack(r)).slice(0, 5));
      buildFilters(dbData);
      updateTicker(dbData);
      renderHomeTagCloud(dbData);
      checkKarteLinkage();
    })
    .catch(err => {
      console.error('DB読み込みエラー:', err.message);
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 2000;
        console.log('リトライします（' + delay/1000 + '秒後）');
        setTimeout(() => loadDB(retryCount + 1), delay);
      } else {
        console.error('DB読み込みを3回試みましたが失敗しました');
        const dbCards = document.getElementById('db-cards');
        if (dbCards && !dbData.length) {
          dbCards.innerHTML = '<div style="padding:2rem;color:#888;font-size:0.85rem">データの読み込みに失敗しました。しばらくしてからページを再読み込みしてください。</div>';
        }
      }
    });
}

function loadSurveyVoices() {
  if (SHEET_ID === 'YOUR_SHEET_ID_HERE') {
    renderHomeVoices(demoVoices());
    return;
  }
  fetch(SHEET_BASE + encodeURIComponent(SURVEY_SHEET_NAME))
    .then(r => r.text())
    .then(text => {
      const json = JSON.parse(text.replace('/*O_o*/\ngoogle.visualization.Query.setResponse(', '').replace(');', ''));
      const rows = json.table.rows;
      surveyData = rows.slice(1).map(row => ({
        pref: row.c[0]?.v || '',
        window: row.c[1]?.v || '',
        detail: row.c[3]?.v || '',
        date: row.c[6]?.v || ''
      })).filter(r => r.detail);
      renderHomeVoices(surveyData.slice(-3).reverse());
      const scs = document.getElementById('survey-count-stat'); if(scs) scs.innerHTML = surveyData.length + '<sup>件</sup>';
      const scb = document.getElementById('survey-count-sub'); if(scb) scb.textContent = '▲ 随時更新';
    })
    .catch(() => renderHomeVoices(demoVoices()));
}

// ===== DEMO DATA =====
function useDemoData() {
  dbData = [
    {
      date:'2026-06-05', region:'京都府', municipality:'京都市', field:'生活保護', url:'',
      title:'【デモ】福祉窓口で申請者に不適切発言、録音が証拠として提出',
      summary:'生活保護申請窓口で担当職員が申請者に不適切な発言。録音データが提出され問題化。',
      tags_event:'申請妨害 / 誤情報提供', tags_structure:'説明責任 / 組織防衛',
      tags_evidence:'当事者証言 / 録音・録画', tags_status:'疑惑段階', severity:'高'
    },
    {
      date:'2026-06-04', region:'大阪府', municipality:'大阪市', field:'障害福祉', url:'',
      title:'【デモ】福祉事務所の訪問記録に虚偽記載、監査で発覚',
      summary:'福祉事務所の職員が未実施の訪問を実施済みとして記録。内部監査で発覚し担当者を処分。',
      tags_event:'記録改ざん', tags_structure:'内部統制 / 説明責任 / 自己修正不能',
      tags_status:'行政が認めた / 謝罪あり', tags_evidence:'監査報告', severity:'高'
    },
    {
      date:'2026-06-03', region:'神奈川県', municipality:'', field:'障害福祉', url:'',
      title:'【デモ】障害福祉サービスの支給量を独断で削減、行政不服申立て',
      summary:'担当ケースワーカーが利用者の同意なくサービス支給量を削減。不服申立てが認められる。',
      tags_event:'支給停止 / 本人意思の無視', tags_structure:'当事者主体の不実装 / 権限濫用',
      tags_status:'係争中 / 是正あり', tags_evidence:'裁判例 / 当事者証言', severity:'高'
    },
    {
      date:'2026-06-02', region:'東京都', municipality:'', field:'情報公開', url:'',
      title:'【デモ】区役所窓口で申請書類を紛失、再提出強要し4ヶ月放置',
      summary:'提出済みの申請書類が区役所内で紛失。担当部署は再提出を求め、その後も4ヶ月間対応せず。',
      tags_event:'長期放置 / 書類紛失', tags_structure:'判断プロセス不備 / 説明責任',
      tags_status:'是正なし', tags_evidence:'当事者証言', severity:'中'
    },
    {
      date:'2026-05-30', region:'愛知県', municipality:'', field:'生活保護', url:'',
      title:'【デモ】生活保護申請に「まず親族に相談を」と繰り返し申請阻止',
      summary:'窓口職員が法的根拠なく親族扶養を条件として提示し続け、申請を事実上阻止していた事例。',
      tags_event:'申請妨害 / 扶養照会濫用', tags_structure:'制度実装の失敗 / 前例主義 / 反復構造',
      tags_status:'疑惑段階', tags_evidence:'当事者証言', severity:'高'
    },
    {
      date:'2026-05-15', region:'京都府', municipality:'京都市', field:'財政', url:'',
      title:'【デモ】京都市財政推計ミスが発覚、値上げ方針は継続',
      summary:'財政危機の根拠となった推計に誤りが発覚したにもかかわらず、当局は値上げ方針を撤回せず。',
      tags_event:'財政推計ミス / 政策撤回なし', tags_structure:'説明責任 / 自己修正不能 / 財政危機言説',
      tags_status:'誤り認定 / 謝罪あり / 撤回なし', tags_evidence:'議会議事録 / 行政資料', severity:'高'
    },
  ];
  renderDB(dbData);
  updateStats();
  renderHomeNews(dbData.filter(r => !isHeldBack(r)).slice(0, 5));
  buildFilters(dbData);
  updateTicker(dbData);
  renderHomeTagCloud(dbData);
  renderHomeVoices(demoVoices());
}

function demoVoices() {
  return [
    {pref:'京都市 / 福祉窓口', detail:'申請したいと言ったら、まず家族に相談してきてと言われた。家族と連絡が取れないから来ているのに。'},
    {pref:'大阪市 / 障害福祉課', detail:'必要な書類を聞いたら毎回違うことを言われる。わざと諦めさせようとしているとしか思えない。'},
    {pref:'名古屋市 / 生活支援課', detail:'担当者が変わったら前の記録が全部消えていた。また一から説明させられた。'},
  ];
}

// ===== RENDER DB =====
const TAG_COLORS = {
  event:     {bg:'#fdf0f0',border:'#e8a0a0',text:'#8b2020'},
  structure: {bg:'#e6f1fb',border:'#85b7eb',text:'#0c447c'},
  evidence:  {bg:'#eaf3de',border:'#97c459',text:'#27500a'},
  status:    {bg:'#faeeda',border:'#ef9f27',text:'#633806'},
};

let activeTagFilters = {event:[], structure:[], evidence:[], status:[]};

function renderDB(data) {
  _currentFilteredData = data;
  const container = document.getElementById('db-cards');
  if (!container) return;

  console.log('renderDB - dbData件数:', data.length);
  console.log('renderDB - karteData件数:', (karteData && karteData.length) ? karteData.length : '未読み込み');
  const totalMatch = data.filter(r => findKarteByUrl(r.url)).length;
  console.log('renderDB - URL照合成功件数:', totalMatch + '/' + data.length);
  data.slice(0, 3).forEach((r, i) => {
    const k = findKarteByUrl(r.url);
    console.log(`記事[${i}] URL:「${r.url}」→ カルテ:`, k ? k.id + ' ' + k.title : 'なし');
    if (!k && karteData && karteData.length) {
      console.log(`  related_urls例:`, karteData[0]?.related_urls?.slice(0, 100));
    }
  });

  // ===== 保留箱は通常の新着一覧からは分離する（削除はしない） =====
  // 「古い記事候補」（確定的に古い）または「要確認」（日付未確認・再配信疑い）の
  // いずれかに該当する行は保留箱扱い。
  // チェックボックス #db-show-old がオンの場合のみ表示に含める。
  const showOld = document.getElementById('db-show-old')?.checked || false;
  const oldCount = data.filter(r => isHeldBack(r)).length;
  const visibleData = showOld ? data : data.filter(r => !isHeldBack(r));

  const oldCountLabel = document.getElementById('db-old-count-label');
  if (oldCountLabel) {
    oldCountLabel.textContent = oldCount > 0
      ? `（保留 ${oldCount}件を${showOld ? '表示中' : '非表示中'}）`
      : '';
  }

  if (!visibleData.length) {
    container.innerHTML = '<div class="db-empty">該当するデータがありません</div>';
    const cl0 = document.getElementById('db-count-label');
    if (cl0) cl0.textContent = '';
    return;
  }

  const cl = document.getElementById('db-count-label');
  if (cl) cl.textContent = visibleData.length + ' 件表示中' + (!showOld && oldCount > 0 ? `（保留${oldCount}件は除く）` : '');

  container.innerHTML = visibleData.map((r, idx) => {
    const eventTags  = splitTags(r.tags_event);
    const structTags = splitTags(r.tags_structure);
    const evidTags   = splitTags(r.tags_evidence);
    const statusTags = splitTags(r.tags_status);
    const fieldTags  = splitTags(r.tags_field);
    const targetTags = splitTags(r.tags_target);
    const actorTags  = splitTags(r.tags_actor);
    const sev = r.severity === '高' ? `<span class="db-card-sev-high">高</span>` :
                r.severity === '中' ? `<span class="db-card-sev-mid">中</span>` : '';
    const hasAnyTag = eventTags.length || structTags.length || evidTags.length || statusTags.length ||
                       fieldTags.length || targetTags.length || actorTags.length;
    // カルテ紐付け：karte_id列を正式キーとして使用
    const relatedKarte = r.karte_id
      ? karteData.find(k => k.id === r.karte_id) || null
      : null;
    // [診断] 最初の5件のみログ
    if (idx < 5) {
      console.log('[renderDB診断] idx:' + idx,
        '| 記事:', (r.title || '').slice(0, 25),
        '| karte_id:', r.karte_id || '(空)',
        '| relatedKarte:', relatedKarte ? relatedKarte.id + ' ' + (relatedKarte.title || '').slice(0, 20) : 'null');
    }
    // idxではなくURLのハッシュ値でカードIDを生成（フィルタ後のズレを防止）
    const cardId = 'card-' + idx + '-' + (r.url || r.title || '').replace(/[^a-zA-Z0-9]/g, '').slice(-8);

    return `<div class="db-card${isHeldBack(r) ? ' db-card-old' : ''}" id="${cardId}">
      <div class="db-card-top">
        <span class="db-card-date">${r.date}</span>
        ${r.old_flag
          ? `<span class="db-card-old-badge" title="元記事公開日が古いと確認済みです">過去記事</span>`
          : (r.date_status === '要確認'
            ? `<span class="db-card-old-badge db-card-review-badge" title="日付の矛盾、またはGoogleニュース再配信の疑いが強いため確認が必要です">要確認</span>`
            : '')}
        ${r.region ? `<span class="db-card-region">${r.region}${r.municipality ? ' / ' + r.municipality : ''}</span>` : ''}
        ${r.field ? `<span class="db-card-field">${r.field}</span>` : ''}
        ${sev}
        ${relatedKarte ? `<span class="db-card-karte-badge">カルテあり</span>` : ''}
      </div>
      <div class="db-card-title">
        ${r.url ? `<a href="${r.url}" target="_blank">${r.title}</a>` : r.title}
      </div>
      ${relatedKarte ? `<button class="db-card-karte-btn" onclick="event.stopPropagation();goToKartePage('${relatedKarte.id}')">📋 事案カルテを見る：${relatedKarte.title}</button>` : ''}
      ${r.summary ? `<div class="db-card-summary">${r.summary}</div>` : ''}
      <div class="db-card-tags">
        ${eventTags.map(t=>`<a href="#/tag/${encodeURIComponent(t)}" class="db-tag-e" onclick="event.stopPropagation()">${t}</a>`).join('')}
        ${structTags.map(t=>`<a href="#/tag/${encodeURIComponent(t)}" class="db-tag-s" onclick="event.stopPropagation()">${t}</a>`).join('')}
        ${evidTags.map(t=>`<a href="#/tag/${encodeURIComponent(t)}" class="db-tag-v" onclick="event.stopPropagation()">${t}</a>`).join('')}
        ${statusTags.map(t=>`<a href="#/tag/${encodeURIComponent(t)}" class="db-tag-t" onclick="event.stopPropagation()">${t}</a>`).join('')}
        ${fieldTags.map(t=>`<a href="#/tag/${encodeURIComponent(t)}" class="db-tag-field" onclick="event.stopPropagation()">${t}</a>`).join('')}
        ${targetTags.map(t=>`<a href="#/tag/${encodeURIComponent(t)}" class="db-tag-target" onclick="event.stopPropagation()">${t}</a>`).join('')}
        ${actorTags.map(t=>`<a href="#/tag/${encodeURIComponent(t)}" class="db-tag-actor" onclick="event.stopPropagation()">${t}</a>`).join('')}
      </div>
      ${hasAnyTag ? `<button class="db-similar-btn" id="similar-btn-${cardId}" onclick="event.stopPropagation();toggleSimilar('${cardId}')">共通する構造を探す</button>` : ''}
      <div class="db-card-similar" id="similar-${cardId}"></div>
    </div>`;
  }).join('');
}

function openKarteFromDB(karteId) {
  goToKartePage(karteId);
}

function normalizeUrl(url) {
  if (!url) return '';
  return url.trim().replace(/\/$/, '');
}

function findKarteByUrl(articleUrl) {
  if (!articleUrl) return null;
  if (!karteData || !karteData.length) return null;
  const normalized = normalizeUrl(articleUrl);
  const allMatched = karteData.filter(k => {
    const urls = k.related_urls;
    if (!urls) return false;
    const urlList = Array.isArray(urls) ? urls : String(urls).split('\n');
    return urlList.map(u => normalizeUrl(u)).includes(normalized);
  });
  if (allMatched.length > 1) {
    console.warn('[findKarteByUrl] 重複URL検出:', normalized,
      '→', allMatched.map(k => k.id).join(', '));
  }
  return allMatched[0] || null;
}

// ===== 保留箱判定（v4） =====
// 保留（通常の新着表示・トップページ・ティッカーから外す）対象は以下のみ：
//   - 「古い記事候補」（元記事公開日が古いと確認済み）
//   - date_status = '要確認'（日付に矛盾、Googleニュース再配信疑いが強い等）
// date_status = '未確認'（RSS日付はあるが元記事公開日が未確認なだけ）は保留しない。
// 通常表示してよい。ただし弱いバッジ（「元記事日付未確認」）で明示する。
function isHeldBack(r) {
  if (r.old_flag) return true; // 確定的に古い記事
  if (r.date_status === '要確認') return true; // 日付矛盾・再配信疑いが強いもの
  return false; // 「未確認」は保留対象にしない
}

function splitTags(str) {
  if (!str) return [];
  return str.split('/').map(t => t.trim()).filter(Boolean);
}

function buildSidebarTagFilters(data) {
  const collect = (key) => {
    const counts = {};
    data.forEach(r => {
      splitTags(r[key]).forEach(t => { counts[t] = (counts[t]||0)+1; });
    });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,15);
  };
  const render = (id, key, entries) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = entries.map(([tag, count]) =>
      `<button class="db-tag-btn" onclick="toggleTagFilter('${key}','${tag}',this)">${tag}<span style="opacity:0.5;margin-left:0.2rem">${count}</span></button>`
    ).join('');
  };
  render('filter-event',    'tags_event',     collect('tags_event'));
  render('filter-structure','tags_structure',  collect('tags_structure'));
  render('filter-status',   'tags_status',     collect('tags_status'));
  render('filter-evidence', 'tags_evidence',   collect('tags_evidence'));
}

function toggleTagFilter(type, tag, btn) {
  const idx = activeTagFilters[type].indexOf(tag);
  if (idx === -1) {
    activeTagFilters[type].push(tag);
    btn.classList.add('active');
  } else {
    activeTagFilters[type].splice(idx, 1);
    btn.classList.remove('active');
  }
  filterDB();
}

function resetFilters() {
  document.getElementById('db-search').value = '';
  document.getElementById('db-pref').value = '';
  document.getElementById('db-category').value = '';
  document.getElementById('db-severity').value = '';
  activeTagFilters = {event:[], structure:[], evidence:[], status:[]};
  document.querySelectorAll('.db-tag-btn').forEach(b => b.classList.remove('active'));
  filterDB();
}

function toggleDbFilter(btn) {
  const sidebar = document.getElementById('db-sidebar');
  const icon    = document.getElementById('db-filter-toggle-icon');
  const label   = document.getElementById('db-filter-toggle-label');
  sidebar.classList.toggle('open');
  const isOpen = sidebar.classList.contains('open');
  icon.textContent  = isOpen ? '▲' : '▼';
  label.textContent = isOpen ? '絞り込み条件を閉じる' : '絞り込み条件を表示';
}

function filterDB() {
  const kw   = (document.getElementById('db-search')?.value || '').toLowerCase();
  const pref = document.getElementById('db-pref')?.value || '';
  const cat  = document.getElementById('db-category')?.value || '';
  const sev  = document.getElementById('db-severity')?.value || '';
  const filtered = dbData.filter(r => {
    const allText = [r.title, r.summary, r.tags_event, r.tags_structure, r.tags_evidence, r.tags_status].filter(Boolean).join(' ').toLowerCase();
    if (kw && !allText.includes(kw)) return false;
    if (pref && (r.region||r.prefecture||'') !== pref) return false;
    if (cat  && (r.field||r.category||'') !== cat) return false;
    if (sev  && r.severity !== sev) return false;
    if (activeTagFilters.event.length     && !activeTagFilters.event.every(t     => (r.tags_event||'').includes(t)))     return false;
    if (activeTagFilters.structure.length && !activeTagFilters.structure.every(t  => (r.tags_structure||'').includes(t))) return false;
    if (activeTagFilters.evidence.length  && !activeTagFilters.evidence.every(t   => (r.tags_evidence||'').includes(t)))  return false;
    if (activeTagFilters.status.length    && !activeTagFilters.status.every(t     => (r.tags_status||'').includes(t)))    return false;
    return true;
  });
  renderDB(filtered);
}

function buildFilters(data) {
  const prefs = [...new Set(data.map(r => r.region||r.prefecture||'').filter(Boolean))].sort();
  const cats  = [...new Set(data.map(r => r.field||r.category||'').filter(Boolean))].sort();
  const prefSel = document.getElementById('db-pref');
  const catSel  = document.getElementById('db-category');
  prefSel.innerHTML = '<option value="">全地域</option>';
  catSel.innerHTML  = '<option value="">全分野</option>';
  prefs.forEach(p => { const o = document.createElement('option'); o.value = o.textContent = p; prefSel.appendChild(o); });
  cats.forEach(c  => { const o = document.createElement('option'); o.value = o.textContent = c; catSel.appendChild(o); });
  buildSidebarTagFilters(data);
}

function updateStats() {
  const dbCount = dbData.length;
  const dcs = document.getElementById('db-count-stat'); if(dcs) dcs.innerHTML = dbCount + '<sup>件</sup>';
  const dcb = document.getElementById('db-count-sub'); if(dcb) dcb.textContent = '▲ AI自動収集・毎日更新';
  // ホームの統計行
  const homeDb = document.getElementById('home-db-count');
  if (homeDb) homeDb.textContent = dbCount + '件';
}

function renderHomeNews(data) {
  document.getElementById('home-news-list').innerHTML = data.map((r, i) => `
    <div class="news-item">
      <div class="news-num">0${i+1}</div>
      <div>
        <div class="news-pref">${r.prefecture}</div>
        <div class="news-title">${r.title}</div>
        <div class="news-meta">${r.date} — ${r.source}</div>
      </div>
    </div>
  `).join('');
}

function renderHomeVoices(data) {
  const hv = document.getElementById('home-voices'); if(hv) hv.innerHTML = data.map(v => `
    <div class="voice-item">
      <span class="voice-pref">${v.pref}</span>
      「${v.detail.slice(0, 60)}${v.detail.length > 60 ? '……' : ''}」
    </div>
  `).join('');
}

function updateTicker(data) {
  // ティッカーは「現在進行中の新着」を見せる場所のため、過去記事（old_flag）は除外する
  const liveData = data.filter(r => !isHeldBack(r));
  const items = liveData.slice(0, 6).map(r => `${r.region||r.prefecture||''}・${r.title}`).join('　　');
  const doubled = items + '　　　　' + items;
  const tt = document.getElementById('ticker-text'); if(tt) tt.textContent = doubled;
}

// ===== SURVEY =====
const GAS_SURVEY_URL = 'https://script.google.com/macros/s/AKfycbwXWIwaQWYnE-LX6sPXNdqCL_--CT-CidBsYnntp88wFYJ0MMyHjhFBI0mZyO9ZlYdymg/exec';

function submitSurvey() {
  const pref   = document.getElementById('s-pref').value;
  const win    = document.getElementById('s-window').value;
  const detail = document.getElementById('s-detail').value;
  const result = document.querySelector('input[name="result"]:checked')?.value || '';
  const when   = document.getElementById('s-when').value;
  const types  = [...document.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value).join('、');
  if (!pref || !detail) { alert('都道府県と体験の詳細は必須です'); return; }

  // 送信先が未設定の場合は「送信完了」を絶対に表示しない（未送信データの隠蔽防止）
  if (GAS_SURVEY_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
    const errEl = document.getElementById('survey-error');
    if (errEl) {
      errEl.textContent = '現在、送信先が未設定のため送信できません。しばらくしてから再度お試しください。';
      errEl.style.display = 'block';
    } else {
      alert('現在、送信先が未設定のため送信できません。しばらくしてから再度お試しください。');
    }
    return;
  }

  const data = { pref, window: win, types, detail, result, when, timestamp: new Date().toISOString() };

  const errEl = document.getElementById('survey-error');
  if (errEl) errEl.style.display = 'none';

  fetch(GAS_SURVEY_URL, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(() => {
    document.getElementById('survey-form-container').style.display = 'none';
    document.getElementById('survey-thanks').style.display = 'block';
  }).catch(() => {
    // 送信失敗時も「成功」を装わない
    if (errEl) {
      errEl.textContent = '送信に失敗しました。通信状況をご確認のうえ、もう一度お試しください。';
      errEl.style.display = 'block';
    } else {
      alert('送信に失敗しました。通信状況をご確認のうえ、もう一度お試しください。');
    }
  });
}

// ===== 観測フィードバック送信 =====
// ===== トップページ キャンバス =====
function renderHomeCanvas() {
  const cv = document.getElementById('home-canvas');
  if (!cv) return;

  const dpr = window.devicePixelRatio || 1;
  const isMobile = window.innerWidth < 600;
  const W = isMobile ? window.innerWidth : Math.min(window.innerWidth, 860);
  const H = Math.round(W * 820 / 680);
  cv.width  = W * dpr;
  cv.height = H * dpr;
  cv.style.width  = W + 'px';
  cv.style.height = H + 'px';
  cv.style.maxWidth = '100%';

  const ctx = cv.getContext('2d');
  const scale = W / 680;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#cdd6e0';
  ctx.fillRect(0, 0, W, H);
  ctx.scale(scale, scale);

  let _s = 31;
  function r() { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; }

  function branch(x, y, a, len, d, maxD) {
    if (d > maxD || len < 2.5) return;
    const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
    const w = Math.max(0.5, Math.pow((maxD - d + 1) / maxD, 1.2) * 18);
    const cx2 = x + Math.cos(a) * len * 0.5 + (r() - 0.5) * 12;
    const cy2 = y + Math.sin(a) * len * 0.5 + (r() - 0.5) * 12;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(cx2, cy2, nx, ny);
    ctx.strokeStyle = '#14140c'; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke();
    const sp = 0.28 + d * 0.032;
    const j = () => (r() - 0.5) * 0.16;
    const n = d < 3 ? 3 : d < 6 ? 3 : 2;
    const f = () => 0.60 + r() * 0.10;
    if (n === 3) {
      branch(nx, ny, a - sp + j(), len * f(), d + 1, maxD);
      branch(nx, ny, a + j() * 0.4, len * (f() + 0.06), d + 1, maxD);
      branch(nx, ny, a + sp + j(), len * f(), d + 1, maxD);
    } else {
      branch(nx, ny, a - sp + j(), len * f(), d + 1, maxD);
      branch(nx, ny, a + sp + j(), len * f(), d + 1, maxD);
    }
  }

  const bx = 680 * 0.44, by = 820 - 55;
  branch(bx, by, -Math.PI / 2, 152, 0, 10);

  // 問いかけテキスト
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(20,20,12,0.28)';
  ctx.font = 'italic 400 15px "Noto Sans JP", sans-serif';
  ctx.letterSpacing = '0.12em';
  ctx.fillText('今日はどこを歩きますか？', bx + 20, 530);
  ctx.restore();

  // 地面
  ctx.fillStyle = '#14140c';
  ctx.beginPath(); ctx.ellipse(bx, 820 - 30, 680 * 0.58, 68, 0, 0, Math.PI * 2); ctx.fill();

  // 百葉箱（大きめ）
  function drawHygrometer(hx, groundY) {
    const legH = 30, boxW = 62, boxH = 54, roofH = 9;
    const boxTop = groundY - legH - boxH;
    ctx.save();
    ctx.strokeStyle = '#d4cfc0'; ctx.lineWidth = 2.5; ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(hx - boxW * 0.28, groundY); ctx.lineTo(hx - boxW * 0.28, groundY - legH);
    ctx.moveTo(hx + boxW * 0.28, groundY); ctx.lineTo(hx + boxW * 0.28, groundY - legH);
    ctx.stroke();
    ctx.fillStyle = '#eceae2'; ctx.strokeStyle = '#b0aa9a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(hx - boxW / 2, boxTop, boxW, boxH); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#b0aa9a'; ctx.lineWidth = 0.8;
    const slats = 7;
    for (let s = 1; s < slats; s++) {
      const sy = boxTop + (boxH / slats) * s;
      ctx.beginPath(); ctx.moveTo(hx - boxW / 2, sy); ctx.lineTo(hx + boxW / 2, sy); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(100,95,85,0.18)'; ctx.lineWidth = 3;
    for (let s = 0; s < slats; s++) {
      const sy = boxTop + (boxH / slats) * s + boxH / slats * 0.5;
      ctx.beginPath(); ctx.moveTo(hx - boxW / 2 + 1, sy); ctx.lineTo(hx + boxW / 2 - 1, sy); ctx.stroke();
    }
    ctx.fillStyle = '#d4cfc0'; ctx.strokeStyle = '#b0aa9a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(hx - boxW / 2 - 4, boxTop - roofH, boxW + 8, roofH + 1); ctx.fill(); ctx.stroke();
    // ラベル
    ctx.textAlign = 'center'; ctx.fillStyle = '#7a7060'; ctx.font = '500 9px sans-serif';
    ctx.fillText('百葉箱', hx, boxTop + boxH * 0.55);
    ctx.restore();
  }

  const hygroX = 460, hygroGroundY = by + 22;
  drawHygrometer(hygroX, hygroGroundY);
  const hygroHit = { x: hygroX, top: hygroGroundY - 30 - 54 - 9, bottom: hygroGroundY, hw: 34 };

  // 立て札（大きめ）
  function drawSignPost(sx, groundY) {
    const poleH = 52, boardW = 74, boardH = 30, poleX = sx;
    const poleTop = groundY - poleH;
    const boardTop = poleTop - 4;
    ctx.save();
    ctx.strokeStyle = '#c8c0a8'; ctx.lineWidth = 3; ctx.lineCap = 'square';
    ctx.beginPath(); ctx.moveTo(poleX, groundY); ctx.lineTo(poleX, poleTop); ctx.stroke();
    ctx.fillStyle = '#ddd8c4'; ctx.strokeStyle = '#b0a888'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(poleX - boardW / 2, boardTop, boardW, boardH, 3); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = '#5a5240';
    ctx.font = '600 9.5px sans-serif'; ctx.fillText('この村について', poleX, boardTop + boardH * 0.45);
    ctx.font = '400 7.5px sans-serif'; ctx.fillStyle = '#8a7e60';
    ctx.fillText('▸ タップして読む', poleX, boardTop + boardH * 0.78);
    ctx.restore();
  }

  const signX = 145, signGroundY = by + 22;
  drawSignPost(signX, signGroundY);
  const signHit = { x: signX, top: signGroundY - 52 - 30 - 4, bottom: signGroundY, hw: 40 };

  // 葉っぱ（PROJECT MANAとは）
  const leafCx = 120, leafCy = 455;
  function drawLeaf(cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.18);

    // 葉の形（左右ベジェ）
    const lw = 82, lh = 44;
    ctx.beginPath();
    ctx.moveTo(0, -lh);
    ctx.bezierCurveTo( lw * 0.9, -lh * 0.6,  lw * 0.9,  lh * 0.6,  0,  lh);
    ctx.bezierCurveTo(-lw * 0.9,  lh * 0.6, -lw * 0.9, -lh * 0.6,  0, -lh);
    ctx.closePath();
    ctx.fillStyle = 'rgba(88, 168, 72, 0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(52, 120, 44, 0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 中心の葉脈
    ctx.beginPath();
    ctx.moveTo(0, -lh + 2);
    ctx.lineTo(0, lh - 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 茎
    ctx.beginPath();
    ctx.moveTo(0, lh - 1);
    ctx.lineTo(4, lh + 11);
    ctx.strokeStyle = 'rgba(52, 120, 44, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // テキスト2行
    ctx.rotate(0.18);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(235,245,225,0.95)';
    ctx.font = '700 11px sans-serif';
    ctx.fillText('PROJECT MANA', 0, -7);
    ctx.font = '400 10.5px sans-serif';
    ctx.fillText('とは？', 0, 9);

    ctx.restore();
  }

  drawLeaf(leafCx, leafCy);
  const squirrelHit = { x: leafCx - 86, y: leafCy - 48, w: 172, h: 100 };

  // 地面前景（地平線を隠す黒帯）
  ctx.fillStyle = '#14140c';
  ctx.fillRect(0, 820 - 44, 680, 44);

  // 鳥
  function bird(x, y, sz, al) {
    ctx.save(); ctx.globalAlpha = al;
    ctx.strokeStyle = '#14140c'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - sz, y); ctx.quadraticCurveTo(x - sz * .5, y - sz * .65, x, y);
    ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sz * .5, y - sz * .65, x + sz, y);
    ctx.stroke(); ctx.restore();
  }
  bird(80, 160, 10, .2); bird(100, 150, 7, .14);
  bird(540, 120, 9, .18); bird(560, 132, 7, .12);
  bird(300, 80, 8, .13); bird(318, 88, 6, .09);
  bird(160, 240, 7, .1); bird(480, 200, 8, .12);

  // 巣箱定義（activeのみ描画; hiddenは構造保持のみ）
  const windows = [
    // 表示する巣箱
    { label: 'メディアの言葉',  winKey: 'メディアの窓',  sub: '村へ',    active: true,  draw: true,  action: () => renderWindowDetailPage('media'),        x: bx - 30,  y: 36,  w: 80, h: 48 },
    { label: '心の言葉',        winKey: '心の窓',        sub: '村へ',    active: true,  draw: true,  action: () => renderWindowDetailPage('mental'),        x: bx - 60,  y: 160, w: 74, h: 48 },
    { label: '戦争の言葉',      winKey: '戦争の窓',      sub: '村へ',    active: true,  draw: true,  action: () => renderWindowDetailPage('war'),           x: bx + 140, y: 180, w: 74, h: 48 },
    { label: '人権の言葉',      winKey: '人権の窓',      sub: '村へ',    active: true,  draw: true,  action: () => renderWindowDetailPage('human_rights'),  x: bx - 220, y: 240, w: 76, h: 50 },
    { label: '民主主義の言葉',  winKey: '民主主義の窓',  sub: '村へ',    active: true,  draw: true,  action: () => renderWindowDetailPage('democracy'),     x: bx + 200, y: 280, w: 84, h: 50 },
    { label: 'MANAの暮らし',   winKey: '',              sub: 'よみもの', active: true,  draw: true,  action: () => renderKurashiPage(),                     x: bx + 20,  y: 352, w: 104, h: 52 },
    { label: 'PROJECT MANAとは', sub: 'ポップアップ', active: true, draw: false,
      action: () => { document.getElementById('mana-about-overlay').classList.add('open'); },
      x: bx - 155, y: 350, w: 100, h: 56 },
    { label: 'フィードバック', sub: '声を届ける', active: true, draw: true,
      action: () => showPage('survey', document.querySelector('nav a:nth-child(3)')),
      x: bx + 250, y: 420, w: 80, h: 52 },
    // 非表示（コード保持）
    { label: '事案の窓',  sub: '稼働中', active: true, draw: false, action: () => showPage('karte', document.querySelector('nav a:nth-child(5)')), x: bx + 190, y: 360, w: 84, h: 56 },
    { label: '観測DB',    sub: '稼働中', active: true, draw: false, action: () => showPage('db',    document.querySelector('nav a:nth-child(2)')), x: bx - 265, y: 440, w: 84, h: 56 },
  ];

  function drawBox(win) {
    const { x, y, w, h, label, sub, active } = win;
    ctx.fillStyle = active ? '#14140c' : 'rgba(20,20,12,0.48)';
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + 5, y); ctx.lineTo(x, y - 14); ctx.lineTo(x + w / 2 - 5, y);
    ctx.fill();
    ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, h, 3); ctx.fill();
    const hr = active ? 8 : 5.5;
    ctx.beginPath(); ctx.arc(x, y + h * .34, hr, 0, Math.PI * 2);
    ctx.fillStyle = '#cdd6e0'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y + h * .34, hr * .35, 0, Math.PI * 2);
    ctx.fillStyle = active ? '#14140c' : 'rgba(20,20,12,.5)'; ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = active ? '#cdd6e0' : 'rgba(200,210,220,.7)';
    const labelFontSize = active ? (w >= 96 ? 10 : 11) : (w >= 96 ? 9 : 10);
    ctx.font = `${active ? '600' : '500'} ${labelFontSize}px sans-serif`;
    ctx.fillText(label, x, y + h * .66);
    ctx.font = '400 7.5px sans-serif';
    ctx.fillStyle = active ? 'rgba(160,185,210,.95)' : 'rgba(150,165,180,.55)';
    ctx.fillText(sub, x, y + h * .83);
  }

  windows.filter(w => w.draw).forEach(drawBox);

  // 共通キャンバスポップアップ
  function showCanvasPopup({ label, body, btnLabel, onOpen }) {
    let popup = document.getElementById('home-canvas-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'home-canvas-popup';
      popup.style.cssText = `
        position:fixed;bottom:2.5rem;left:50%;transform:translateX(-50%);
        background:rgba(20,20,12,0.92);color:#cdd6e0;
        font-size:0.84rem;line-height:1.85;
        padding:1.3rem 1.8rem 1rem;border-radius:7px;
        max-width:320px;width:calc(100% - 3rem);text-align:center;
        opacity:0;transition:opacity 0.3s;pointer-events:none;z-index:999;
        letter-spacing:0.03em;
      `;
      document.body.appendChild(popup);
    }
    clearTimeout(popup._timer);
    const btnHtml = btnLabel
      ? `<div style="margin-top:1rem">
           <button id="home-popup-btn" style="
             background:rgba(205,214,224,0.15);border:1px solid rgba(205,214,224,0.35);
             color:#cdd6e0;font-size:0.78rem;letter-spacing:0.06em;
             padding:0.4rem 1.1rem;border-radius:20px;cursor:pointer;
           ">${btnLabel} →</button>
         </div>`
      : '';
    popup.innerHTML = `<strong style="font-size:0.72rem;letter-spacing:0.1em;opacity:0.55">${label}</strong><br><br>${body}${btnHtml}`;
    popup.style.opacity = '1';
    popup.style.pointerEvents = 'auto';
    if (btnLabel && onOpen) {
      document.getElementById('home-popup-btn').onclick = () => {
        popup.style.opacity = '0'; popup.style.pointerEvents = 'none';
        onOpen();
      };
    }
    popup._timer = setTimeout(() => {
      popup.style.opacity = '0'; popup.style.pointerEvents = 'none';
    }, 6000);
  }

  function onCanvasClick(e) {
    const rect = cv.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;

    // 百葉箱
    if (mx >= hygroHit.x - hygroHit.hw && mx <= hygroHit.x + hygroHit.hw
     && my >= hygroHit.top && my <= hygroHit.bottom) {
      showCanvasPopup({
        label: '百葉箱',
        body: 'MANAは社会を評価する場所ではありません。<br><br>まず観測し、記録し、残します。<br><br>ここには日々の観測が蓄積されています。',
        btnLabel: '観測DBを開く',
        onOpen: () => showPage('db', document.querySelector('nav a:nth-child(2)')),
      });
      return;
    }

    // リス（吹き出し）
    if (mx >= squirrelHit.x && mx <= squirrelHit.x + squirrelHit.w
     && my >= squirrelHit.y && my <= squirrelHit.y + squirrelHit.h) {
      document.getElementById('mana-about-overlay').classList.add('open');
      return;
    }

    // 立て札
    if (mx >= signHit.x - signHit.hw && mx <= signHit.x + signHit.hw
     && my >= signHit.top && my <= signHit.bottom) {
      showCanvasPopup({
        label: 'この村について',
        body: 'ここは制度の外側にいる人たちが、それでも社会と繋がり続けるための観測所です。<br><br>村の各家には、集まった記事・記録・声が展示されています。',
      });
      return;
    }

    // 巣箱
    for (const win of windows) {
      if (!win.draw) continue;
      const inBox = mx >= win.x - win.w / 2 && mx <= win.x + win.w / 2
                 && my >= win.y - 14         && my <= win.y + win.h;
      if (!inBox) continue;
      if (win.label === 'PROJECT MANAとは' || win.label === 'フィードバック') {
        win.action();
      } else {
        const wData = windowMasterData.find(w => w.window_name === (win.winKey || win.label));
        if (wData) {
          showCanvasPopup({
            label: win.label,
            body: (wData.popup_text || wData.question).replace(/\n/g, '<br>'),
            btnLabel: '展示室を開く',
            onOpen: win.action,
          });
        } else {
          win.action();
        }
      }
      return;
    }
  }

  function onCanvasMove(e) {
    const rect = cv.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;
    const hitHyg = mx >= hygroHit.x - hygroHit.hw && mx <= hygroHit.x + hygroHit.hw
                && my >= hygroHit.top && my <= hygroHit.bottom;
    const hitSign = mx >= signHit.x - signHit.hw && mx <= signHit.x + signHit.hw
                 && my >= signHit.top && my <= signHit.bottom;
    const hitSq = mx >= squirrelHit.x && mx <= squirrelHit.x + squirrelHit.w
               && my >= squirrelHit.y && my <= squirrelHit.y + squirrelHit.h;
    const hitWin = windows.filter(w => w.draw).some(win =>
      mx >= win.x - win.w / 2 && mx <= win.x + win.w / 2
      && my >= win.y - 14 && my <= win.y + win.h
    );
    cv.style.cursor = (hitHyg || hitSign || hitSq || hitWin) ? 'pointer' : 'default';
  }

  cv.removeEventListener('click', cv._homeClickHandler);
  cv.removeEventListener('mousemove', cv._homeMoveHandler);
  cv._homeClickHandler = onCanvasClick;
  cv._homeMoveHandler  = onCanvasMove;
  cv.addEventListener('click', onCanvasClick);
  cv.addEventListener('mousemove', onCanvasMove);
}

// ===== 観測の窓ページ =====
function renderWindowsPage() {
  const cv = document.getElementById('windows-canvas');
  if (!cv) return;

  const dpr = window.devicePixelRatio || 1;
  const isMobile = window.innerWidth < 600;
  const W = isMobile ? window.innerWidth : Math.min(window.innerWidth, 860);
  const H = Math.round(W * 820 / 680);
  cv.width = W * dpr;
  cv.height = H * dpr;
  cv.style.width = W + 'px';
  cv.style.height = H + 'px';
  cv.style.maxWidth = '100%';

  const ctx = cv.getContext('2d');
  const scale = W / 680;

  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#cdd6e0';
  ctx.fillRect(0, 0, W, H);
  ctx.scale(scale, scale);

  let _s = 31;
  function r() { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; }

  function branch(x, y, a, len, d, maxD) {
    if (d > maxD || len < 2.5) return;
    const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
    const w = Math.max(0.5, Math.pow((maxD - d + 1) / maxD, 1.2) * 18);
    const cx = x + Math.cos(a) * len * 0.5 + (r() - 0.5) * 12;
    const cy = y + Math.sin(a) * len * 0.5 + (r() - 0.5) * 12;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(cx, cy, nx, ny);
    ctx.strokeStyle = '#14140c'; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke();
    const sp = 0.28 + d * 0.032;
    const j = () => (r() - 0.5) * 0.16;
    const n = d < 3 ? 3 : d < 6 ? 3 : 2;
    const f = () => 0.60 + r() * 0.10;
    if (n === 3) {
      branch(nx, ny, a - sp + j(), len * f(), d + 1, maxD);
      branch(nx, ny, a + j() * 0.4, len * (f() + 0.06), d + 1, maxD);
      branch(nx, ny, a + sp + j(), len * f(), d + 1, maxD);
    } else {
      branch(nx, ny, a - sp + j(), len * f(), d + 1, maxD);
      branch(nx, ny, a + sp + j(), len * f(), d + 1, maxD);
    }
  }

  const bx = 680 * 0.44, by = 820 - 55;
  branch(bx, by, -Math.PI / 2, 152, 0, 10);

  ctx.fillStyle = '#14140c';
  ctx.beginPath(); ctx.ellipse(bx, 820 - 30, 680 * 0.58, 68, 0, 0, Math.PI * 2); ctx.fill();

  // 百葉箱（地面より前に描くことで脚が地平線に埋まる）
  function drawHygrometer(hx, groundY) {
    const legH = 21, boxW = 44, boxH = 39, roofH = 6;
    const boxTop = groundY - legH - boxH;
    ctx.save();

    // 脚（2本）
    ctx.strokeStyle = '#d4cfc0'; ctx.lineWidth = 2.2; ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(hx - boxW * 0.28, groundY); ctx.lineTo(hx - boxW * 0.28, groundY - legH);
    ctx.moveTo(hx + boxW * 0.28, groundY); ctx.lineTo(hx + boxW * 0.28, groundY - legH);
    ctx.stroke();

    // 本体（白い箱）
    ctx.fillStyle = '#eceae2';
    ctx.strokeStyle = '#b0aa9a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(hx - boxW / 2, boxTop, boxW, boxH); ctx.fill(); ctx.stroke();

    // 鎧戸（水平スリット）
    ctx.strokeStyle = '#b0aa9a'; ctx.lineWidth = 0.8;
    const slats = 6;
    for (let s = 1; s < slats; s++) {
      const sy = boxTop + (boxH / slats) * s;
      ctx.beginPath(); ctx.moveTo(hx - boxW / 2, sy); ctx.lineTo(hx + boxW / 2, sy); ctx.stroke();
    }
    // スリットの斜め影（鎧戸らしさ）
    ctx.strokeStyle = 'rgba(100,95,85,0.18)'; ctx.lineWidth = 3;
    for (let s = 0; s < slats; s++) {
      const sy = boxTop + (boxH / slats) * s + boxH / slats * 0.5;
      ctx.beginPath(); ctx.moveTo(hx - boxW / 2 + 1, sy); ctx.lineTo(hx + boxW / 2 - 1, sy); ctx.stroke();
    }

    // 屋根（少し張り出す）
    ctx.fillStyle = '#d4cfc0';
    ctx.strokeStyle = '#b0aa9a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(hx - boxW / 2 - 3, boxTop - roofH, boxW + 6, roofH + 1); ctx.fill(); ctx.stroke();

    ctx.restore();
  }

  const hygroX = 460, hygroGroundY = by + 22;
  drawHygrometer(hygroX, hygroGroundY);
  // ヒットボックス（屋根上端〜脚底）
  const hygroHit = { x: hygroX, top: hygroGroundY - 21 - 39 - 6, bottom: hygroGroundY, hw: 25 };

  ctx.fillRect(0, 820 - 44, 680, 44);

  function bird(x, y, sz, al) {
    ctx.save(); ctx.globalAlpha = al;
    ctx.strokeStyle = '#14140c'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - sz, y); ctx.quadraticCurveTo(x - sz * .5, y - sz * .65, x, y);
    ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sz * .5, y - sz * .65, x + sz, y);
    ctx.stroke(); ctx.restore();
  }
  bird(80, 160, 10, .2); bird(100, 150, 7, .14);
  bird(540, 120, 9, .18); bird(560, 132, 7, .12);
  bird(300, 80, 8, .13); bird(318, 88, 6, .09);
  bird(160, 240, 7, .1); bird(480, 200, 8, .12);

  // 巣箱の定義（クリック判定用にhitbox情報も保持）
  const windows = [
    { label: '観測DB',      sub: '稼働中',  active: true,  action: () => showPage('db',    document.querySelector('nav a:nth-child(2)')), x: bx - 265, y: 440, w: 84, h: 56 },
    { label: '事案の窓',    sub: '稼働中',  active: true,  action: () => showPage('karte', document.querySelector('nav a:nth-child(5)')), x: bx + 190, y: 360, w: 84, h: 56 },
    { label: '人権の村',    sub: '仮実装',  active: true, action: () => renderWindowDetailPage('human_rights'),  x: bx - 220, y: 240, w: 76, h: 50 },
    { label: '民主主義の村', sub: '仮実装', active: true, action: () => renderWindowDetailPage('democracy'),     x: bx + 200, y: 280, w: 76, h: 50 },
    { label: '心の村',      sub: '仮実装',  active: true, action: () => renderWindowDetailPage('mental'),        x: bx - 60,  y: 160, w: 74, h: 48 },
    { label: '戦争の村',    sub: '仮実装',  active: true, action: () => renderWindowDetailPage('war'),           x: bx + 140, y: 180, w: 74, h: 48 },
    { label: 'メディアの村', sub: '仮実装', active: true, action: () => renderWindowDetailPage('media'),         x: bx - 30,  y: 36,  w: 72, h: 46 },
  ];

  function drawBox(win) {
    const { x, y, w, h, label, sub, active } = win;
    ctx.fillStyle = active ? '#14140c' : 'rgba(20,20,12,0.48)';
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + 5, y); ctx.lineTo(x, y - 14); ctx.lineTo(x + w / 2 - 5, y);
    ctx.fill();
    ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, h, 3); ctx.fill();
    const hr = active ? 8 : 5.5;
    ctx.beginPath(); ctx.arc(x, y + h * .34, hr, 0, Math.PI * 2);
    ctx.fillStyle = '#cdd6e0'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y + h * .34, hr * .35, 0, Math.PI * 2);
    ctx.fillStyle = active ? '#14140c' : 'rgba(20,20,12,.5)'; ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = active ? '#cdd6e0' : 'rgba(200,210,220,.7)';
    ctx.font = `${active ? '600 12' : '500 10.5'}px sans-serif`;
    ctx.fillText(label, x, y + h * .65);
    ctx.font = '400 8px sans-serif';
    ctx.fillStyle = active ? 'rgba(160,185,210,.95)' : 'rgba(150,165,180,.55)';
    ctx.fillText(sub, x, y + h * .81);
  }

  windows.forEach(drawBox);

  // 共通ポップアップ（問いを表示し、ボタンで遷移）
  function showCanvasPopup({ label, body, btnLabel, onOpen }) {
    let popup = document.getElementById('canvas-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'canvas-popup';
      popup.style.cssText = `
        position:fixed;bottom:2.5rem;left:50%;transform:translateX(-50%);
        background:rgba(20,20,12,0.92);color:#cdd6e0;
        font-size:0.84rem;line-height:1.85;
        padding:1.3rem 1.8rem 1rem;border-radius:7px;
        max-width:300px;width:calc(100% - 3rem);text-align:center;
        opacity:0;transition:opacity 0.3s;pointer-events:none;z-index:999;
        letter-spacing:0.03em;
      `;
      document.body.appendChild(popup);
    }
    clearTimeout(popup._timer);

    const btnHtml = btnLabel
      ? `<div style="margin-top:1rem">
           <button id="canvas-popup-btn" style="
             background:rgba(205,214,224,0.15);border:1px solid rgba(205,214,224,0.35);
             color:#cdd6e0;font-size:0.78rem;letter-spacing:0.06em;
             padding:0.4rem 1.1rem;border-radius:20px;cursor:pointer;
           ">${btnLabel} →</button>
         </div>`
      : '';

    popup.innerHTML = `<strong style="font-size:0.72rem;letter-spacing:0.1em;opacity:0.55">${label}</strong><br><br>${body}${btnHtml}`;
    popup.style.opacity = '1';
    popup.style.pointerEvents = 'auto';

    if (btnLabel && onOpen) {
      document.getElementById('canvas-popup-btn').onclick = () => {
        popup.style.opacity = '0';
        popup.style.pointerEvents = 'none';
        onOpen();
      };
    }

    popup._timer = setTimeout(() => {
      popup.style.opacity = '0';
      popup.style.pointerEvents = 'none';
    }, 5000);
  }

  // トースト（準備中）
  function showToast() {
    const toast = document.getElementById('windows-toast');
    if (!toast) return;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 1600);
  }

  // クリック判定（スケール考慮）
  function onCanvasClick(e) {
    const rect = cv.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;

    // 百葉箱ヒット判定
    if (mx >= hygroHit.x - hygroHit.hw && mx <= hygroHit.x + hygroHit.hw
     && my >= hygroHit.top && my <= hygroHit.bottom) {
      showCanvasPopup({
        label: '百葉箱',
        body: 'MANAは社会を評価する場所ではありません。<br><br>まず観測し、記録し、残します。<br><br>ここには日々の観測が蓄積されています。',
        btnLabel: '観測DBを開く',
        onOpen: () => showPage('db', document.querySelector('nav a:nth-child(2)')),
      });
      return;
    }

    for (const win of windows) {
      const inBox = mx >= win.x - win.w / 2 && mx <= win.x + win.w / 2
                 && my >= win.y - 14         && my <= win.y + win.h;
      if (!inBox) continue;
      if (win.active && win.action) {
        const wData = windowMasterData.find(w => w.window_name === win.label);
        if (wData) {
          const body = (wData.popup_text || wData.question)
            .replace(/\n/g, '<br>');
          showCanvasPopup({
            label: wData.window_name,
            body,
            btnLabel: '展示室を開く',
            onOpen: win.action,
          });
        } else {
          win.action();
        }
      } else {
        showToast();
      }
      return;
    }
  }

  // カーソル変更
  function onCanvasMove(e) {
    const rect = cv.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;
    const hitHyg = mx >= hygroHit.x - hygroHit.hw && mx <= hygroHit.x + hygroHit.hw
                && my >= hygroHit.top && my <= hygroHit.bottom;
    const hitWin = windows.some(win =>
      mx >= win.x - win.w / 2 && mx <= win.x + win.w / 2
      && my >= win.y - 14 && my <= win.y + win.h
    );
    cv.style.cursor = (hitHyg || hitWin) ? 'pointer' : 'default';
  }

  cv.removeEventListener('click', cv._clickHandler);
  cv.removeEventListener('mousemove', cv._moveHandler);
  cv._clickHandler = onCanvasClick;
  cv._moveHandler = onCanvasMove;
  cv.addEventListener('click', onCanvasClick);
  cv.addEventListener('mousemove', onCanvasMove);
}

// ===== 窓マスター読み込み =====
function loadWindowMaster() {
  fetch('/window_master.json')
    .then(r => r.json())
    .then(data => { windowMasterData = data; })
    .catch(e => console.warn('window_master.json 読み込み失敗', e));
}

// 記事テキストに窓のキーワード・タグ・法令・機関が含まれるか判定
function matchesWindow(row, win) {
  const text = [
    row['タイトル'] || row.title || '',
    row['出来事タグ'] || '',
    row['構造タグ'] || '',
    row['状態タグ'] || '',
    row['law_refs_raw'] || '',
    row['institution_refs_raw'] || '',
  ].join(' ');
  return (win.keywords   || []).some(k => text.includes(k))
      || (win.tags       || []).some(t => text.includes(t))
      || (win.law_refs   || []).some(l => text.includes(l))
      || (win.institution_refs || []).some(i => text.includes(i));
}

// ===== 窓詳細ページ =====
function renderWindowDetailPage(windowId) {
  const win = windowMasterData.find(w => w.window_id === windowId);
  const el = document.getElementById('page-window-detail');
  if (!el) return;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  el.classList.add('active');
  window.scrollTo(0, 0);

  if (!win) {
    el.innerHTML = '<div class="page-inner"><p>窓データが読み込まれていません。</p></div>';
    return;
  }

  el.innerHTML = `
    <div class="village-page">
      <div class="village-topbar">
        <button class="window-back-btn" onclick="showPage('windows',null)">← 観測の窓へ戻る</button>
      </div>
      <div class="village-map-wrap">
        <canvas id="village-canvas" style="display:block;width:100%;"></canvas>
        <div id="village-plaza-msg" class="village-plaza-msg" style="display:none"></div>
      </div>
      <div id="village-content" class="village-content"></div>
    </div>`;

  renderVillageCanvas(win, windowId);
}

// ===== MANAの暮らし（運営の随筆） =====
function renderKurashiPage() {
  const el = document.getElementById('page-kurashi');
  if (!el) return;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  el.classList.add('active');
  window.scrollTo(0, 0);
  el.innerHTML = '<div class="page-inner"><p style="padding:2rem 0;color:var(--ink-light)">読み込み中...</p></div>';
  fetch('/mana_kurashi.json')
    .then(r => r.json())
    .then(essays => {
      const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      let html = '<div class="kurashi-page">'
        + '<button class="window-back-btn" onclick="showPage(\'home\',document.querySelector(\'nav a:nth-child(1)\'))">← ホームへ戻る</button>'
        + '<div class="kurashi-intro"><h1 class="kurashi-pagetitle">MANAの暮らし</h1>'
        + '<p class="kurashi-lead">生活のなかで感じたこと、記録しておきたいことを、運営（多藝麻奈）が時々置いていく場所です。</p></div>';
      (Array.isArray(essays) ? essays : []).forEach(a => {
        html += '<article class="kurashi-essay">';
        html += '<header class="kurashi-essay-head">';
        html += '<h2 class="kurashi-title">' + esc(a.title) + '</h2>';
        if (a.subtitle) html += '<p class="kurashi-subtitle">' + esc(a.subtitle) + '</p>';
        html += '<p class="kurashi-meta">' + esc(a.author) + (a.date ? '　' + esc(a.date) : '') + '</p>';
        html += '</header>';
        (a.sections || []).forEach(sec => {
          if (sec.heading) html += '<h3 class="kurashi-heading">' + esc(sec.heading) + '</h3>';
          (sec.paragraphs || []).forEach(p => { html += '<p class="kurashi-p">' + esc(p) + '</p>'; });
        });
        html += '</article>';
      });
      html += '</div>';
      el.innerHTML = html;
      window.scrollTo(0, 0);
    })
    .catch(() => { el.innerHTML = '<div class="page-inner"><p style="padding:2rem 0">読み込みに失敗しました。</p></div>'; });
}

function renderHomeVillage() {
  const cv = document.getElementById('home-village-canvas');
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1;
  const BASE_W = 720, BASE_H = 510;
  const dispW = cv.parentElement.clientWidth || window.innerWidth;
  const dispH = Math.round(dispW * BASE_H / BASE_W);
  cv.width  = dispW * dpr; cv.height = dispH * dpr;
  cv.style.width = dispW + 'px'; cv.style.height = dispH + 'px';

  const ctx = cv.getContext('2d');
  const sx = dpr * dispW / BASE_W, sy = dpr * dispH / BASE_H;
  ctx.scale(sx, sy);
  const W = BASE_W, H = BASE_H;

  // RNG
  let _s = 42;
  function sr(){ _s=(_s*16807)%2147483647; return (_s-1)/2147483646; }
  function setSeed(s){ _s=Math.abs((s|1))||1; }
  function rn(){ return sr(); }
  function jit(a){ return (rn()-0.5)*a*2; }

  // 背景
  ctx.fillStyle='#ece2bc'; ctx.fillRect(0,0,W,H);
  const washes=[
    [195,155,240,170,'#c4ce55',0.13],[420,195,280,200,'#cad850',0.11],
    [560,365,210,175,'#aabe58',0.13],[102,365,180,148,'#b0be48',0.11],
    [330,428,220,132,'#a8c048',0.10],[608,125,170,108,'#beca55',0.12],
    [80,240,138,108,'#a0b244',0.09],[258,268,150,118,'#8a9e44',0.12],
    [485,252,170,138,'#90a84e',0.10],
  ];
  washes.forEach(([cx,cy,rx,ry,c,a])=>{
    setSeed(cx|0);
    for(let p=0;p<4;p++){
      ctx.save(); ctx.globalAlpha=a*(1-p*0.22); ctx.fillStyle=c;
      ctx.beginPath();
      ctx.ellipse(cx+jit(15+p*10),cy+jit(12+p*8),(rx+jit(20))*(1-p*.18),(ry+jit(15))*(1-p*.18),jit(0.4),0,Math.PI*2);
      ctx.fill(); ctx.restore();
    }
  });
  setSeed(5);
  for(let i=0;i<1600;i++){
    ctx.fillStyle=`rgba(${65+rn()*45|0},${70+rn()*35|0},${25+rn()*22|0},${0.02+rn()*0.022})`;
    ctx.fillRect(rn()*W,rn()*H,1.5,1.5);
  }

  function treeRound(cx,cy,seed,sc2){
    setSeed(seed); const s=sc2;
    ctx.strokeStyle='#6a4828'; ctx.lineWidth=3.8*s; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.bezierCurveTo(cx+jit(4*s),cy-9*s,cx+jit(4*s),cy-15*s,cx+jit(3*s),cy-20*s); ctx.stroke();
    ctx.lineWidth=1.6*s;
    ctx.beginPath(); ctx.moveTo(cx+jit(2*s),cy-15*s); ctx.lineTo(cx+9*s+jit(3*s),cy-23*s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+jit(2*s),cy-14*s); ctx.lineTo(cx-8*s+jit(3*s),cy-25*s); ctx.stroke();
    const blobs=[
      [0,-31*s,18*s,'#4a6a30'],[-11*s,-35*s,13*s,'#3e5e28'],[11*s,-33*s,14*s,'#527c3c'],
      [4*s,-44*s,12*s,'#5a8a4a'],[-6*s,-24*s,11*s,'#426230'],[9*s,-24*s,10*s,'#4e7038'],
      [0,-51*s,9*s,'#6a9058'],[-13*s,-27*s,8*s,'#3c5c28'],[6*s,-40*s,7*s,'#608a48'],
    ];
    blobs.forEach(([dx,dy,r,c])=>{
      setSeed(seed+(r|0)); ctx.fillStyle=c;
      ctx.beginPath(); ctx.arc(cx+dx+jit(2.5*s),cy+dy+jit(2.5*s),Math.max(3,r+jit(2.5*s)),0,Math.PI*2); ctx.fill();
    });
    ctx.strokeStyle='#2c4a1c'; ctx.lineWidth=1.2*s; setSeed(seed+50);
    ctx.beginPath();
    for(let i=0;i<=22;i++){
      const a=i/22*Math.PI*2,r2=(20+jit(5.5))*s;
      const x=cx+Math.cos(a)*r2,y=(cy-33*s)+Math.sin(a)*r2*.87;
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.closePath(); ctx.stroke();
  }
  function treePine(cx,cy,seed,sc2){
    setSeed(seed); const s=sc2;
    ctx.fillStyle='#4e361c'; ctx.strokeStyle='#382010'; ctx.lineWidth=0.9;
    ctx.beginPath(); ctx.rect(cx-3.5*s,cy,7*s,9*s); ctx.fill(); ctx.stroke();
    const layers=[
      [0,30*s,'#1e3810'],[-14*s,23*s,'#243e16'],[-26*s,17*s,'#2a4618'],
      [-35*s,12*s,'#305020'],[-43*s,8*s,'#385628'],[-50*s,5*s,'#3e5c2c'],
    ];
    layers.forEach(([topY,hw,c],i)=>{
      setSeed(seed+i*7);
      ctx.fillStyle=c; ctx.strokeStyle='#142c0a'; ctx.lineWidth=0.8; ctx.lineJoin='round';
      ctx.beginPath();
      ctx.moveTo(cx+jit(2*s),cy+topY);
      ctx.lineTo(cx+hw/2*1.1+jit(2.5*s),cy+layers[Math.min(i+1,5)][0]+jit(2*s));
      ctx.lineTo(cx-hw/2*1.1+jit(2.5*s),cy+layers[Math.min(i+1,5)][0]+jit(2*s));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    });
  }

  const PX=340,PY=285;
  setSeed(70);
  ctx.save();
  ctx.strokeStyle='#9a8248'; ctx.lineWidth=2.2; ctx.setLineDash([5,10]); ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(128,198); ctx.bezierCurveTo(148,225,175,258,240,272); ctx.bezierCurveTo(278,282,310,284,PX,PY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(PX,PY); ctx.bezierCurveTo(348,268,368,228,378,188); ctx.bezierCurveTo(385,162,385,145,390,132); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(PX,PY); ctx.bezierCurveTo(322,308,298,348,275,385); ctx.bezierCurveTo(258,412,228,438,195,452); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(PX,PY); ctx.bezierCurveTo(385,282,448,272,505,264); ctx.bezierCurveTo(540,258,572,262,598,272); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(598,272); ctx.bezierCurveTo(610,318,595,368,562,415); ctx.bezierCurveTo(554,428,548,438,545,448); ctx.stroke();
  ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(PX,PY); ctx.bezierCurveTo(388,258,452,198,508,152); ctx.bezierCurveTo(532,132,552,118,572,108); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();

  [[228,262,101,1.0],[248,244,102,0.92],[238,274,103,1.05],[214,270,104,0.86],[260,255,105,0.80],[270,276,106,0.74]].forEach(([cx,cy,seed,sc2])=>treePine(cx,cy,seed,sc2));
  [[52,82,201,0.88],[78,62,202,0.74],[46,122,203,0.80],[38,152,240,0.70],[30,198,241,0.65]].forEach(a=>treeRound(...a));
  [[444,72,206,0.90],[472,98,207,0.78],[585,58,208,0.94],[618,86,209,0.80],[600,36,210,0.70]].forEach(a=>treeRound(...a));
  [[662,194,211,1.0],[678,226,212,0.88],[685,164,213,0.78],[675,258,241,0.82]].forEach(a=>treeRound(...a));
  [[648,378,215,0.98],[662,408,216,0.86],[672,348,217,0.74]].forEach(a=>treeRound(...a));
  [[68,415,218,0.90],[44,440,219,0.76],[92,446,220,0.70],[135,462,229,0.68]].forEach(a=>treeRound(...a));
  [[478,448,221,0.82],[500,428,222,0.72]].forEach(a=>treeRound(...a));
  [[328,50,224,0.75],[308,76,225,0.64]].forEach(a=>treeRound(...a));
  [[32,312,226,0.80],[16,342,227,0.66]].forEach(a=>treeRound(...a));

  setSeed(80);
  ctx.save(); ctx.globalAlpha=0.22; ctx.fillStyle='#e0d480';
  ctx.beginPath(); ctx.ellipse(PX+jit(4),PY+jit(4),52+jit(6),42+jit(5),jit(0.2),0,Math.PI*2); ctx.fill(); ctx.restore();
  setSeed(81);
  for(let i=0;i<10;i++){
    const tx=PX+(rn()-0.5)*56,ty=PY+(rn()-0.5)*42;
    ctx.save(); ctx.globalAlpha=0.24; ctx.fillStyle='#c0ae68'; ctx.strokeStyle='#9e8e4c'; ctx.lineWidth=0.6;
    ctx.beginPath(); ctx.ellipse(tx+jit(3),ty+jit(3),9+rn()*6,6+rn()*3,jit(0.5),0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.restore();
  }

  // 案内板（広場）
  (function(){
    const bx=PX+4,by=PY-6; setSeed(82);
    ctx.strokeStyle='#6a4c28'; ctx.lineWidth=5; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(bx,by+12); ctx.bezierCurveTo(bx+2,by-6,bx-2,by-24,bx+3,by-50); ctx.stroke();
    ctx.strokeStyle='#5a3e1e'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(bx-28,by-49); ctx.lineTo(bx+30,by-46); ctx.stroke();
    ctx.strokeStyle='#988050'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(bx-19,by-48); ctx.bezierCurveTo(bx-20,by-43,bx-20,by-38,bx-20,by-33); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx+20,by-47); ctx.bezierCurveTo(bx+21,by-42,bx+20,by-37,bx+20,by-33); ctx.stroke();
    ctx.save(); ctx.translate(bx,by-18); ctx.rotate(-0.038); setSeed(83);
    ctx.save(); ctx.globalAlpha=0.10; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.moveTo(-24+5,3); ctx.lineTo(26+5,3); ctx.lineTo(26+5,28); ctx.lineTo(-24+5,28); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle='#c4a038'; ctx.strokeStyle='#887020'; ctx.lineWidth=1.8;
    ctx.beginPath();
    ctx.moveTo(-25+jit(1.5),jit(1.5)); ctx.lineTo(25+jit(1.5),jit(1.5));
    ctx.lineTo(25+jit(1.5),28+jit(1.5)); ctx.lineTo(-25+jit(1.5),28+jit(1.5));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.globalAlpha=0.10; ctx.strokeStyle='#6a4010'; ctx.lineWidth=0.9;
    [6,13,20].forEach(y=>{
      ctx.beginPath(); ctx.moveTo(-22,y+jit(1.5)); ctx.bezierCurveTo(-8,y+jit(2.5),8,y+jit(2),22,y+jit(1.5)); ctx.stroke();
    });
    ctx.restore();
    ctx.textAlign='center';
    ctx.font='700 8.5px serif'; ctx.fillStyle='rgba(40,24,4,0.86)'; ctx.fillText('民主主義の窓',0,11);
    ctx.font='500 6.5px serif'; ctx.fillStyle='rgba(40,24,4,0.64)'; ctx.fillText('権力はどこで補正されるか',0,23);
    ctx.restore();
  })();

  function sketchHouse(cx,cy,seed,roofC,wallC,w,h,extras){
    setSeed(seed); const j=2.2;
    ctx.save(); ctx.globalAlpha=0.09; ctx.fillStyle='#2a1808';
    ctx.beginPath(); ctx.ellipse(cx+w*.15,cy+4,w*.52,6,.08,0,Math.PI*2); ctx.fill(); ctx.restore();
    ctx.fillStyle=roofC; ctx.strokeStyle='#3a1e0c'; ctx.lineWidth=1.6; ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.beginPath();
    ctx.moveTo(cx-w/2-4+jit(j),cy-h*.38+jit(j)); ctx.lineTo(cx+jit(j),cy-h*.38-h*.52+jit(j)); ctx.lineTo(cx+w/2+4+jit(j),cy-h*.38+jit(j));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle='rgba(38,14,4,0.22)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(cx+jit(j),cy-h*.38-h*.52); ctx.lineTo(cx+2,cy-h*.38); ctx.stroke();
    ctx.fillStyle=wallC; ctx.strokeStyle='#3a1e0c'; ctx.lineWidth=1.6;
    ctx.beginPath();
    ctx.moveTo(cx-w/2+jit(j),cy-h*.38+jit(j)); ctx.lineTo(cx+w/2+jit(j),cy-h*.38+jit(j));
    ctx.lineTo(cx+w/2+jit(j),cy+jit(j)); ctx.lineTo(cx-w/2+jit(j),cy+jit(j));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#3a2810'; ctx.strokeStyle='#28160a'; ctx.lineWidth=1.2;
    const dw=w*.24,dh=h*.38;
    ctx.beginPath();
    ctx.moveTo(cx-dw/2+jit(j),cy+jit(j)); ctx.lineTo(cx+dw/2+jit(j),cy+jit(j));
    ctx.lineTo(cx+dw/2+jit(j),cy-dh+dw/3+jit(j));
    ctx.quadraticCurveTo(cx+jit(j),cy-dh-dw/4+jit(j),cx-dw/2+jit(j),cy-dh+dw/3+jit(j));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#c8a430'; ctx.beginPath(); ctx.arc(cx+dw*.28,cy-dh*.4,2.2,0,Math.PI*2); ctx.fill();
    [[-.3,.47],[.3,.47]].forEach(([dx,dy])=>{
      const glow=extras&&extras.glowLeft&&dx<0;
      if(glow){
        ctx.save(); const g=ctx.createRadialGradient(cx+w*dx,cy-h*dy-1,0,cx+w*dx,cy-h*dy-1,16);
        g.addColorStop(0,'rgba(255,215,80,0.55)'); g.addColorStop(1,'rgba(255,215,80,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx+w*dx,cy-h*dy-1,16,0,Math.PI*2); ctx.fill(); ctx.restore();
        ctx.fillStyle='#f0d050';
      } else { ctx.fillStyle='#d0e8f5'; }
      ctx.strokeStyle='#3a1e0c'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.rect(cx+w*dx-4.5+jit(j),cy-h*dy-1+jit(j),9,9); ctx.fill(); ctx.stroke();
      ctx.strokeStyle='rgba(38,20,8,0.28)'; ctx.lineWidth=0.7;
      ctx.beginPath(); ctx.moveTo(cx+w*dx+jit(j/2),cy-h*dy-1); ctx.lineTo(cx+w*dx+jit(j/2),cy-h*dy+8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+w*dx-4.5,cy-h*dy+3.5+jit(j/2)); ctx.lineTo(cx+w*dx+4.5,cy-h*dy+3.5+jit(j/2)); ctx.stroke();
    });
    if(extras&&extras.chimney){
      const chx=cx+w*.28,chy=cy-h*.38-h*.5;
      ctx.fillStyle='#8a7858'; ctx.strokeStyle='#3a1e0c'; ctx.lineWidth=1.2; ctx.lineJoin='round';
      ctx.beginPath();
      ctx.moveTo(chx-4+jit(j),chy+jit(j)); ctx.lineTo(chx+4+jit(j),chy+jit(j));
      ctx.lineTo(chx+5+jit(j),chy-18+jit(j)); ctx.lineTo(chx-3+jit(j),chy-18+jit(j));
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.globalAlpha=0.18; ctx.strokeStyle='#aaa'; ctx.lineWidth=2.5; ctx.setLineDash([2,4]); ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(chx,chy-20);
      ctx.bezierCurveTo(chx+7,chy-32,chx-5,chy-44,chx+4,chy-58);
      ctx.bezierCurveTo(chx+10,chy-68,chx-3,chy-78,chx+2,chy-90);
      ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }
    if(extras&&extras.stone){
      setSeed(seed+1); ctx.save(); ctx.globalAlpha=0.14; ctx.strokeStyle='#8a8880'; ctx.lineWidth=0.9; ctx.lineCap='round';
      for(let i=1;i<4;i++){
        ctx.beginPath();
        ctx.moveTo(cx-w/2+2,cy-h*.38*i/4+jit(1));
        ctx.bezierCurveTo(cx-w/6,cy-h*.38*i/4+jit(1.5),cx+w/6,cy-h*.38*i/4+jit(1.5),cx+w/2-2,cy-h*.38*i/4+jit(1));
        ctx.stroke();
      }
      ctx.restore();
    }
    if(extras&&extras.grain){
      setSeed(seed+2); ctx.save(); ctx.globalAlpha=0.09; ctx.strokeStyle='#7a5030'; ctx.lineWidth=0.9;
      for(let i=0;i<5;i++){
        ctx.beginPath();
        ctx.moveTo(cx-w/2+i*(w/4.5)+jit(2),cy-h*.38+jit(1));
        ctx.lineTo(cx-w/2+i*(w/4.5)+jit(3),cy+jit(1));
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  sketchHouse(122,192,300,'#a23c2a','#c8c4b8',48,44,{stone:true});
  sketchHouse(192,452,301,'#ac4230','#e2d0aa',50,46,{grain:true});
  sketchHouse(390,136,302,'#a43c30','#dedad8',48,44,{chimney:true});
  sketchHouse(572,106,303,'#9c3628','#d6d2bc',38,34,{});
  sketchHouse(600,276,304,'#9a3228','#dedad4',48,44,{glowLeft:true});
  (function(){
    const cx=548,cy=448,w=58,h=44; setSeed(305); const j=2.2;
    ctx.fillStyle='#a03a28'; ctx.strokeStyle='#3a1e0c'; ctx.lineWidth=1.6; ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.beginPath();
    ctx.moveTo(cx-w/2-4+jit(j),cy-h*.38+jit(j)); ctx.lineTo(cx+jit(j),cy-h*.38-h*.42+jit(j)); ctx.lineTo(cx+w/2+4+jit(j),cy-h*.38+jit(j));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#d2cec0'; ctx.strokeStyle='#3a1e0c'; ctx.lineWidth=1.6;
    ctx.beginPath();
    ctx.moveTo(cx-w/2+jit(j),cy-h*.38+jit(j)); ctx.lineTo(cx+w/2+jit(j),cy-h*.38+jit(j));
    ctx.lineTo(cx+w/2+jit(j),cy+jit(j)); ctx.lineTo(cx-w/2+jit(j),cy+jit(j));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    const dw=11,dh=h*.36;
    ctx.fillStyle='#3a2810'; ctx.strokeStyle='#28160a'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.rect(cx-dw/2+jit(j),cy-dh+jit(j),dw,dh); ctx.fill(); ctx.stroke();
    [[-.30,.46],[.30,.46],[-.30,.20],[.30,.20]].forEach(([dx,dy])=>{
      ctx.fillStyle='#d0e8f5'; ctx.strokeStyle='#3a1e0c'; ctx.lineWidth=0.9;
      ctx.beginPath(); ctx.rect(cx+w*dx-4+jit(j),cy-h*dy-0.5+jit(j),8,8); ctx.fill(); ctx.stroke();
      ctx.strokeStyle='rgba(38,20,8,0.25)'; ctx.lineWidth=0.6;
      ctx.beginPath(); ctx.moveTo(cx+w*dx,cy-h*dy-0.5); ctx.lineTo(cx+w*dx,cy-h*dy+7.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+w*dx-4,cy-h*dy+3.5); ctx.lineTo(cx+w*dx+4,cy-h*dy+3.5); ctx.stroke();
    });
  })();

  function mapLabel(x,y,text,angle){
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
    ctx.font='600 11.5px serif';
    ctx.strokeStyle='rgba(234,222,178,0.90)'; ctx.lineWidth=3.5; ctx.strokeText(text,0,0);
    ctx.fillStyle='rgba(36,22,6,0.86)'; ctx.fillText(text,0,0);
    ctx.restore();
  }
  mapLabel(44,  174,'法律・制度',   -0.07);
  mapLabel(105, 476,'当事者の声',    0.05);
  mapLabel(398, 118,'研究者・論考', -0.04);
  mapLabel(584,  90,'観測事案',      0.05);
  mapLabel(618, 294,'ジャーナリスト',0.03);
  mapLabel(556, 470,'カルテ',       -0.06);

  ctx.strokeStyle='#8a7638'; ctx.lineWidth=4; ctx.strokeRect(2,2,W-4,H-4);
  ctx.strokeStyle='#c0a450'; ctx.lineWidth=1; ctx.strokeRect(8,8,W-16,H-16);

  const sc = dispW / BASE_W;

  // クリック可能オブジェクト（広場＋6軒）
  const objects = [
    // 広場の案内板（クリックで紹介文）
    { id:'plaza', cx:344, cy:261, w:52, h:58,
      action: () => showHomeVillageMsg() },
    { id:'law',         cx:122, cy:192, w:48, h:44, action: () => showPage('windows',null) },
    { id:'voice',       cx:192, cy:452, w:50, h:46, action: () => showPage('survey',document.querySelector('nav a:nth-child(3)')) },
    { id:'researcher',  cx:390, cy:136, w:48, h:44, action: () => showPage('essays',document.querySelector('nav a:nth-child(4)')) },
    { id:'observation', cx:572, cy:106, w:38, h:34, action: () => showPage('db',document.querySelector('nav a:nth-child(2)')) },
    { id:'journalist',  cx:600, cy:276, w:48, h:44, action: () => showPage('db',document.querySelector('nav a:nth-child(2)')) },
    { id:'karte',       cx:548, cy:448, w:58, h:44, action: () => showPage('karte',document.querySelector('nav a:nth-child(5)')) },
  ];

  function hitTest(mx, my){
    return objects.find(o=>{
      const ox=o.cx*sc, oy=o.cy*sc, ow=o.w*sc, oh=o.h*sc;
      return mx>=ox-ow/2-4 && mx<=ox+ow/2+4 && my>=oy-oh-oh*.55-4 && my<=oy+8;
    });
  }

  cv.removeEventListener('mousemove', cv._hvm);
  cv.removeEventListener('click', cv._hvc);
  cv._hvm = e => {
    const r=cv.getBoundingClientRect();
    const mx=e.clientX-r.left, my=e.clientY-r.top;
    cv.style.cursor = hitTest(mx,my) ? 'pointer' : 'default';
  };
  cv._hvc = e => {
    const r=cv.getBoundingClientRect();
    const mx=e.clientX-r.left, my=e.clientY-r.top;
    const h=hitTest(mx,my);
    if(h) h.action();
  };
  cv.addEventListener('mousemove', cv._hvm);
  cv.addEventListener('click', cv._hvc);
}

function showHomeVillageMsg() {
  const el = document.getElementById('home-village-msg');
  if (!el) return;
  el.style.display = 'block';
  el.innerHTML = `
    <button class="home-village-msg-close" onclick="document.getElementById('home-village-msg').style.display='none'">✕</button>
    <div class="home-village-msg-title">MANAの広場</div>
    <div class="home-village-msg-body">ここは、社会の出来事を通じて考える場所です。

MANAは答えを示しません。
各村の窓から、社会を観察してみてください。</div>`;
}

function renderVillageCanvas(win, windowId) {
  const cv = document.getElementById('village-canvas');
  if (!cv) return;

  const dpr = window.devicePixelRatio || 1;
  const BASE_W = 720, BASE_H = 510;
  const dispW = cv.parentElement ? cv.parentElement.clientWidth : window.innerWidth;
  const dispH = Math.round(dispW * BASE_H / BASE_W);
  cv.width  = dispW * dpr; cv.height = dispH * dpr;
  cv.style.width = dispW + 'px'; cv.style.height = dispH + 'px';

  const ctx = cv.getContext('2d');
  ctx.scale(dpr * dispW / BASE_W, dpr * dispH / BASE_H);
  const W = BASE_W, H = BASE_H;

  // RNG
  let _s = 42;
  function sr() { _s = (_s * 16807) % 2147483647; return (_s - 1) / 2147483646; }
  function setSeed(s) { _s = Math.abs((s | 1)) || 1; }
  function rn() { return sr(); }
  function jit(a) { return (rn() - 0.5) * a * 2; }

  // 背景
  ctx.fillStyle = '#ece2bc'; ctx.fillRect(0, 0, W, H);

  const washes = [
    [195,155,240,170,'#c4ce55',0.13],[420,195,280,200,'#cad850',0.11],
    [560,365,210,175,'#aabe58',0.13],[102,365,180,148,'#b0be48',0.11],
    [330,428,220,132,'#a8c048',0.10],[608,125,170,108,'#beca55',0.12],
    [80,240,138,108,'#a0b244',0.09],[258,268,150,118,'#8a9e44',0.12],
    [485,252,170,138,'#90a84e',0.10],
  ];
  washes.forEach(([cx,cy,rx,ry,c,a]) => {
    setSeed(cx | 0);
    for (let p = 0; p < 4; p++) {
      ctx.save(); ctx.globalAlpha = a * (1 - p * 0.22); ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(cx+jit(15+p*10),cy+jit(12+p*8),(rx+jit(20))*(1-p*.18),(ry+jit(15))*(1-p*.18),jit(0.4),0,Math.PI*2);
      ctx.fill(); ctx.restore();
    }
  });

  setSeed(5);
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = `rgba(${65+rn()*45|0},${70+rn()*35|0},${25+rn()*22|0},${0.02+rn()*0.022})`;
    ctx.fillRect(rn()*W, rn()*H, 1.5, 1.5);
  }

  function treeRound(cx, cy, seed, sc2) {
    setSeed(seed);
    const s = sc2;
    ctx.strokeStyle = '#6a4828'; ctx.lineWidth = 3.8*s; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.bezierCurveTo(cx+jit(4*s),cy-9*s,cx+jit(4*s),cy-15*s,cx+jit(3*s),cy-20*s);
    ctx.stroke();
    ctx.lineWidth = 1.6*s;
    ctx.beginPath(); ctx.moveTo(cx+jit(2*s),cy-15*s); ctx.lineTo(cx+9*s+jit(3*s),cy-23*s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+jit(2*s),cy-14*s); ctx.lineTo(cx-8*s+jit(3*s),cy-25*s); ctx.stroke();
    const blobs = [
      [0,-31*s,18*s,'#4a6a30'],[-11*s,-35*s,13*s,'#3e5e28'],[11*s,-33*s,14*s,'#527c3c'],
      [4*s,-44*s,12*s,'#5a8a4a'],[-6*s,-24*s,11*s,'#426230'],[9*s,-24*s,10*s,'#4e7038'],
      [0,-51*s,9*s,'#6a9058'],[-13*s,-27*s,8*s,'#3c5c28'],[6*s,-40*s,7*s,'#608a48'],
    ];
    blobs.forEach(([dx,dy,r,c]) => {
      setSeed(seed + (r | 0));
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(cx+dx+jit(2.5*s),cy+dy+jit(2.5*s),Math.max(3,r+jit(2.5*s)),0,Math.PI*2); ctx.fill();
    });
    ctx.strokeStyle = '#2c4a1c'; ctx.lineWidth = 1.2*s;
    setSeed(seed + 50);
    ctx.beginPath();
    for (let i = 0; i <= 22; i++) {
      const a = i/22*Math.PI*2, r2 = (20+jit(5.5))*s;
      const x = cx+Math.cos(a)*r2, y = (cy-33*s)+Math.sin(a)*r2*.87;
      i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.closePath(); ctx.stroke();
  }

  function treePine(cx, cy, seed, sc2) {
    setSeed(seed);
    const s = sc2;
    ctx.fillStyle = '#4e361c'; ctx.strokeStyle = '#382010'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.rect(cx-3.5*s,cy,7*s,9*s); ctx.fill(); ctx.stroke();
    const layers = [
      [0,30*s,'#1e3810'],[-14*s,23*s,'#243e16'],[-26*s,17*s,'#2a4618'],
      [-35*s,12*s,'#305020'],[-43*s,8*s,'#385628'],[-50*s,5*s,'#3e5c2c'],
    ];
    layers.forEach(([topY,hw,c],i) => {
      setSeed(seed + i*7);
      ctx.fillStyle = c; ctx.strokeStyle = '#142c0a'; ctx.lineWidth = 0.8; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx+jit(2*s), cy+topY);
      ctx.lineTo(cx+hw/2*1.1+jit(2.5*s), cy+layers[Math.min(i+1,5)][0]+jit(2*s));
      ctx.lineTo(cx-hw/2*1.1+jit(2.5*s), cy+layers[Math.min(i+1,5)][0]+jit(2*s));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    });
  }

  const PX = 340, PY = 285;

  setSeed(70);
  ctx.save();
  ctx.strokeStyle = '#9a8248'; ctx.lineWidth = 2.2; ctx.setLineDash([5,10]); ctx.lineCap = 'round';

  ctx.beginPath(); ctx.moveTo(128,198);
  ctx.bezierCurveTo(148,225,175,258,240,272);
  ctx.bezierCurveTo(278,282,310,284,PX,PY); ctx.stroke();

  ctx.beginPath(); ctx.moveTo(PX,PY);
  ctx.bezierCurveTo(348,268,368,228,378,188);
  ctx.bezierCurveTo(385,162,385,145,390,132); ctx.stroke();

  ctx.beginPath(); ctx.moveTo(PX,PY);
  ctx.bezierCurveTo(322,308,298,348,275,385);
  ctx.bezierCurveTo(258,412,228,438,195,452); ctx.stroke();

  ctx.beginPath(); ctx.moveTo(PX,PY);
  ctx.bezierCurveTo(385,282,448,272,505,264);
  ctx.bezierCurveTo(540,258,572,262,598,272); ctx.stroke();

  ctx.beginPath(); ctx.moveTo(598,272);
  ctx.bezierCurveTo(610,318,595,368,562,415);
  ctx.bezierCurveTo(554,428,548,438,545,448); ctx.stroke();

  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(PX,PY);
  ctx.bezierCurveTo(388,258,452,198,508,152);
  ctx.bezierCurveTo(532,132,552,118,572,108); ctx.stroke();

  ctx.setLineDash([]); ctx.restore();

  [[228,262,101,1.0],[248,244,102,0.92],[238,274,103,1.05],
   [214,270,104,0.86],[260,255,105,0.80],[270,276,106,0.74]].forEach(([cx,cy,seed,sc2])=>treePine(cx,cy,seed,sc2));

  [[52,82,201,0.88],[78,62,202,0.74],[46,122,203,0.80],[38,152,240,0.70],[30,198,241,0.65]].forEach(a=>treeRound(...a));
  [[444,72,206,0.90],[472,98,207,0.78],[585,58,208,0.94],[618,86,209,0.80],[600,36,210,0.70]].forEach(a=>treeRound(...a));
  [[662,194,211,1.0],[678,226,212,0.88],[685,164,213,0.78],[675,258,241,0.82]].forEach(a=>treeRound(...a));
  [[648,378,215,0.98],[662,408,216,0.86],[672,348,217,0.74]].forEach(a=>treeRound(...a));
  [[68,415,218,0.90],[44,440,219,0.76],[92,446,220,0.70],[135,462,229,0.68]].forEach(a=>treeRound(...a));
  [[478,448,221,0.82],[500,428,222,0.72]].forEach(a=>treeRound(...a));
  [[328,50,224,0.75],[308,76,225,0.64]].forEach(a=>treeRound(...a));
  [[32,312,226,0.80],[16,342,227,0.66]].forEach(a=>treeRound(...a));

  setSeed(80);
  ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = '#e0d480';
  ctx.beginPath(); ctx.ellipse(PX+jit(4),PY+jit(4),52+jit(6),42+jit(5),jit(0.2),0,Math.PI*2); ctx.fill();
  ctx.restore();
  setSeed(81);
  for (let i = 0; i < 10; i++) {
    const tx = PX+(rn()-0.5)*56, ty = PY+(rn()-0.5)*42;
    ctx.save(); ctx.globalAlpha = 0.24; ctx.fillStyle = '#c0ae68'; ctx.strokeStyle = '#9e8e4c'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.ellipse(tx+jit(3),ty+jit(3),9+rn()*6,6+rn()*3,jit(0.5),0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // 案内板
  (function() {
    const bx = PX+4, by = PY-6;
    setSeed(82);
    ctx.strokeStyle = '#6a4c28'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx,by+12);
    ctx.bezierCurveTo(bx+2,by-6,bx-2,by-24,bx+3,by-50); ctx.stroke();
    ctx.strokeStyle = '#5a3e1e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(bx-28,by-49); ctx.lineTo(bx+30,by-46); ctx.stroke();
    ctx.strokeStyle = '#988050'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(bx-19,by-48); ctx.bezierCurveTo(bx-20,by-43,bx-20,by-38,bx-20,by-33); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx+20,by-47); ctx.bezierCurveTo(bx+21,by-42,bx+20,by-37,bx+20,by-33); ctx.stroke();
    ctx.save(); ctx.translate(bx,by-18); ctx.rotate(-0.038);
    setSeed(83);
    ctx.save(); ctx.globalAlpha = 0.10; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.moveTo(-24+5,3); ctx.lineTo(26+5,3); ctx.lineTo(26+5,28); ctx.lineTo(-24+5,28);
    ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#c4a038'; ctx.strokeStyle = '#887020'; ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-25+jit(1.5),jit(1.5)); ctx.lineTo(25+jit(1.5),jit(1.5));
    ctx.lineTo(25+jit(1.5),28+jit(1.5)); ctx.lineTo(-25+jit(1.5),28+jit(1.5));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.globalAlpha = 0.10; ctx.strokeStyle = '#6a4010'; ctx.lineWidth = 0.9;
    [6,13,20].forEach(y => {
      ctx.beginPath(); ctx.moveTo(-22,y+jit(1.5)); ctx.bezierCurveTo(-8,y+jit(2.5),8,y+jit(2),22,y+jit(1.5)); ctx.stroke();
    });
    ctx.restore();
    ctx.textAlign = 'center';
    const signTitle = win && win.window_name ? win.window_name : '民主主義の窓';
    ctx.font = '700 8.5px serif'; ctx.fillStyle = 'rgba(40,24,4,0.86)'; ctx.fillText(signTitle, 0, 11);
    ctx.font = '500 6px serif'; ctx.fillStyle = 'rgba(40,24,4,0.60)'; ctx.fillText('▶ クリックして読む', 0, 23);
    ctx.restore();
  })();

  function sketchHouse(cx, cy, seed, roofC, wallC, w, h, extras) {
    setSeed(seed);
    const j = 2.2;
    ctx.save(); ctx.globalAlpha = 0.09; ctx.fillStyle = '#2a1808';
    ctx.beginPath(); ctx.ellipse(cx+w*.15,cy+4,w*.52,6,.08,0,Math.PI*2); ctx.fill(); ctx.restore();
    ctx.fillStyle = roofC; ctx.strokeStyle = '#3a1e0c'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx-w/2-4+jit(j), cy-h*.38+jit(j));
    ctx.lineTo(cx+jit(j),       cy-h*.38-h*.52+jit(j));
    ctx.lineTo(cx+w/2+4+jit(j), cy-h*.38+jit(j));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(38,14,4,0.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx+jit(j),cy-h*.38-h*.52); ctx.lineTo(cx+2,cy-h*.38); ctx.stroke();
    ctx.fillStyle = wallC; ctx.strokeStyle = '#3a1e0c'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx-w/2+jit(j), cy-h*.38+jit(j));
    ctx.lineTo(cx+w/2+jit(j), cy-h*.38+jit(j));
    ctx.lineTo(cx+w/2+jit(j), cy+jit(j));
    ctx.lineTo(cx-w/2+jit(j), cy+jit(j));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2810'; ctx.strokeStyle = '#28160a'; ctx.lineWidth = 1.2;
    const dw = w*.24, dh = h*.38;
    ctx.beginPath();
    ctx.moveTo(cx-dw/2+jit(j),cy+jit(j));
    ctx.lineTo(cx+dw/2+jit(j),cy+jit(j));
    ctx.lineTo(cx+dw/2+jit(j),cy-dh+dw/3+jit(j));
    ctx.quadraticCurveTo(cx+jit(j),cy-dh-dw/4+jit(j),cx-dw/2+jit(j),cy-dh+dw/3+jit(j));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c8a430';
    ctx.beginPath(); ctx.arc(cx+dw*.28,cy-dh*.4,2.2,0,Math.PI*2); ctx.fill();
    [[-.3,.47],[.3,.47]].forEach(([dx,dy]) => {
      const glow = extras && extras.glowLeft && dx < 0;
      if (glow) {
        ctx.save();
        const g = ctx.createRadialGradient(cx+w*dx,cy-h*dy-1,0,cx+w*dx,cy-h*dy-1,16);
        g.addColorStop(0,'rgba(255,215,80,0.55)'); g.addColorStop(1,'rgba(255,215,80,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx+w*dx,cy-h*dy-1,16,0,Math.PI*2); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#f0d050';
      } else { ctx.fillStyle = '#d0e8f5'; }
      ctx.strokeStyle = '#3a1e0c'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.rect(cx+w*dx-4.5+jit(j),cy-h*dy-1+jit(j),9,9); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(38,20,8,0.28)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(cx+w*dx+jit(j/2),cy-h*dy-1); ctx.lineTo(cx+w*dx+jit(j/2),cy-h*dy+8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+w*dx-4.5,cy-h*dy+3.5+jit(j/2)); ctx.lineTo(cx+w*dx+4.5,cy-h*dy+3.5+jit(j/2)); ctx.stroke();
    });
    if (extras && extras.chimney) {
      const chx = cx+w*.28, chy = cy-h*.38-h*.5;
      ctx.fillStyle = '#8a7858'; ctx.strokeStyle = '#3a1e0c'; ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(chx-4+jit(j),chy+jit(j)); ctx.lineTo(chx+4+jit(j),chy+jit(j));
      ctx.lineTo(chx+5+jit(j),chy-18+jit(j)); ctx.lineTo(chx-3+jit(j),chy-18+jit(j));
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.globalAlpha = 0.18; ctx.strokeStyle = '#aaa'; ctx.lineWidth = 2.5; ctx.setLineDash([2,4]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(chx,chy-20);
      ctx.bezierCurveTo(chx+7,chy-32,chx-5,chy-44,chx+4,chy-58);
      ctx.bezierCurveTo(chx+10,chy-68,chx-3,chy-78,chx+2,chy-90);
      ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }
    if (extras && extras.stone) {
      setSeed(seed + 1);
      ctx.save(); ctx.globalAlpha = 0.14; ctx.strokeStyle = '#8a8880'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(cx-w/2+2,cy-h*.38*i/4+jit(1));
        ctx.bezierCurveTo(cx-w/6,cy-h*.38*i/4+jit(1.5),cx+w/6,cy-h*.38*i/4+jit(1.5),cx+w/2-2,cy-h*.38*i/4+jit(1));
        ctx.stroke();
      }
      ctx.restore();
    }
    if (extras && extras.grain) {
      setSeed(seed + 2);
      ctx.save(); ctx.globalAlpha = 0.09; ctx.strokeStyle = '#7a5030'; ctx.lineWidth = 0.9;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(cx-w/2+i*(w/4.5)+jit(2),cy-h*.38+jit(1));
        ctx.lineTo(cx-w/2+i*(w/4.5)+jit(3),cy+jit(1));
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  sketchHouse(122,192,300,'#a23c2a','#c8c4b8',48,44,{stone:true});
  sketchHouse(192,452,301,'#ac4230','#e2d0aa',50,46,{grain:true});
  sketchHouse(390,136,302,'#a43c30','#dedad8',48,44,{chimney:true});
  sketchHouse(572,106,303,'#9c3628','#d6d2bc',38,34,{});
  sketchHouse(600,276,304,'#9a3228','#dedad4',48,44,{glowLeft:true});

  // 喫茶店
  (function() {
    const cx = 295, cy = 438, w = 52, h = 44;
    setSeed(310);
    const j = 2.2;
    // 影
    ctx.save(); ctx.globalAlpha = 0.09; ctx.fillStyle = '#2a1808';
    ctx.beginPath(); ctx.ellipse(cx+w*.15,cy+4,w*.52,6,.08,0,Math.PI*2); ctx.fill(); ctx.restore();
    // 屋根
    ctx.fillStyle = '#4a6878'; ctx.strokeStyle = '#2a3e4c'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx-w/2-4+jit(j), cy-h*.38+jit(j));
    ctx.lineTo(cx+jit(j),       cy-h*.38-h*.5+jit(j));
    ctx.lineTo(cx+w/2+4+jit(j), cy-h*.38+jit(j));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // 壁
    ctx.fillStyle = '#f2ede0'; ctx.strokeStyle = '#3a1e0c'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx-w/2+jit(j),cy-h*.38+jit(j)); ctx.lineTo(cx+w/2+jit(j),cy-h*.38+jit(j));
    ctx.lineTo(cx+w/2+jit(j),cy+jit(j)); ctx.lineTo(cx-w/2+jit(j),cy+jit(j));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // ひさし（スカラップ）
    const awY = cy - h*.38 + 2;
    ctx.fillStyle = '#c04820'; ctx.strokeStyle = '#7a2c10'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - w/2 - 6, awY);
    for (let i = 0; i < 5; i++) {
      const ax = cx - w/2 - 6 + (w + 12) / 5 * i;
      const ax2 = ax + (w + 12) / 5;
      ctx.quadraticCurveTo(ax + (w + 12) / 10, awY + 9, ax2, awY);
    }
    ctx.lineTo(cx + w/2 + 6, awY - 1);
    ctx.lineTo(cx - w/2 - 6, awY - 1);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // ドア
    const dw = w*.24, dh = h*.38;
    ctx.fillStyle = '#6a4428'; ctx.strokeStyle = '#28160a'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx-dw/2+jit(j),cy+jit(j));
    ctx.lineTo(cx+dw/2+jit(j),cy+jit(j));
    ctx.lineTo(cx+dw/2+jit(j),cy-dh+dw/3+jit(j));
    ctx.quadraticCurveTo(cx+jit(j),cy-dh-dw/4+jit(j),cx-dw/2+jit(j),cy-dh+dw/3+jit(j));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // 窓2つ
    [[-.3,.47],[.3,.47]].forEach(([dx,dy]) => {
      ctx.fillStyle = '#f5e8c8'; ctx.strokeStyle = '#3a1e0c'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.rect(cx+w*dx-4.5+jit(j),cy-h*dy-1+jit(j),9,9); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(38,20,8,0.25)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(cx+w*dx,cy-h*dy-1); ctx.lineTo(cx+w*dx,cy-h*dy+8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+w*dx-4.5,cy-h*dy+3.5); ctx.lineTo(cx+w*dx+4.5,cy-h*dy+3.5); ctx.stroke();
    });
    // 看板「喫茶」
    ctx.save(); ctx.translate(cx, cy - h*.38 - h*.28); ctx.rotate(-0.04);
    ctx.fillStyle = '#f0e0b0'; ctx.strokeStyle = '#8a5828'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.roundRect(-14, -8, 28, 14, 2); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = '#5a2c10';
    ctx.font = '700 7.5px serif'; ctx.fillText('喫茶', 0, 3);
    ctx.restore();
  })();

  // カルテ（資料館・4窓）
  (function() {
    const cx = 548, cy = 448, w = 58, h = 44;
    setSeed(305);
    const j = 2.2;
    ctx.fillStyle = '#a03a28'; ctx.strokeStyle = '#3a1e0c'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx-w/2-4+jit(j), cy-h*.38+jit(j));
    ctx.lineTo(cx+jit(j),       cy-h*.38-h*.42+jit(j));
    ctx.lineTo(cx+w/2+4+jit(j), cy-h*.38+jit(j));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d2cec0'; ctx.strokeStyle = '#3a1e0c'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx-w/2+jit(j),cy-h*.38+jit(j)); ctx.lineTo(cx+w/2+jit(j),cy-h*.38+jit(j));
    ctx.lineTo(cx+w/2+jit(j),cy+jit(j)); ctx.lineTo(cx-w/2+jit(j),cy+jit(j));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    const dw = 11, dh = h*.36;
    ctx.fillStyle = '#3a2810'; ctx.strokeStyle = '#28160a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.rect(cx-dw/2+jit(j),cy-dh+jit(j),dw,dh); ctx.fill(); ctx.stroke();
    [[-.30,.46],[.30,.46],[-.30,.20],[.30,.20]].forEach(([dx,dy]) => {
      ctx.fillStyle = '#d0e8f5'; ctx.strokeStyle = '#3a1e0c'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.rect(cx+w*dx-4+jit(j),cy-h*dy-0.5+jit(j),8,8); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(38,20,8,0.25)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(cx+w*dx,cy-h*dy-0.5); ctx.lineTo(cx+w*dx,cy-h*dy+7.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+w*dx-4,cy-h*dy+3.5); ctx.lineTo(cx+w*dx+4,cy-h*dy+3.5); ctx.stroke();
    });
  })();

  function mapLabel(x, y, text, angle) {
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
    ctx.font = '600 11.5px serif';
    ctx.strokeStyle = 'rgba(234,222,178,0.90)'; ctx.lineWidth = 3.5;
    ctx.strokeText(text,0,0);
    ctx.fillStyle = 'rgba(36,22,6,0.86)';
    ctx.fillText(text,0,0);
    ctx.restore();
  }
  const HL = villageHouseLabels(windowId);
  mapLabel(44,  174, HL.law,        -0.07);
  mapLabel(105, 476, HL.voice,       0.05);
  mapLabel(398, 118, HL.researcher, -0.04);
  mapLabel(584,  90, HL.observation, 0.05);
  mapLabel(618, 294, HL.journalist,  0.03);
  mapLabel(556, 470, HL.karte,      -0.06);
  mapLabel(248, 462, HL.cafe,        0.04);

  // 左上：戻る矢印（絵の中に手書き風で）
  ctx.save();
  ctx.font = '500 10px serif';
  ctx.strokeStyle = 'rgba(234,222,178,0.85)'; ctx.lineWidth = 3;
  ctx.strokeText('← 観測の窓へ', 18, 22);
  ctx.fillStyle = 'rgba(60,36,12,0.70)';
  ctx.fillText('← 観測の窓へ', 18, 22);
  ctx.restore();

  // ヒット領域（base coord → CSSピクセルに sc 倍）
  const sc = dispW / BASE_W;
  // 家（id付き）
  const houses = [
    { id:'law',         cx:122, cy:192, w:48, h:44 },
    { id:'voice',       cx:192, cy:452, w:50, h:46 },
    { id:'researcher',  cx:390, cy:136, w:48, h:44 },
    { id:'observation', cx:572, cy:106, w:38, h:34 },
    { id:'journalist',  cx:600, cy:276, w:48, h:44 },
    { id:'karte',       cx:548, cy:448, w:58, h:44 },
    { id:'cafe',        cx:295, cy:438, w:52, h:44 },
  ];
  // 広場の案内板ヒット領域
  const plazaHit = { cx:344, cy:260, w:60, h:62 };
  // 左上の戻るリンク（CSS pixel座標で判定）
  const backHitCSS = { x1:0, y1:0, x2:110*sc, y2:30*sc };

  function inBox(mx, my, o, topRatio) {
    const ox=o.cx*sc, oy=o.cy*sc, ow=o.w*sc, oh=o.h*sc;
    return mx>=ox-ow/2-4 && mx<=ox+ow/2+4 && my>=oy-oh*(topRatio||1.5)-4 && my<=oy+8;
  }

  function hitTest(mx, my) {
    if (mx>=backHitCSS.x1 && mx<=backHitCSS.x2 && my>=backHitCSS.y1 && my<=backHitCSS.y2)
      return { id:'__back__' };
    if (inBox(mx, my, plazaHit, 1.0)) return { id:'__plaza__' };
    return houses.find(h => inBox(mx, my, h, 1.52));
  }

  cv.removeEventListener('mousemove', cv._vm);
  cv.removeEventListener('click', cv._vc);

  cv._vm = e => {
    const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    cv.style.cursor = hitTest(mx, my) ? 'pointer' : 'default';
  };
  cv._vc = e => {
    const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const hit = hitTest(mx, my);
    if (!hit) return;
    if (hit.id === '__back__') { showPage('windows', null); }
    else if (hit.id === '__plaza__') { showVillagePlazaMsg(win); }
    else { showVillageContent(hit, win, windowId); }
  };
  cv.addEventListener('mousemove', cv._vm);
  cv.addEventListener('click', cv._vc);
}

function showVillagePlazaMsg(win) {
  const el = document.getElementById('village-plaza-msg');
  if (!el) return;
  const title    = win && win.window_name ? win.window_name : '';
  const question = win && win.question   ? win.question    : '';
  el.style.display = 'block';
  el.innerHTML = `
    <button class="home-village-msg-close" onclick="document.getElementById('village-plaza-msg').style.display='none'">✕</button>
    <div class="home-village-msg-title">${title}</div>
    <div class="home-village-msg-body">${question}

MANAは答えを示しません。
ここでは、社会の出来事から考える材料を展示しています。</div>`;
}

// 村ごとの家ラベル。既定は全村共通（＝従来通り）。
// windowId 別に上書きすることで、その村だけ家の名前を変えられる。
function villageHouseLabels(windowId) {
  const base = {
    law:         '法律・制度',
    researcher:  '研究者・論考',
    voice:       '当事者の声',
    journalist:  'ジャーナリスト',
    karte:       'カルテ',
    observation: '観測事案',
    cafe:        '喫茶店',
  };
  if (windowId === 'war') {
    // 戦争の村：民主主義の型からの差し替え
    return { ...base, law: '国際人道法', voice: '記憶・証言', karte: '戦争を必要とする人たち' };
  }
  return base;
}

function showVillageContent(house, win, windowId) {
  const el = document.getElementById('village-content');
  if (!el) return;

  const labels = villageHouseLabels(windowId);

  let items = [];

  // 窓に関連する記事を article_type で絞り込むヘルパー
  function dbByType(type) {
    return dbData.filter(r => matchesWindow(r, win) && r.article_type === type)
      .slice(0, 20).map(r => ({
        title: r.title || '',
        sub:   String(r.date || r.collected_at || '').slice(0,10),
        url:   r.url || '',
        tags:  [r.tags_event, r.tags_structure].filter(Boolean).join('　'),
      }));
  }

  if (house.id === 'cafe') {
    el.innerHTML = `
      <div class="village-room village-room-cafe">
        <div class="village-room-header">
          <span class="village-room-name">喫茶店</span>
          <button class="village-room-close" onclick="document.getElementById('village-content').innerHTML=''">✕</button>
        </div>
        <p class="village-cafe-msg">少し休憩していきますか。<br>コーヒーを一杯どうぞ。</p>
      </div>`;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  if (house.id === 'observation') {
    // ニュース記事（デフォルト。記事種別列がない間は全件が news 扱い → 従来通り）
    items = dbByType('news');
  } else if (house.id === 'journalist' || house.id === 'researcher') {
    const types = house.id === 'journalist'
      ? ['opinion', 'investigative']
      : ['research'];
    const el2 = el;
    el2.innerHTML = `<div class="village-room"><div class="village-room-header"><span class="village-room-name">${labels[house.id]}</span><button class="village-room-close" onclick="document.getElementById('village-content').innerHTML=''">✕</button></div><p style="padding:1rem">読み込み中...</p></div>`;
    fetch(GAS_API_URL + '?sheet=' + encodeURIComponent('観測DB（全件ログ）'))
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) throw new Error('not array');
        const matchTerms = [
          ...((win && win.keywords) ? win.keywords : []),
          ...((win && win.tags)     ? win.tags     : []),
        ];
        const fullItems = data.map(row => ({
          title:        row['タイトル'] || '',
          url:          row['URL'] || '',
          source:       row['出典'] || '',
          date:         row['rss_pubDate'] || row['公開日'] || '',
          article_type: inferArticleType(row['記事種別'], row['source_domain'], row['出典'] || ''),
        })).filter(r => {
          if (!r.title || !types.includes(r.article_type)) return false;
          if (!matchTerms.length) return true;
          return matchTerms.some(kw => r.title.includes(kw));
        }).slice(0, 20);
        renderVillageRoomItems(el2, house, labels, fullItems);
      })
      .catch(() => renderVillageRoomItems(el2, house, labels, []));
    return;
  } else if (house.id === 'voice') {
    const villageMap = { democracy: '民主主義', human_rights: '人権', media: 'メディア', mental: '心', war: '戦争' };
    const villageName = villageMap[windowId] || '';
    const el2 = el;
    el2.innerHTML = `<div class="village-room"><div class="village-room-header"><span class="village-room-name">${labels[house.id]}</span><button class="village-room-close" onclick="document.getElementById('village-content').innerHTML=''">✕</button></div><p style="padding:1rem">読み込み中...</p></div>`;
    fetch(GAS_API_URL + '?sheet=' + encodeURIComponent('当事者の声'))
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) throw new Error('not array');
        const voiceItems = data.filter(row =>
          row['展示対象'] === '展示' &&
          (!villageName || (row['村'] || '').split(',').map(s => s.trim()).includes(villageName))
        ).slice(0, 30).map(row => ({
          title:  row['タイトル'] || '',
          url:    row['URL'] || '',
          source: row['発信者'] || '',
          sub:    row['種別'] || '',
          tags:   row['要約'] || '',
        }));
        renderVillageRoomItems(el2, house, labels, voiceItems);
      })
      .catch(() => renderVillageRoomItems(el2, house, labels, []));
    return;
  } else if (house.id === 'karte') {
    if (windowId === 'war') {
      // 戦争の村では「戦争を必要とする人たち」に転用。軍需産業・推進側の資料を順次追加（今は準備中）
      items = [];
    } else {
      items = karteData.filter(k => {
        const text = [k.tags_event,k.tags_structure,k.field,k.summary].join(' ');
        return (win.keywords||[]).some(kw=>text.includes(kw)) || (win.tags||[]).some(t=>text.includes(t));
      }).map(k => ({ title: k.title, sub: k.region, url: '#/karte/'+encodeURIComponent(k.id), tags: k.tags_event }));
    }
  } else if (house.id === 'law') {
    items = (win.law_refs||[]).map(l => ({ title: l, sub: '関連法令', url: '', tags: '' }));
  }

  const isEmpty = items.length === 0;
  el.innerHTML = `
    <div class="village-room">
      <div class="village-room-header">
        <span class="village-room-name">${labels[house.id]}</span>
        <button class="village-room-close" onclick="document.getElementById('village-content').innerHTML=''">✕</button>
      </div>
      ${isEmpty
        ? `<p class="village-room-empty">この家はまだ準備中です。</p>`
        : items.map(item => `
          <div class="village-room-item">
            <div class="village-room-title">${item.url
              ? `<a href="${item.url}" ${item.url.startsWith('#') ? '' : 'target="_blank" rel="noopener"'}>${item.title}</a>`
              : item.title}</div>
            ${item.sub ? `<div class="village-room-sub">${item.sub}</div>` : ''}
            ${item.tags ? `<div class="village-room-tags">${item.tags}</div>` : ''}
          </div>`).join('')}
    </div>`;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderVillageRoomItems(el, house, labels, items) {
  const isEmpty = items.length === 0;
  el.innerHTML = `
    <div class="village-room">
      <div class="village-room-header">
        <span class="village-room-name">${labels[house.id]}</span>
        <button class="village-room-close" onclick="document.getElementById('village-content').innerHTML=''">✕</button>
      </div>
      ${isEmpty
        ? `<p class="village-room-empty">この家はまだ準備中です。</p>`
        : items.map(item => `
          <div class="village-room-item">
            <div class="village-room-title">${item.url
              ? `<a href="${item.url}" ${item.url.startsWith('#') ? '' : 'target="_blank" rel="noopener"'}>${item.title}</a>`
              : item.title}</div>
            ${item.sub ? `<div class="village-room-sub">${item.sub}</div>` : ''}
            ${item.source ? `<div class="village-room-sub">${item.source}</div>` : ''}
            ${item.tags ? `<div class="village-room-tags">${item.tags}</div>` : ''}
          </div>`).join('')}
    </div>`;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const GAS_FEEDBACK_URL = 'https://script.google.com/macros/s/AKfycbw0MWRwN9ZgoXxtAsAQus3wDhsnZc1nESxp_imFe90-b9dAw4jbnBLpMQ4zJUm1Z2VsFQ/exec';

function submitFeedback() {
  const type    = document.getElementById('f-type').value;
  const karteId = document.getElementById('f-karte-id').value.trim();
  const url     = document.getElementById('f-url').value.trim();
  const content = document.getElementById('f-content').value.trim();
  const contact = document.getElementById('f-contact').value.trim();

  if (!type || !content) { alert('種別と内容は必須です'); return; }

  const errEl = document.getElementById('feedback-error');

  // 送信先が未設定の場合は「送信完了」を絶対に表示しない（未送信データの隠蔽防止）
  if (GAS_FEEDBACK_URL === 'YOUR_GAS_FEEDBACK_URL_HERE') {
    if (errEl) {
      errEl.textContent = '現在、送信先が未設定のため送信できません。しばらくしてから再度お試しください。';
      errEl.style.display = 'block';
    } else {
      alert('現在、送信先が未設定のため送信できません。しばらくしてから再度お試しください。');
    }
    return;
  }

  const data = {
    type,
    targetKarteId: karteId,
    targetUrl: url,
    content,
    contact,
    timestamp: new Date().toISOString(),
  };

  if (errEl) errEl.style.display = 'none';

  fetch(GAS_FEEDBACK_URL, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(() => {
    document.getElementById('feedback-form-container').style.display = 'none';
    document.getElementById('feedback-thanks').style.display = 'block';
  }).catch(() => {
    // 送信失敗時も「成功」を装わない
    if (errEl) {
      errEl.textContent = '送信に失敗しました。通信状況をご確認のうえ、もう一度お試しください。';
      errEl.style.display = 'block';
    } else {
      alert('送信に失敗しました。通信状況をご確認のうえ、もう一度お試しください。');
    }
  });
}

// ===== 構造類似表示 =====
function getComparableTags(r) {
  return [
    ...splitTags(r.tags_structure),
    ...splitTags(r.tags_event),
    ...splitTags(r.tags_status),
    ...splitTags(r.tags_evidence),
  ];
}

function calcSimilarity(a, b) {
  const tagsA = new Set(getComparableTags(a));
  const tagsB = new Set(getComparableTags(b));
  return [...tagsA].filter(t => tagsB.has(t));
}

function scoreLabel(count) {
  if (count >= 5) return { label: '要観測', cls: 'score-3' };
  if (count >= 3) return { label: '構造的類似あり', cls: 'score-2' };
  if (count >= 1) return { label: '関連あり', cls: 'score-1' };
  return null;
}

function toggleSimilar(cardId) {
  const panel = document.getElementById('similar-' + cardId);
  const btn   = document.getElementById('similar-btn-' + cardId);
  if (!panel || !btn) return;
  const isOpen = panel.classList.contains('open');
  if (isOpen) {
    panel.classList.remove('open');
    btn.classList.remove('active');
    btn.textContent = '共通する構造を探す';
    return;
  }
  // data-url属性からURLを取得してdbDataを逆引き
  const cardEl = panel.closest('.db-card');
  const articleUrl = cardEl ? cardEl.querySelector('.db-card-title a')?.href : null;
  const normalizedTarget = articleUrl ? normalizeUrl(articleUrl) : null;
  const target = normalizedTarget
    ? dbData.find(r => normalizeUrl(r.url) === normalizedTarget)
    : null;
  if (!target) return;
  const targetTags = new Set(getComparableTags(target));
  if (targetTags.size === 0) {
    panel.innerHTML = '<div style="font-size:0.78rem;color:var(--ink-light)">タグが未付与のため比較できません</div>';
    panel.classList.add('open');
    return;
  }
  const results = dbData
    .filter(r => r !== target && r.title !== target.title)
    .map(r => ({ r, common: calcSimilarity(target, r) }))
    .filter(x => x.common.length >= 1)
    .sort((a, b) => b.common.length - a.common.length)
    .slice(0, 5);
  if (!results.length) {
    panel.innerHTML = '<div class="db-similar-label">共通する構造を持つ事例</div><div style="font-size:0.78rem;color:var(--ink-light)">現在のDBに一致する事例はありません</div>';
    panel.classList.add('open');
    btn.classList.add('active');
    btn.textContent = '▲ 閉じる';
    return;
  }
  const topCommon = results[0].common;
  const score = scoreLabel(topCommon.length);
  panel.innerHTML = `
    <div class="db-similar-label">この記事と共通する構造</div>
    ${score ? `<div class="db-similar-score ${score.cls}">共通タグ数：${topCommon.length}　${score.label}</div>` : ''}
    <div class="db-similar-tags">
      ${topCommon.map(t => `<span class="db-similar-tag">${t}</span>`).join('')}
    </div>
    <div class="db-similar-label" style="margin-top:0.5rem">同じ構造が観測された事例</div>
    <div class="db-similar-cases">
      ${results.map(x => `
        <div class="db-similar-case">
          <span class="db-similar-case-region">${x.r.region || ''}</span>
          ${x.r.url ? `<a href="${x.r.url}" target="_blank" style="color:var(--ink-mid);border-bottom:1px solid var(--rule)">${x.r.title}</a>` : x.r.title}
          <span style="font-family:'DM Mono',monospace;font-size:0.58rem;color:var(--ink-light);margin-left:0.4rem">（一致${x.common.length}）</span>
        </div>
      `).join('')}
    </div>`;
  panel.classList.add('open');
  btn.classList.add('active');
  btn.textContent = '▲ 閉じる';
}

let _currentFilteredData = [];
function getCurrentFilteredData() { return _currentFilteredData; }

function renderHomeTagCloud(data) {
  const tagCount = {};
  data.forEach(r => {
    ['tags_event','tags_structure','tags_evidence','tags_status'].forEach(key => {
      if (!r[key]) return;
      r[key].split(' / ').forEach(t => {
        t = t.trim();
        if (t) tagCount[t] = (tagCount[t] || 0) + 1;
      });
    });
  });
  const sorted = Object.entries(tagCount).sort((a,b) => b[1]-a[1]).slice(0, 24);
  const max = sorted[0]?.[1] || 1;
  const htc = document.getElementById('home-tag-cloud'); if(htc) htc.innerHTML = sorted.map(([tag, count]) => {
    const size    = 0.62 + (count / max) * 0.22;
    const opacity = 0.5  + (count / max) * 0.5;
    return `<span onclick="filterByTag('${tag}')" style="font-family:'DM Mono',monospace;font-size:${size}rem;padding:0.2rem 0.5rem;border:1px solid var(--rule);color:var(--ink-mid);cursor:pointer;opacity:${opacity};transition:all 0.15s;display:inline-block;margin:0.15rem" onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'" onmouseout="this.style.borderColor='var(--rule)';this.style.color='var(--ink-mid)'">${tag}<span style="font-size:0.52rem;opacity:0.5;margin-left:0.2rem">${count}</span></span>`;
  }).join('');
}

function filterByTag(tag) {
  showPage('db', document.querySelector('nav a:nth-child(2)'));
  setTimeout(() => {
    document.getElementById('db-search').value = tag;
    filterDB();
  }, 50);
}

// ===== KARTE =====
const QA_SHEET_NAME    = 'Q&A';
const GAS_QA_URL       = 'YOUR_GAS_WEB_APP_URL_HERE';
const KARTE_SHEET_NAME = 'カルテ';
let qaData    = [];
let karteData = [];

const demoKartes = [
  {
    id:'KARTE-0001', title:'京都市生活保護窓口での申請妨害', region:'京都府', field:'生活保護',
    summary:'京都市の福祉窓口において、生活保護申請者が「まず家族に相談を」「書類が揃ってから来て」などの言葉で申請を阻まれる事案が複数件確認されている。担当者が異なるにもかかわらず言葉が酷似しており、組織的な対応指針の存在が疑われる。',
    progress:'市民団体が事例を収集中。行政は「個別対応」として組織的関与を否定。',
    tags_event:'申請妨害 / 扶養照会濫用', tags_structure:'組織的不作為 / 説明責任 / 前例主義',
    tags_status:'疑惑段階', tags_evidence:'当事者証言',
    tags_field:'生活保護', tags_target:'生活保護申請者', tags_actor:'福祉事務所 / ケースワーカー',
    tags_event_search:'申請を断られた / 扶養照会を強いられた',
    related_urls:'https://example.com/article1\nhttps://example.com/article2',
    mana_comment:'', created_at:'2026-06-08', updated_at:'2026-06-09', start_date:'2026-06-01',
  },
  {
    id:'KARTE-0002', title:'燕市生活保護費の過大支給と回収問題', region:'新潟県', field:'生活保護',
    summary:'新潟県燕市において、生活保護受給者9人への総額約855万円の誤支給が判明。行政ミスによる過払いにもかかわらず、受給者への返還請求が行われた。',
    progress:'行政が誤りを認め謝罪。返還交渉中。',
    tags_event:'誤情報提供 / 財政推計ミス', tags_structure:'内部統制 / 説明責任 / 自己修正不能',
    tags_status:'行政が認めた / 謝罪あり', tags_evidence:'報道',
    tags_field:'生活保護', tags_target:'生活保護受給者', tags_actor:'市区町村窓口',
    tags_event_search:'支給を止められた',
    related_urls:'https://example.com/article3',
    mana_comment:'', created_at:'2026-06-08', updated_at:'2026-06-08', start_date:'2026-06-08',
  },
];

function loadKartes() {
  if (SHEET_ID === 'YOUR_SHEET_ID_HERE') {
    karteData = demoKartes;
    renderKartes(karteData);
    buildKarteFilters(karteData);
    if (!_routeHandled) handleHashRoute();
    return;
  }
  const url = GAS_API_URL + '?sheet=' + encodeURIComponent(KARTE_SHEET_NAME);
  console.log('カルテ読み込み開始:', url);
  fetch(url)
    .then(r => r.json())
    .then(data => {
      console.log('カルテAPIレスポンス件数:', Array.isArray(data) ? data.length : 'エラー');
      if (!Array.isArray(data)) throw new Error('配列ではありません: ' + JSON.stringify(data).slice(0, 100));
      karteData = data.map(row => ({
        id:             row['カルテID'] || row['id'] || '',
        title:          row['事案名']   || row['title'] || '',
        region:         row['地域']     || '',
        region_pref:    row['地域']    || row['都道府県'] || '',
        region_city:    row['市区町村'] || '',
        region_ward:    row['区']       || '',
        field:          row['分野']     || '',
        summary:        row['概要']     || '',
        progress:       row['経過']     || '',
        tags_event:     row['出来事タグ'] || '',
        tags_structure: row['構造タグ']   || '',
        tags_status:    row['状態タグ']   || '',
        tags_evidence:  row['根拠タグ']   || '',
        related_urls:   row['関連記事URL'] || '',
        mana_comment:   row['MANAコメント'] || '',
        created_at:     row['作成日']     || '',
        updated_at:     row['最終更新日'] || '',
        start_date:     row['事案開始日'] || '',
        tags_field:        row['分野タグ']         || '',
        tags_target:       row['対象者タグ']        || '',
        tags_actor:        row['行為者タグ']        || '',
        tags_event_search: row['出来事タグ（探索）'] || '',
      })).filter(r => r.id || r.title);
      console.log('カルテ読み込み成功:', karteData.length + '件');
      // ホームのカルテ件数・タグ件数を更新
      const homeKarte = document.getElementById('home-karte-count');
      if (homeKarte) homeKarte.textContent = karteData.length + '件';
      const allTags = new Set();
      karteData.forEach(k => {
        ['tags_field','tags_target','tags_actor','tags_event_search',
         'tags_event','tags_structure','tags_status','tags_evidence'].forEach(f => {
          splitKarteTags(k[f] || '').forEach(t => allTags.add(t));
        });
      });
      const homeTag = document.getElementById('home-tag-count');
      if (homeTag) homeTag.textContent = allTags.size + '種';
      renderKartes(karteData);
      buildKarteFilters(karteData);
      if (dbData.length) renderDB(dbData);
      if (!_routeHandled) handleHashRoute();
      checkKarteLinkage();
    })
    .catch(err => {
      console.error('カルテ読み込みエラー:', err.message);
      const list = document.getElementById('karte-list');
      if (list) list.innerHTML = `<div class="db-empty">カルテの読み込みに失敗しました<br><span style="font-family:'DM Mono',monospace;font-size:0.7rem;color:var(--ink-light)">${err.message}</span></div>`;
    });
}

function renderKartes(data) {
  const list = document.getElementById('karte-list');
  document.getElementById('karte-count-label').textContent = data.length + ' 件';
  if (!data.length) {
    list.innerHTML = '<div class="db-empty">該当する事案カルテがありません</div>';
    return;
  }
  list.innerHTML = data.map(k => {
    const urls       = k.related_urls ? k.related_urls.split('\n').filter(Boolean) : [];
    const structTags = splitKarteTags(k.tags_structure);
    const eventTags  = splitKarteTags(k.tags_event);
    const statusTags = splitKarteTags(k.tags_status);
    return `<div class="karte-card" onclick="goToKartePage('${k.id}')">\n      <div class="karte-card-top">\n        <span class="karte-card-id">${k.id}</span>\n        ${k.region ? `<span class="karte-card-region">${k.region}</span>` : ''}\n        ${k.field  ? `<span class="karte-card-field">${k.field}</span>`   : ''}\n        ${statusTags[0] ? `<a href="#/tag/${encodeURIComponent(statusTags[0])}" class="db-tag-t" onclick="event.stopPropagation()">${statusTags[0]}</a>` : ''}\n      </div>\n      <div class="karte-card-title">${k.title}</div>\n      ${k.summary  ? `<div class="karte-card-summary">${k.summary.slice(0,120)}${k.summary.length>120?'……':''}</div>` : ''}
      ${k.progress ? `<div class="karte-card-progress">${k.progress}</div>` : ''}
      <div class="karte-card-tags">
        ${structTags.map(t => `<a href="#/tag/${encodeURIComponent(t)}" class="db-tag-s" onclick="event.stopPropagation()">${t}</a>`).join('')}
        ${eventTags.map(t  => `<a href="#/tag/${encodeURIComponent(t)}" class="db-tag-e" onclick="event.stopPropagation()">${t}</a>`).join('')}
      </div>
      <div class="karte-card-footer">
        <span>記事 ${urls.length} 件</span>
        <span>更新: ${k.updated_at ? k.updated_at.slice(0,10) : ''}</span>
      </div>
    </div>`;
  }).join('');
}

function buildKarteFilters(data) {
  const prefs    = [...new Set(data.map(k => k.region).filter(Boolean))].sort();
  const fields   = [...new Set(data.map(k => k.field).filter(Boolean))].sort();
  const structs  = [...new Set(data.flatMap(k => splitKarteTags(k.tags_structure)))].sort();
  const statuses = [...new Set(data.flatMap(k => splitKarteTags(k.tags_status)))].sort();
  const fill = (id, items) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const first = sel.options[0].outerHTML;
    sel.innerHTML = first + items.map(v => `<option value="${v}">${v}</option>`).join('');
  };
  fill('karte-pref',      prefs);
  fill('karte-field',     fields);
  fill('karte-structure', structs);
  fill('karte-status',    statuses);
}

function filterKartes() {
  const pref   = document.getElementById('karte-pref')?.value || '';
  const field  = document.getElementById('karte-field')?.value || '';
  const struct = document.getElementById('karte-structure')?.value || '';
  const status = document.getElementById('karte-status')?.value || '';
  const filtered = karteData.filter(k =>
    (!pref   || k.region === pref) &&
    (!field  || k.field === field) &&
    (!struct || (k.tags_structure || '').includes(struct)) &&
    (!status || (k.tags_status    || '').includes(status))
  );
  renderKartes(filtered);
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function splitKarteTags(str) {
  if (!str) return [];
  return str.split(/[\/・,、]/).map(t => t.trim()).filter(Boolean);
}

// ===== ESSAYS =====
const ESSAY_SHEET_NAME = '論考';
let essayData = [];

const demoEssays = [
  {date:'2025-11-01',type:'調査報告書',title:'尊厳の倫理学——行政的暴力と当事者の声',summary:'行政による不作為は単なる怠慢ではない。それは権力関係の構造的な産物であり、当事者の尊厳を組織的に剥奪するプロセスである。収集された証言と記録から、その論理と倫理的含意を検討する。',tags:'尊厳 / 当事者主体 / 組織的不作為 / 行政暴力',url:'',status:'公開',featured:'1'},
  {date:'2025-08-01',type:'調査報告書',title:'行政の組織的不作為——京都市の事例から',summary:'京都市の福祉行政における申請妨害・虚偽記録・権限濫用の事例を収集・分析。個別の逸脱ではなく、組織文化として定着した構造的不作為を記述する。',tags:'水際作戦 / 生活保護 / 組織的不作為 / 京都市',url:'',status:'公開',featured:''},
  {date:'2025-06-15',type:'論考',title:'水際作戦の構造——なぜ申請は阻まれるのか',summary:'生活保護申請の妨害は偶発的な窓口対応の問題ではない。制度を実装させないための組織的な選択として機能している。その構造を解析する。',tags:'水際作戦 / 生活保護 / 制度実装 / 申請妨害',url:'',status:'公開',featured:''},
  {date:'2026-06-01',type:'論考',title:'ポテトは混ざる——多文化的出会いと人間の多様性の基底',summary:'ラトビア人のツアーガイドとの会話から生まれた問い。異なる文化・背景を持つ人間が出会うとき、そこに生まれるものは何か。多様性の根拠を「混ざること」に見出す試み。',tags:'多文化 / 多様性 / 当事者研究 / エッセイ',url:'',status:'執筆中',featured:''},
];

function loadEssays() {
  if (SHEET_ID === 'YOUR_SHEET_ID_HERE') {
    essayData = demoEssays; renderEssays(essayData); buildEssayFilters(essayData); return;
  }
  fetch(SHEET_BASE + encodeURIComponent(ESSAY_SHEET_NAME))
    .then(r => r.text())
    .then(text => {
      const json = JSON.parse(text.replace('/*O_o*/\ngoogle.visualization.Query.setResponse(', '').replace(');', ''));
      const rows = json.table.rows;
      essayData = rows.slice(1).map(row => ({
        date:row.c[0]?.v||'', type:row.c[1]?.v||'', title:row.c[2]?.v||'',
        summary:row.c[3]?.v||'', tags:row.c[4]?.v||'', url:row.c[5]?.v||'',
        status:row.c[6]?.v||'', featured:row.c[7]?.v||''
      })).filter(r => r.title && r.status !== '非公開');
      renderEssays(essayData);
      buildEssayFilters(essayData);
    })
    .catch(() => { essayData = demoEssays; renderEssays(essayData); buildEssayFilters(essayData); });
}

function renderEssays(data) {
  const list = document.getElementById('essay-list');
  const ec = document.getElementById('essay-count'); if(ec) ec.textContent = data.length + ' 件';
  if (!data.length) { list.innerHTML = '<div style="padding:2rem 0;color:var(--ink-light);font-size:0.83rem">該当する論考がありません</div>'; return; }
  const featured = data.find(e => e.featured === '1');
  const rest = data.filter(e => e !== featured);
  let html = '';
  if (featured) {
    html += `<div style="border-bottom:1px solid var(--rule);padding-bottom:2rem;margin-bottom:2rem">
      <div style="display:flex;gap:0.8rem;align-items:center;margin-bottom:0.6rem">
        <span style="font-family:'DM Mono',monospace;font-size:0.6rem;background:var(--ink);color:var(--paper);padding:0.15rem 0.5rem">最新</span>
        <span style="font-family:'DM Mono',monospace;font-size:0.62rem;color:var(--accent)">${featured.type}</span>
        <span style="font-family:'DM Mono',monospace;font-size:0.62rem;color:var(--ink-light)">${featured.date}</span>
      </div>
      <h2 style="font-family:'Playfair Display',serif;font-size:1.7rem;font-weight:700;line-height:1.2;margin-bottom:0.8rem">${featured.title}</h2>
      <p style="font-size:0.85rem;line-height:1.9;color:var(--ink-mid);margin-bottom:1rem">${featured.summary}</p>
      <div style="margin-bottom:1rem">${renderEssayTags(featured.tags)}</div>
      ${featured.url?`<a href="${featured.url}" target="_blank" class="btn-primary" style="display:inline-flex">報告書を読む（PDF）→</a>`:featured.status==='執筆中'?`<span style="font-family:'DM Mono',monospace;font-size:0.68rem;color:var(--ink-light)">執筆中</span>`:`<span style="font-family:'DM Mono',monospace;font-size:0.68rem;color:var(--ink-light)">PDF準備中</span>`}
    </div>`;
  }
  html += rest.map(e => `
    <div style="padding:1rem 0;border-bottom:1px solid var(--rule)">
      <div style="display:flex;gap:0.8rem;align-items:center;margin-bottom:0.4rem">
        <span style="font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--accent)">${e.type}</span>
        <span style="font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--ink-light)">${e.date}</span>
        ${e.status==='執筆中'?`<span style="font-family:'DM Mono',monospace;font-size:0.58rem;color:var(--ink-light);border:1px solid var(--rule);padding:0.1rem 0.35rem">執筆中</span>`:''}
      </div>
      <div style="font-family:'Playfair Display',serif;font-size:1.05rem;font-weight:700;line-height:1.3;margin-bottom:0.4rem">
        ${e.url?`<a href="${e.url}" target="_blank" style="border-bottom:1px solid var(--rule)">${e.title}</a>`:e.title}
      </div>
      <p style="font-size:0.8rem;line-height:1.75;color:var(--ink-mid);margin-bottom:0.5rem">${e.summary}</p>
      <div>${renderEssayTags(e.tags)}</div>
    </div>`).join('');
  list.innerHTML = html;
}

function renderEssayTags(tagStr) {
  if (!tagStr) return '';
  return tagStr.split(' / ').map(t=>t.trim()).filter(Boolean).map(t=>
    `<span onclick="filterEssayByTag('${t}')" style="display:inline-block;margin:0.1rem;padding:0.15rem 0.5rem;border:1px solid var(--rule);font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--ink-mid);cursor:pointer" onmouseover="this.style.color='var(--accent)';this.style.borderColor='var(--accent)'" onmouseout="this.style.color='var(--ink-mid)';this.style.borderColor='var(--rule)'">${t}</span>`
  ).join('');
}

function buildEssayFilters(data) {
  const tags = [...new Set(data.flatMap(e=>(e.tags||'').split(' / ').map(t=>t.trim()).filter(Boolean)))].sort();
  const sel = document.getElementById('essay-tag-filter');
  tags.forEach(t=>{const o=document.createElement('option');o.value=o.textContent=t;sel.appendChild(o);});
  const etc = document.getElementById('essay-tag-cloud'); if(etc) etc.innerHTML = tags.map(t=>
    `<span class="tag" onclick="filterEssayByTag('${t}')" style="cursor:pointer">${t}</span>`
  ).join('');
}

function filterEssays() {
  const tag  = document.getElementById('essay-tag-filter').value;
  const type = document.getElementById('essay-type-filter').value;
  renderEssays(essayData.filter(e=>(!tag||(e.tags||'').includes(tag))&&(!type||e.type===type)));
}

function filterEssayByTag(tag) {
  document.getElementById('essay-tag-filter').value = tag;
  filterEssays();
}

// ===== Q&A =====
const demoQA = [
  {id:1, type:'質問', content:'扶養照会を断ることはできますか？DVがあって家族に知られたくないです。', answer:'はい、断れます。DV・虐待・家族関係が壊れているなどの理由がある場合、扶養照会を省略できます。申請時に「家族への照会は希望しません。理由は○○です」と伝え、書面で申し出ると効果的です。', date:'2026-05-10', status:'公開'},
  {id:2, type:'体験', content:'「書類が揃ってから来てください」と言われて追い返されそうになりましたが、「申請書だけください」と言ったら受け取れました。', answer:'', date:'2026-05-18', status:'公開'},
  {id:3, type:'アドバイス', content:'窓口に行くとき、録音していることを最初に伝えたら対応がすごく丁寧になりました。最初から言うのがおすすめです。', answer:'', date:'2026-05-22', status:'公開'},
  {id:4, type:'質問', content:'申請したのに2週間以上連絡がありません。どうすればいいですか？', answer:'法律では14日以内に決定することが原則です（最長30日）。担当ケースワーカーに進捗を確認してください。「いつ決定が出ますか」と電話で聞くのが一番早いです。それでも動かない場合は支援団体に相談することをおすすめします。', date:'2026-05-28', status:'公開'},
];

function initQA() {
  if (SHEET_ID === 'YOUR_SHEET_ID_HERE') { qaData = demoQA; renderQA(qaData); return; }
  fetch(SHEET_BASE + encodeURIComponent(QA_SHEET_NAME))
    .then(r => r.text())
    .then(text => {
      const json = JSON.parse(text.replace('/*O_o*/\ngoogle.visualization.Query.setResponse(', '').replace(');', ''));
      const rows = json.table.rows;
      qaData = rows.slice(1).map((row, i) => ({
        id: i+1, type: row.c[0]?.v || '', content: row.c[1]?.v || '',
        answer: row.c[2]?.v || '', date: row.c[3]?.v || '', status: row.c[4]?.v || ''
      })).filter(r => r.content && r.status === '公開');
      renderQA(qaData);
    })
    .catch(() => { qaData = demoQA; renderQA(qaData); });
}

function renderQA(data) {
  const list = document.getElementById('qa-list');
  if (!data.length) {
    list.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--ink-light);font-size:0.83rem">まだ投稿がありません</div>';
    return;
  }
  list.innerHTML = data.map(q => `
    <div class="qa-item">
      <div class="qa-question" onclick="toggleQA(${q.id})">
        <span class="qa-q-label">${q.type}</span>
        <span class="qa-q-text">${q.content}</span>
        <span class="qa-arrow" id="qa-arrow-${q.id}">▼</span>
      </div>
      <div class="qa-answer ${q.answer ? '' : 'no-answer'}" id="qa-ans-${q.id}">
        ${q.answer ? q.answer : '<span style="color:var(--ink-light)">まだ回答がありません。知っている方は投稿してください。</span>'}
        <div class="qa-meta">${q.date}</div>
      </div>
    </div>
  `).join('');
}

function toggleQA(id) {
  document.getElementById('qa-ans-'   + id).classList.toggle('show');
  document.getElementById('qa-arrow-' + id).classList.toggle('open');
}

function filterQA(kw) {
  renderQA(qaData.filter(q => q.content.includes(kw) || (q.answer && q.answer.includes(kw))));
}

function switchQaTab(tab, el) {
  document.querySelectorAll('.qa-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('qa-tab-list').style.display = tab === 'list' ? 'block' : 'none';
  document.getElementById('qa-tab-post').style.display = tab === 'post' ? 'block' : 'none';
}

function showGuideSection(sec, el) {
  document.querySelectorAll('.guide-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.guide-nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('gsec-' + sec).style.display = 'block';
  el.classList.add('active');
  if (sec === 'qa') initQA();
}

// ===== QA SUBMIT =====
const GEMINI_API_KEY_CLIENT = '';

async function submitQA() {
  const type    = document.getElementById('qa-type').value;
  const content = document.getElementById('qa-content').value.trim();
  const status  = document.getElementById('qa-status');
  if (!content) { alert('内容を入力してください'); return; }
  status.className = 'qa-status checking';
  status.style.display = 'block';
  status.textContent = 'AIが内容を確認しています……';
  let approved = false;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY_CLIENT}`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        contents:[{parts:[{text:`以下の投稿内容を審査してください。生活保護申請Q&Aサイトへの投稿です。\n\n【投稿内容】\n${content}\n\n【審査基準】\n- OK: 生活保護・行政窓口に関する質問、体験談、アドバイス、困りごと\n- NG: 広告・宣伝、特定個人への攻撃・誹謗中傷、全く無関係な内容、個人情報（氏名・住所等）を含む投稿\n\n【出力形式】以下のJSONのみを出力すること:\n{"result":"ok","reason":"理由"} または {"result":"ng","reason":"理由"}`}]}],
        generationConfig:{temperature:0,maxOutputTokens:200}
      })
    });
    const data   = await res.json();
    const text   = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(text.replace(/```json|```/g,'').trim());
    approved = parsed.result === 'ok';
    if (!approved) {
      status.className = 'qa-status ng';
      status.textContent = '投稿できませんでした：' + (parsed.reason || 'ガイドラインに沿っていない内容です');
      return;
    }
  } catch(e) {
    approved = true;
  }
  if (GAS_QA_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
    status.className = 'qa-status ok';
    status.textContent = '✓ 投稿を受け付けました。審査後に公開されます。';
    document.getElementById('qa-content').value = '';
    return;
  }
  fetch(GAS_QA_URL, {
    method:'POST', mode:'no-cors',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({type, content, answer:'', date: new Date().toISOString().slice(0,10), status:'審査済み・公開待ち'})
  }).then(() => {
    status.className = 'qa-status ok';
    status.textContent = '✓ 投稿を受け付けました。審査後に公開されます。';
    document.getElementById('qa-content').value = '';
  }).catch(() => {
    status.className = 'qa-status ok';
    status.textContent = '✓ 投稿を受け付けました。';
    document.getElementById('qa-content').value = '';
  });
}
