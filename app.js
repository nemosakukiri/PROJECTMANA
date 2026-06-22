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
let _routeHandled = false; // 初回ルーティング済みフラグ

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hdate').textContent = new Date().toLocaleDateString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit'}).replace(/\//g,'.');
  loadKartes();
  loadDB();
  loadSurveyVoices();
  window.addEventListener('hashchange', handleHashRoute);
  handleHashRoute();
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
  if (name === 'essays') loadEssays();
  if (name === 'karte') loadKartes();
  if (name === 'windows') renderWindowsPage();
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

      </div>
    </div>
  </div>`;
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
