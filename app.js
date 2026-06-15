// ===== CONFIG =====
// スプレッドシートのURLをここに設定
// 公開したスプレッドシートのIDを入れる
const SHEET_ID = '1xVWTPun5X0sW7qlx-XolbX1-mdZjdtVNJ7CTqWJhc3A';
const DB_SHEET_NAME = 'kansokuDB';
const SURVEY_SHEET_NAME = '市民の声';
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxiZEEce69vsneiNs064iQ5MAJtmB4Jjgm9EoxZj29LZ-kJ18EICndUuZ_poU47gmwJsA/exec';
const SHEET_BASE = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=`;

// ===== STATE =====
let dbData = [];
let surveyData = [];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hdate').textContent = new Date().toLocaleDateString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit'}).replace(/\//g,'.');
  loadKartes(); // カルテを先に読み込む（DB表示時にURL照合できるよう）
  loadDB();
  loadSurveyVoices();

  // ハッシュルーティング（直URL対応）
  window.addEventListener('hashchange', handleHashRoute);
  handleHashRoute();
});

// ===== PAGE NAVIGATION =====
function showPage(name, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  if (navEl) navEl.classList.add('active');
  window.scrollTo(0, 0);
  if (name === 'essays') loadEssays();
  if (name === 'karte') loadKartes();
  // ハッシュルーティングページ以外に移動した場合はURLハッシュをクリア
  if (!['kartedetail','tags','tagdetail'].includes(name) && /^#\//.test(location.hash)) {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

// ===== ハッシュルーティング =====
// /#/tags         → タグ一覧
// /#/tag/タグ名   → タグ別カルテ一覧
// /#/karte/ID     → 独立カルテページ（既存）
function handleHashRoute() {
  const hash = location.hash;

  if (hash === '#/tags') {
    _activatePage('page-tags', 'タグから探す');
    renderTagIndex();
    return;
  }

  const tagMatch = hash.match(/^#\/tag\/(.+)$/);
  if (tagMatch) {
    const tagName = decodeURIComponent(tagMatch[1]);
    _activatePage('page-tagdetail', 'タグから探す');
    renderTagPage(tagName);
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

// ページ切替の共通処理（ハッシュルーティング用）
function _activatePage(pageId, navLabel) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  document.querySelectorAll('nav a').forEach(a => {
    if (a.textContent.trim() === navLabel) a.classList.add('active');
  });
  window.scrollTo(0, 0);
}

// 独立カルテページへ遷移する（観測DBの「カルテを見る」ボタンから使用）
function goToKartePage(karteId) {
  location.hash = '#/karte/' + encodeURIComponent(karteId);
}

// ===== タグ一覧ページ描画 /#/tags =====
function renderTagIndex() {
  const container = document.getElementById('page-tags');
  if (!container) return;
  if (!karteData.length) {
    container.innerHTML = '<div class="karte-detail-loading">読み込み中……</div>';
    setTimeout(renderTagIndex, 300);
    return;
  }

  const axes = [
    { key: 'tags_field',        label: '何の制度に関係していますか？' },
    { key: 'tags_target',       label: 'あなた（または家族）の状況は？' },
    { key: 'tags_actor',        label: 'どの機関・誰が関わっていますか？' },
    { key: 'tags_event_search', label: '何をされましたか？' },
  ];

  const axesHtml = axes.map(axis => {
    const counts = {};
    karteData.forEach(k => {
      splitKarteTags(k[axis.key] || '').forEach(tag => {
        if (tag) counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    const tags = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
    if (!tags.length) return '';
    return `<div style="margin-bottom:2rem">
      <div class="section-label" style="margin-bottom:0.8rem">${axis.label}</div>
      <div style="display:flex;flex-wrap:wrap;gap:0.4rem">
        ${tags.map(([tag, count]) =>
          `<a href="#/tag/${encodeURIComponent(tag)}" class="tag-explore-btn">
            ${tag}<span style="font-size:0.6rem;opacity:0.5;margin-left:0.3rem">(${count})</span>
          </a>`
        ).join('')}
      </div>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="karte-detail-header">
      <div class="page-title">タグから探す</div>
      <div class="page-subtitle">自分の状況に近いタグをクリックしてください</div>
    </div>
    <div style="padding:1.5rem 0">${axesHtml}</div>`;
}

// ===== タグ別カルテ一覧ページ描画 /#/tag/タグ名 =====
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
    'tags_event', 'tags_structure', 'tags_status', 'tags_evidence'
  ];
  const matched = karteData.filter(k =>
    allTagFields.some(f => splitKarteTags(k[f] || '').includes(tagName))
  );

  const backLink = `<a href="#/tags" class="karte-detail-back">← タグ一覧へ</a>`;

  const cards = matched.map(k => {
    const urls = k.related_urls ? k.related_urls.split('\n').filter(Boolean) : [];
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
        ${structTags.map(t=>`<span class="db-tag-s">${t}</span>`).join('')}
        ${eventTags.map(t =>`<span class="db-tag-e">${t}</span>`).join('')}
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

// ===== 観測DB × カルテ 紐付け状況の確認（事実の集計のみ・推測なし）=====
function checkKarteLinkage() {
  if (!dbData.length || !karteData.length) return;

  // 1. 観測DBの記事URL数（空URLは除く）
  const dbUrls = dbData.map(r => r.url).filter(Boolean);

  // 2. カルテのrelated_urls内URL数（全カルテ分の合計、重複含む）
  const karteUrls = karteData.flatMap(k =>
    k.related_urls ? k.related_urls.split('\n').map(u => u.trim()).filter(Boolean) : []
  );

  // 3 & 4. URL一致／不一致
  const matched = [];
  const unmatched = [];
  dbData.forEach(r => {
    if (!r.url) { unmatched.push(r); return; }
    const k = findKarteByUrl(r.url);
    if (k) matched.push(r); else unmatched.push(r);
  });

  // 5. related_urlsが空のカルテ
  const emptyRelatedKartes = karteData.filter(k => !k.related_urls || !k.related_urls.trim());

  console.log('===== カルテ紐付け状況（事実集計） =====');
  console.log('1. 観測DBの記事URL数:', dbUrls.length);
  console.log('2. カルテ related_urls 内URL数（延べ）:', karteUrls.length);
  console.log('3. URL一致している記事数:', matched.length);
  console.log('4. URL一致していない記事一覧（' + unmatched.length + '件）:');
  unmatched.forEach(r => console.log('   -', r.date, r.title, '|', r.url || '(URLなし)'));
  console.log('5. related_urlsが空のカルテ一覧（' + emptyRelatedKartes.length + '件）:');
  emptyRelatedKartes.forEach(k => console.log('   -', k.id, k.title));
  console.log('=========================================');
}

*{margin:0;padding:0;box-sizing:border-box}
:root{
  --ink:#0f0e0d;
  --ink-mid:#4a4845;
  --ink-light:#9a9690;
  --paper:#faf9f6;
  --paper-warm:#f3f1ec;
  --rule:#e0ddd6;
  --accent:#123a6f;
  --accent-pale:#eef3fa;
}
body{font-family:'Noto Sans JP',sans-serif;background:var(--paper);color:var(--ink);min-height:100vh}
a{color:inherit;text-decoration:none}

/* HEADER */
header{border-bottom:3px solid var(--ink);padding:0 2rem;position:sticky;top:0;background:var(--paper);z-index:100}
.header-top{display:flex;align-items:baseline;justify-content:space-between;padding:1rem 0 0.5rem}
.site-name{font-family:'Playfair Display',serif;font-size:2rem;font-weight:900;letter-spacing:-0.02em}
.site-name span{color:var(--accent)}
.tagline{font-size:0.65rem;font-weight:300;color:var(--ink-mid);letter-spacing:0.1em}
.header-meta{display:flex;gap:2rem;align-items:center}
.header-date{font-family:'DM Mono',monospace;font-size:0.68rem;color:var(--ink-mid)}
nav a{font-size:0.7rem;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;border-bottom:1.5px solid transparent;padding-bottom:1px;transition:all 0.15s;margin-left:1.5rem}
nav a:hover,nav a.active{border-color:var(--accent);color:var(--accent)}
.ticker{background:var(--ink);color:var(--paper);padding:0.3rem 2rem;font-family:'DM Mono',monospace;font-size:0.65rem;display:flex;gap:1rem;overflow:hidden}
.ticker-label{color:var(--accent);font-weight:500;flex-shrink:0}
@keyframes scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.ticker-inner{display:inline-flex;gap:3rem;animation:scroll 25s linear infinite;white-space:nowrap}

/* PAGES */
.page{display:none;padding:0 2rem 3rem}
.page.active{display:block}

/* HOME */
.hero{border-bottom:1px solid var(--rule);padding:2rem 0}
.hero-grid{display:grid;grid-template-columns:1fr 1fr;gap:3rem}
.hero-kicker{font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--accent);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:0.6rem}
.hero-headline{font-family:'Playfair Display',serif;font-size:2.3rem;font-weight:700;line-height:1.15;letter-spacing:-0.02em;margin-bottom:1rem}
.hero-body{font-size:0.88rem;line-height:1.9;color:var(--ink-mid);margin-bottom:1.4rem}
.btn-primary{display:inline-flex;align-items:center;gap:0.4rem;background:var(--ink);color:var(--paper);font-size:0.72rem;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;padding:0.65rem 1.4rem;cursor:pointer;border:none;transition:background 0.15s;font-family:'Noto Sans JP',sans-serif}
.btn-primary:hover{background:var(--accent)}
.btn-outline{display:inline-flex;align-items:center;gap:0.4rem;background:transparent;color:var(--ink);font-size:0.72rem;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;padding:0.6rem 1.2rem;cursor:pointer;border:1.5px solid var(--ink);transition:all 0.15s;font-family:'Noto Sans JP',sans-serif}
.btn-outline:hover{background:var(--ink);color:var(--paper)}

.stats-col{border-left:1px solid var(--rule);padding-left:3rem;display:flex;flex-direction:column;gap:0}
.stat-card{padding:1.1rem 0;border-bottom:1px solid var(--rule)}
.stat-card:last-child{border-bottom:none}
.stat-num{font-family:'Playfair Display',serif;font-size:2.6rem;font-weight:900;line-height:1}
.stat-num sup{font-size:0.9rem;color:var(--accent)}
.stat-label{font-size:0.7rem;color:var(--ink-mid);font-weight:300;margin-top:0.2rem}
.stat-change{font-family:'DM Mono',monospace;font-size:0.62rem;color:var(--accent);margin-top:0.25rem}

.pillars{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--rule)}
.pillar{padding:1.8rem 0;cursor:pointer}
.pillar:not(:last-child){border-right:1px solid var(--rule);padding-right:2rem}
.pillar:not(:first-child){padding-left:2rem}
.pillar:hover .pillar-title{color:var(--accent)}
.pillar-num{font-family:'DM Mono',monospace;font-size:0.62rem;color:var(--ink-light);margin-bottom:0.6rem}
.pillar-badge{display:inline-block;background:var(--accent);color:white;font-family:'DM Mono',monospace;font-size:0.55rem;letter-spacing:0.08em;padding:0.12rem 0.4rem;margin-bottom:0.5rem}
.pillar-title{font-family:'Playfair Display',serif;font-size:1.2rem;font-weight:700;margin-bottom:0.5rem;line-height:1.2;transition:color 0.15s}
.pillar-desc{font-size:0.78rem;line-height:1.7;color:var(--ink-mid)}
.pillar-link{display:inline-flex;align-items:center;gap:0.3rem;font-size:0.7rem;font-weight:500;color:var(--accent);margin-top:0.8rem;border-bottom:1px solid var(--accent);padding-bottom:1px}

.home-bottom{display:grid;grid-template-columns:2fr 1fr;gap:3rem;padding:2rem 0}
.section-label{font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--ink-light);letter-spacing:0.1em;text-transform:uppercase;border-top:3px solid var(--ink);padding-top:0.5rem;margin-bottom:1rem}
.section-label.red{border-top-color:var(--accent)}
.section-label.navy{border-top-color:var(--accent)}
.news-item{display:grid;grid-template-columns:1.5rem 1fr;gap:0.8rem;padding:0.85rem 0;border-bottom:1px solid var(--rule)}
.news-item:last-child{border-bottom:none}
.news-num{font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--ink-light);padding-top:0.1rem}
.news-pref{font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--accent);margin-bottom:0.15rem}
.news-title{font-size:0.83rem;font-weight:500;line-height:1.4;margin-bottom:0.25rem}
.news-meta{font-size:0.65rem;color:var(--ink-light)}

.voice-panel{background:var(--paper-warm);border:1px solid var(--rule);padding:1.2rem}
.voice-item{padding:0.65rem 0;border-bottom:1px solid var(--rule);font-size:0.77rem;line-height:1.65;color:var(--ink-mid)}
.voice-item:last-child{border-bottom:none}
.voice-pref{font-family:'DM Mono',monospace;font-size:0.58rem;color:var(--accent);display:block;margin-bottom:0.15rem}

.db-card-similar{display:none;margin-top:0.8rem;padding:0.8rem;background:var(--paper-warm);border-left:3px solid var(--accent)}
.db-card-similar.open{display:block}
.db-similar-label{font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--ink-light);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.5rem}
.db-similar-tags{display:flex;flex-wrap:wrap;gap:0.25rem;margin-bottom:0.6rem}
.db-similar-tag{font-family:'DM Mono',monospace;font-size:0.6rem;padding:0.1rem 0.4rem;background:#e6f1fb;border:1px solid #85b7eb;color:#0c447c}
.db-similar-score{font-family:'DM Mono',monospace;font-size:0.65rem;margin-bottom:0.6rem}
.db-similar-score.score-1{color:var(--ink-mid)}
.db-similar-score.score-2{color:#7a4a10}
.db-similar-score.score-3{color:var(--accent);font-weight:500}
.db-similar-cases{display:flex;flex-direction:column;gap:0.3rem}
.db-similar-case{font-size:0.75rem;color:var(--ink-mid);padding:0.3rem 0;border-bottom:1px solid var(--rule);line-height:1.4}
.db-similar-case:last-child{border-bottom:none}
.db-similar-case-region{font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--accent);margin-right:0.4rem}
.db-similar-btn{font-family:'DM Mono',monospace;font-size:0.6rem;padding:0.15rem 0.5rem;border:1px solid var(--rule);background:transparent;color:var(--ink-mid);cursor:pointer;margin-top:0.4rem;transition:all 0.12s}
.db-similar-btn:hover{border-color:var(--accent);color:var(--accent)}
.db-similar-btn.active{border-color:var(--accent);color:var(--accent);background:#eef3fa}

/* DB PAGE */
.db-header{padding:2rem 0 1rem;border-bottom:1px solid var(--rule)}
.page-title{font-family:'Playfair Display',serif;font-size:2rem;font-weight:700;margin-bottom:0.4rem}
.page-subtitle{font-size:0.82rem;color:var(--ink-mid)}
.db-filter-toggle{display:none;width:100%;margin:1rem 0 0;font-family:'Noto Sans JP',sans-serif;font-size:0.82rem;font-weight:500;padding:0.65rem 1rem;border:1px solid var(--rule);background:var(--paper);color:var(--ink);cursor:pointer;text-align:left}
.db-layout{display:grid;grid-template-columns:210px 1fr;gap:2.5rem;padding:1.5rem 0;align-items:start}
.db-sidebar{position:sticky;top:90px}
.db-filter-block{margin-bottom:1.2rem}
.db-filter-label{font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--ink-light);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.4rem;border-top:1px solid var(--rule);padding-top:0.5rem}
.db-sidebar input,.db-sidebar select{width:100%;font-family:'Noto Sans JP',sans-serif;font-size:0.78rem;padding:0.45rem 0.6rem;border:1px solid var(--rule);background:var(--paper);color:var(--ink);outline:none}
.db-sidebar input:focus,.db-sidebar select:focus{border-color:var(--accent)}
.db-tag-filter{display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.3rem}
.db-tag-btn{font-family:'DM Mono',monospace;font-size:0.58rem;padding:0.15rem 0.4rem;border:1px solid var(--rule);background:transparent;color:var(--ink-mid);cursor:pointer;transition:all 0.12s}
.db-tag-btn:hover{border-color:var(--accent);color:var(--accent)}
.db-tag-btn.active{background:var(--accent);border-color:var(--accent);color:#fff}
.db-filter-reset{width:100%;margin-top:1rem;font-family:'Noto Sans JP',sans-serif;font-size:0.7rem;padding:0.5rem;border:1px solid var(--rule);background:transparent;color:var(--ink-mid);cursor:pointer;transition:all 0.12s}
.db-filter-reset:hover{border-color:var(--ink);color:var(--ink)}
.db-count{font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--ink-light);padding:0 0 0.8rem;border-bottom:2px solid var(--ink);margin-bottom:1rem}
.db-card{padding:1rem 0;border-bottom:1px solid var(--rule)}
.db-card:hover{background:var(--paper-warm);margin:0 -0.5rem;padding:1rem 0.5rem}
.db-card-top{display:flex;gap:0.6rem;align-items:center;margin-bottom:0.35rem;flex-wrap:wrap}
.db-card-date{font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--ink-light)}
.db-card-region{font-family:'DM Mono',monospace;font-size:0.62rem;color:var(--accent);font-weight:500}
.db-card-field{font-size:0.62rem;padding:0.08rem 0.35rem;background:var(--paper-warm);border:1px solid var(--rule);color:var(--ink-mid)}
.db-card-sev-high{font-family:'DM Mono',monospace;font-size:0.58rem;color:#8b2020;background:#fdf0f0;border:1px solid #e8a0a0;padding:0.08rem 0.3rem}
.db-card-sev-mid{font-family:'DM Mono',monospace;font-size:0.58rem;color:#633806;background:#faeeda;border:1px solid #ef9f27;padding:0.08rem 0.3rem}
.db-card-title{font-size:0.88rem;font-weight:500;line-height:1.4;margin-bottom:0.35rem}
.db-card-title a{color:var(--ink);border-bottom:1px solid var(--rule)}
.db-card-title a:hover{color:var(--accent);border-color:var(--accent)}
.db-card-summary{font-size:0.77rem;color:var(--ink-mid);line-height:1.65;margin-bottom:0.45rem}
.db-card-tags{display:flex;flex-wrap:wrap;gap:0.22rem}
.db-tag-e{font-family:'DM Mono',monospace;font-size:0.57rem;padding:0.08rem 0.32rem;background:#fdf0f0;border:1px solid #e8a0a0;color:#8b2020;cursor:pointer}
.db-tag-s{font-family:'DM Mono',monospace;font-size:0.57rem;padding:0.08rem 0.32rem;background:#e6f1fb;border:1px solid #85b7eb;color:#0c447c;cursor:pointer}
.db-tag-v{font-family:'DM Mono',monospace;font-size:0.57rem;padding:0.08rem 0.32rem;background:#eaf3de;border:1px solid #97c459;color:#27500a;cursor:pointer}
.db-tag-t{font-family:'DM Mono',monospace;font-size:0.57rem;padding:0.08rem 0.32rem;background:#faeeda;border:1px solid #ef9f27;color:#633806;cursor:pointer}
.db-card-karte-btn{display:inline-flex;align-items:center;gap:0.3rem;font-family:'DM Mono',monospace;font-size:0.6rem;padding:0.18rem 0.5rem;border:1px solid var(--accent);color:var(--accent);background:transparent;cursor:pointer;transition:all 0.12s;margin-top:0.4rem}
.db-card-karte-btn:hover{background:var(--accent);color:#fff}
.db-card-karte-badge{font-family:'DM Mono',monospace;font-size:0.55rem;padding:0.1rem 0.35rem;background:var(--accent);color:#fff;letter-spacing:0.04em}
.pref-tag{font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--accent)}

/* SURVEY PAGE */
.survey-header{padding:2rem 0 1.5rem;border-bottom:1px solid var(--rule)}
.survey-intro{font-size:0.85rem;line-height:1.9;color:var(--ink-mid);max-width:600px;margin-top:0.8rem}
.survey-form{max-width:640px;padding:2rem 0}
.field{margin-bottom:1.8rem}
.field label{display:block;font-size:0.78rem;font-weight:500;margin-bottom:0.5rem;letter-spacing:0.03em}
.field-note{font-size:0.68rem;color:var(--ink-light);margin-top:0.25rem}
.field input,.field select,.field textarea{width:100%;font-family:'Noto Sans JP',sans-serif;font-size:0.85rem;padding:0.7rem 0.9rem;border:1px solid var(--rule);background:var(--paper);color:var(--ink);outline:none;transition:border-color 0.15s}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--ink)}
.field textarea{resize:vertical;line-height:1.7}
.radio-group{display:flex;flex-direction:column;gap:0.5rem;margin-top:0.3rem}
.radio-item{display:flex;align-items:center;gap:0.6rem;font-size:0.82rem;cursor:pointer}
.radio-item input{width:auto;margin:0}
.survey-thanks{display:none;text-align:center;padding:3rem 0}
.survey-thanks h3{font-family:'Playfair Display',serif;font-size:1.6rem;margin-bottom:0.8rem}
.survey-thanks p{font-size:0.85rem;color:var(--ink-mid);line-height:1.8}

/* ESSAYS PAGE */
.essays-header{padding:2rem 0 1rem;border-bottom:1px solid var(--rule)}
.essays-grid{display:grid;grid-template-columns:2fr 1fr;gap:3rem;padding:2rem 0}
.essay-featured{border-bottom:1px solid var(--rule);padding-bottom:2rem;margin-bottom:2rem}
.essay-kicker{font-family:'DM Mono',monospace;font-size:0.62rem;color:var(--accent);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:0.5rem}
.essay-title{font-family:'Playfair Display',serif;font-size:1.7rem;font-weight:700;line-height:1.2;margin-bottom:0.8rem}
.essay-excerpt{font-size:0.83rem;line-height:1.85;color:var(--ink-mid);margin-bottom:1rem}
.essay-byline{font-family:'DM Mono',monospace;font-size:0.62rem;color:var(--ink-light)}
.essay-list-item{padding:1rem 0;border-bottom:1px solid var(--rule);cursor:pointer}
.essay-list-item:hover .essay-list-title{color:var(--accent)}
.essay-list-title{font-family:'Playfair Display',serif;font-size:1rem;font-weight:700;margin-bottom:0.3rem;transition:color 0.15s}
.essay-list-meta{font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--ink-light)}
.essay-sidebar{}
.sidebar-section{margin-bottom:2rem}
.sidebar-title{font-family:'DM Mono',monospace;font-size:0.62rem;color:var(--ink-light);letter-spacing:0.1em;text-transform:uppercase;border-top:2px solid var(--ink);padding-top:0.5rem;margin-bottom:0.8rem}
.tag-cloud{display:flex;flex-wrap:wrap;gap:0.4rem}
.tag{font-family:'DM Mono',monospace;font-size:0.62rem;padding:0.2rem 0.5rem;border:1px solid var(--rule);color:var(--ink-mid);cursor:pointer;transition:all 0.15s}
.tag:hover{border-color:var(--accent);color:var(--accent)}

footer{border-top:3px solid var(--ink);padding:1.2rem 2rem;display:flex;justify-content:space-between;align-items:center;margin-top:2rem}
.footer-name{font-family:'Playfair Display',serif;font-size:0.9rem;font-weight:700}
.footer-copy{font-size:0.62rem;color:var(--ink-light);font-family:'DM Mono',monospace}

/* GUIDE PAGE */
.guide-header{padding:2rem 0 1rem;border-bottom:1px solid var(--rule)}
.guide-layout{display:grid;grid-template-columns:220px 1fr;gap:3rem;padding:2rem 0;align-items:start}
.guide-nav{position:sticky;top:100px}
.guide-nav-item{display:block;font-size:0.78rem;padding:0.55rem 0;border-bottom:1px solid var(--rule);color:var(--ink-mid);cursor:pointer;transition:color 0.15s}
.guide-nav-item:hover,.guide-nav-item.active{color:var(--accent);font-weight:500}
.guide-nav-label{font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--ink-light);letter-spacing:0.1em;text-transform:uppercase;padding:0.8rem 0 0.4rem;margin-top:0.5rem}
.guide-content{}
.guide-section{margin-bottom:3rem;padding-bottom:3rem;border-bottom:1px solid var(--rule)}
.guide-section:last-child{border-bottom:none}
.guide-section-title{font-family:'Playfair Display',serif;font-size:1.5rem;font-weight:700;margin-bottom:1.2rem}
.guide-section-intro{font-size:0.85rem;line-height:1.9;color:var(--ink-mid);margin-bottom:1.5rem}
.step-list{display:flex;flex-direction:column;gap:1rem}
.step-item{display:grid;grid-template-columns:2.5rem 1fr;gap:1rem;background:var(--paper-warm);padding:1.2rem;border-left:3px solid var(--ink)}
.step-item.warning{border-left-color:var(--accent);background:var(--accent-pale,#fdf5f5)}
.step-num{font-family:'Playfair Display',serif;font-size:1.4rem;font-weight:900;color:var(--ink-light);line-height:1}
.step-body{}
.step-title{font-size:0.85rem;font-weight:700;margin-bottom:0.3rem}
.step-desc{font-size:0.8rem;line-height:1.75;color:var(--ink-mid)}
.tip-box{background:var(--paper-warm);border:1px solid var(--rule);border-left:3px solid var(--accent);padding:1rem 1.2rem;margin:1rem 0}
.tip-label{font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--accent);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:0.4rem}
.tip-text{font-size:0.82rem;line-height:1.75;color:var(--ink-mid)}
.phrase-list{display:flex;flex-direction:column;gap:0.6rem}
.phrase-item{background:var(--paper-warm);padding:0.8rem 1rem;border-left:2px solid var(--ink);font-size:0.83rem;line-height:1.6}
.phrase-bad{border-left-color:var(--ink-light);color:var(--ink-light);text-decoration:line-through}
.phrase-good{border-left-color:var(--accent);font-weight:500}
.contact-list{display:flex;flex-direction:column;gap:0.8rem}
.contact-item{padding:1rem;background:var(--paper-warm);border:1px solid var(--rule)}
.contact-name{font-weight:700;font-size:0.85rem;margin-bottom:0.2rem}
.contact-detail{font-size:0.78rem;color:var(--ink-mid);line-height:1.6}
.contact-tel{font-family:'DM Mono',monospace;font-size:0.8rem;color:var(--accent)}

/* QA */
.qa-tabs{display:flex;gap:0;border-bottom:2px solid var(--ink);margin-bottom:1.5rem}
.qa-tab{font-size:0.78rem;font-weight:500;padding:0.6rem 1.2rem;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all 0.15s;letter-spacing:0.03em}
.qa-tab.active{border-bottom-color:var(--accent);color:var(--accent)}
.qa-search{width:100%;font-family:'Noto Sans JP',sans-serif;font-size:0.85rem;padding:0.65rem 0.9rem;border:1px solid var(--rule);background:var(--paper);color:var(--ink);outline:none;margin-bottom:1rem}
.qa-search:focus{border-color:var(--ink)}
.qa-list{display:flex;flex-direction:column;gap:0}
.qa-item{border-bottom:1px solid var(--rule);overflow:hidden}
.qa-question{padding:1rem 0;cursor:pointer;display:flex;justify-content:space-between;align-items:start;gap:1rem}
.qa-question:hover .qa-q-text{color:var(--accent)}
.qa-q-label{font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--accent);flex-shrink:0;padding-top:0.15rem}
.qa-q-text{font-size:0.85rem;font-weight:500;line-height:1.4;flex:1}
.qa-arrow{font-size:0.7rem;color:var(--ink-light);flex-shrink:0;transition:transform 0.2s}
.qa-arrow.open{transform:rotate(180deg)}
.qa-answer{display:none;padding:0 0 1.2rem 2rem;font-size:0.82rem;line-height:1.85;color:var(--ink-mid)}
.qa-answer.show{display:block}
.qa-meta{font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--ink-light);margin-top:0.5rem}
.qa-post-btn{margin-top:1.5rem}
.qa-form{background:var(--paper-warm);border:1px solid var(--rule);padding:1.5rem;margin-top:1rem;display:none}
.qa-form.show{display:block}
.qa-form .field{margin-bottom:1.2rem}
.qa-form .field:last-child{margin-bottom:0}
.qa-status{font-size:0.78rem;padding:0.6rem;text-align:center;display:none}
.qa-status.checking{color:var(--ink-mid);background:var(--paper-warm);border:1px solid var(--rule)}
.qa-status.ok{color:#2d6a2d;background:#f0f7f0;border:1px solid #b8d8b8}
.qa-status.ng{color:var(--accent);background:#fdf0f0;border:1px solid #f0b8b8}
/* KARTE PAGE */
.karte-header{padding:2rem 0 1rem;border-bottom:1px solid var(--rule)}
.karte-layout{display:grid;grid-template-columns:200px 1fr;gap:2.5rem;padding:1.5rem 0;align-items:start}
.karte-sidebar{position:sticky;top:90px}
.karte-filter-block{margin-bottom:1.2rem}
.karte-filter-label{font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--ink-light);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.4rem;border-top:1px solid var(--rule);padding-top:0.5rem}
.karte-sidebar select{width:100%;font-family:'Noto Sans JP',sans-serif;font-size:0.78rem;padding:0.45rem 0.6rem;border:1px solid var(--rule);background:var(--paper);color:var(--ink);outline:none}
.karte-card{border:1px solid var(--rule);padding:1.4rem;margin-bottom:1rem;cursor:pointer;transition:border-color 0.15s}
.karte-card:hover{border-color:var(--accent)}
.karte-card-top{display:flex;gap:0.6rem;align-items:center;margin-bottom:0.6rem;flex-wrap:wrap}
.karte-card-id{font-family:'DM Mono',monospace;font-size:0.58rem;color:var(--ink-light)}
.karte-card-region{font-family:'DM Mono',monospace;font-size:0.62rem;color:var(--accent);font-weight:500}
.karte-card-field{font-size:0.62rem;padding:0.08rem 0.35rem;background:var(--paper-warm);border:1px solid var(--rule);color:var(--ink-mid)}
.karte-card-title{font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:700;line-height:1.3;margin-bottom:0.5rem}
.karte-card-summary{font-size:0.8rem;color:var(--ink-mid);line-height:1.75;margin-bottom:0.6rem}
.karte-card-progress{font-size:0.75rem;color:var(--ink-mid);border-left:2px solid var(--accent);padding-left:0.6rem;margin-bottom:0.6rem;font-style:italic}
.karte-card-tags{display:flex;flex-wrap:wrap;gap:0.22rem;margin-bottom:0.6rem}
.karte-card-footer{display:flex;justify-content:space-between;align-items:center;font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--ink-light)}
.karte-related{margin-top:0.5rem}
.karte-related-label{font-family:'DM Mono',monospace;font-size:0.58rem;color:var(--ink-light);margin-bottom:0.3rem}
.karte-related-link{display:block;font-size:0.72rem;color:var(--accent);border-bottom:1px solid var(--rule);padding:0.2rem 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* DETAIL MODAL */
.karte-modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;overflow-y:auto}
.karte-modal-overlay.show{display:flex;align-items:flex-start;justify-content:center;padding:2rem 1rem}
.karte-modal{background:var(--paper);max-width:720px;width:100%;padding:2rem;position:relative}
.karte-modal-close{position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--ink-mid)}
.karte-modal-id{font-family:'DM Mono',monospace;font-size:0.62rem;color:var(--accent);margin-bottom:0.5rem}
.karte-modal-title{font-family:'Playfair Display',serif;font-size:1.6rem;font-weight:700;line-height:1.2;margin-bottom:1rem}
.karte-modal-section{margin-bottom:1.2rem;border-top:1px solid var(--rule);padding-top:0.8rem}
.karte-modal-section-label{font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--ink-light);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.4rem}
.karte-modal-text{font-size:0.85rem;line-height:1.85;color:var(--ink-mid)}
.karte-modal-progress{font-size:0.82rem;border-left:2px solid var(--accent);padding-left:0.8rem;color:var(--ink-mid);font-style:italic}
.karte-related-cards{display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem}
.karte-related-card{padding:0.6rem 0.8rem;border:1px solid var(--rule);font-size:0.78rem;cursor:pointer}
.karte-related-card:hover{border-color:var(--accent);color:var(--accent)}

/* 独立カルテページ */
.karte-detail-header{padding:1.5rem 0 1rem;border-bottom:1px solid var(--rule)}
.karte-detail-back{display:inline-flex;align-items:center;gap:0.3rem;font-size:0.75rem;color:var(--ink-mid);cursor:pointer;margin-bottom:0.8rem}
.karte-detail-back:hover{color:var(--accent)}
.karte-detail-body{padding:1.5rem 0;max-width:720px}
.karte-detail-loading{padding:3rem 0;text-align:center;color:var(--ink-light);font-size:0.85rem}

@media (max-width: 768px) {

  /* 全体の横幅制限 */
  *{box-sizing:border-box}
  body{overflow-x:hidden}

  /* ヘッダー */
  header{padding:0 0.8rem}
  .header-top{flex-direction:column;gap:0.4rem;padding:0.7rem 0 0.4rem}
  .header-meta{flex-direction:column;gap:0.4rem;align-items:flex-start;width:100%}
  nav{display:flex;flex-wrap:wrap;gap:0.25rem;width:100%}
  nav a{margin-left:0;font-size:0.62rem;padding:0.2rem 0.5rem;border:1px solid var(--rule);border-radius:2px}
  .site-name{font-size:1.4rem}
  .tagline{font-size:0.58rem}
  .ticker{padding:0.28rem 0.8rem;font-size:0.58rem}

  /* ページ余白 */
  .page{padding:0 0.8rem 2rem}
  main{padding:0 0.8rem}

  /* ヒーロー */
  .hero-grid{grid-template-columns:1fr;gap:1.2rem}
  .stats-col{border-left:none;padding-left:0;border-top:1px solid var(--rule);padding-top:0.8rem;display:grid;grid-template-columns:repeat(3,1fr);gap:0}
  .stat-card{padding:0.6rem 0.4rem;border-bottom:none;border-right:1px solid var(--rule)}
  .stat-card:last-child{border-right:none}
  .stat-num{font-size:1.5rem}
  .hero-headline{font-size:1.45rem;line-height:1.2}
  .hero-body{font-size:0.82rem}

  /* 4本柱 */
  .pillars{grid-template-columns:1fr 1fr}
  .pillar{padding:1rem 0.7rem !important;border-right:none !important;border-bottom:1px solid var(--rule)}
  .pillar-title{font-size:0.95rem}
  .pillar-desc{font-size:0.72rem}

  /* ホーム下部 */
  .home-bottom{grid-template-columns:1fr;gap:1.2rem}

  /* 注目パターン・タグクラウド */
  div[style*="grid-template-columns:1fr 1fr"]{grid-template-columns:1fr !important}
  div[style*="border-left:1px solid var(--rule);"]{border-left:none !important;padding-left:0 !important;border-top:1px solid var(--rule);padding-top:1rem !important}

  /* ===== DBページ ===== */
  .db-filter-toggle{display:block}
  .db-layout{grid-template-columns:1fr !important;gap:0.8rem}
  .db-sidebar{
    position:static !important;
    display:none;
    width:100%;
    background:var(--paper-warm);
    border:1px solid var(--rule);
    padding:1rem;
    margin-bottom:0.5rem;
  }
  .db-sidebar.open{display:block}
  .db-sidebar input,
  .db-sidebar select{width:100% !important;font-size:0.88rem;padding:0.55rem 0.7rem}
  .db-tag-filter{gap:0.3rem}
  .db-tag-btn{font-size:0.65rem;padding:0.3rem 0.55rem;min-height:32px}
  .db-filter-toggle{
    display:block;
    width:100%;
    margin:0.8rem 0 0;
    font-family:'Noto Sans JP',sans-serif;
    font-size:0.85rem;
    font-weight:500;
    padding:0.75rem 1rem;
    border:1.5px solid var(--ink);
    background:var(--paper);
    color:var(--ink);
    cursor:pointer;
    text-align:left;
    display:flex;
    justify-content:space-between;
    align-items:center;
  }
  .db-card{padding:1rem 0}
  .db-card:hover{margin:0;padding:1rem 0;background:none}
  .db-card-title{font-size:0.88rem;line-height:1.45}
  .db-card-summary{font-size:0.78rem}
  .db-card-top{gap:0.35rem;flex-wrap:wrap}
  .db-card-karte-btn{
    width:100%;
    justify-content:center;
    font-size:0.7rem;
    padding:0.5rem 0.8rem;
    min-height:36px;
    margin-top:0.5rem;
  }
  .db-main{min-width:0;width:100%;overflow-x:hidden}

  /* カルテモーダル スマホ最適化 */
  .karte-modal-overlay{padding:0.5rem}
  .karte-modal{padding:1.2rem;width:100%;max-width:100%}
  .karte-modal-title{font-size:1.2rem}
  .karte-modal-close{top:0.8rem;right:0.8rem;font-size:1rem;min-height:36px;min-width:36px}
  .karte-related-card{padding:0.7rem;min-height:44px}

  /* カルテページ */
  .karte-layout{grid-template-columns:1fr;gap:0.8rem}
  .karte-sidebar{position:static}
  .karte-card{padding:1rem}
  .karte-card-title{font-size:1rem}

  /* アンケート */
  .survey-form{padding:1rem 0}
  .field input,.field select,.field textarea{font-size:0.9rem;padding:0.65rem 0.8rem}
  .radio-item{font-size:0.85rem;padding:0.2rem 0}

  /* 論考 */
  .essays-grid{grid-template-columns:1fr}
  .essay-sidebar{display:none}

  /* 生活保護ガイド */
  .guide-layout{grid-template-columns:1fr;gap:0.8rem}
  .guide-nav{position:static;display:flex;flex-wrap:wrap;gap:0.25rem;border-bottom:1px solid var(--rule);padding-bottom:0.8rem;margin-bottom:0.8rem}
  .guide-nav-item{font-size:0.7rem;padding:0.3rem 0.6rem;border:1px solid var(--rule);display:inline-block;min-height:32px}
  .guide-nav-label{display:none}
  .step-item{grid-template-columns:2rem 1fr;gap:0.6rem;padding:0.8rem}
  .btn-primary,.btn-outline{min-height:44px;font-size:0.82rem}

  /* フッター */
  footer{flex-direction:column;gap:0.3rem;padding:1rem 0.8rem;text-align:center}
}

/* ===== スマホ対応 (480px以下) ===== */
@media (max-width: 480px) {
  .site-name{font-size:1.2rem}
  .hero-headline{font-size:1.25rem}
  .pillars{grid-template-columns:1fr}
  .stats-col{grid-template-columns:1fr}
  .stat-card{border-right:none;border-bottom:1px solid var(--rule)}
  .stat-card:last-child{border-bottom:none}
  .stat-num{font-size:1.4rem}
  .page-title{font-size:1.3rem}
  .btn-primary,.btn-outline{width:100%;justify-content:center;text-align:center;font-size:0.7rem}
  .guide-section-title{font-size:1.1rem}
  .db-card-tags{gap:0.18rem}
  .db-tag-e,.db-tag-s,.db-tag-v,.db-tag-t{font-size:0.55rem;padding:0.06rem 0.28rem}
}
/* =====================================================
   PROJECT MANA — Phase 1 スマホ対応追記
   既存style.cssの末尾に追記する上書き用スタイル
   JS・HTML構造には触れない
   ===================================================== */

/* ----- 独立カルテページ 基本 ----- */
.karte-detail-body {
  padding: 1.5rem 0;
  width: 100%;
}

/* ----- 関連記事リンク：長いURLの折り返し ----- */
.karte-related-link {
  white-space: normal;
  word-break: break-all;
  overflow: hidden;
  text-overflow: clip;
}

/* =====================================================
   768px以下
   ===================================================== */
@media (max-width: 768px) {

  /* 独立カルテページ */
  .karte-detail-body {
    max-width: 100%;
    padding: 1rem 0;
  }

  .karte-detail-back {
    font-size: 0.8rem;
    padding: 0.3rem 0;
    min-height: 36px;
    display: inline-flex;
    align-items: center;
  }

  /* カルテ詳細：セクション余白を詰める */
  .karte-modal-section {
    margin-bottom: 1rem;
    padding-top: 0.7rem;
  }

  .karte-modal-title {
    font-size: 1.3rem;
    line-height: 1.3;
  }

  .karte-modal-text {
    font-size: 0.83rem;
    line-height: 1.8;
  }

  /* タグサイズ統一（読みやすさ優先） */
  .db-tag-e,
  .db-tag-s,
  .db-tag-v,
  .db-tag-t {
    font-size: 0.68rem;
    padding: 0.18rem 0.4rem;
    min-height: 28px;
    display: inline-flex;
    align-items: center;
  }

  /* 観測DBカード：hover時の負マージンによる横スクロール防止 */
  .db-card:hover {
    margin-left: 0;
    margin-right: 0;
  }

  /* 観測DBカード：タグ行の折り返し改善 */
  .db-card-tags {
    gap: 0.28rem;
    row-gap: 0.28rem;
  }

  /* 観測DB：カード上部の情報行が詰みすぎないよう調整 */
  .db-card-top {
    row-gap: 0.3rem;
  }

  /* カルテ一覧カード */
  .karte-card-title {
    font-size: 1rem;
    line-height: 1.35;
  }

  .karte-card-summary {
    font-size: 0.78rem;
    line-height: 1.7;
  }

  /* 独立カルテページ内のタグ */
  .karte-modal-section .db-tag-e,
  .karte-modal-section .db-tag-s,
  .karte-modal-section .db-tag-v,
  .karte-modal-section .db-tag-t {
    font-size: 0.68rem;
    padding: 0.18rem 0.4rem;
  }
}

/* =====================================================
   480px以下
   ===================================================== */
@media (max-width: 480px) {

  /* 独立カルテページ */
  .karte-detail-header {
    padding: 1rem 0 0.8rem;
  }

  .karte-detail-body {
    padding: 0.8rem 0;
  }

  .karte-modal-id {
    font-size: 0.6rem;
  }

  .karte-modal-title {
    font-size: 1.15rem;
    margin-bottom: 0.8rem;
  }

  .karte-modal-section-label {
    font-size: 0.58rem;
  }

  .karte-modal-text {
    font-size: 0.82rem;
  }

  /* タグをさらに少し大きく（極小画面での誤タップ防止） */
  .db-tag-e,
  .db-tag-s,
  .db-tag-v,
  .db-tag-t {
    font-size: 0.7rem;
    padding: 0.2rem 0.45rem;
    min-height: 30px;
  }

  /* 関連記事リンク：極小画面での行高調整 */
  .karte-related-link {
    font-size: 0.7rem;
    line-height: 1.5;
    padding: 0.3rem 0;
  }

  /* DBカードタイトル */
  .db-card-title {
    font-size: 0.85rem;
    line-height: 1.45;
  }

  /* DBカード要約 */
  .db-card-summary {
    font-size: 0.76rem;
  }
}

/* ===== 独立カルテページ：元記事リスト ===== */
.karte-source-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.3rem;
}

.karte-source-link {
  display: block;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--rule);
  border-left: 3px solid var(--accent);
  text-decoration: none;
  color: var(--ink);
  transition: border-color 0.15s, background 0.15s;
}

.karte-source-link:hover {
  border-color: var(--accent);
  background: var(--accent-pale);
}

.karte-source-title {
  display: block;
  font-size: 0.83rem;
  font-weight: 500;
  line-height: 1.4;
  color: var(--ink);
  word-break: break-all;
}

.karte-source-meta {
  display: block;
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  color: var(--ink-light);
  margin-top: 0.25rem;
}

@media (max-width: 768px) {
  .karte-source-link {
    padding: 0.7rem 0.8rem;
  }
  .karte-source-title {
    font-size: 0.82rem;
  }
}
  }

  const k = karteData.find(k => k.id === karteId);
  if (!k) {
    container.innerHTML = `<div class="karte-detail-loading">指定されたカルテ（${escapeAttr(karteId)}）が見つかりません</div>`;
    return;
  }

  const urls = k.related_urls ? k.related_urls.split('\n').filter(Boolean) : [];

  container.innerHTML = `
    <div class="karte-modal-id">${k.id}</div>
    <div class="karte-modal-title">${k.title}</div>
    <div class="karte-card-top" style="margin-bottom:1rem">
      ${k.region ? `<span class="karte-card-region">${k.region}</span>` : ''}
      ${k.field  ? `<span class="karte-card-field">${k.field}</span>`   : ''}
    </div>

    <div class="karte-modal-section">
      <div class="karte-modal-section-label">概要</div>
      <div class="karte-modal-text">${k.summary || ''}</div>
    </div>

    ${urls.length ? `<div class="karte-modal-section">
      <div class="karte-modal-section-label">関連記事 (${urls.length}件)</div>
      ${urls.map(u => `<a class="karte-related-link" href="${u}" target="_blank">${u}</a>`).join('')}
    </div>` : ''}

    <div class="karte-modal-section">
      <div class="karte-modal-section-label">タグ</div>
      ${[
        {label:'出来事', tags: splitKarteTags(k.tags_event),     cls:'db-tag-e'},
        {label:'状態',   tags: splitKarteTags(k.tags_status),    cls:'db-tag-t'},
        {label:'根拠',   tags: splitKarteTags(k.tags_evidence),  cls:'db-tag-v'},
        {label:'構造',   tags: splitKarteTags(k.tags_structure), cls:'db-tag-s'},
      ].filter(g => g.tags.length).map(g => `
        <div style="margin-bottom:0.5rem">
          <span style="font-family:'DM Mono',monospace;font-size:0.58rem;color:var(--ink-light);margin-right:0.4rem">${g.label}</span>
          ${g.tags.map(t => `<a href="#/tag/${encodeURIComponent(t)}" class="${g.cls}" style="text-decoration:none">${t}</a>`).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

// ===== LOAD DB FROM GOOGLE SHEETS =====
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
      })).filter(r => r.title);

      // 日付降順・同日は収録日時降順でソート
      dbData.sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        if (dateB - dateA !== 0) return dateB - dateA;
        return new Date(b.collected_at || 0) - new Date(a.collected_at || 0);
      });

      console.log('DB読み込み成功:', dbData.length + '件');
      renderDB(dbData);
      updateStats();
      renderHomeNews(dbData.slice(0, 5));
      buildFilters(dbData);
      updateTicker(dbData);
      renderHomeTagCloud(dbData);
      checkKarteLinkage();
      const tbody = document.getElementById('db-tbody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="10" style="padding:2rem;text-align:center">
          <div style="color:var(--accent);font-weight:500;margin-bottom:0.5rem">データの読み込みに失敗しました</div>
          <div style="font-family:'DM Mono',monospace;font-size:0.72rem;color:var(--ink-light);margin-bottom:0.5rem">${err.message}</div>
          <div style="font-size:0.75rem;color:var(--ink-light)">ブラウザのコンソール（F12）で詳細を確認できます</div>
        </td></tr>`;
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
      document.getElementById('survey-count-stat').innerHTML = surveyData.length + '<sup>件</sup>';
      document.getElementById('survey-count-sub').textContent = '▲ 随時更新';
    })
    .catch(() => renderHomeVoices(demoVoices()));
}

// ===== DEMO DATA =====
function useDemoData() {
  dbData = [
    {
      date:'2026-06-05', region:'京都府', municipality:'京都市', field:'生活保護',
      source_type:'当事者証言', source_name:'（デモデータ）', url:'',
      title:'【デモ】福祉窓口で申請者に不適切発言、録音が証拠として提出',
      summary:'生活保護申請窓口で担当職員が申請者に不適切な発言。録音データが提出され問題化。',
      tags_event:'申請妨害 / 誤情報提供',
      tags_structure:'説明責任 / 組織防衛',
      tags_evidence:'当事者証言 / 録音・録画',
      tags_status:'疑惑段階',
      severity:'高'
    },
    {
      date:'2026-06-04', region:'大阪府', municipality:'大阪市', field:'障害福祉',
      source_type:'監査報告', source_name:'（デモデータ）', url:'',
      title:'【デモ】福祉事務所の訪問記録に虚偽記載、監査で発覚',
      summary:'福祉事務所の職員が未実施の訪問を実施済みとして記録。内部監査で発覚し担当者を処分。',
      tags_event:'記録改ざん',
      tags_structure:'内部統制 / 説明責任 / 自己修正不能',
      tags_status:'行政が認めた / 謝罪あり',
      tags_evidence:'監査報告',
      severity:'高'
    },
    {
      date:'2026-06-03', region:'神奈川県', municipality:'', field:'障害福祉',
      source_type:'裁判例', source_name:'（デモデータ）', url:'',
      title:'【デモ】障害福祉サービスの支給量を独断で削減、行政不服申立て',
      summary:'担当ケースワーカーが利用者の同意なくサービス支給量を削減。不服申立てが認められる。',
      tags_event:'支給停止 / 本人意思の無視',
      tags_structure:'当事者主体の不実装 / 権限濫用',
      tags_status:'係争中 / 是正あり',
      tags_evidence:'裁判例 / 当事者証言',
      severity:'高'
    },
    {
      date:'2026-06-02', region:'東京都', municipality:'', field:'情報公開',
      source_type:'当事者証言', source_name:'（デモデータ）', url:'',
      title:'【デモ】区役所窓口で申請書類を紛失、再提出強要し4ヶ月放置',
      summary:'提出済みの申請書類が区役所内で紛失。担当部署は再提出を求め、その後も4ヶ月間対応せず。',
      tags_event:'長期放置 / 書類紛失',
      tags_structure:'判断プロセス不備 / 説明責任',
      tags_status:'是正なし',
      tags_evidence:'当事者証言',
      severity:'中'
    },
    {
      date:'2026-05-30', region:'愛知県', municipality:'', field:'生活保護',
      source_type:'当事者証言', source_name:'（デモデータ）', url:'',
      title:'【デモ】生活保護申請に「まず親族に相談を」と繰り返し申請阻止',
      summary:'窓口職員が法的根拠なく親族扶養を条件として提示し続け、申請を事実上阻止していた事例。',
      tags_event:'申請妨害 / 扶養照会濫用',
      tags_structure:'制度実装の失敗 / 前例主義 / 反復構造',
      tags_status:'疑惑段階',
      tags_evidence:'当事者証言',
      severity:'高'
    },
    {
      date:'2026-05-15', region:'京都府', municipality:'京都市', field:'財政',
      source_type:'議会議事録', source_name:'（デモデータ）', url:'',
      title:'【デモ】京都市財政推計ミスが発覚、値上げ方針は継続',
      summary:'財政危機の根拠となった推計に誤りが発覚したにもかかわらず、当局は値上げ方針を撤回せず。',
      tags_event:'財政推計ミス / 政策撤回なし',
      tags_structure:'説明責任 / 自己修正不能 / 財政危機言説',
      tags_status:'誤り認定 / 謝罪あり / 撤回なし',
      tags_evidence:'議会議事録 / 行政資料',
      severity:'高'
    },
  ];
  renderDB(dbData);
  updateStats();
  renderHomeNews(dbData.slice(0, 5));
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

// ===== RENDER DB - カード表示 =====
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

  // デバッグ用ログ
  console.log('renderDB - dbData件数:', data.length);
  console.log('renderDB - karteData件数:', (karteData && karteData.length) ? karteData.length : '未読み込み');
  const totalMatch = data.filter(r => findKarteByUrl(r.url)).length;
  console.log('renderDB - URL照合成功件数:', totalMatch + '/' + data.length);
  // 最初の3件の照合詳細
  data.slice(0, 3).forEach((r, i) => {
    const k = findKarteByUrl(r.url);
    console.log(`記事[${i}] URL:「${r.url}」→ カルテ:`, k ? k.id + ' ' + k.title : 'なし');
    if (!k && karteData && karteData.length) {
      console.log(`  related_urls例:`, karteData[0]?.related_urls?.slice(0, 100));
    }
  });

  if (!data.length) {
    container.innerHTML = '<div class="db-empty">該当するデータがありません</div>';
    document.getElementById('db-count-label').textContent = '';
    return;
  }

  document.getElementById('db-count-label').textContent = data.length + ' 件表示中';

  container.innerHTML = data.map((r, idx) => {
    const eventTags = splitTags(r.tags_event);
    const structTags = splitTags(r.tags_structure);
    const evidTags = splitTags(r.tags_evidence);
    const statusTags = splitTags(r.tags_status);
    const sev = r.severity === '高' ? `<span class="db-card-sev-high">高</span>` :
                r.severity === '中' ? `<span class="db-card-sev-mid">中</span>` : '';
    const hasAnyTag = eventTags.length || structTags.length || evidTags.length || statusTags.length;

    // 対応カルテをURLで逆引き（安全版）
    const relatedKarte = findKarteByUrl(r.url);

    return `<div class="db-card" id="card-${idx}">
      <div class="db-card-top">
        <span class="db-card-date">${r.date}</span>
        ${r.region ? `<span class="db-card-region">${r.region}${r.municipality ? ' / ' + r.municipality : ''}</span>` : ''}
        ${r.field ? `<span class="db-card-field">${r.field}</span>` : ''}
        ${sev}
        ${relatedKarte ? `<span class="db-card-karte-badge">カルテあり</span>` : ''}
      </div>
      <div class="db-card-title">
        ${r.url ? `<a href="${r.url}" target="_blank">${r.title}</a>` : r.title}
      </div>
      ${relatedKarte ? `<button class="db-card-karte-btn" onclick="openKarteFromDB('${relatedKarte.id}')">📋 事案カルテを見る：${relatedKarte.title}</button>` : ''}
      ${r.summary ? `<div class="db-card-summary">${r.summary}</div>` : ''}
      <div class="db-card-tags">
        ${eventTags.map(t=>`<span class="db-tag-e" onclick="addTagFilter('event','${t}')">${t}</span>`).join('')}
        ${structTags.map(t=>`<span class="db-tag-s" onclick="addTagFilter('structure','${t}')">${t}</span>`).join('')}
        ${evidTags.map(t=>`<span class="db-tag-v" onclick="addTagFilter('evidence','${t}')">${t}</span>`).join('')}
        ${statusTags.map(t=>`<span class="db-tag-t" onclick="addTagFilter('status','${t}')">${t}</span>`).join('')}
      </div>
      ${hasAnyTag ? `<button class="db-similar-btn" id="similar-btn-${idx}" onclick="toggleSimilar(${idx})">共通する構造を探す</button>` : ''}
      <div class="db-card-similar" id="similar-${idx}"></div>
    </div>`;
  }).join('');
}

function openKarteFromDB(karteId) {
  // 独立カルテページへ遷移（観測DB → カルテ の主導線）
  goToKartePage(karteId);
}

// URL正規化（将来的な正規化拡張のための関数）
function normalizeUrl(url) {
  if (!url) return '';
  return url.trim().replace(/\/$/, ''); // 末尾スラッシュ除去
}

// 記事URLからカルテを逆引き（安全版）
function findKarteByUrl(articleUrl) {
  if (!articleUrl) return null;
  if (!karteData || !karteData.length) return null; // 未読み込み時は安全に返す
  const normalized = normalizeUrl(articleUrl);
  return karteData.find(k => {
    const urls = k.related_urls;
    if (!urls) return false;
    // 文字列でも配列でも安全に処理
    const urlList = Array.isArray(urls)
      ? urls
      : String(urls).split('\n');
    return urlList.map(u => normalizeUrl(u)).includes(normalized);
  }) || null;
}

function splitTags(str) {
  if (!str) return [];
  return str.split('/').map(t => t.trim()).filter(Boolean);
}

// サイドバーのタグフィルターボタン生成
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

function addTagFilter(type, tag) {
  if (!activeTagFilters[type].includes(tag)) {
    activeTagFilters[type].push(tag);
    // サイドバーのボタンも active に
    const btns = document.querySelectorAll(`#filter-${type} .db-tag-btn`);
    btns.forEach(btn => { if (btn.textContent.trim().startsWith(tag)) btn.classList.add('active'); });
  }
  showPage('db', document.querySelector('nav a:nth-child(2)'));
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
  const kw = (document.getElementById('db-search')?.value || '').toLowerCase();
  const pref = document.getElementById('db-pref')?.value || '';
  const cat = document.getElementById('db-category')?.value || '';
  const sev = document.getElementById('db-severity')?.value || '';

  const filtered = dbData.filter(r => {
    const allText = [r.title, r.summary, r.tags_event, r.tags_structure, r.tags_evidence, r.tags_status].filter(Boolean).join(' ').toLowerCase();
    if (kw && !allText.includes(kw)) return false;
    if (pref && (r.region||r.prefecture||'') !== pref) return false;
    if (cat && (r.field||r.category||'') !== cat) return false;
    if (sev && r.severity !== sev) return false;
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
  document.getElementById('db-count-stat').innerHTML = dbData.length + '<sup>件</sup>';
  document.getElementById('db-count-sub').textContent = '▲ AI自動収集・毎日更新';
}

// ===== HOME NEWS =====
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

// ===== HOME VOICES =====
function renderHomeVoices(data) {
  document.getElementById('home-voices').innerHTML = data.map(v => `
    <div class="voice-item">
      <span class="voice-pref">${v.pref}</span>
      「${v.detail.slice(0, 60)}${v.detail.length > 60 ? '……' : ''}」
    </div>
  `).join('');
}

// ===== TICKER =====
function updateTicker(data) {
  const items = data.slice(0, 6).map(r => `${r.region||r.prefecture||''}・${r.title}`).join('　　');
  const doubled = items + '　　　　' + items;
  document.getElementById('ticker-text').textContent = doubled;
}

// ===== SURVEY SUBMIT =====
// Google Apps Script WebアプリのURLをここに設定
const GAS_SURVEY_URL = 'YOUR_GAS_WEB_APP_URL_HERE';

function submitSurvey() {
  const pref = document.getElementById('s-pref').value;
  const win = document.getElementById('s-window').value;
  const detail = document.getElementById('s-detail').value;
  const result = document.querySelector('input[name="result"]:checked')?.value || '';
  const when = document.getElementById('s-when').value;
  const types = [...document.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value).join('、');

  if (!pref || !detail) {
    alert('都道府県と体験の詳細は必須です');
    return;
  }

  const data = { pref, window: win, types, detail, result, when, timestamp: new Date().toISOString() };

  if (GAS_SURVEY_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
    // デモモード：実際の送信なし
    document.getElementById('survey-form-container').style.display = 'none';
    document.getElementById('survey-thanks').style.display = 'block';
    return;
  }

  fetch(GAS_SURVEY_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(() => {
    document.getElementById('survey-form-container').style.display = 'none';
    document.getElementById('survey-thanks').style.display = 'block';
  }).catch(() => {
    document.getElementById('survey-form-container').style.display = 'none';
    document.getElementById('survey-thanks').style.display = 'block';
  });
}

// ===== 構造類似表示 =====
// 地域タグは使わない。tags_structure / tags_event / tags_status / tags_evidence で比較。

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
  const common = [...tagsA].filter(t => tagsB.has(t));
  return common;
}

function scoreLabel(count) {
  if (count >= 5) return { label: '要観測', cls: 'score-3' };
  if (count >= 3) return { label: '構造的類似あり', cls: 'score-2' };
  if (count >= 1) return { label: '関連あり', cls: 'score-1' };
  return null;
}

function toggleSimilar(idx) {
  const panel = document.getElementById('similar-' + idx);
  const btn   = document.getElementById('similar-btn-' + idx);
  const isOpen = panel.classList.contains('open');

  if (isOpen) {
    panel.classList.remove('open');
    btn.classList.remove('active');
    btn.textContent = '共通する構造を探す';
    return;
  }

  // 現在表示中のデータ（filterDBの結果）からこのカードを特定
  const currentData = getCurrentFilteredData();
  const target = currentData[idx];
  if (!target) return;

  const targetTags = new Set(getComparableTags(target));
  if (targetTags.size === 0) {
    panel.innerHTML = '<div style="font-size:0.78rem;color:var(--ink-light)">タグが未付与のため比較できません</div>';
    panel.classList.add('open');
    return;
  }

  // 全DBデータと比較（自分自身は除く）
  const results = dbData
    .filter(r => r !== target && r.title !== target.title)
    .map(r => {
      const common = calcSimilarity(target, r);
      return { r, common };
    })
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

  // 共通タグを集計（全結果を通じて共通するもの）
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
    </div>
  `;

  panel.classList.add('open');
  btn.classList.add('active');
  btn.textContent = '▲ 閉じる';
}

// 現在フィルター後のデータを保持する変数
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
  document.getElementById('home-tag-cloud').innerHTML = sorted.map(([tag, count]) => {
    const size = 0.62 + (count / max) * 0.22;
    const opacity = 0.5 + (count / max) * 0.5;
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
const QA_SHEET_NAME = 'Q&A';
const GAS_QA_URL = 'YOUR_GAS_WEB_APP_URL_HERE'; // survey_receiver.gsと同じGASに追加する

let qaData = [];

// デモQ&Aデータ
// ===== KARTE =====
const KARTE_SHEET_NAME = 'カルテ';
let karteData = [];

const demoKartes = [
  {
    id:'KARTE-0001', title:'京都市生活保護窓口での申請妨害', region:'京都府', field:'生活保護',
    summary:'京都市の福祉窓口において、生活保護申請者が「まず家族に相談を」「書類が揃ってから来て」などの言葉で申請を阻まれる事案が複数件確認されている。担当者が異なるにもかかわらず言葉が酷似しており、組織的な対応指針の存在が疑われる。',
    progress:'市民団体が事例を収集中。行政は「個別対応」として組織的関与を否定。',
    tags_event:'申請妨害 / 扶養照会濫用',
    tags_structure:'組織的不作為 / 説明責任 / 前例主義',
    tags_status:'疑惑段階',
    tags_evidence:'当事者証言',
    related_urls:'https://example.com/article1\nhttps://example.com/article2',
    mana_comment:'',
    created_at:'2026-06-08',
    updated_at:'2026-06-09',
    start_date:'2026-06-01',
  },
  {
    id:'KARTE-0002', title:'燕市生活保護費の過大支給と回収問題', region:'新潟県', field:'生活保護',
    summary:'新潟県燕市において、生活保護受給者9人への総額約855万円の誤支給が判明。行政ミスによる過払いにもかかわらず、受給者への返還請求が行われた。制度の説明責任と内部チェック機能の不備が問われている。',
    progress:'行政が誤りを認め謝罪。返還交渉中。',
    tags_event:'誤情報提供 / 財政推計ミス',
    tags_structure:'内部統制 / 説明責任 / 自己修正不能',
    tags_status:'行政が認めた / 謝罪あり',
    tags_evidence:'報道',
    related_urls:'https://example.com/article3',
    mana_comment:'',
    created_at:'2026-06-08',
    updated_at:'2026-06-08',
    start_date:'2026-06-08',
  },
];

function loadKartes() {
  if (SHEET_ID === 'YOUR_SHEET_ID_HERE') {
    karteData = demoKartes;
    renderKartes(karteData);
    buildKarteFilters(karteData);
    handleHashRoute();
    return;
  }
  const url = GAS_API_URL + '?sheet=' + encodeURIComponent(KARTE_SHEET_NAME);
  console.log('カルテ読み込み開始:', url);

  fetch(url)
    .then(r => r.json())
    .then(data => {
      console.log('カルテAPIレスポンス:', data);
      if (!Array.isArray(data)) throw new Error('配列ではありません: ' + JSON.stringify(data).slice(0, 100));

      karteData = data.map(row => ({
        id:             row['カルテID'] || row['id'] || '',
        title:          row['事案名'] || row['title'] || '',
        region:         row['地域'] || '',
        field:          row['分野'] || '',
        summary:        row['概要'] || '',
        progress:       row['経過'] || '',
        tags_event:     row['出来事タグ'] || '',
        tags_structure: row['構造タグ'] || '',
        tags_status:    row['状態タグ'] || '',
        tags_evidence:  row['根拠タグ'] || '',
        related_urls:   row['関連記事URL'] || '',
        mana_comment:   row['MANAコメント'] || '',
        created_at:     row['作成日'] || '',
        updated_at:     row['最終更新日'] || '',
        start_date:     row['事案開始日'] || '',
        tags_field:         row['分野タグ']         || '',
        tags_target:        row['対象者タグ']        || '',
        tags_actor:         row['行為者タグ']        || '',
        tags_event_search:  row['出来事タグ（探索）'] || '',
      })).filter(r => r.id || r.title); // IDまたはタイトルがあれば表示

      console.log('カルテ読み込み成功:', karteData.length + '件');
      // カルテのrelated_urls先頭3件をログ
      karteData.slice(0, 3).forEach((k, i) => {
        console.log(`カルテ[${i}] id:${k.id} related_urls:「${(k.related_urls||'').slice(0, 150)}」`);
      });
      renderKartes(karteData);
      buildKarteFilters(karteData);
      // DBが既に表示済みなら再描画してカルテボタンを反映
      if (dbData.length) {
        console.log('カルテ読み込み完了→DB再描画');
        renderDB(dbData);
      }
      // ハッシュルーティング（直URLアクセスに対応）
      handleHashRoute();
      checkKarteLinkage();
    })
    .catch(err => {
      console.error('カルテ読み込みエラー:', err.message);
      // エラー時はデモデータではなくエラーメッセージを表示
      const list = document.getElementById('karte-list');
      if (list) list.innerHTML = `<div class="db-empty">
        カルテの読み込みに失敗しました<br>
        <span style="font-family:'DM Mono',monospace;font-size:0.7rem;color:var(--ink-light)">${err.message}</span>
      </div>`;
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
    const urls = k.related_urls ? k.related_urls.split('\n').filter(Boolean) : [];
    const structTags = splitKarteTags(k.tags_structure);
    const eventTags  = splitKarteTags(k.tags_event);
    const statusTags = splitKarteTags(k.tags_status);

    return `<div class="karte-card" onclick="openKarteModal('${k.id}')">
      <div class="karte-card-top">
        <span class="karte-card-id">${k.id}</span>
        ${k.region ? `<span class="karte-card-region">${k.region}</span>` : ''}
        ${k.field  ? `<span class="karte-card-field">${k.field}</span>`   : ''}
        ${statusTags[0] ? `<span class="db-tag-t">${statusTags[0]}</span>` : ''}
      </div>
      <div class="karte-card-title">${k.title}</div>
      ${k.summary ? `<div class="karte-card-summary">${k.summary.slice(0, 120)}${k.summary.length > 120 ? '……' : ''}</div>` : ''}
      ${k.progress ? `<div class="karte-card-progress">${k.progress}</div>` : ''}
      <div class="karte-card-tags">
        ${structTags.map(t => `<span class="db-tag-s">${t}</span>`).join('')}
        ${eventTags.map(t  => `<span class="db-tag-e">${t}</span>`).join('')}
      </div>
      <div class="karte-card-footer">
        <span>記事 ${urls.length} 件</span>
        <span>更新: ${k.updated_at ? k.updated_at.slice(0,10) : ''}</span>
      </div>
    </div>`;
  }).join('');
}

function buildKarteFilters(data) {
  const prefs     = [...new Set(data.map(k => k.region).filter(Boolean))].sort();
  const fields    = [...new Set(data.map(k => k.field).filter(Boolean))].sort();
  const structs   = [...new Set(data.flatMap(k => splitKarteTags(k.tags_structure)))].sort();
  const statuses  = [...new Set(data.flatMap(k => splitKarteTags(k.tags_status)))].sort();

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
    (!status || (k.tags_status || '').includes(status))
  );
  renderKartes(filtered);
}

function openKarteModal(id) {
  const k = karteData.find(k => k.id === id);
  if (!k) return;

  // 共通構造タグを持つ関連カルテを検索
  const myStructTags = splitKarteTags(k.tags_structure);
  const related = karteData.filter(other =>
    other.id !== k.id &&
    splitKarteTags(other.tags_structure).some(t => myStructTags.includes(t))
  ).slice(0, 5);

  const urls = k.related_urls ? k.related_urls.split('\n').filter(Boolean) : [];

  document.getElementById('karte-modal-content').innerHTML = `
    <div class="karte-modal-id">${k.id}</div>
    <div class="karte-modal-title">${k.title}</div>
    <div class="karte-card-top" style="margin-bottom:1rem">
      ${k.region ? `<span class="karte-card-region">${k.region}</span>` : ''}
      ${k.field  ? `<span class="karte-card-field">${k.field}</span>`   : ''}
    </div>

    <div class="karte-modal-section">
      <div class="karte-modal-section-label">概要</div>
      <div class="karte-modal-text">${k.summary}</div>
    </div>

    ${k.progress ? `<div class="karte-modal-section">
      <div class="karte-modal-section-label">現在の経過</div>
      <div class="karte-modal-progress">${k.progress}</div>
    </div>` : ''}

    <div class="karte-modal-section">
      <div class="karte-modal-section-label">このカルテのタグ</div>
      ${[
        {label:'出来事', tags: splitKarteTags(k.tags_event),     cls:'db-tag-e'},
        {label:'状態',   tags: splitKarteTags(k.tags_status),    cls:'db-tag-t'},
        {label:'根拠',   tags: splitKarteTags(k.tags_evidence),  cls:'db-tag-v'},
        {label:'構造',   tags: splitKarteTags(k.tags_structure), cls:'db-tag-s'},
      ].filter(g => g.tags.length).map(g => `
        <div style="margin-bottom:0.5rem">
          <span style="font-family:'DM Mono',monospace;font-size:0.58rem;color:var(--ink-light);margin-right:0.4rem">${g.label}</span>
          ${g.tags.map(t => `<span class="${g.cls}" style="cursor:pointer" onclick="filterKarteByTag('${escapeAttr(t)}')" title="「${escapeAttr(t)}」の事案を探す">${t}</span>`).join('')}
        </div>
      `).join('')}
    </div>

    ${k.mana_comment ? `<div class="karte-modal-section">
      <div class="karte-modal-section-label">MANAコメント</div>
      <div class="karte-modal-text">${k.mana_comment}</div>
    </div>` : ''}

    ${urls.length ? `<div class="karte-modal-section">
      <div class="karte-modal-section-label">関連記事 (${urls.length}件)</div>
      ${urls.map(u => `<a class="karte-related-link" href="${u}" target="_blank">${u}</a>`).join('')}
    </div>` : ''}

    ${related.length ? `<div class="karte-modal-section">
      <div class="karte-modal-section-label">共通構造タグを持つ関連事案</div>
      <div class="karte-related-cards">
        ${related.map(r => `<div class="karte-related-card" onclick="openKarteModal('${r.id}')">
          <span style="font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--accent)">${r.region} / ${r.field}</span>
          <div style="font-weight:500;margin-top:0.2rem">${r.title}</div>
        </div>`).join('')}
      </div>
    </div>` : ''}
  `;

  document.getElementById('karte-modal').classList.add('show');
}

function closeKarteModal(e) {
  if (e.target.id === 'karte-modal') {
    document.getElementById('karte-modal').classList.remove('show');
  }
}

// タグクリックでカルテ一覧を絞り込む
function filterKarteByTag(tag) {
  // モーダルを閉じる
  document.getElementById('karte-modal').classList.remove('show');

  // karteDataが既にあればloadKartesを呼ばずにページ切替だけする
  // showPage('karte')はloadKartesを呼ぶので使わない
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('page-karte').classList.add('active');
  const karteNav = document.querySelector('nav a:nth-child(5)');
  if (karteNav) karteNav.classList.add('active');
  window.scrollTo(0, 0);

  // 絞り込み実行
  const filtered = karteData.filter(k =>
    [k.tags_event, k.tags_structure, k.tags_status, k.tags_evidence]
      .some(t => (t || '').includes(tag))
  );
  renderKartes(filtered);
  document.getElementById('karte-count-label').textContent =
    `「${tag}」の事案： ${filtered.length} 件`;
}

// onclick属性に埋め込むタグ文字列をエスケープする
function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function splitKarteTags(str) {
  if (!str) return [];
  return str.split(/[\/・,、]/).map(t => t.trim()).filter(Boolean);
}


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
    essayData = demoEssays;
    renderEssays(essayData);
    buildEssayFilters(essayData);
    return;
  }
  fetch(SHEET_BASE + encodeURIComponent(ESSAY_SHEET_NAME))
    .then(r => r.text())
    .then(text => {
      const json = JSON.parse(text.replace('/*O_o*/\ngoogle.visualization.Query.setResponse(', '').replace(');', ''));
      const rows = json.table.rows;
      essayData = rows.slice(1).map(row => ({
        date:row.c[0]?.v||'',type:row.c[1]?.v||'',title:row.c[2]?.v||'',
        summary:row.c[3]?.v||'',tags:row.c[4]?.v||'',url:row.c[5]?.v||'',
        status:row.c[6]?.v||'',featured:row.c[7]?.v||''
      })).filter(r => r.title && r.status !== '非公開');
      renderEssays(essayData);
      buildEssayFilters(essayData);
    })
    .catch(() => { essayData = demoEssays; renderEssays(essayData); buildEssayFilters(essayData); });
}

function renderEssays(data) {
  const list = document.getElementById('essay-list');
  document.getElementById('essay-count').textContent = data.length + ' 件';
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
  document.getElementById('essay-tag-cloud').innerHTML = tags.map(t=>
    `<span class="tag" onclick="filterEssayByTag('${t}')" style="cursor:pointer">${t}</span>`
  ).join('');
}

function filterEssays() {
  const tag = document.getElementById('essay-tag-filter').value;
  const type = document.getElementById('essay-type-filter').value;
  renderEssays(essayData.filter(e=>(!tag||(e.tags||'').includes(tag))&&(!type||e.type===type)));
}

function filterEssayByTag(tag) {
  document.getElementById('essay-tag-filter').value = tag;
  filterEssays();
}

const demoQA = [
  {id:1, type:'質問', content:'扶養照会を断ることはできますか？DVがあって家族に知られたくないです。', answer:'はい、断れます。DV・虐待・家族関係が壊れているなどの理由がある場合、扶養照会を省略できます。申請時に「家族への照会は希望しません。理由は○○です」と伝え、書面で申し出ると効果的です。', date:'2026-05-10', status:'公開'},
  {id:2, type:'体験', content:'「書類が揃ってから来てください」と言われて追い返されそうになりましたが、「申請書だけください」と言ったら受け取れました。', answer:'', date:'2026-05-18', status:'公開'},
  {id:3, type:'アドバイス', content:'窓口に行くとき、録音していることを最初に伝えたら対応がすごく丁寧になりました。最初から言うのがおすすめです。', answer:'', date:'2026-05-22', status:'公開'},
  {id:4, type:'質問', content:'申請したのに2週間以上連絡がありません。どうすればいいですか？', answer:'法律では14日以内に決定することが原則です（最長30日）。担当ケースワーカーに進捗を確認してください。「いつ決定が出ますか」と電話で聞くのが一番早いです。それでも動かない場合は支援団体に相談することをおすすめします。', date:'2026-05-28', status:'公開'},
];

function initQA() {
  if (SHEET_ID === 'YOUR_SHEET_ID_HERE') {
    qaData = demoQA;
    renderQA(qaData);
    return;
  }
  fetch(SHEET_BASE + encodeURIComponent(QA_SHEET_NAME))
    .then(r => r.text())
    .then(text => {
      const json = JSON.parse(text.replace('/*O_o*/\ngoogle.visualization.Query.setResponse(', '').replace(');', ''));
      const rows = json.table.rows;
      qaData = rows.slice(1).map((row, i) => ({
        id: i+1,
        type: row.c[0]?.v || '',
        content: row.c[1]?.v || '',
        answer: row.c[2]?.v || '',
        date: row.c[3]?.v || '',
        status: row.c[4]?.v || ''
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
  const ans = document.getElementById('qa-ans-' + id);
  const arrow = document.getElementById('qa-arrow-' + id);
  ans.classList.toggle('show');
  arrow.classList.toggle('open');
}

function filterQA(kw) {
  const filtered = qaData.filter(q => q.content.includes(kw) || (q.answer && q.answer.includes(kw)));
  renderQA(filtered);
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

// ===== QA SUBMIT WITH GEMINI MODERATION =====
async function submitQA() {
  const type = document.getElementById('qa-type').value;
  const content = document.getElementById('qa-content').value.trim();
  const status = document.getElementById('qa-status');

  if (!content) { alert('内容を入力してください'); return; }

  status.className = 'qa-status checking';
  status.style.display = 'block';
  status.textContent = 'AIが内容を確認しています……';

  // Gemini APIで自動モデレーション
  let approved = false;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY_CLIENT}`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        contents:[{parts:[{text:`
以下の投稿内容を審査してください。生活保護申請Q&Aサイトへの投稿です。

【投稿内容】
${content}

【審査基準】
- OK: 生活保護・行政窓口に関する質問、体験談、アドバイス、困りごと
- NG: 広告・宣伝、特定個人への攻撃・誹謗中傷、全く無関係な内容、個人情報（氏名・住所等）を含む投稿

【出力形式】以下のJSONのみを出力すること:
{"result":"ok","reason":"理由"} または {"result":"ng","reason":"理由"}
        `}]}],
        generationConfig:{temperature:0,maxOutputTokens:200}
      })
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(text.replace(/```json|```/g,'').trim());
    approved = parsed.result === 'ok';
    if (!approved) {
      status.className = 'qa-status ng';
      status.textContent = '投稿できませんでした：' + (parsed.reason || 'ガイドラインに沿っていない内容です');
      return;
    }
  } catch(e) {
    // API失敗時はデモモードとして通す
    approved = true;
  }

  // 承認された場合、GASに送信
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

// クライアント側のGemini APIキー（モデレーション用）
// GASのAPIキーとは別に設定できる。空のままだとデモモードで動作。
const GEMINI_API_KEY_CLIENT = '';
