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
function loadDB() {
  console.log('DB読み込み開始（GAS API）:', GAS_API_URL);
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
        severity:       row['重要度'] || '中',
        structure_note: row['構造メモ'] || '',
        collected_at:   row['収録日時'] || '',
        old_flag:       row['古い記事'] || '', // 「古い記事候補」が入っていればアーカイブ扱い
        karte_id:       row['カルテID'] || '', // 正式紐付けキー（URL逆引き不使用）
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
      renderHomeNews(dbData.filter(r => !r.old_flag).slice(0, 5));
      buildFilters(dbData);
      updateTicker(dbData);
      renderHomeTagCloud(dbData);
      checkKarteLinkage();
    })
    .catch(err => {
      console.error('DB読み込みエラー:', err.message);
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
  renderHomeNews(dbData.filter(r => !r.old_flag).slice(0, 5));
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

  // ===== 古い記事候補は通常の新着一覧からは分離する（削除はしない） =====
  // 「古い記事」列に値（例：「古い記事候補」）が入っている行はアーカイブ扱い。
  // チェックボックス #db-show-old がオンの場合のみ表示に含める。
  const showOld = document.getElementById('db-show-old')?.checked || false;
  const oldCount = data.filter(r => r.old_flag).length;
  const visibleData = showOld ? data : data.filter(r => !r.old_flag);

  const oldCountLabel = document.getElementById('db-old-count-label');
  if (oldCountLabel) {
    oldCountLabel.textContent = oldCount > 0
      ? `（過去記事 ${oldCount}件を${showOld ? '表示中' : '非表示中'}）`
      : '';
  }

  if (!visibleData.length) {
    container.innerHTML = '<div class="db-empty">該当するデータがありません</div>';
    const cl0 = document.getElementById('db-count-label');
    if (cl0) cl0.textContent = '';
    return;
  }

  const cl = document.getElementById('db-count-label');
  if (cl) cl.textContent = visibleData.length + ' 件表示中' + (!showOld && oldCount > 0 ? `（過去記事${oldCount}件は除く）` : '');

  container.innerHTML = visibleData.map((r, idx) => {
    const eventTags  = splitTags(r.tags_event);
    const structTags = splitTags(r.tags_structure);
    const evidTags   = splitTags(r.tags_evidence);
    const statusTags = splitTags(r.tags_status);
    const sev = r.severity === '高' ? `<span class="db-card-sev-high">高</span>` :
                r.severity === '中' ? `<span class="db-card-sev-mid">中</span>` : '';
    const hasAnyTag = eventTags.length || structTags.length || evidTags.length || statusTags.length;
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

    return `<div class="db-card${r.old_flag ? ' db-card-old' : ''}" id="${cardId}">
      <div class="db-card-top">
        <span class="db-card-date">${r.date}</span>
        ${r.old_flag ? `<span class="db-card-old-badge" title="収集はされましたが、公開日が古い記事です">過去記事</span>` : ''}
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
  const liveData = data.filter(r => !r.old_flag);
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
