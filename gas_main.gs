// PROJECT MANA — 観測DB 自動収集スクリプト v7
// 思想：審査DBではなく観測DB。生データを残し、分類は後から育てる。

// ===== 初回設定（一度だけ手動実行）=====
// ★ APIキー設定はこの関数を正とする（実行用はここだけ）。
// exploration_tags.gs 側は setupApiKey_DEPRECATED() に改名済み。
function setupApiKey() {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', 'ここにAPIキーを入れて実行');
  Logger.log('APIキーを保存しました');
}

// ===== RSSフィードリスト =====
const RSS_SOURCES = [
  {
    url: 'https://www3.nhk.or.jp/rss/news/cat0.xml',
    name: 'NHK'
  },
  {
    url: 'https://news.google.com/rss/search?q=%E7%94%9F%E6%B4%BB%E4%BF%9D%E8%AD%B7+%E8%A1%8C%E6%94%BF&hl=ja&gl=JP&ceid=JP:ja',
    name: 'Googleニュース（生活保護）'
  },
  {
    url: 'https://news.google.com/rss/search?q=%E7%A6%8F%E7%A5%89+%E8%A1%8C%E6%94%BF+%E4%B8%8D%E7%A5%A5%E4%BA%8B&hl=ja&gl=JP&ceid=JP:ja',
    name: 'Googleニュース（福祉行政）'
  },
  {
    url: 'https://news.google.com/rss/search?q=%E5%9C%B0%E6%96%B9%E8%87%AA%E6%B2%BB%E4%BD%93+%E8%B2%A1%E6%94%BF+%E5%9F%BA%E9%87%91+%E5%82%B5%E5%8B%99&hl=ja&gl=JP&ceid=JP:ja',
    name: 'Googleニュース（地方財政）'
  },
  {
    url: 'https://news.google.com/rss/search?q=%E8%A1%8C%E8%B2%A1%E6%94%BF%E6%94%B9%E9%9D%A9+%E6%8C%87%E5%AE%9A%E7%AE%A1%E7%90%86+%E5%85%AC%E5%85%B1%E6%96%BD%E8%A8%AD&hl=ja&gl=JP&ceid=JP:ja',
    name: 'Googleニュース（行財政改革）'
  },
  // ===== オピニオン・論考メディア（article_type: opinion）=====
  // Wedge ONLINE：行政・政策・社会課題の論説記事
  {
    url: 'https://news.google.com/rss/search?q=site%3Awedge.ismedia.jp+%E8%A1%8C%E6%94%BF+OR+%E7%A6%8F%E7%A5%89+OR+%E6%B0%91%E4%B8%BB%E4%B8%BB%E7%BE%A9&hl=ja&gl=JP&ceid=JP:ja',
    name: 'Wedge ONLINE（行政・福祉・民主主義）',
    article_type: 'opinion'
  },
  // Slow News：調査報道・社会課題
  {
    url: 'https://news.google.com/rss/search?q=site%3Aslownews.com&hl=ja&gl=JP&ceid=JP:ja',
    name: 'Slow News',
    article_type: 'opinion'
  },
  // シノドス：社会科学の論考・研究者執筆
  {
    url: 'https://news.google.com/rss/search?q=site%3Asynodos.jp+%E8%A1%8C%E6%94%BF+OR+%E7%A4%BE%E4%BC%9A+OR+%E7%A6%8F%E7%A5%89&hl=ja&gl=JP&ceid=JP:ja',
    name: 'シノドス（社会・行政・福祉）',
    article_type: 'research'
  },
  // 現代ビジネス：行政・制度の読み物（玉石混交のためキーワード絞り込み）
  {
    url: 'https://news.google.com/rss/search?q=site%3Agendai.media+%E8%A1%8C%E6%94%BF+OR+%E7%94%9F%E6%B4%BB%E4%BF%9D%E8%AD%B7+OR+%E7%A6%8F%E7%A5%89+OR+%E6%B0%91%E4%B8%BB%E4%B8%BB%E7%BE%A9&hl=ja&gl=JP&ceid=JP:ja',
    name: '現代ビジネス（行政・福祉・民主主義）',
    article_type: 'opinion'
  },
];

// 公開DBに自動反映するキーワード（これを含む記事はタグ未分類でも即公開）
const AUTO_PUBLIC_KEYWORDS = [
  '生活保護', '福祉', '障害', '介護', '申請', '水際',
  '行政', '公務員', '不祥事', '改ざん', '虚偽', '不作為',
  '監査', '情報公開', '裁判', '財政', '窓口',
  '予算', '基金', '債務', '地方債', '行財政改革', '指定管理', '公共施設',
];

const FULL_LOG_SHEET    = '観測DB（全件ログ）';
const PUBLIC_SHEET       = 'kansokuDB';
const TAG_MASTER         = 'タグマスター';

// ===== 列名定数（ベタ書き削減のため列名で参照する）=====
// 列の物理的な並び順はシート側のヘッダーで決まる。
// コード側は常に「列名→現在の列番号」をシートから動的に取得して使う。
const COL = {
  DATE:        '日付',
  REGION:      '地域',
  MUNICIPALITY:'市区町村',
  FIELD:       '分野',
  SOURCE:      '出典',
  URL:         'URL',
  TITLE:       'タイトル',
  SUMMARY:     '要約',
  TAGS_EVENT:     '出来事タグ',
  TAGS_STRUCTURE: '構造タグ',
  TAGS_EVIDENCE:  '根拠タグ',
  TAGS_STATUS:    '状態タグ',
  SEVERITY:    '重要度',
  STRUCT_NOTE: '構造メモ',
  COLLECTED_AT:'収録日時',
  PUB_DATE:    '公開日',
  OLD_FLAG:    '古い記事',
  RSS_SUMMARY: 'RSS要約',
  BODY_CACHE_FLAG: '本文キャッシュ有無',
  ORIG_ID:     '原本ID',
  GEMINI_DONE: 'Gemini分類済み', // 旧フラグ・後方互換のため残置（新規ロジックではCLASSIFY_STATUSを使う）
  GEMINI_TRIED_AT: 'Gemini分類試行日時',
  CLASSIFY_STATUS: '分類状態', // 新規：未分類 / 分類済み / 対象外 / 分類失敗

  // ===== 日付の観測値管理（v4）=====
  // 「正確な公開日」を一度で取ろうとせず、観測できた情報をそのまま保存し、
  // 取れなかったものは「未確認」として残し、後から再取得できるようにする。
  RSS_PUBDATE:        'rss_pubDate',           // RSSが返した日付（無加工・元記事公開日として扱わない）
  GOOGLE_NEWS_URL:     'google_news_url',       // GoogleニュースのラッパーURL
  ORIGINAL_URL:        'original_url',          // 元記事の実URL（取得できた場合のみ）
  ORIGINAL_PUBLISHED_AT: 'original_published_at', // 元記事の実際の公開日（取得できた場合のみ）
  DATE_STATUS:         'date_status',           // 確定 / 未確認 / 要確認

  // ===== 観測メタデータ（Step1：記事から直接取得）=====
  TITLE_NORMALIZED:     'title_normalized',     // 表記揺れを除去した正規化タイトル（重複判定用）
  SOURCE_DOMAIN:        'source_domain',        // 出典URLのドメイン（例: www3.nhk.or.jp）
  DEDUP_HASH:           'dedup_hash',           // title_normalized + rss_pubDate + source_domain のMD5前半16桁
  LAW_REFS_RAW:         'law_refs_raw',         // 記事テキストに含まれる法令名（カンマ区切り・記事直接抽出）
  INSTITUTION_REFS_RAW: 'institution_refs_raw', // 記事テキストに含まれる機関名（カンマ区切り・記事直接抽出）
  TAG_SOURCE:           'tag_source',           // タグ付与の由来：'rule'=ルールベース / 'gemini'=AI推定
};

// ===== date_status の値 =====
// MANAでは不明な事実を推定で確定扱いしない。「推定」は使わず3状態のみとする。
const DATE_STATUS = {
  CONFIRMED:    '確定',   // original_published_atをメタデータ等から直接取得できた
  UNCONFIRMED:  '未確認', // RSSのpubDateはあるが元記事での確認が済んでいない（新着表示は抑制）
  NEEDS_REVIEW: '要確認', // RSS再配信疑い・取得失敗・矛盾あり等、人による確認が必要
};

// ===== 分類状態の値 =====
const CLASSIFY_STATUS = {
  UNCLASSIFIED: '未分類',
  DONE:         '分類済み',
  OUT_OF_SCOPE: '対象外',
  FAILED:       '分類失敗',
};

// ===== シートのヘッダー行から「列名→列インデックス(0-indexed)」マップを取得 =====
function getColMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach(function(h, i) { map[h] = i; });
  return map;
}

// ===== メイン関数（毎日自動実行）=====
// ===== メイン収集（層A：Gemini非依存・必ず実行される）=====
// RSS取得 → 原本庫相当の最低限項目を観測DBに即時保存。
// Geminiは一切呼ばない。これにより429やAPIキー未設定でも収集は止まらない。
// ===== メイン収集（層A：Gemini非依存・必ず実行される）=====
// RSS取得 → 原本庫相当の最低限項目を観測DBに即時保存。
// Geminiは一切呼ばない。これにより429やAPIキー未設定でも収集は止まらない。
function collectNews() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet    = getOrCreateFullLogSheet(ss);
  const publicSheet = getOrCreatePublicSheet(ss);

  Logger.log('===== collectNews 診断開始 =====');
  Logger.log('実行時刻: ' + new Date().toISOString());

  // 1. RSSから記事を収集（Gemini不要）
  //    RSSごとの取得件数は fetchFromRSS() 内のログで出力される
  const articles = fetchFromRSS();
  Logger.log('--- Step1: RSS取得 ---');
  Logger.log('RSS取得合計（重複タイトル除去後）: ' + articles.length + '件');
  if (!articles.length) {
    Logger.log('[原因切り分け] RSS側：RSSから記事が1件も取得できていません。フィードURL・配信停止・パース失敗の可能性。');
    return;
  }

  // 取得記事のpub_dateの分布を確認（20日以前の記事しか来ていないか）
  const pubDates = articles.map(a => a.pub_date).filter(Boolean);
  if (pubDates.length) {
    const sorted = pubDates.slice().sort();
    Logger.log('取得記事の公開日範囲: ' + sorted[0] + ' 〜 ' + sorted[sorted.length - 1]);
  } else {
    Logger.log('取得記事に公開日（pub_date）が一件も含まれていません');
  }

  // 2. 全件ログで重複チェック（全件ログにない新着のみ処理）
  // シート全体を1回だけ読み込んでSetにする（isDuplicate()を毎回呼ぶとAPIコールが爆発するため）
  const logColMap   = getColMap(logSheet);
  const logUrlIdx   = logColMap[COL.URL];
  const logTitleIdx = logColMap[COL.TITLE];
  const logRows     = logSheet.getDataRange().getValues();
  const existingLogKeys = new Set();
  logRows.slice(1).forEach(row => {
    if (logUrlIdx   !== undefined && row[logUrlIdx])   existingLogKeys.add(row[logUrlIdx]);
    if (logTitleIdx !== undefined && row[logTitleIdx]) existingLogKeys.add(row[logTitleIdx]);
  });

  let dupCount = 0;
  let newCount = 0;
  const newArticles = [];
  articles.forEach(a => {
    const key = a.url || a.title;
    if (!key || existingLogKeys.has(key)) {
      dupCount++;
    } else {
      newCount++;
      newArticles.push(a);
    }
  });

  Logger.log('--- Step2: 重複判定（全件ログ基準） ---');
  Logger.log('既存URL/タイトルとして判定されスキップ: ' + dupCount + '件');
  Logger.log('新着と判定: ' + newCount + '件');

  if (!newArticles.length) {
    Logger.log('[原因切り分け] 重複判定：全件が既存扱いでスキップされました。');
    Logger.log('  (a) RSS側が同じ記事しか返していない  (b) 列マップのズレ');
    articles.slice(0, 3).forEach((a, i) => {
      Logger.log('  [' + i + '] URL: ' + a.url + ' / タイトル: ' + a.title);
    });
    return;
  }

  // 3. 層Aのみで全件ログに一括保存（appendRowは遅いのでsetValuesで一括書き込み）
  const logRows2Write = newArticles.map(item => buildRowLayerA(item, logSheet));
  const logLastRow = logSheet.getLastRow();
  const logNumCols = logSheet.getLastColumn();
  try {
    logSheet.getRange(logLastRow + 1, 1, logRows2Write.length, logNumCols).setValues(logRows2Write);
  } catch(e) {
    Logger.log('[全件ログ保存エラー] ' + e.message);
  }
  const savedLog = logRows2Write.length;
  Logger.log('--- Step3: 全件ログ（原本庫相当）保存 ---');
  Logger.log('保存成功: ' + savedLog + '件');

  // 4. 公開DBにも同様に層Aのみで保存
  // 公開DBも同様にSetで一括読み込み
  const pubColMap   = getColMap(publicSheet);
  const pubUrlIdx   = pubColMap[COL.URL];
  const pubTitleIdx = pubColMap[COL.TITLE];
  const pubRows     = publicSheet.getDataRange().getValues();
  const existingPubKeys = new Set();
  pubRows.slice(1).forEach(row => {
    if (pubUrlIdx   !== undefined && row[pubUrlIdx])   existingPubKeys.add(row[pubUrlIdx]);
    if (pubTitleIdx !== undefined && row[pubTitleIdx]) existingPubKeys.add(row[pubTitleIdx]);
  });

  let savedPublic  = 0;
  let notMatched   = 0;
  let dupInPublic  = 0;
  const pubRows2Write = [];
  newArticles.forEach(item => {
    if (!shouldAutoPublish(item)) {
      notMatched++;
      return;
    }
    const key = item.url || item.title;
    if (existingPubKeys.has(key)) {
      dupInPublic++;
      return;
    }
    pubRows2Write.push(buildRowLayerA(item, publicSheet));
    existingPubKeys.add(key);
    savedPublic++;
  });
  if (pubRows2Write.length > 0) {
    const pubLastRow = publicSheet.getLastRow();
    const pubNumCols = publicSheet.getLastColumn();
    publicSheet.getRange(pubLastRow + 1, 1, pubRows2Write.length, pubNumCols).setValues(pubRows2Write);
  }

  Logger.log('--- Step4: 観測DB（公開用）保存 ---');
  Logger.log('観測DB追加: ' + savedPublic + '件');
  Logger.log('キーワード不一致でスキップ（対象外相当・層Aの時点ではis_target判定はしていない）: ' + notMatched + '件');
  Logger.log('観測DB内で既に重複と判定されスキップ: ' + dupInPublic + '件');

  Logger.log('');
  Logger.log('===== collectNews サマリ =====');
  Logger.log('RSS取得:           ' + articles.length + '件');
  Logger.log('新着（重複除外後）: ' + newArticles.length + '件');
  Logger.log('全件ログ保存:       ' + savedLog + '件');
  Logger.log('観測DB追加:         ' + savedPublic + '件');
  Logger.log('===== 層A収集完了 =====');

  if (savedLog > 0 && savedPublic === 0) {
    Logger.log('[原因切り分け] 保存処理：全件ログには保存されたが観測DBには0件。');
    Logger.log('  → shouldAutoPublish()のキーワード判定に該当しないか、観測DB側で既に重複判定されている可能性。');
    Logger.log('  → 表示側の問題ではなく、観測DBへの保存条件の問題です。');
  }

  Logger.log('===== 層A収集完了。Gemini分類は classifyUnclassifiedBatch() で後続実行してください =====');
  // 当事者メディア収集は collectTojishaSources()（6時30分トリガー）で別実行
}

// ===== 層A行データの組み立て（列名マップに基づく・列順非依存）=====
// sheetを渡すことで、そのシートの実際のヘッダー順に合わせた配列を返す。
// 層B・管理列は空欄（未分類状態）で初期化する。
function buildRowLayerA(item, sheet) {
  const colMap = getColMap(sheet);
  const numCols = sheet.getLastColumn();
  const row = new Array(numCols).fill('');

  const collectedAt = new Date().toISOString();
  const rssPubDate   = item.pub_date || ''; // RSSが返した値そのまま。元記事公開日として扱わない
  const hasBodyCache = !!(item.body_cache && item.body_cache.trim());

  function set(colName, value) {
    const idx = colMap[colName];
    if (idx === undefined) return; // 列が存在しない場合は無視（将来の互換性のため）
    row[idx] = value;
  }

  // 層A：必須項目（観測できた情報をそのまま保存。正確性の判断はここではしない）
  set(COL.TITLE,           item.title || '');
  set(COL.URL,              item.url   || ''); // 互換のため既存URL列にも入れる
  set(COL.SOURCE,           item.source_name || '');
  set(COL.PUB_DATE,         rssPubDate); // 旧列。RSS_PUBDATEと同値を入れておく（後方互換）
  set(COL.COLLECTED_AT,     collectedAt);
  set(COL.RSS_SUMMARY,      item.description || '');
  set(COL.BODY_CACHE_FLAG,  hasBodyCache ? 'あり' : 'なし');
  set(COL.ORIG_ID,          item.orig_id || '');

  // ===== 日付の観測値（v4）=====
  set(COL.RSS_PUBDATE,      rssPubDate);
  set(COL.GOOGLE_NEWS_URL,  item.url || ''); // RSS収集時点ではGoogleニュースのラッパーURLであることが多い
  set(COL.ORIGINAL_URL,            ''); // 後処理（retryFetchOriginalMetadata）で埋める
  set(COL.ORIGINAL_PUBLISHED_AT,   ''); // 同上
  // 取れなかったものは「未確認」として残す。無理に推定値を入れない。
  set(COL.DATE_STATUS,      DATE_STATUS.UNCONFIRMED);

  // ===== 旧DATE列は埋めない方針に変更 =====
  // 以前はGemini分類時にここへ推定日付を入れていたが、
  // Googleニュース再配信等により誤った日付が「確定値」のように見えてしまう問題があったため、
  // 層Aの時点ではDATE列に値を入れない。値が要るのは表示側で original_published_at が無い場合のみ。

  // 旧来の古い記事フラグは date_status が未確定の段階では判定しない
  // （誤ったDATE列を根拠に判定していた問題を避けるため）

  // 層B・管理列：未分類状態で明示的に初期化
  set(COL.GEMINI_DONE,     false); // 後方互換
  set(COL.GEMINI_TRIED_AT, '');
  set(COL.CLASSIFY_STATUS, CLASSIFY_STATUS.UNCLASSIFIED);

  // ===== 観測メタデータ（Step1：記事から直接取得・AI不使用）=====
  const titleNorm   = normalizeTitle(item.title);
  const domain      = extractDomain(item.url);
  const rawTextForMeta = (item.title || '') + ' ' + (item.description || '');

  set(COL.TITLE_NORMALIZED,     titleNorm);
  set(COL.SOURCE_DOMAIN,        domain);
  set(COL.DEDUP_HASH,           computeDedupHash(titleNorm, rssPubDate, domain));
  set(COL.LAW_REFS_RAW,         extractLawRefs(rawTextForMeta));
  set(COL.INSTITUTION_REFS_RAW, extractInstitutionRefs(rawTextForMeta));
  set(COL.TAG_SOURCE,           'rule');

  return row;
}

// ===== 層B：Gemini分類・要約の後処理バッチ =====
// 「Gemini分類済み」がfalseの行を対象に分類を試みる。
// 429やエラー時は分類済みフラグをfalseのまま残し、試行日時だけ更新する。
// 観測DB保存そのものには一切影響しない（既に層Aで確定保存済みのため）。
function classifyUnclassifiedBatch(limit) {
  limit = limit || 20;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = getOrCreateFullLogSheet(ss);
  const tags = loadTagMaster(ss);
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  if (!apiKey) {
    Logger.log('APIキーが未設定。setupApiKey()を実行してください。');
    return;
  }

  const colMap = getColMap(logSheet);
  const idxStatus = colMap[COL.CLASSIFY_STATUS];

  if (idxStatus === undefined) {
    Logger.log('「' + COL.CLASSIFY_STATUS + '」列が見つかりません。migrateToClassifyStatusSchema()を先に実行してください。');
    return;
  }

  const data = logSheet.getDataRange().getValues();

  // 再試行対象：「未分類」または「分類失敗」の行のみ。「分類済み」「対象外」は対象外。
  const RETRY_STATUSES = [CLASSIFY_STATUS.UNCLASSIFIED, CLASSIFY_STATUS.FAILED, ''];
  const targets = [];
  for (let i = 1; i < data.length && targets.length < limit; i++) {
    const status = String(data[i][idxStatus] || '').trim();
    if (!RETRY_STATUSES.includes(status)) continue; // 分類済み・対象外はスキップ
    targets.push({
      rowNum: i + 1,
      title: data[i][colMap[COL.TITLE]],
      url:   data[i][colMap[COL.URL]],
      description: colMap[COL.RSS_SUMMARY] !== undefined ? data[i][colMap[COL.RSS_SUMMARY]] : '',
    });
  }

  Logger.log('===== Gemini分類バッチ開始 対象:' + targets.length + '件 =====');
  if (!targets.length) { Logger.log('未分類/分類失敗の行はありません'); return; }

  const articlesForGemini = targets.map(t => ({
    title: t.title,
    url:   t.url,
    description: t.description,
    source_name: '',
  }));

  const classified = classifyWithGemini(articlesForGemini, tags, apiKey);

  let doneCount    = 0;
  let outOfScopeCount = 0;
  let failCount    = 0;
  const triedAt = new Date().toISOString();

  classified.forEach((item, idx) => {
    const target = targets[idx];
    if (!target) return;

    // classifyWithGemini が429等で失敗しフォールバックを返した場合
    const isGeminiFailure = item.gemini_failed === true;

    const r = target.rowNum;
    function setIfExists(colName, value) {
      const idx2 = colMap[colName];
      if (idx2 === undefined) return;
      logSheet.getRange(r, idx2 + 1).setValue(value);
    }

    setIfExists(COL.GEMINI_TRIED_AT, triedAt);

    if (isGeminiFailure) {
      // API失敗・JSON抽出失敗 → 分類失敗（再試行対象として残す）
      setIfExists(COL.CLASSIFY_STATUS, CLASSIFY_STATUS.FAILED);
      failCount++;
      Logger.log('[分類失敗] 行' + r + ' 「' + String(target.title).slice(0,30) + '」 → 再試行対象として残す');
      return;
    }

    if (item.is_target === false) {
      // MANA対象外と明確に判定された記事 → 観測DBには残すが再分類・カルテ化はしない
      setIfExists(COL.CLASSIFY_STATUS, CLASSIFY_STATUS.OUT_OF_SCOPE);
      outOfScopeCount++;
      Logger.log('[対象外] 行' + r + ' 「' + String(target.title).slice(0,30) + '」 → 再分類・カルテ化の対象から除外');
      return;
    }

    const enriched = applyRuleBasedTags(item);

    // 古い記事フラグ判定
    let isOld = false;
    const pubDateRaw = enriched.date || '';
    if (pubDateRaw) {
      const pub = new Date(pubDateRaw);
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      if (!isNaN(pub.getTime()) && pub < twoYearsAgo) isOld = true;
    }

    setIfExists(COL.DATE,           enriched.date || '');
    setIfExists(COL.REGION,         enriched.region || '');
    setIfExists(COL.MUNICIPALITY,   enriched.municipality || '');
    setIfExists(COL.FIELD,          enriched.field || '');
    setIfExists(COL.SUMMARY,        enriched.summary || '');
    setIfExists(COL.TAGS_EVENT,     enriched.tags_event || '');
    setIfExists(COL.TAGS_STRUCTURE, enriched.tags_structure || '');
    setIfExists(COL.TAGS_EVIDENCE,  enriched.tags_evidence || '');
    setIfExists(COL.TAGS_STATUS,    enriched.tags_status || '');
    setIfExists(COL.SEVERITY,       enriched.severity || '');
    setIfExists(COL.STRUCT_NOTE,    enriched.structure_note || '');
    setIfExists(COL.OLD_FLAG,       isOld ? '古い記事候補' : '');

    const layerBComplete = !!(enriched.region && enriched.field);

    if (layerBComplete) {
      // region/fieldが揃った → 分類済み（カルテ生成の対象になりうる）
      setIfExists(COL.CLASSIFY_STATUS, CLASSIFY_STATUS.DONE);
      doneCount++;
      Logger.log('[分類済み] 行' + r + ' 「' + String(target.title).slice(0,30) + '」 地域:' + enriched.region + ' 分野:' + enriched.field);
    } else {
      // is_target=trueだがregion/fieldが特定できなかった → 未分類のまま残し再試行対象にする
      setIfExists(COL.CLASSIFY_STATUS, CLASSIFY_STATUS.UNCLASSIFIED);
      Logger.log('[分類保留] 行' + r + ' 「' + String(target.title).slice(0,30) + '」 → 地域/分野不明、再試行対象として残す');
    }
  });

  Logger.log('===== Gemini分類バッチ完了 分類済み:' + doneCount + '件 対象外:' + outOfScopeCount + '件 分類失敗:' + failCount + '件 =====');
}

// ===== 公開DBに自動反映すべきか判定 =====
function shouldAutoPublish(item) {
  // 層A段階ではGemini要約(summary)がまだ無いため、RSS要約(description)もフォールバックで見る
  const text = (
    (item.title || '') + ' ' +
    (item.summary || item.description || '') + ' ' +
    (item.source_name || '')
  ).toLowerCase();
  return AUTO_PUBLIC_KEYWORDS.some(kw => text.includes(kw));
}

// ===== 行データを組み立てる（旧版・現在未使用）=====
// 層A/層B分離設計（v3）導入により、新規保存は buildRowLayerA() を使用する。
// この関数は過去の列構成との互換確認用に残置。
function buildRow(item) {
  const collectedAt = new Date().toISOString();
  const pubDate     = item.pub_date || item.date || '';

  // 古い記事フラグ：公開日が2年以上前なら true
  let isOld = false;
  if (pubDate) {
    const pub = new Date(pubDate);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    if (!isNaN(pub.getTime()) && pub < twoYearsAgo) isOld = true;
  }

  return [
    item.date,          // 日付（Geminiが推定した記事公開日）
    item.region,
    item.municipality,
    item.field,
    item.source_name,
    item.url,
    item.title,
    item.summary,
    item.tags_event,
    item.tags_structure,
    item.tags_evidence,
    item.tags_status,
    item.severity,
    item.structure_note,
    collectedAt,        // 収録日時（MANAが観測した日）
    pubDate,            // 公開日（RSSのpubDate）
    isOld ? '古い記事候補' : ''  // 古い記事フラグ
  ];
}

// ===== RSS収集 =====
function fetchFromRSS() {
  const articles = [];
  const seen = new Set();

  RSS_SOURCES.forEach(source => {
    try {
      const response = UrlFetchApp.fetch(source.url, {
        muteHttpExceptions: true,
        headers: { 'User-Agent': 'Mozilla/5.0' },
        followRedirects: true
      });

      const code = response.getResponseCode();
      if (code !== 200) {
        Logger.log(source.name + ': HTTP ' + code);
        return;
      }

      const xml = XmlService.parse(response.getContentText('UTF-8'));
      const root = xml.getRootElement();
      let items = [];
      const channel = root.getChild('channel');
      if (channel) {
        items = channel.getChildren('item');
      } else {
        items = root.getChildren('entry');
      }

      Logger.log(source.name + ': ' + items.length + '件取得');

      items.forEach(item => {
        try {
          const title = getTextSafe(item, ['title']);
          const link  = getTextSafe(item, ['link', 'guid']);
          const desc  = getTextSafe(item, ['description', 'summary', 'content']);
          const date  = getTextSafe(item, ['pubDate', 'published', 'updated']);

          if (!title || seen.has(title)) return;
          seen.add(title);

          articles.push({
            title:       title.trim(),
            url:         link.trim(),
            description: desc.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 400),
            source_name: source.name,
            pub_date:    date,
          });
        } catch(e) {}
      });

    } catch(e) {
      Logger.log(source.name + ' エラー: ' + e.message);
    }
  });

  const seen2 = new Set();
  return articles.filter(a => {
    if (seen2.has(a.title)) return false;
    seen2.add(a.title);
    return true;
  });
}

function getTextSafe(element, tagNames) {
  for (const tag of tagNames) {
    try {
      const child = element.getChild(tag);
      if (child) {
        const text = child.getText() || child.getValue();
        if (text) return text;
      }
    } catch(e) {}
  }
  return '';
}

// ===== ルールベース タグ付け =====
const FIELD_RULES = [
  { keywords: ['生活保護','生活支援','保護費','保護受給','水際'], tag: '生活保護' },
  { keywords: ['障害','障がい','障碍','手帳','支給量','サービス等利用計画'], tag: '障害福祉' },
  { keywords: ['介護','要介護','ケアマネ','訪問介護','デイサービス'], tag: '介護' },
  { keywords: ['訪問看護','訪問診療'], tag: '訪問看護' },
  { keywords: ['財政','財源','収支','決算','歳入','歳出'], tag: '財政' },
  { keywords: ['予算','補正予算','当初予算'], tag: '予算' },
  { keywords: ['基金','積立','財政調整基金'], tag: '基金' },
  { keywords: ['地方債','起債','債務','借金'], tag: '地方債' },
  { keywords: ['行財政改革','行革','行政改革','スリム化'], tag: '行財政改革' },
  { keywords: ['指定管理','指定管理者'], tag: '指定管理' },
  { keywords: ['公共施設','市民会館','体育館','図書館','プール'], tag: '公共施設' },
  { keywords: ['情報公開','開示請求','黒塗り','不開示'], tag: '情報公開' },
  { keywords: ['議会','議員','質疑','答弁','委員会'], tag: '議会' },
  { keywords: ['監査','監査委員','内部監査'], tag: '監査' },
  { keywords: ['裁判','訴訟','判決','原告','被告','控訴'], tag: '裁判' },
  { keywords: ['子育て','保育','保育所','児童','育休'], tag: '子育て' },
  { keywords: ['医療','病院','診療','保険証','健康保険'], tag: '医療' },
  { keywords: ['住宅','家賃','居住','退去'], tag: '住宅' },
  { keywords: ['雇用','失業','ハローワーク','求職'], tag: '雇用' },
  { keywords: ['相談支援','相談員','ケースワーカー'], tag: '相談支援' },
];

const EVENT_RULES = [
  { keywords: ['申請妨害','申請を断','窓口で断','申請させ'], tag: '申請妨害' },
  { keywords: ['水際','追い返','門前払い'], tag: '水際' },
  { keywords: ['扶養照会','家族に相談','親族に'], tag: '扶養照会濫用' },
  { keywords: ['虚偽記録','虚偽記載','改ざん','偽り','ねつ造'], tag: '記録改ざん' },
  { keywords: ['情報隠蔽','隠蔽','隠す','開示しない','黒塗り'], tag: '情報非公開' },
  { keywords: ['長期放置','放置','対応せず','放っておか'], tag: '長期放置' },
  { keywords: ['説明しない','説明拒否','答えない','回答しない'], tag: '説明拒否' },
  { keywords: ['差し戻し','再提出','書類が足りない'], tag: '差し戻し' },
  { keywords: ['支給停止','打ち切り','廃止','削減'], tag: '支給停止' },
  { keywords: ['過払い','誤払い','過大支給','返還'], tag: '誤情報提供' },
  { keywords: ['財政推計','見通し誤り','推計ミス','試算誤り'], tag: '財政推計ミス' },
  { keywords: ['撤回せず','方針継続','変更しない','政策継続'], tag: '政策撤回なし' },
  { keywords: ['本人の意向','本人の意思','当事者の声を無視'], tag: '本人意思の無視' },
  { keywords: ['たらい回し','たらいまわし','窓口を転々'], tag: '窓口たらい回し' },
  { keywords: ['書類紛失','書類をなくし','紛失'], tag: '書類紛失' },
];

const STATUS_RULES = [
  { keywords: ['謝罪','お詫び','陳謝'], tag: '謝罪あり' },
  { keywords: ['誤りを認め','ミスを認め','不適切と認め'], tag: '誤り認定' },
  { keywords: ['是正','改善','対応した','対策を'], tag: '是正あり' },
  { keywords: ['係争','訴訟中','争い','不服申立'], tag: '係争中' },
  { keywords: ['再発','繰り返し','また同じ','再び'], tag: '再発' },
  { keywords: ['撤回せず','継続','変わらず'], tag: '撤回なし' },
];

// ===== 法令名リスト（laws.json の name / short_name から直接引用）=====
// 記事テキストとの文字列マッチに使用。AI推定なし・記事から直接取得。
const LAW_NAMES = [
  '生活保護法',
  '障害者総合支援法',
  '障害者の日常生活及び社会生活を総合的に支援するための法律',
  '介護保険法',
  '児童福祉法',
  '行政手続法',
  '行政不服審査法',
  '情報公開法',
  '行政機関の保有する情報の公開に関する法律',
  '国民健康保険法',
  '社会福祉法',
  '行政事件訴訟法',
];

// ===== 機関名リスト（省庁・行政機関）=====
// 都道府県・市区町村は既存の region / municipality 列で管理済みのため除外。
// ここでは国の省庁・広域機関・専門機関のみを対象とする。
const INSTITUTION_NAMES = [
  '厚生労働省', '厚労省', '総務省', '内閣府', '財務省',
  '文部科学省', '国土交通省', '法務省', '経済産業省',
  '農林水産省', '環境省', '防衛省', '内閣官房',
  '福祉事務所', '児童相談所', '社会福祉協議会',
  '介護保険審査会', '社会保険審査官', '社会保険審査会',
  'ハローワーク', '公共職業安定所',
  '地方裁判所', '高等裁判所', '最高裁判所',
  '後期高齢者医療広域連合', '国民健康保険団体連合会',
  '監査委員', '行政委員会', '人事委員会', '教育委員会',
  '国民健康保険', '社会保険事務所',
];

const STRUCTURE_RULES = [
  { keywords: ['説明責任','説明すべき','公表すべき','情報開示'], tag: '説明責任' },
  { keywords: ['繰り返し','同様の事案','類似事案','また同じ'], tag: '反復構造' },
  { keywords: ['組織的','組織として','幹部が','上の判断'], tag: '組織防衛' },
  { keywords: ['前例','慣例','ずっとそうしてきた','これまでの'], tag: '前例主義' },
  { keywords: ['当事者','本人が','利用者が','患者が'], tag: '当事者主体の不実装' },
  { keywords: ['制度があるのに','法律では','条例では','規定では'], tag: '制度実装の失敗' },
];

const REGION_RULES = [
  { keywords: ['北海道','札幌','函館','旭川'], pref: '北海道' },
  { keywords: ['青森','弘前','八戸'], pref: '青森県' },
  { keywords: ['岩手','盛岡','一関'], pref: '岩手県' },
  { keywords: ['宮城','仙台','石巻'], pref: '宮城県' },
  { keywords: ['秋田','大仙','横手'], pref: '秋田県' },
  { keywords: ['山形','米沢','鶴岡'], pref: '山形県' },
  { keywords: ['福島','郡山','いわき'], pref: '福島県' },
  { keywords: ['茨城','水戸','つくば'], pref: '茨城県' },
  { keywords: ['栃木','宇都宮','日光'], pref: '栃木県' },
  { keywords: ['群馬','前橋','高崎'], pref: '群馬県' },
  { keywords: ['埼玉','さいたま','川越','熊谷'], pref: '埼玉県' },
  { keywords: ['千葉','船橋','松戸','柏'], pref: '千葉県' },
  { keywords: ['東京','新宿','渋谷','世田谷','足立','江戸川','板橋'], pref: '東京都' },
  { keywords: ['神奈川','横浜','川崎','相模原'], pref: '神奈川県' },
  { keywords: ['新潟','長岡','上越','南魚沼','燕市'], pref: '新潟県' },
  { keywords: ['富山','高岡','魚津'], pref: '富山県' },
  { keywords: ['石川','金沢','小松'], pref: '石川県' },
  { keywords: ['福井','敦賀','越前'], pref: '福井県' },
  { keywords: ['山梨','甲府','富士吉田'], pref: '山梨県' },
  { keywords: ['長野','松本','上田','飯田'], pref: '長野県' },
  { keywords: ['岐阜','大垣','高山'], pref: '岐阜県' },
  { keywords: ['静岡','浜松','沼津'], pref: '静岡県' },
  { keywords: ['愛知','名古屋','豊橋','岡崎'], pref: '愛知県' },
  { keywords: ['三重','津市','四日市','伊勢'], pref: '三重県' },
  { keywords: ['滋賀','大津','彦根','草津'], pref: '滋賀県' },
  { keywords: ['京都','京都市','宇治','亀岡','伏見'], pref: '京都府' },
  { keywords: ['大阪','大阪市','堺','東大阪','豊中'], pref: '大阪府' },
  { keywords: ['兵庫','神戸','姫路','尼崎'], pref: '兵庫県' },
  { keywords: ['奈良','奈良市','橿原','生駒'], pref: '奈良県' },
  { keywords: ['和歌山','田辺','橋本'], pref: '和歌山県' },
  { keywords: ['鳥取','米子','倉吉'], pref: '鳥取県' },
  { keywords: ['島根','松江','出雲'], pref: '島根県' },
  { keywords: ['岡山','倉敷','津山'], pref: '岡山県' },
  { keywords: ['広島','広島市','福山','呉'], pref: '広島県' },
  { keywords: ['山口','下関','宇部'], pref: '山口県' },
  { keywords: ['徳島','鳴門','阿南'], pref: '徳島県' },
  { keywords: ['香川','高松','丸亀'], pref: '香川県' },
  { keywords: ['愛媛','松山','今治','新居浜'], pref: '愛媛県' },
  { keywords: ['高知','高知市','南国'], pref: '高知県' },
  { keywords: ['福岡','福岡市','北九州','久留米'], pref: '福岡県' },
  { keywords: ['佐賀','唐津','鳥栖'], pref: '佐賀県' },
  { keywords: ['長崎','佐世保','諫早'], pref: '長崎県' },
  { keywords: ['熊本','熊本市','八代'], pref: '熊本県' },
  { keywords: ['大分','別府','中津'], pref: '大分県' },
  { keywords: ['宮崎','都城','延岡'], pref: '宮崎県' },
  { keywords: ['鹿児島','薩摩','奄美'], pref: '鹿児島県' },
  { keywords: ['沖縄','那覇','宜野湾','浦添'], pref: '沖縄県' },
  { keywords: ['厚生労働省','厚労省'], pref: '厚労省' },
  { keywords: ['総務省'], pref: '総務省' },
  { keywords: ['内閣府'], pref: '内閣府' },
];

// ===== 市区町村 → 都道府県 逆引きマップ =====
// 市区町村名が記事に出ても都道府県を補完できるようにする
// ===== 市区町村 → 都道府県 逆引きマップ =====
// 区名のみのキーは誤判定を防ぐため含めない（例：北区・中央区・港区は削除）
// 東京23区は別途テキスト内「東京」の確認後に判定する
// region / municipality が既に入っている場合は上書きしない
const CITY_TO_PREF = {
  // 北海道
  '札幌市':'北海道','函館市':'北海道','旭川市':'北海道','釧路市':'北海道','帯広市':'北海道',
  '北見市':'北海道','苫小牧市':'北海道','小樽市':'北海道','江別市':'北海道','恵庭市':'北海道',
  // 東北
  '青森市':'青森県','弘前市':'青森県','八戸市':'青森県',
  '盛岡市':'岩手県','一関市':'岩手県','奥州市':'岩手県','花巻市':'岩手県',
  '仙台市':'宮城県','石巻市':'宮城県','大崎市':'宮城県','気仙沼市':'宮城県',
  '秋田市':'秋田県','横手市':'秋田県','大仙市':'秋田県','能代市':'秋田県',
  '山形市':'山形県','鶴岡市':'山形県','酒田市':'山形県','米沢市':'山形県',
  '福島市':'福島県','郡山市':'福島県','いわき市':'福島県','会津若松市':'福島県',
  // 関東（市名のみ・区名は含めない）
  '水戸市':'茨城県','つくば市':'茨城県','日立市':'茨城県','土浦市':'茨城県','ひたちなか市':'茨城県',
  '宇都宮市':'栃木県','小山市':'栃木県','栃木市':'栃木県','足利市':'栃木県','那須塩原市':'栃木県',
  '前橋市':'群馬県','高崎市':'群馬県','太田市':'群馬県','伊勢崎市':'群馬県','桐生市':'群馬県',
  'さいたま市':'埼玉県','川越市':'埼玉県','川口市':'埼玉県','所沢市':'埼玉県','越谷市':'埼玉県',
  '草加市':'埼玉県','春日部市':'埼玉県','上尾市':'埼玉県','熊谷市':'埼玉県','新座市':'埼玉県',
  '志木市':'埼玉県','朝霞市':'埼玉県','和光市':'埼玉県','三郷市':'埼玉県','狭山市':'埼玉県',
  '千葉市':'千葉県','船橋市':'千葉県','松戸市':'千葉県','柏市':'千葉県','市川市':'千葉県',
  '市原市':'千葉県','流山市':'千葉県','八千代市':'千葉県','我孫子市':'千葉県','鎌ヶ谷市':'千葉県',
  '浦安市':'千葉県','習志野市':'千葉県','木更津市':'千葉県','成田市':'千葉県',
  // 東京（市名のみ。区名はテキスト内「東京」確認後に別途処理）
  '八王子市':'東京都','町田市':'東京都','府中市':'東京都','調布市':'東京都',
  '西東京市':'東京都','立川市':'東京都','武蔵野市':'東京都','三鷹市':'東京都',
  '小平市':'東京都','東村山市':'東京都','日野市':'東京都','多摩市':'東京都',
  '稲城市':'東京都','国分寺市':'東京都','国立市':'東京都','昭島市':'東京都',
  '横浜市':'神奈川県','川崎市':'神奈川県','相模原市':'神奈川県','藤沢市':'神奈川県',
  '横須賀市':'神奈川県','平塚市':'神奈川県','厚木市':'神奈川県','大和市':'神奈川県',
  '茅ヶ崎市':'神奈川県','小田原市':'神奈川県','海老名市':'神奈川県','秦野市':'神奈川県',
  // 甲信越・北陸
  '新潟市':'新潟県','長岡市':'新潟県','上越市':'新潟県','三条市':'新潟県','燕市':'新潟県',
  '富山市':'富山県','高岡市':'富山県','射水市':'富山県','魚津市':'富山県',
  '金沢市':'石川県','小松市':'石川県','白山市':'石川県','加賀市':'石川県',
  '福井市':'福井県','敦賀市':'福井県','越前市':'福井県',
  '甲府市':'山梨県','富士吉田市':'山梨県','南アルプス市':'山梨県',
  '長野市':'長野県','松本市':'長野県','上田市':'長野県','飯田市':'長野県','諏訪市':'長野県',
  // 東海
  '岐阜市':'岐阜県','大垣市':'岐阜県','高山市':'岐阜県','各務原市':'岐阜県',
  '静岡市':'静岡県','浜松市':'静岡県','沼津市':'静岡県','富士市':'静岡県','磐田市':'静岡県',
  '名古屋市':'愛知県','豊橋市':'愛知県','岡崎市':'愛知県','一宮市':'愛知県','豊田市':'愛知県',
  '春日井市':'愛知県','安城市':'愛知県','西尾市':'愛知県','刈谷市':'愛知県','豊川市':'愛知県',
  '津市':'三重県','四日市市':'三重県','伊勢市':'三重県','松阪市':'三重県','桑名市':'三重県',
  // 近畿
  '大津市':'滋賀県','草津市':'滋賀県','彦根市':'滋賀県','長浜市':'滋賀県','東近江市':'滋賀県',
  '京都市':'京都府','宇治市':'京都府','亀岡市':'京都府','城陽市':'京都府','向日市':'京都府',
  '長岡京市':'京都府','八幡市':'京都府','京田辺市':'京都府',
  '大阪市':'大阪府','堺市':'大阪府','東大阪市':'大阪府','豊中市':'大阪府','枚方市':'大阪府',
  '吹田市':'大阪府','高槻市':'大阪府','八尾市':'大阪府','茨木市':'大阪府','寝屋川市':'大阪府',
  '岸和田市':'大阪府','和泉市':'大阪府','摂津市':'大阪府','松原市':'大阪府','箕面市':'大阪府',
  '神戸市':'兵庫県','姫路市':'兵庫県','尼崎市':'兵庫県','明石市':'兵庫県','西宮市':'兵庫県',
  '芦屋市':'兵庫県','伊丹市':'兵庫県','宝塚市':'兵庫県','川西市':'兵庫県','三田市':'兵庫県',
  '加古川市':'兵庫県','丹波市':'兵庫県','豊岡市':'兵庫県',
  '奈良市':'奈良県','橿原市':'奈良県','生駒市':'奈良県','大和高田市':'奈良県',
  '和歌山市':'和歌山県','田辺市':'和歌山県','橋本市':'和歌山県','海南市':'和歌山県',
  // 中国・四国
  '鳥取市':'鳥取県','米子市':'鳥取県','倉吉市':'鳥取県',
  '松江市':'島根県','出雲市':'島根県','浜田市':'島根県',
  '岡山市':'岡山県','倉敷市':'岡山県','津山市':'岡山県','総社市':'岡山県',
  '広島市':'広島県','福山市':'広島県','呉市':'広島県','東広島市':'広島県','尾道市':'広島県',
  '下関市':'山口県','宇部市':'山口県','山口市':'山口県','周南市':'山口県',
  '徳島市':'徳島県','鳴門市':'徳島県','阿南市':'徳島県',
  '高松市':'香川県','丸亀市':'香川県','さぬき市':'香川県',
  '松山市':'愛媛県','今治市':'愛媛県','新居浜市':'愛媛県','西条市':'愛媛県',
  '高知市':'高知県','南国市':'高知県','四万十市':'高知県',
  // 九州・沖縄
  '福岡市':'福岡県','北九州市':'福岡県','久留米市':'福岡県','飯塚市':'福岡県','春日市':'福岡県',
  '大牟田市':'福岡県','筑紫野市':'福岡県',
  '佐賀市':'佐賀県','唐津市':'佐賀県','鳥栖市':'佐賀県',
  '長崎市':'長崎県','佐世保市':'長崎県','諫早市':'長崎県','大村市':'長崎県',
  '熊本市':'熊本県','八代市':'熊本県','天草市':'熊本県',
  '大分市':'大分県','別府市':'大分県','中津市':'大分県','日田市':'大分県',
  '宮崎市':'宮崎県','都城市':'宮崎県','延岡市':'宮崎県',
  '鹿児島市':'鹿児島県','霧島市':'鹿児島県','鹿屋市':'鹿児島県','薩摩川内市':'鹿児島県',
  '那覇市':'沖縄県','沖縄市':'沖縄県','宜野湾市':'沖縄県','浦添市':'沖縄県','うるま市':'沖縄県',
  '名護市':'沖縄県','豊見城市':'沖縄県','糸満市':'沖縄県',
};

// 東京23区リスト（テキスト内に「東京」がある場合のみ使用）
const TOKYO_WARDS = [
  '千代田区','中央区','港区','新宿区','文京区','台東区','墨田区','江東区',
  '品川区','目黒区','大田区','世田谷区','渋谷区','中野区','杉並区','豊島区',
  '北区','荒川区','板橋区','練馬区','足立区','葛飾区','江戸川区',
];

function applyRuleBasedTags(item) {
  const text = ((item.title || '') + ' ' + (item.summary || '') + ' ' + (item.source_name || '')).toLowerCase();

  const fieldTags = [];
  FIELD_RULES.forEach(rule => {
    if (rule.keywords.some(kw => text.includes(kw))) {
      if (!fieldTags.includes(rule.tag)) fieldTags.push(rule.tag);
    }
  });

  const eventTags = [];
  EVENT_RULES.forEach(rule => {
    if (rule.keywords.some(kw => text.includes(kw))) {
      if (!eventTags.includes(rule.tag)) eventTags.push(rule.tag);
    }
  });

  const statusTags = [];
  STATUS_RULES.forEach(rule => {
    if (rule.keywords.some(kw => text.includes(kw))) {
      if (!statusTags.includes(rule.tag)) statusTags.push(rule.tag);
    }
  });

  const structureTags = [];
  STRUCTURE_RULES.forEach(rule => {
    if (rule.keywords.some(kw => text.includes(kw))) {
      if (!structureTags.includes(rule.tag)) structureTags.push(rule.tag);
    }
  });

  // --- 地域抽出（3段階） ---
  let region     = item.region     || '';
  let municipality = item.municipality || '';

  // 段階1: REGION_RULESで都道府県を補完（都道府県名・代表都市名キーワード）
  REGION_RULES.forEach(rule => {
    if (rule.keywords.some(kw => text.includes(kw.toLowerCase()))) {
      if (!region) region = rule.pref;
    }
  });

  // 段階2: CITY_TO_PREFで市区町村名→都道府県を逆引き補完
  // ・長い名前から順にマッチ（「さいたま市」が「さいたま」より先にマッチするよう）
  // ・region が空、または municipality が空の場合のみ補完
  const rawText = (item.title || '') + ' ' + (item.summary || '') + ' ' + (item.source_name || '');
  if (!region || !municipality) {
    // キーを文字数降順にソートして長い名前を優先マッチ
    const sortedCities = Object.keys(CITY_TO_PREF).sort((a, b) => b.length - a.length);
    for (const city of sortedCities) {
      if (rawText.includes(city)) {
        if (!region)       region       = CITY_TO_PREF[city];
        if (!municipality) municipality = city;
        break;
      }
    }
  }

  // 段階2b: 東京23区は記事内に「東京」がある場合のみ補完
  if ((!region || !municipality) && rawText.includes('東京')) {
    for (const ward of TOKYO_WARDS) {
      if (rawText.includes(ward)) {
        if (!region)       region       = '東京都';
        if (!municipality) municipality = ward;
        break;
      }
    }
  }

  // 段階3: 出典名から都道府県を補完（最終フォールバック）
  const sourceName = item.source_name || '';
  if (!region) {
    if (sourceName.includes('京都')) region = '京都府';
    else if (sourceName.includes('大阪')) region = '大阪府';
    else if (sourceName.includes('東京')) region = '東京都';
  }

  return {
    ...item,
    region:       region       || item.region       || '',
    municipality: municipality || item.municipality || '',
    field: item.field || fieldTags[0] || '',
    tags_event:     mergeTagStr(item.tags_event, eventTags),
    tags_structure: mergeTagStr(item.tags_structure, structureTags),
    tags_status:    mergeTagStr(item.tags_status, statusTags),
    tags_evidence:  item.tags_evidence || (sourceName ? '報道' : ''),
  };
}

function mergeTagStr(existing, newTags) {
  const existingArr = existing ? existing.split(' / ').map(t => t.trim()).filter(Boolean) : [];
  const merged = [...new Set([...existingArr, ...newTags])];
  return merged.join(' / ');
}

// ===== 観測メタデータ抽出ユーティリティ（Step1）=====
// 記事から直接取得。AI推定なし。

// タイトル正規化：記号・全角英数を除去・統一して重複判定に使う
function normalizeTitle(title) {
  if (!title) return '';
  return title
    .replace(/[　\s]+/g, ' ')
    .replace(/[「」『』【】〔〕［］〈〉《》""'']/g, '')
    .replace(/[、。！？!?・…‥〜～―－]/g, '')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
      return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    })
    .trim()
    .toLowerCase();
}

// URLからドメインを抽出（www. は除去）
function extractDomain(url) {
  if (!url) return '';
  try {
    const m = String(url).match(/^https?:\/\/([^\/\?#]+)/);
    return m ? m[1].replace(/^www\./, '') : '';
  } catch(e) { return ''; }
}

// 重複判定用ハッシュ：title_normalized + pubDate + domain のMD5前半16文字
function computeDedupHash(titleNorm, pubDate, domain) {
  const str = [titleNorm, pubDate || '', domain].join('|');
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, str);
  return bytes.map(function(b) {
    return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0');
  }).join('').slice(0, 16);
}

// 法令名抽出：テキスト中に含まれる法令名をカンマ区切りで返す（記事直接抽出）
function extractLawRefs(text) {
  if (!text) return '';
  return LAW_NAMES.filter(function(name) { return text.includes(name); }).join(', ');
}

// 機関名抽出：テキスト中に含まれる機関名をカンマ区切りで返す（記事直接抽出）
function extractInstitutionRefs(text) {
  if (!text) return '';
  return INSTITUTION_NAMES.filter(function(name) { return text.includes(name); }).join(', ');
}

function classifyWithGemini(articles, tags, apiKey) {
  const results = [];
  const batchSize = 5;

  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    const classified = classifyBatch(batch, tags, apiKey);
    results.push(...classified);
    if (i + batchSize < articles.length) Utilities.sleep(2000);
  }

  return results;
}

function classifyBatch(articles, tags, apiKey) {
  const articleList = articles.map((a, i) =>
    `[${i+1}] タイトル:${a.title}\n概要:${a.description.slice(0, 200)}\n出典:${a.source_name}\nURL:${a.url}\nRSS公開日:${a.pub_date || '不明'}`
  ).join('\n\n');

  const prompt = `
あなたは日本の行政・社会構造の分析専門家です。
以下のニュース記事を分析し、各記事にタグを付与してください。
全件処理してください。

【最初に判定すること：MANAの観測対象か】
MANAは日本の行政・福祉・財政・制度運用に関する構造的問題を観測するサイトです。
各記事についてまず is_target を判定してください。
- is_target: true → 日本の行政・福祉・財政・制度運用に関係する記事
- is_target: false → 国際情勢、スポーツ、芸能、海外ニュースなど、MANAの観測対象と明確に無関係な記事
判断に迷う場合（行政系だが地域が特定できない等）は is_target: true のまま region/field を空文字にしてよい。
is_target: false は「明確に無関係」と確信できる場合のみ使うこと。

【最重要：構造タグについて】
構造タグとは、個別の事件・不祥事ではなく、
組織や制度の動き・機能不全のパターンを示す概念タグです。
表面の出来事の背後にある「なぜそれが起きたか」「どんな組織的・制度的文脈か」を読み取ってください。

構造タグの例と意味：
- 説明責任：組織が説明を回避・拒否・遅延している
- 情報公開：開示請求、黒塗り、非公開決定など情報アクセスに関する問題
- 組織防衛：組織が自己保存のために情報を隠す・責任を回避する
- 組織的不作為：個人ではなく組織として問題を放置・黙認している
- 公益通報：内部告発、通報者保護に関する問題
- 第三者委員会：外部調査・第三者検証が求められている・阻まれている
- 文書管理：記録の保存・廃棄・改ざん・不存在に関する問題
- 内部統制：組織内のチェック機能が働いていない
- 監査：監査が形骸化している・監査で問題が発覚した
- 権力集中：特定の人物・部署に権限が集中し牽制が機能しない
- 制度実装の失敗：制度・法律・条例はあるが現場で実装されていない
- 当事者主体の不実装：当事者の声・意思が制度設計や運用に反映されていない
- 自己修正不能：問題を認識しても組織が自ら是正できない構造
- 前例主義：前例・慣例を根拠に変化を拒む
- 情報非対称：行政と市民の間に意図的・構造的な情報格差がある
- 反復構造：同種の問題が繰り返し発生している
- 財政危機言説：財政危機を理由に福祉・サービスを削減する論理

【タグリスト（このリスト以外は使わないこと）】
${JSON.stringify(tags)}

【記事リスト】
${articleList}

【出力形式】必ずこのJSONのみ出力。説明文・マークダウン記号は一切含めない。
[
  {
    "article_index": 1,
    "is_target": true,
    "date": "YYYY-MM-DD。RSS公開日（pub_date）が提供されている場合は必ずそれを使うこと。不明な場合のみ今日の日付。",
    "region": "都道府県名のみ（例：京都府、埼玉県、東京都）。記事に市区町村名しか出ない場合も、その市区町村が属する都道府県を必ず推論して入れること。例：さいたま市→埼玉県、川越市→埼玉県、京都市→京都府、札幌市→北海道。国の省庁のみの場合は空文字。どうしても不明な場合のみ空文字。",
    "municipality": "市区町村名のみ（例：京都市、さいたま市、川越市）。区・町・村まで含めてよい。政令市の場合は区名は含めず市名のみ（例：京都市北区→京都市）。不明なら空文字。",
    "field": "分野（生活保護/障害福祉/財政/情報公開など。不明なら空文字）",
    "source_name": "出典名",
    "url": "URL",
    "title": "タイトル",
    "summary": "100文字以内の要約",
    "tags_event": "出来事タグ（複数なら / で区切る）",
    "tags_structure": "構造タグ（複数なら / で区切る。必ず1つ以上付けること）",
    "tags_evidence": "根拠タグ",
    "tags_status": "状態タグ",
    "severity": "高/中/低",
    "structure_note": "この事例が示す構造的問題を一文で。個別事件ではなく組織・制度レベルで書くこと"
  }
]`;

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + apiKey;

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8000 }
      }),
      muteHttpExceptions: true
    });

    const json = JSON.parse(response.getContentText());
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\[[\s\S]*\]/);

    if (!match) {
      Logger.log('JSON抽出失敗。フォールバック保存します。');
      Logger.log('--- デバッグ: rawText先頭500文字 ---');
      Logger.log(text.slice(0, 500));
      Logger.log('--- デバッグ: response HTTPステータス ---');
      Logger.log(response.getResponseCode());
      if (json.error) {
        Logger.log('--- デバッグ: APIエラー ---');
        Logger.log(JSON.stringify(json.error).slice(0, 300));
      }
      return fallbackItems(articles);
    }

    const items = JSON.parse(match[0]);
    return items.map((item, i) => ({
      is_target:      item.is_target !== false, // 明示的にfalseの場合のみ対象外
      date:           item.date || formatDate(new Date()),
      region:         item.region || '',
      municipality:   item.municipality || '',
      field:          item.field || '',
      source_name:    item.source_name || articles[i]?.source_name || '',
      url:            item.url || articles[i]?.url || '',
      title:          item.title || articles[i]?.title || '',
      summary:        item.summary || '',
      tags_event:     item.tags_event || '',
      tags_structure: item.tags_structure || '',
      tags_evidence:  item.tags_evidence || '',
      tags_status:    item.tags_status || '',
      severity:       item.severity || '中',
      structure_note: item.structure_note || '',
      gemini_failed:  false,
    }));

  } catch(e) {
    Logger.log('Gemini処理エラー: ' + e.message);
    return fallbackItems(articles);
  }
}

// ===== Gemini失敗時のフォールバック =====
function fallbackItems(articles) {
  return articles.map(a => ({
    date:           formatDate(new Date()),
    region:         '',
    municipality:   '',
    field:          '',
    source_name:    a.source_name,
    url:            a.url,
    title:          a.title,
    summary:        a.description.slice(0, 100),
    tags_event:     '',
    tags_structure: '',
    tags_evidence:  '',
    tags_status:    '',
    severity:       '中',
    structure_note: '',
    gemini_failed:  true,
  }));
}

// ===== シート作成 =====
function getOrCreateFullLogSheet(ss) {
  let sheet = ss.getSheetByName(FULL_LOG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(FULL_LOG_SHEET);
    // 既存kansokuDBの列順を維持。新規シート作成時もこの順序で統一する。
    const headers = [
      '日付','地域','市区町村','分野','出典','URL',
      'タイトル','要約','出来事タグ','構造タグ','根拠タグ','状態タグ',
      '重要度','構造メモ','収録日時','公開日','古い記事',
      // ===== v3で追加（層A/層B分離設計）=====
      'RSS要約','本文キャッシュ有無','原本ID','Gemini分類済み','Gemini分類試行日時',
      // ===== Step1追加（観測メタデータ・記事直接取得）=====
      'title_normalized','source_domain','dedup_hash',
      'law_refs_raw','institution_refs_raw','tag_source'
    ];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    const h = sheet.getRange(1,1,1,headers.length);
    h.setBackground('#0f0e0d'); h.setFontColor('#faf9f6'); h.setFontWeight('bold');
    sheet.setColumnWidth(7,280); sheet.setColumnWidth(8,350);
  }
  return sheet;
}

function getOrCreatePublicSheet(ss) {
  let sheet = ss.getSheetByName(PUBLIC_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(PUBLIC_SHEET);
    // 既存kansokuDBの列順を維持。新規シート作成時もこの順序で統一する。
    const headers = [
      '日付','地域','市区町村','分野','出典','URL',
      'タイトル','要約','出来事タグ','構造タグ','根拠タグ','状態タグ',
      '重要度','構造メモ','収録日時','公開日','古い記事',
      // ===== v3で追加（層A/層B分離設計）=====
      'RSS要約','本文キャッシュ有無','原本ID','Gemini分類済み','Gemini分類試行日時',
      // ===== Step1追加（観測メタデータ・記事直接取得）=====
      'title_normalized','source_domain','dedup_hash',
      'law_refs_raw','institution_refs_raw','tag_source'
    ];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    const h = sheet.getRange(1,1,1,headers.length);
    h.setBackground('#0f0e0d'); h.setFontColor('#faf9f6'); h.setFontWeight('bold');
    sheet.setColumnWidth(7,280); sheet.setColumnWidth(8,350);
  }
  return sheet;
}

function getOrCreateTagMaster(ss) {
  let sheet = ss.getSheetByName(TAG_MASTER);
  if (!sheet) {
    sheet = ss.insertSheet(TAG_MASTER);
    sheet.appendRow(['カテゴリー','タグ','メモ']);
    sheet.setFrozenRows(1);
    const h = sheet.getRange(1,1,1,3);
    h.setBackground('#0f0e0d'); h.setFontColor('#faf9f6'); h.setFontWeight('bold');
    const initialTags = [
      ['出来事','申請妨害',''],['出来事','説明拒否',''],['出来事','長期放置',''],
      ['出来事','記録改ざん',''],['出来事','誤情報提供',''],['出来事','支給停止',''],
      ['出来事','虐待認定不全',''],['出来事','情報非公開',''],['出来事','財政推計ミス',''],
      ['出来事','政策撤回なし',''],['出来事','本人意思の無視',''],['出来事','書類紛失',''],
      ['出来事','窓口たらい回し',''],['出来事','扶養照会濫用',''],['出来事','差し戻し',''],
      ['構造','説明責任',''],['構造','当事者主体の不実装',''],['構造','制度実装の失敗',''],
      ['構造','組織防衛',''],['構造','情報非対称',''],['構造','判断プロセス不備',''],
      ['構造','権限濫用',''],['構造','自己修正不能',''],['構造','沈黙の同意扱い',''],
      ['構造','前例主義',''],['構造','支援と支配',''],['構造','反復構造',''],
      ['構造','組織的不作為',''],['構造','情報公開',''],['構造','公益通報',''],
      ['構造','第三者委員会',''],['構造','文書管理',''],['構造','内部統制',''],
      ['構造','監査',''],['構造','権力集中',''],['構造','財政危機言説',''],
      ['構造','政策修正不全',''],['構造','連鎖的不作為',''],
      ['根拠','報道',''],['根拠','議会議事録',''],['根拠','監査報告',''],
      ['根拠','裁判例',''],['根拠','行政資料',''],['根拠','当事者証言',''],
      ['根拠','弁護士会声明',''],['根拠','NPO報告',''],['根拠','公式発表',''],
      ['状態','疑惑段階',''],['状態','行政が認めた',''],['状態','謝罪あり',''],
      ['状態','是正あり',''],['状態','是正なし',''],['状態','係争中',''],
      ['状態','再発',''],['状態','誤り認定',''],['状態','撤回なし',''],
      ['地域','東京都',''],['地域','京都府',''],['地域','大阪府',''],['地域','神奈川県',''],
      ['地域','愛知県',''],['地域','福岡県',''],['地域','北海道',''],['地域','宮城県',''],
      ['地域','広島県',''],['地域','兵庫県',''],['地域','京都市',''],['地域','大阪市',''],
      ['地域','厚労省',''],['地域','総務省',''],['地域','内閣府',''],
      ['分野','生活保護',''],['分野','障害福祉',''],['分野','介護',''],['分野','財政',''],
      ['分野','予算',''],['分野','基金',''],['分野','債務',''],['分野','地方債',''],
      ['分野','行財政改革',''],['分野','指定管理',''],['分野','公共施設',''],
      ['分野','情報公開',''],['分野','議会',''],['分野','監査',''],['分野','裁判',''],
      ['分野','住宅',''],['分野','雇用',''],['分野','子育て',''],['分野','医療',''],
      ['分野','訪問看護',''],['分野','相談支援',''],
    ];
    sheet.getRange(2,1,initialTags.length,3).setValues(initialTags);
    sheet.setColumnWidth(1,120); sheet.setColumnWidth(2,160); sheet.setColumnWidth(3,220);
  }
  return sheet;
}

function loadTagMaster(ss) {
  const sheet = getOrCreateTagMaster(ss);
  const data = sheet.getDataRange().getValues();
  const tags = {};
  data.slice(1).forEach(row => {
    const cat = row[0], tag = row[1];
    if (cat && tag) {
      if (!tags[cat]) tags[cat] = [];
      tags[cat].push(tag);
    }
  });
  return tags;
}

// ===== 全件ログからタグ付き記事を手動で公開DBにコピー（任意）=====
function manualPromote() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet    = ss.getSheetByName(FULL_LOG_SHEET);
  const publicSheet = getOrCreatePublicSheet(ss);
  if (!logSheet) { Logger.log('全件ログシートが見つかりません'); return; }

  const data = logSheet.getDataRange().getValues();
  let copied = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const hasTags = row[8] || row[9];
    if (hasTags && !isDuplicate(publicSheet, row[5] || row[6])) {
      publicSheet.appendRow(row.slice(0, 15));
      copied++;
    }
  }
  Logger.log('手動プロモート: ' + copied + '件を公開DBにコピー');
}

// ===== ユーティリティ =====
function isDuplicate(sheet, key) {
  if (!key) return false;
  const colMap = getColMap(sheet);
  const urlIdx   = colMap[COL.URL];
  const titleIdx = colMap[COL.TITLE];

  // 列名マップが取得できない場合のみ、フォールバックとして旧来のインデックスを使う
  if (urlIdx === undefined && titleIdx === undefined) {
    return sheet.getDataRange().getValues().some(row => row[5] === key || row[6] === key);
  }

  return sheet.getDataRange().getValues().some(row =>
    (urlIdx   !== undefined && row[urlIdx]   === key) ||
    (titleIdx !== undefined && row[titleIdx] === key)
  );
}

function formatDate(date) {
  return date.getFullYear() + '-' +
    String(date.getMonth()+1).padStart(2,'0') + '-' +
    String(date.getDate()).padStart(2,'0');
}

// ===== トリガー設定 =====
// 6:00 collectNews（一般ニュース収集）
// 6:30 collectTojishaSources（当事者メディア収集・別関数で時間分散）
// 7:00 classifyUnclassifiedBatch（観測DB Gemini分類）
// 8:00 classifyTojishaArticles（当事者の声 Gemini分類、10件/回）
// 9:00 reviewTojishaWithClaude（当事者の声 Claude再確認、5件/回）
function setDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('collectNews').timeBased().everyDays(1).atHour(6).create();
  ScriptApp.newTrigger('collectTojishaSources').timeBased().everyDays(1).atHour(6).nearMinute(30).create();
  ScriptApp.newTrigger('classifyUnclassifiedBatch').timeBased().everyDays(1).atHour(7).create();
  ScriptApp.newTrigger('classifyTojishaArticles').timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('reviewTojishaWithClaude').timeBased().everyDays(1).atHour(9).create();
  Logger.log('トリガー設定完了: collectNews（6:00）+ collectTojishaSources（6:30）+ classifyUnclassifiedBatch（7:00）+ classifyTojishaArticles（8:00）+ reviewTojishaWithClaude（9:00）');
}

// ===== 既存kansokuDBシートに「公開日」「古い記事」列を追加 =====
// 既存シートにはこれらの列がないため、一度だけ実行して追加する
function addNewColumnsToExistingSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = ['kansokuDB', '観測DB（タグ確認待ち）', '観測DB（全件ログ）'];

  sheetNames.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) { Logger.log(name + ': シートなし・スキップ'); return; }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const hasPubDate  = headers.includes('公開日');
    const hasOldFlag  = headers.includes('古い記事');

    if (hasPubDate && hasOldFlag) {
      Logger.log(name + ': 既に両列あり・スキップ');
      return;
    }

    const lastCol = sheet.getLastColumn();
    if (!hasPubDate) {
      sheet.getRange(1, lastCol + 1).setValue('公開日');
      Logger.log(name + ': 「公開日」列を追加 (' + (lastCol + 1) + '列目)');
    }
    if (!hasOldFlag) {
      const col = sheet.getLastColumn() + 1;
      sheet.getRange(1, col).setValue('古い記事');
      Logger.log(name + ': 「古い記事」列を追加 (' + col + '列目)');
    }
  });

  Logger.log('完了');
}

// ===== 層A/層B分離設計（v3）への移行：既存シートに新列を追加 =====
// 既存の列構成（日付・地域・市区町村・分野・出典・URL・タイトル・要約・...）は壊さない。
// 末尾に「RSS要約」「本文キャッシュ有無」「原本ID」「Gemini分類済み」「Gemini分類試行日時」を追加するのみ。
// 既存行の「Gemini分類済み」は true として扱う（既存分は層Bが既に埋まっているため再分類不要）。
function migrateToLayerABSchema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = ['kansokuDB', '観測DB（タグ確認待ち）', '観測DB（全件ログ）'];

  const NEW_COLS = ['RSS要約', '本文キャッシュ有無', '原本ID', 'Gemini分類済み', 'Gemini分類試行日時'];

  sheetNames.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) { Logger.log(name + ': シートなし・スキップ'); return; }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const missing = NEW_COLS.filter(function(c) { return !headers.includes(c); });

    if (missing.length === 0) {
      Logger.log(name + ': 既に全列あり・スキップ');
      return;
    }

    let lastCol = sheet.getLastColumn();
    const addedCols = [];
    missing.forEach(function(colName) {
      lastCol++;
      sheet.getRange(1, lastCol).setValue(colName);
      addedCols.push({ name: colName, col: lastCol });
    });

    Logger.log(name + ': ' + missing.length + '列追加 → ' + missing.join(', '));

    // 「Gemini分類済み」列が新規追加された場合のみ、既存行を一括 true にする
    const doneCol = addedCols.find(function(c) { return c.name === 'Gemini分類済み'; });
    if (doneCol) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const values = Array(lastRow - 1).fill([true]);
        sheet.getRange(2, doneCol.col, lastRow - 1, 1).setValues(values);
        Logger.log(name + ': 既存' + (lastRow - 1) + '行を Gemini分類済み=true として初期化');
      }
    }
  });

  Logger.log('===== 移行完了 =====');
  Logger.log('注意: 既存の列順（日付・地域...）はそのまま維持されています。');
  Logger.log('新規保存（collectNews）は buildRowLayerA() を使うため、');
  Logger.log('列順を完全に層A/層B構成へ揃えたい場合は別途シート再構築が必要です。');
}

// ===== 分類状態（4値）スキーマへの移行 =====
// 「分類状態」列を追加し、既存行を適切な状態に初期化する。
// 既存行は全て layer B（地域・分野等）が既に埋まっている前提のため「分類済み」とする。
// 「対象外」の判定は遡及的にはできないため、既存分は一律「分類済み」のままとする
// （対象外判定はこれ以降の新規分類分から適用される）。
function migrateToClassifyStatusSchema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = ['kansokuDB', '観測DB（タグ確認待ち）', '観測DB（全件ログ）'];

  sheetNames.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) { Logger.log(name + ': シートなし・スキップ'); return; }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.includes(COL.CLASSIFY_STATUS)) {
      Logger.log(name + ': 既に「' + COL.CLASSIFY_STATUS + '」列あり・スキップ');
      return;
    }

    const newCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, newCol).setValue(COL.CLASSIFY_STATUS);
    Logger.log(name + ': 「' + COL.CLASSIFY_STATUS + '」列を追加 (' + newCol + '列目)');

    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const colMap = getColMap(sheet);
      const idxDone = colMap[COL.GEMINI_DONE];
      const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

      const statusValues = data.map(function(row) {
        const wasDone = idxDone !== undefined ? row[idxDone] : true;
        const status = (wasDone === true || wasDone === 'TRUE')
          ? CLASSIFY_STATUS.DONE
          : CLASSIFY_STATUS.UNCLASSIFIED;
        return [status];
      });

      sheet.getRange(2, newCol, statusValues.length, 1).setValues(statusValues);
      Logger.log(name + ': 既存' + statusValues.length + '行を分類状態で初期化（既存はGemini分類済み=trueベースのため大半が「分類済み」）');
    }
  });

  Logger.log('===== 分類状態スキーマ移行完了 =====');
  Logger.log('注意: 「対象外」判定は過去には遡及されません。今後の classifyUnclassifiedBatch() 実行分から適用されます。');
}

// ===== 診断：観測DB・全件ログの直近データを確認 =====
// 「表示で見えていないだけ」なのか「実際にデータが無い」のかを切り分ける。
function diagnoseRecentEntries() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet    = getOrCreateFullLogSheet(ss);
  const publicSheet = getOrCreatePublicSheet(ss);

  Logger.log('===== 直近データ診断 =====');

  const summary = {}; // { '全件ログ': {...}, '観測DB': {...} }

  [
    { key: '全件ログ（原本庫相当）', sheet: logSheet },
    { key: '観測DB（公開用）',        sheet: publicSheet },
  ].forEach(function(target) {
    const sheet = target.sheet;
    const colMap = getColMap(sheet);
    const lastRow = sheet.getLastRow();
    const total = lastRow - 1;

    Logger.log('');
    Logger.log('--- ' + target.key + ' ---');
    Logger.log('総行数（ヘッダー除く）: ' + total + '件');

    summary[target.key] = { total: total, since620: 0, oldButRecent: 0 };

    if (total <= 0) { Logger.log('データなし'); return; }

    const showCount = Math.min(5, total);
    const startRow = lastRow - showCount + 1;
    const recentData = sheet.getRange(startRow, 1, showCount, sheet.getLastColumn()).getValues();

    const idxCollected = colMap[COL.COLLECTED_AT];
    const idxTitle     = colMap[COL.TITLE];
    const idxDate       = colMap[COL.DATE];
    const idxPub        = colMap[COL.PUB_DATE];

    Logger.log('直近' + showCount + '行:');
    recentData.forEach(function(row, i) {
      const rowNum = startRow + i;
      Logger.log('  行' + rowNum + ': 収録日時=' + (idxCollected !== undefined ? row[idxCollected] : '?') +
        ' / 公開日=' + (idxPub !== undefined ? row[idxPub] : '?') +
        ' / 日付列=' + (idxDate !== undefined ? row[idxDate] : '?') +
        ' / タイトル=' + (idxTitle !== undefined ? String(row[idxTitle]).slice(0,40) : '?'));
    });

    // ===== Q1〜Q3共通：全行を走査して集計 =====
    if (idxCollected !== undefined) {
      const allData = sheet.getRange(2, 1, total, sheet.getLastColumn()).getValues();

      // 6/20 00:00 JST 以降に「収録」された件数（収集が止まっていないかの確認）
      const cutoff620 = new Date('2026-06-20T00:00:00+09:00');
      let since620Count = 0;

      // 公開日が極端に古い（2年以上前）のに、収録日時が直近24時間以内＝
      // 「古い記事が新着として収録されてしまっている」件数
      const cutoffOld = new Date();
      cutoffOld.setFullYear(cutoffOld.getFullYear() - 2);
      const cutoffRecent24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      let oldButRecentCount = 0;

      allData.forEach(function(row) {
        const collectedAt = row[idxCollected];
        if (!collectedAt) return;
        const collectedDate = new Date(collectedAt);

        if (collectedDate > cutoff620) since620Count++;

        if (collectedDate > cutoffRecent24h) {
          const pubRaw = idxPub !== undefined ? row[idxPub] : (idxDate !== undefined ? row[idxDate] : '');
          if (pubRaw) {
            const pubDate = new Date(pubRaw);
            if (!isNaN(pubDate.getTime()) && pubDate < cutoffOld) {
              oldButRecentCount++;
            }
          }
        }
      });

      Logger.log('2026-06-20以降に収録された件数: ' + since620Count + '件');
      Logger.log('直近24時間に収録され、かつ公開日が2年以上前（古い記事の新着混入）: ' + oldButRecentCount + '件');

      summary[target.key].since620 = since620Count;
      summary[target.key].oldButRecent = oldButRecentCount;
    }
  });

  // ===== Q4：観測DBと全件ログの件数差とその理由 =====
  Logger.log('');
  Logger.log('--- 全件ログ と 観測DB の件数差 ---');
  const logTotal    = summary['全件ログ（原本庫相当）'] ? summary['全件ログ（原本庫相当）'].total : 0;
  const publicTotal = summary['観測DB（公開用）']        ? summary['観測DB（公開用）'].total        : 0;
  Logger.log('全件ログ総数: ' + logTotal + '件');
  Logger.log('観測DB総数:   ' + publicTotal + '件');
  Logger.log('差分:         ' + (logTotal - publicTotal) + '件');
  Logger.log('理由: 観測DBは shouldAutoPublish() のキーワード判定を通過した記事のみコピーされる設計のため、');
  Logger.log('      全件ログより観測DBの件数が少ないのは仕様通りです（対象外記事は全件ログにのみ残る）。');

  Logger.log('');
  Logger.log('===== 診断完了 =====');
}

// ===== 既存記事への古い記事フラグ遡及補完 =====
// buildRowLayerA()に古い記事判定を追加する前に保存された記事（公開日はあるが
// 古い記事列が空欄のもの）に対して、公開日だけで判定し補完する。
// Geminiは使わないため429の影響を受けない。
function backfillOldFlagForExisting() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = ['kansokuDB', '観測DB（タグ確認待ち）', '観測DB（全件ログ）'];

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  sheetNames.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) { Logger.log(name + ': シートなし・スキップ'); return; }

    const colMap = getColMap(sheet);
    const idxOld = colMap[COL.OLD_FLAG];
    const idxPub = colMap[COL.PUB_DATE];
    const idxDate = colMap[COL.DATE];
    const idxTitle = colMap[COL.TITLE];

    if (idxOld === undefined) {
      Logger.log(name + ': 「' + COL.OLD_FLAG + '」列が見つかりません・スキップ');
      return;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) { Logger.log(name + ': データなし'); return; }

    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    let checked = 0;
    let filled  = 0;

    data.forEach(function(row, i) {
      const existing = String(row[idxOld] || '').trim();
      if (existing) return; // 既に判定済みならスキップ

      // 公開日（無ければ日付列）を使う
      const pubRaw = (idxPub !== undefined ? row[idxPub] : '') || (idxDate !== undefined ? row[idxDate] : '');
      if (!pubRaw) return;

      checked++;
      const pub = new Date(pubRaw);
      if (isNaN(pub.getTime())) return;

      if (pub < twoYearsAgo) {
        const rowNum = i + 2;
        sheet.getRange(rowNum, idxOld + 1).setValue('古い記事候補');
        filled++;
        Logger.log('[補完] ' + name + ' 行' + rowNum + ' 「' + String(row[idxTitle] || '').slice(0,35) + '」 公開日:' + pubRaw);
      }
    });

    Logger.log(name + ': チェック対象' + checked + '件中 ' + filled + '件を「古い記事候補」に補完');
  });

  Logger.log('===== 古い記事フラグ遡及補完 完了 =====');
}

// ===== テストケース診断：京都市職員逮捕記事の公開日確認 =====
// RSSのpubDateが実際の記事公開日と一致しているか、
// Googleニュースの再配信日になっていないかを確認する。
// 修正はしない・データ取得とログ出力のみ。
function diagnoseArticlePublishDate(searchKeyword) {
  searchKeyword = searchKeyword || '京都市職員';

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = ['kansokuDB', '観測DB（全件ログ）'];

  sheetNames.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) { Logger.log(name + ': シートなし'); return; }

    const colMap = getColMap(sheet);
    const idxTitle = colMap[COL.TITLE];
    const idxUrl   = colMap[COL.URL];
    const idxPub   = colMap[COL.PUB_DATE];
    const idxDate  = colMap[COL.DATE];
    const idxCollected = colMap[COL.COLLECTED_AT];
    const idxRssSummary = colMap[COL.RSS_SUMMARY];
    const idxOld   = colMap[COL.OLD_FLAG];

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    Logger.log('===== ' + name + ' 内の「' + searchKeyword + '」一致記事 =====');
    let found = 0;

    data.forEach(function(row, i) {
      const title = idxTitle !== undefined ? String(row[idxTitle] || '') : '';
      if (!title.includes(searchKeyword)) return;

      found++;
      const rowNum = i + 2;
      Logger.log('--- 行' + rowNum + ' ---');
      Logger.log('タイトル: ' + title);
      Logger.log('URL: ' + (idxUrl !== undefined ? row[idxUrl] : '(列なし)'));
      Logger.log('公開日(PUB_DATE列・RSSのpubDateそのまま): ' + (idxPub !== undefined ? row[idxPub] : '(列なし)'));
      Logger.log('日付列(DATE・Gemini分類後の推定日付): ' + (idxDate !== undefined ? row[idxDate] : '(列なし)'));
      Logger.log('収録日時: ' + (idxCollected !== undefined ? row[idxCollected] : '(列なし)'));
      Logger.log('RSS要約: ' + (idxRssSummary !== undefined ? String(row[idxRssSummary] || '').slice(0, 200) : '(列なし)'));
      Logger.log('古い記事フラグ: ' + (idxOld !== undefined ? (row[idxOld] || '(空欄)') : '(列なし)'));
      Logger.log('');
    });

    if (found === 0) Logger.log('一致する記事が見つかりませんでした');
  });

  Logger.log('===== 診断完了 =====');
}

// ===== URLから実際のページのpublished_time等メタ情報を取得して比較 =====
// 元記事ページにアクセスし、og:published_time / article:published_time / 
// JSON-LDのdatePublished等を抽出して、RSSのpubDateとズレていないか確認する。
function diagnoseActualPublishDateFromUrl(url) {
  if (!url) { Logger.log('URLを指定してください'); return; }

  Logger.log('===== 元記事ページの公開日メタデータ確認 =====');
  Logger.log('対象URL: ' + url);

  try {
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const code = response.getResponseCode();
    Logger.log('HTTPステータス: ' + code);
    if (code !== 200) {
      Logger.log('ページ取得に失敗しました');
      return;
    }

    const html = response.getContentText();

    // 各種メタタグから公開日候補を抽出
    const patterns = [
      { name: 'og:published_time',      regex: /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i },
      { name: 'og:published_time(逆順)', regex: /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i },
      { name: 'datePublished(JSON-LD)', regex: /"datePublished"\s*:\s*"([^"]+)"/i },
      { name: 'meta name=pubdate',      regex: /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i },
      { name: 'time datetime属性',       regex: /<time[^>]+datetime=["']([^"']+)["']/i },
    ];

    let foundAny = false;
    patterns.forEach(function(p) {
      const m = html.match(p.regex);
      if (m) {
        Logger.log('[検出] ' + p.name + ': ' + m[1]);
        foundAny = true;
      }
    });

    if (!foundAny) {
      Logger.log('ページ内に公開日メタデータが見つかりませんでした');
      // タイトル周辺のテキストに年号らしき文字列がないか簡易チェック
      const yearMatch = html.match(/(19|20)\d{2}年\d{1,2}月\d{1,2}日/);
      if (yearMatch) {
        Logger.log('[参考] 本文中に年月日らしき文字列を検出: ' + yearMatch[0]);
      } else {
        Logger.log('本文中にも年月日らしき文字列は見つかりませんでした');
      }
    }

  } catch (e) {
    Logger.log('エラー: ' + e.message);
  }

  Logger.log('===== 診断完了 =====');
}

// ===== 全体再計算：過去記事フラグの一括再判定 =====
// 既存の判定結果（古い記事列の値）に関わらず、全行を対象に再評価する。
// 個別記事の手動修正ではなく、ルール変更時に何度でも再実行できる仕組み。
//
// 判定優先順位：
//   1. タイトル/RSS要約に含まれる明示的な年号（例:「2006年」）があれば最優先で採用
//      → Googleニュース等の再配信により DATE 列が汚染されているケースに対応
//   2. PUB_DATE列（RSSのpubDateそのまま）があれば使用
//   3. DATE列（Gemini推定日付）を最後の手段として使用
//
// 削除・本文改変は一切行わない。「古い記事」列の値のみ更新する。
function recalculateArchiveFlags() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = ['kansokuDB', '観測DB（タグ確認待ち）', '観測DB（全件ログ）'];

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const YEAR_PATTERN = /(19|20)\d{2}年/;

  sheetNames.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) { Logger.log(name + ': シートなし・スキップ'); return; }

    const colMap = getColMap(sheet);
    const idxOld     = colMap[COL.OLD_FLAG];
    const idxPub     = colMap[COL.PUB_DATE];
    const idxDate    = colMap[COL.DATE];
    const idxTitle   = colMap[COL.TITLE];
    const idxRss     = colMap[COL.RSS_SUMMARY];
    const idxSummary = colMap[COL.SUMMARY];
    const idxStatus  = colMap[COL.DATE_STATUS];
    const idxOrigPub = colMap[COL.ORIGINAL_PUBLISHED_AT];

    if (idxOld === undefined) {
      Logger.log(name + ': 「' + COL.OLD_FLAG + '」列が見つかりません・スキップ');
      return;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) { Logger.log(name + ': データなし'); return; }

    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    let total          = data.length;
    let confirmedOld    = 0; // original_published_at（確定値）に基づいて古いと判定
    let suspectedOld     = 0; // タイトル年号等から疑いはあるが未確定（date_status=要確認に回す）
    let changedToOld     = 0;
    let changedToReview  = 0;
    let noDateInfo        = 0;

    const newOldValues    = [];
    const newStatusValues = idxStatus !== undefined ? [] : null;

    data.forEach(function(row, i) {
      const existingOld = String(row[idxOld] || '').trim();
      const existingStatus = idxStatus !== undefined ? String(row[idxStatus] || '').trim() : '';
      const title   = idxTitle !== undefined ? String(row[idxTitle] || '') : '';
      const rssText = idxRss   !== undefined ? String(row[idxRss]   || '') : '';
      const sumText = idxSummary !== undefined ? String(row[idxSummary] || '') : '';

      // ===== 確定値（original_published_at）がある場合のみ、古い記事として確定判定する =====
      // MANAでは不明な事実を推定で確定扱いしない。タイトル年号等は「疑い」止まりとする。
      let confirmedDate = null;
      if (idxOrigPub !== undefined && row[idxOrigPub]) {
        const d = new Date(row[idxOrigPub]);
        if (!isNaN(d.getTime())) confirmedDate = d;
      }

      if (confirmedDate) {
        const isOldNow = confirmedDate < twoYearsAgo;
        const newValue = isOldNow ? '古い記事候補' : '';
        if (isOldNow) confirmedOld++;
        if (isOldNow && !existingOld) changedToOld++;

        newOldValues.push([newValue]);
        if (newStatusValues) newStatusValues.push([DATE_STATUS.CONFIRMED]);

        if (newValue !== existingOld) {
          Logger.log('[確定判定] ' + name + ' 行' + (i + 2) + ' 「' + title.slice(0, 35) + '」' +
            ' original_published_atに基づき確定 → ' + (newValue || '(新しい記事)'));
        }
        return;
      }

      // ===== 確定値が無い場合：タイトル/要約中の年号は「疑い」のみ。古い記事候補は付けない =====
      const combinedText = title + ' ' + rssText + ' ' + sumText;
      const yearMatch = combinedText.match(YEAR_PATTERN);
      let hasSuspicion = false;

      if (yearMatch) {
        const year = parseInt(yearMatch[0], 10);
        const thisYear = new Date().getFullYear();
        if (year >= 1990 && year <= thisYear) {
          const yearsAgo = thisYear - year;
          if (yearsAgo >= 2) {
            hasSuspicion = true;
            suspectedOld++;
          }
        }
      }

      // 古い記事フラグ自体は確定値がないので変更しない（推定で確定扱いしない）
      newOldValues.push([existingOld]);

      // date_statusのみ更新：疑いがあれば「要確認」に倒す（事実確認を促す）
      if (newStatusValues) {
        let newStatus = existingStatus;
        if (hasSuspicion && existingStatus !== DATE_STATUS.CONFIRMED) {
          newStatus = DATE_STATUS.NEEDS_REVIEW;
        } else if (!existingStatus) {
          newStatus = DATE_STATUS.UNCONFIRMED;
        }
        if (newStatus !== existingStatus) {
          changedToReview++;
          Logger.log('[要確認化] ' + name + ' 行' + (i + 2) + ' 「' + title.slice(0, 35) + '」' +
            ' タイトル中に' + (yearMatch ? yearMatch[0] : '') + 'を検出 → date_status=' + newStatus);
        }
        newStatusValues.push([newStatus]);
      }

      if (!yearMatch && !(idxPub !== undefined && row[idxPub]) && !(idxDate !== undefined && row[idxDate])) {
        noDateInfo++;
      }
    });

    // バッチ書き込み
    sheet.getRange(2, idxOld + 1, newOldValues.length, 1).setValues(newOldValues);
    if (newStatusValues) {
      sheet.getRange(2, idxStatus + 1, newStatusValues.length, 1).setValues(newStatusValues);
    }

    Logger.log('');
    Logger.log('===== ' + name + ' 再計算サマリ =====');
    Logger.log('対象件数:                       ' + total + '件');
    Logger.log('確定値に基づき古い記事と判定:   ' + confirmedOld + '件');
    Logger.log('新規に古いフラグが確定で付いた: ' + changedToOld + '件');
    Logger.log('タイトル年号等から疑いあり（要確認化）: ' + suspectedOld + '件');
    Logger.log('date_statusが要確認に変更された: ' + changedToReview + '件');
    Logger.log('日付情報なし:                   ' + noDateInfo + '件');
    Logger.log('');
  });

  Logger.log('===== recalculateArchiveFlags 完了 =====');
  Logger.log('※ 原本庫・観測記録は一切削除していません。');
  Logger.log('※ 「古い記事候補」は original_published_at（確定値）がある場合のみ付与します。');
  Logger.log('※ タイトル年号等の疑いのみの場合は date_status=要確認 として、確定扱いはしません。');
}

// ===== 元記事メタデータの再取得バッチ（v4） =====
// date_status が「未確認」または「要確認」の記事のみを対象に、
// 元記事URLへのアクセスとメタタグ抽出で original_published_at を補完する。
//
// 重要な制約：
//   news.google.com のラッパーURLはJavaScriptリダイレクトのため、
//   GASのUrlFetchAppでは元記事に到達できない。このケースは取得を試みた上で
//   date_status = '要確認' のまま残す（無理に推定しない）。
//
// 取得できなかった記事は「失敗」として消すのではなく、
// date_status を更新しないことで「再試行可能な状態」を維持する。
function retryFetchOriginalMetadata(limit) {
  limit = limit || 20;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = ['kansokuDB', '観測DB（全件ログ）'];

  sheetNames.forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) { Logger.log(sheetName + ': シートなし・スキップ'); return; }

    const colMap = getColMap(sheet);
    const idxStatus  = colMap[COL.DATE_STATUS];
    const idxGNUrl   = colMap[COL.GOOGLE_NEWS_URL];
    const idxOrigUrl = colMap[COL.ORIGINAL_URL];
    const idxOrigPub = colMap[COL.ORIGINAL_PUBLISHED_AT];
    const idxTitle   = colMap[COL.TITLE];

    if (idxStatus === undefined) {
      Logger.log(sheetName + ': 「' + COL.DATE_STATUS + '」列が見つかりません。スキーマ移行が未実施の可能性があります。');
      return;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) { Logger.log(sheetName + ': データなし'); return; }

    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    // 対象：未確認 または 要確認 の行のみ
    const targets = [];
    data.forEach(function(row, i) {
      const status = String(row[idxStatus] || '').trim();
      if (status !== DATE_STATUS.UNCONFIRMED && status !== DATE_STATUS.NEEDS_REVIEW) return;
      targets.push({
        rowNum: i + 2,
        title: idxTitle !== undefined ? String(row[idxTitle] || '') : '',
        url:   idxGNUrl !== undefined ? String(row[idxGNUrl] || '') : '',
      });
    });

    Logger.log('===== ' + sheetName + ' 元記事メタデータ再取得 対象:' + targets.length + '件（上限' + limit + '件処理）=====');

    let processed     = 0;
    let confirmedCount = 0;
    let needsReviewCount = 0;
    let stillUnknownCount = 0;

    for (let i = 0; i < targets.length && processed < limit; i++) {
      const t = targets[i];
      if (!t.url) { stillUnknownCount++; continue; }

      processed++;
      const result = _fetchOriginalMetadataFromUrl(t.url);

      if (result.isGoogleNewsWrapper) {
        // ラッパーURLで元記事に到達できなかった → 要確認のまま残す
        sheet.getRange(t.rowNum, idxStatus + 1).setValue(DATE_STATUS.NEEDS_REVIEW);
        needsReviewCount++;
        Logger.log('[要確認] 行' + t.rowNum + ' 「' + t.title.slice(0,30) + '」 Googleニュースラッパーのため元記事に到達できず');
        continue;
      }

      if (result.publishedAt) {
        if (idxOrigUrl !== undefined)  sheet.getRange(t.rowNum, idxOrigUrl + 1).setValue(result.finalUrl || t.url);
        if (idxOrigPub !== undefined)  sheet.getRange(t.rowNum, idxOrigPub + 1).setValue(result.publishedAt);
        sheet.getRange(t.rowNum, idxStatus + 1).setValue(DATE_STATUS.CONFIRMED);
        confirmedCount++;
        Logger.log('[確定] 行' + t.rowNum + ' 「' + t.title.slice(0,30) + '」 → ' + result.publishedAt + '（根拠:' + result.source + '）');
      } else {
        // アクセスはできたがメタデータが見つからなかった → 未確認のまま（再試行可能）
        stillUnknownCount++;
        Logger.log('[未確認のまま] 行' + t.rowNum + ' 「' + t.title.slice(0,30) + '」 メタデータ検出できず');
      }

      Utilities.sleep(500); // 連続アクセスへの配慮
    }

    Logger.log('');
    Logger.log('===== ' + sheetName + ' 完了 =====');
    Logger.log('処理試行: ' + processed + '件');
    Logger.log('確定:     ' + confirmedCount + '件');
    Logger.log('要確認のまま: ' + needsReviewCount + '件（Googleニュースラッパーのため）');
    Logger.log('未確認のまま: ' + stillUnknownCount + '件（再試行可能）');
    Logger.log('');
  });

  Logger.log('===== retryFetchOriginalMetadata 完了 =====');
}

// ===== URLから元記事メタデータを取得するヘルパー =====
function _fetchOriginalMetadataFromUrl(url) {
  const isGoogleNewsWrapper = url.indexOf('news.google.com') !== -1;

  if (isGoogleNewsWrapper) {
    // 既知の制約：JSのリダイレクトのため直接は取得不可
    return { isGoogleNewsWrapper: true, publishedAt: null, finalUrl: null, source: null };
  }

  try {
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (response.getResponseCode() !== 200) {
      return { isGoogleNewsWrapper: false, publishedAt: null, finalUrl: null, source: null };
    }

    const html = response.getContentText();
    const finalUrl = url; // GASではリダイレクト後のURLを直接は取れないため元URLを記録

    const patterns = [
      { name: 'article:published_time', regex: /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i },
      { name: 'article:published_time(逆順)', regex: /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i },
      { name: 'datePublished(JSON-LD)', regex: /"datePublished"\s*:\s*"([^"]+)"/i },
      { name: 'meta name=pubdate', regex: /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i },
      { name: 'time datetime属性', regex: /<time[^>]+datetime=["']([^"']+)["']/i },
    ];

    for (const p of patterns) {
      const m = html.match(p.regex);
      if (m) {
        const d = new Date(m[1]);
        if (!isNaN(d.getTime())) {
          return { isGoogleNewsWrapper: false, publishedAt: d.toISOString(), finalUrl: finalUrl, source: p.name };
        }
      }
    }

    return { isGoogleNewsWrapper: false, publishedAt: null, finalUrl: finalUrl, source: null };

  } catch (e) {
    return { isGoogleNewsWrapper: false, publishedAt: null, finalUrl: null, source: null };
  }
}

// ===== 既存シートへのdate_status関連列の追加（v4移行） =====
function migrateToDateStatusSchema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = ['kansokuDB', '観測DB（タグ確認待ち）', '観測DB（全件ログ）'];

  const NEW_COLS = [
    COL.RSS_PUBDATE, COL.GOOGLE_NEWS_URL, COL.ORIGINAL_URL,
    COL.ORIGINAL_PUBLISHED_AT, COL.DATE_STATUS
  ];

  sheetNames.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) { Logger.log(name + ': シートなし・スキップ'); return; }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const missing = NEW_COLS.filter(function(c) { return !headers.includes(c); });

    if (missing.length === 0) {
      Logger.log(name + ': 既に全列あり・スキップ');
      return;
    }

    let lastCol = sheet.getLastColumn();
    const addedCols = [];
    missing.forEach(function(colName) {
      lastCol++;
      sheet.getRange(1, lastCol).setValue(colName);
      addedCols.push({ name: colName, col: lastCol });
    });

    Logger.log(name + ': ' + missing.length + '列追加 → ' + missing.join(', '));

    // date_status列が新規追加された場合、既存行は「未確認」で初期化する
    // （既存のDATE列・PUB_DATE列の値が正確かどうか分からないため、安全側で「未確認」とする）
    const statusCol = addedCols.find(function(c) { return c.name === COL.DATE_STATUS; });
    if (statusCol) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const values = Array(lastRow - 1).fill([DATE_STATUS.UNCONFIRMED]);
        sheet.getRange(2, statusCol.col, values.length, 1).setValues(values);
        Logger.log(name + ': 既存' + (lastRow - 1) + '行を date_status=未確認 として初期化');
      }
    }
  });

  Logger.log('===== migrateToDateStatusSchema 完了 =====');
}

// ===== 観測DB実態調査：date_status分布・出典別集計 =====
// 表示ロジックを触る前に、まず現状を観測する。
// 「まず分布を見る。その後で対策を決める。」
function diagnoseDateStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('kansokuDB');
  if (!sheet) { Logger.log('kansokuDBが見つかりません'); return; }

  const colMap = getColMap(sheet);
  const idxStatus  = colMap[COL.DATE_STATUS];
  const idxOld     = colMap[COL.OLD_FLAG];
  const idxSource  = colMap[COL.SOURCE];
  const idxTitle   = colMap[COL.TITLE];
  const idxUrl     = colMap[COL.URL];
  const idxKarte   = colMap['カルテID'];

  const lastRow = sheet.getLastRow();
  const total = lastRow - 1;
  if (total <= 0) { Logger.log('データなし'); return; }

  const data = sheet.getRange(2, 1, total, sheet.getLastColumn()).getValues();

  // ===== 集計 =====
  let countConfirmed   = 0; // 確定
  let countUnconfirmed = 0; // 未確認
  let countReview      = 0; // 要確認
  let countOther       = 0; // その他（列が無い等）
  let countOldFlag     = 0; // old_flag あり
  let countHeldBack    = 0; // 保留箱対象（old_flag OR 要確認）

  const reviewRows   = []; // 要確認の詳細
  const sourceMap    = {}; // 出典別 × date_status 集計

  data.forEach(function(row, i) {
    const status  = idxStatus !== undefined ? String(row[idxStatus] || '').trim() : '';
    const oldFlag = idxOld    !== undefined ? String(row[idxOld]    || '').trim() : '';
    const source  = idxSource !== undefined ? String(row[idxSource] || '不明').trim() : '不明';
    const title   = idxTitle  !== undefined ? String(row[idxTitle]  || '').slice(0, 40) : '';
    const url     = idxUrl    !== undefined ? String(row[idxUrl]    || '') : '';
    const karteId = idxKarte  !== undefined ? String(row[idxKarte]  || '') : '';

    // date_status集計
    if      (status === DATE_STATUS.CONFIRMED)    countConfirmed++;
    else if (status === DATE_STATUS.UNCONFIRMED)  countUnconfirmed++;
    else if (status === DATE_STATUS.NEEDS_REVIEW) countReview++;
    else                                          countOther++;

    // old_flag集計
    if (oldFlag) countOldFlag++;

    // 保留箱集計
    const heldBack = !!(oldFlag || status === DATE_STATUS.NEEDS_REVIEW);
    if (heldBack) countHeldBack++;

    // 要確認の詳細を記録（最大20件）
    if (status === DATE_STATUS.NEEDS_REVIEW && reviewRows.length < 20) {
      reviewRows.push({ rowNum: i + 2, title, source, karteId, oldFlag });
    }

    // 出典別集計
    if (!sourceMap[source]) sourceMap[source] = { confirmed: 0, unconfirmed: 0, review: 0, old: 0, total: 0 };
    sourceMap[source].total++;
    if (status === DATE_STATUS.CONFIRMED)    sourceMap[source].confirmed++;
    if (status === DATE_STATUS.UNCONFIRMED)  sourceMap[source].unconfirmed++;
    if (status === DATE_STATUS.NEEDS_REVIEW) sourceMap[source].review++;
    if (oldFlag)                             sourceMap[source].old++;
  });

  // ===== 出力 =====
  Logger.log('');
  Logger.log('========== 観測DB 実態調査 ==========');
  Logger.log('実行日時: ' + new Date().toISOString());
  Logger.log('');
  Logger.log('---------- date_status 分布 ----------');
  Logger.log('全観測DB件数:       ' + total + '件');
  Logger.log('  確定:             ' + countConfirmed   + '件  (' + pct(countConfirmed,   total) + ')');
  Logger.log('  未確認:           ' + countUnconfirmed + '件  (' + pct(countUnconfirmed, total) + ')');
  Logger.log('  要確認:           ' + countReview      + '件  (' + pct(countReview,      total) + ')');
  Logger.log('  その他/未設定:    ' + countOther       + '件  (' + pct(countOther,       total) + ')');
  Logger.log('');
  Logger.log('  old_flag あり:    ' + countOldFlag  + '件  (' + pct(countOldFlag,  total) + ')');
  Logger.log('  保留箱対象合計:   ' + countHeldBack + '件  (' + pct(countHeldBack, total) + ')');
  Logger.log('  （保留箱 = old_flag または 要確認）');
  Logger.log('');

  // 要確認 詳細TOP20
  Logger.log('---------- 要確認 詳細（最大20件）----------');
  if (reviewRows.length === 0) {
    Logger.log('  要確認の記事はありません');
  } else {
    reviewRows.forEach(function(r) {
      Logger.log('  行' + r.rowNum + ' [' + (r.karteId || '未紐付') + '] 「' + r.title + '」'
        + ' 出典:' + r.source
        + (r.oldFlag ? ' ★過去記事' : ''));
    });
  }
  Logger.log('');

  // 出典別集計（件数降順）
  Logger.log('---------- 出典別分布 ----------');
  const sourceEntries = Object.entries(sourceMap).sort(function(a, b) { return b[1].total - a[1].total; });
  Logger.log('出典                    | 合計 | 確定 | 未確認 | 要確認 | 過去記事 | 取得率');
  Logger.log('------------------------|------|------|--------|--------|----------|-------');
  sourceEntries.forEach(function(entry) {
    const name = entry[0];
    const s    = entry[1];
    const rate = s.total > 0 ? Math.round(s.confirmed / s.total * 100) + '%' : '-';
    Logger.log(
      pad(name, 24) + '| ' +
      pad(s.total,       5) + '| ' +
      pad(s.confirmed,   5) + '| ' +
      pad(s.unconfirmed, 7) + '| ' +
      pad(s.review,      7) + '| ' +
      pad(s.old,         9) + '| ' +
      rate
    );
  });

  Logger.log('');
  Logger.log('========================================');
  Logger.log('次のアクション判断指標：');
  Logger.log('  確定が少ない（< 30%）→ 元記事公開日取得強化が優先');
  Logger.log('  要確認が多い（> 10%）→ 保留箱ロジックの精緻化が優先');
  Logger.log('  出典偏りがある → ソース別対策が有効');
}

function pct(n, total) {
  if (!total) return '-%';
  return Math.round(n / total * 100) + '%';
}

function pad(val, len) {
  const s = String(val);
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}
// ===== 全件ログ → kansokuDB 同期（ドライラン）=====
// 実際には書き込まない。ログに「何が同期される予定か」を出力するだけ。
// URLを主キーとして照合。カルテID・DATE列には絶対に触れない。
function syncLogToPublicDryRun(limit) {
  limit = limit || 10;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet    = ss.getSheetByName(FULL_LOG_SHEET);
  const publicSheet = ss.getSheetByName(PUBLIC_SHEET);

  if (!logSheet)    { Logger.log('全件ログシートが見つかりません'); return; }
  if (!publicSheet) { Logger.log('kansokuDBシートが見つかりません'); return; }

  const logColMap = getColMap(logSheet);
  const pubColMap = getColMap(publicSheet);

  // ===== 同期対象フィールド（カルテID・DATE列は含めない）=====
  const SYNC_FIELDS = [
    COL.REGION,         // 地域
    COL.MUNICIPALITY,   // 市区町村
    COL.FIELD,          // 分野
    COL.SUMMARY,        // 要約
    COL.TAGS_EVENT,     // 出来事タグ
    COL.TAGS_STRUCTURE, // 構造タグ
    COL.TAGS_EVIDENCE,  // 根拠タグ
    COL.TAGS_STATUS,    // 状態タグ
    COL.SEVERITY,       // 重要度
    COL.GEMINI_TRIED_AT,  // Gemini分類試行日時（ログとして記録）
    COL.CLASSIFY_STATUS,  // 分類状態
  ];

  // ===== 絶対に触らない列（明示）=====
  // COL.DATE (日付) — Gemini推定値で上書きしない
  // 'カルテID'       — kansokuDB固有のID。全件ログに列なし・絶対保護

  // ===== 全件ログを走査してURLインデックスを作成 =====
  const logData = logSheet.getDataRange().getValues();
  const logUrlIdx   = logColMap[COL.URL];
  const logStatusIdx = logColMap[COL.CLASSIFY_STATUS];
  const logTriedIdx  = logColMap[COL.GEMINI_TRIED_AT];

  // 全件ログ：URLキー → 行データ のマップ（分類済みかつGemini試行日時ありのみ）
  const logByUrl = {};
  for (let i = 1; i < logData.length; i++) {
    const row    = logData[i];
    const url    = String(row[logUrlIdx] || '').trim();
    const status = String(row[logStatusIdx] || '').trim();
    const tried  = String(row[logTriedIdx]  || '').trim();

    if (!url) continue;
    if (status !== CLASSIFY_STATUS.DONE) continue;   // 分類済みのみ対象
    if (!tried) continue;                             // Gemini試行日時なし = 実際に分類していない

    logByUrl[url] = row;
  }

  Logger.log('===== syncLogToPublicDryRun 開始（DRY RUN: 書き込みなし）=====');
  Logger.log('全件ログ内 分類済み×Gemini試行日時あり: ' + Object.keys(logByUrl).length + '件');

  // ===== kansokuDB を走査して照合 =====
  const pubData    = publicSheet.getDataRange().getValues();
  const pubUrlIdx  = pubColMap[COL.URL];

  let matchCount   = 0;
  let syncCount    = 0;
  let skipCount    = 0;
  let processed    = 0;

  for (let i = 1; i < pubData.length && processed < limit; i++) {
    const pubRow = pubData[i];
    const url    = String(pubRow[pubUrlIdx] || '').trim();
    if (!url) continue;

    const logRow = logByUrl[url];
    if (!logRow) continue;  // 全件ログに対応行なし

    matchCount++;
    processed++;

    // 各フィールドで「kansokuDB側が空 → 全件ログに値あり」かを確認
    const willSync = [];
    const alreadyFilled = [];

    SYNC_FIELDS.forEach(function(colName) {
      const pubIdx = pubColMap[colName];
      const logIdx = logColMap[colName];
      if (pubIdx === undefined || logIdx === undefined) return;

      const pubVal = String(pubRow[pubIdx] || '').trim();
      const logVal = String(logRow[logIdx] || '').trim();

      if (!logVal) return;  // 全件ログ側も空なら同期不要

      if (pubVal) {
        // すでにkansokuDB側に値がある → 上書きしない
        alreadyFilled.push(colName + ':「' + pubVal.slice(0, 20) + '」');
      } else {
        // kansokuDB側が空 → 同期対象
        willSync.push(colName + '→「' + logVal.slice(0, 20) + '」');
      }
    });

    const pubTitleIdx = pubColMap[COL.TITLE];
    const title = pubTitleIdx !== undefined ? String(pubRow[pubTitleIdx] || '').slice(0, 35) : '(タイトル不明)';

    Logger.log('');
    Logger.log('[行' + (i + 1) + '] ' + title);
    Logger.log('  URL: ' + url.slice(0, 80));

    if (willSync.length > 0) {
      Logger.log('  ✅ 同期予定 (' + willSync.length + '項目): ' + willSync.join(' / '));
      syncCount++;
    } else {
      Logger.log('  ⏭ スキップ（すべての対象フィールドが既に埋まっている）');
      skipCount++;
    }

    if (alreadyFilled.length > 0) {
      Logger.log('  🔒 上書きしない（既存値あり）: ' + alreadyFilled.join(' / '));
    }

    // カルテID・DATE列が誤って含まれていないことを明示確認
    Logger.log('  🛡 カルテID: 触れません / DATE列: 触れません');
  }

  Logger.log('');
  Logger.log('===== DRY RUN サマリ =====');
  Logger.log('処理件数（上限' + limit + '件）: ' + processed + '件');
  Logger.log('URL一致件数: ' + matchCount + '件');
  Logger.log('同期実行予定: ' + syncCount + '件');
  Logger.log('スキップ（既存値あり）: ' + skipCount + '件');
  Logger.log('');
  Logger.log('問題なければ syncLogToPublic(' + limit + ') を実行してください。');
  Logger.log('===== DRY RUN 完了（書き込みは一切行っていません）=====');
}


// ===== 全件ログ → kansokuDB 同期（実書き込み）=====
// syncLogToPublicDryRun() の結果を確認してから実行すること。
// URLを主キーとして照合。カルテID・DATE列には絶対に触れない。
// kansokuDB側にすでに値がある項目は上書きしない。
function syncLogToPublic(limit) {
  limit = limit || 10;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet    = ss.getSheetByName(FULL_LOG_SHEET);
  const publicSheet = ss.getSheetByName(PUBLIC_SHEET);

  if (!logSheet)    { Logger.log('全件ログシートが見つかりません'); return; }
  if (!publicSheet) { Logger.log('kansokuDBシートが見つかりません'); return; }

  const logColMap = getColMap(logSheet);
  const pubColMap = getColMap(publicSheet);

  const SYNC_FIELDS = [
    COL.REGION,
    COL.MUNICIPALITY,
    COL.FIELD,
    COL.SUMMARY,
    COL.TAGS_EVENT,
    COL.TAGS_STRUCTURE,
    COL.TAGS_EVIDENCE,
    COL.TAGS_STATUS,
    COL.SEVERITY,
    COL.GEMINI_TRIED_AT,
    COL.CLASSIFY_STATUS,
  ];

  const logData     = logSheet.getDataRange().getValues();
  const logUrlIdx   = logColMap[COL.URL];
  const logStatusIdx = logColMap[COL.CLASSIFY_STATUS];
  const logTriedIdx  = logColMap[COL.GEMINI_TRIED_AT];

  const logByUrl = {};
  for (let i = 1; i < logData.length; i++) {
    const row    = logData[i];
    const url    = String(row[logUrlIdx] || '').trim();
    const status = String(row[logStatusIdx] || '').trim();
    const tried  = String(row[logTriedIdx]  || '').trim();
    if (!url || status !== CLASSIFY_STATUS.DONE || !tried) continue;
    logByUrl[url] = row;
  }

  Logger.log('===== syncLogToPublic 開始（実書き込み）=====');
  Logger.log('全件ログ内 同期元候補: ' + Object.keys(logByUrl).length + '件');

  const pubData   = publicSheet.getDataRange().getValues();
  const pubUrlIdx = pubColMap[COL.URL];

  let matchCount  = 0;
  let syncCount   = 0;
  let skipCount   = 0;
  let fieldCount  = 0;
  let processed   = 0;

  for (let i = 1; i < pubData.length && processed < limit; i++) {
    const pubRow = pubData[i];
    const url    = String(pubRow[pubUrlIdx] || '').trim();
    if (!url) continue;

    const logRow = logByUrl[url];
    if (!logRow) continue;

    matchCount++;
    processed++;

    const pubTitleIdx = pubColMap[COL.TITLE];
    const title = pubTitleIdx !== undefined ? String(pubRow[pubTitleIdx] || '').slice(0, 35) : '';

    let wrote = [];
    let skipped = [];

    SYNC_FIELDS.forEach(function(colName) {
      const pubIdx = pubColMap[colName];
      const logIdx = logColMap[colName];
      if (pubIdx === undefined || logIdx === undefined) return;

      const pubVal = String(pubRow[pubIdx] || '').trim();
      const logVal = String(logRow[logIdx] || '').trim();

      if (!logVal) return;

      if (pubVal) {
        skipped.push(colName);
        return;
      }

      // 書き込み（kansokuDB側が空の場合のみ）
      publicSheet.getRange(i + 1, pubIdx + 1).setValue(logVal);
      wrote.push(colName + ':「' + logVal.slice(0, 20) + '」');
      fieldCount++;
    });

    if (wrote.length > 0) {
      syncCount++;
      Logger.log('[書込] 行' + (i + 1) + ' 「' + title + '」');
      Logger.log('  書き込み: ' + wrote.join(' / '));
      if (skipped.length > 0) Logger.log('  上書きスキップ: ' + skipped.join(', '));
    } else {
      skipCount++;
      Logger.log('[スキップ] 行' + (i + 1) + ' 「' + title + '」（全フィールド既存値あり）');
    }
  }

  Logger.log('');
  Logger.log('===== syncLogToPublic サマリ =====');
  Logger.log('処理件数: ' + processed + '件');
  Logger.log('URL一致: ' + matchCount + '件');
  Logger.log('書き込み行数: ' + syncCount + '件');
  Logger.log('スキップ行数: ' + skipCount + '件');
  Logger.log('書き込みフィールド総数: ' + fieldCount + '件');
  Logger.log('🛡 カルテID・DATE列には一切書き込んでいません');
  Logger.log('===== 完了 =====');
}

// ===== 「偽分類済み」を未分類に戻す =====
// 条件：Gemini試行日時が空 かつ 分類状態=分類済み かつ (地域が空 OR 分野が空)
// 地域・分野が両方入っている行は対象外（既存データを守る）
// 最初は limit=10 でテストすること
function resetFakeClassifiedToUnclassified(limit) {
  limit = limit || 10;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(FULL_LOG_SHEET);
  if (!logSheet) { Logger.log('全件ログシートが見つかりません'); return; }

  const colMap    = getColMap(logSheet);
  const idxStatus = colMap[COL.CLASSIFY_STATUS];
  const idxTried  = colMap[COL.GEMINI_TRIED_AT];
  const idxRegion = colMap[COL.REGION];
  const idxField  = colMap[COL.FIELD];
  const idxTitle  = colMap[COL.TITLE];

  if (idxStatus === undefined) { Logger.log('分類状態列が見つかりません'); return; }

  const data = logSheet.getDataRange().getValues();
  let resetCount = 0;
  let skippedCount = 0;
  let processed = 0;

  Logger.log('===== resetFakeClassifiedToUnclassified 開始 =====');

  for (let i = 1; i < data.length && processed < limit; i++) {
    const row    = data[i];
    const status = String(row[idxStatus] || '').trim();
    const tried  = String(idxTried !== undefined ? row[idxTried] : '').trim();
    const region = String(idxRegion !== undefined ? row[idxRegion] : '').trim();
    const field  = String(idxField  !== undefined ? row[idxField]  : '').trim();
    const title  = String(idxTitle  !== undefined ? row[idxTitle]  : '').slice(0, 40);

    if (status !== CLASSIFY_STATUS.DONE) continue;  // 分類済みでない行はスキップ
    if (tried) continue;                             // Gemini試行日時がある = 本物の分類済み → スキップ
    if (region && field) {                           // 地域・分野ともに入っている → 保護
      skippedCount++;
      Logger.log('[保護] 行' + (i + 1) + ' 地域:' + region + ' 分野:' + field + ' | ' + title);
      continue;
    }

    // 未分類に戻す
    logSheet.getRange(i + 1, idxStatus + 1).setValue(CLASSIFY_STATUS.UNCLASSIFIED);
    resetCount++;
    processed++;
    Logger.log('[戻し] 行' + (i + 1) + ' 地域:' + (region || '空') + ' 分野:' + (field || '空') + ' | ' + title);
  }

  Logger.log('');
  Logger.log('===== サマリ =====');
  Logger.log('未分類に戻した件数: ' + resetCount + '件');
  Logger.log('保護した件数（地域・分野ともにあり）: ' + skippedCount + '件');
  Logger.log('次のステップ: classifyUnclassifiedBatch(10) を実行してください');
  Logger.log('===== 完了 =====');
}

// ===== Step1 マイグレーション：既存シートに観測メタデータ列を追加 =====
// 1回だけ手動実行する。既存の列・データは一切変更しない。
// 実行後に backfillObservationFields() で既存行へ遡及付与する。
function migrateAddObservationColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = ['kansokuDB', '観測DB（全件ログ）'];

  const NEW_COLS = [
    'title_normalized', 'source_domain', 'dedup_hash',
    'law_refs_raw', 'institution_refs_raw', 'tag_source'
  ];

  sheetNames.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) { Logger.log(name + ': シートなし・スキップ'); return; }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const missing = NEW_COLS.filter(function(c) { return !headers.includes(c); });

    if (missing.length === 0) {
      Logger.log(name + ': 全列が既に存在します・スキップ');
      return;
    }

    let lastCol = sheet.getLastColumn();
    missing.forEach(function(colName) {
      lastCol++;
      sheet.getRange(1, lastCol).setValue(colName);
      Logger.log(name + ': 「' + colName + '」列を追加（' + lastCol + '列目）');
    });
  });

  Logger.log('');
  Logger.log('===== migrateAddObservationColumns 完了 =====');
  Logger.log('既存データは一切変更していません。');
  Logger.log('次のステップ: backfillObservationFields(20) で20件テスト後、backfillObservationFields(200) を繰り返してください。');
}

// ===== Step1 遡及バッチ：既存行に観測メタデータを付与 =====
// 空欄の行のみ対象。既存値がある行は上書きしない。
// 最初は limit=20 でテスト確認後、limit=200 を繰り返すこと。
function backfillObservationFields(limit) {
  limit = limit || 200;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = ['kansokuDB', '観測DB（全件ログ）'];

  sheetNames.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) { Logger.log(name + ': シートなし・スキップ'); return; }

    const colMap = getColMap(sheet);

    // dedup_hash 列がなければ先にマイグレーションが必要
    const idxHash = colMap['dedup_hash'];
    if (idxHash === undefined) {
      Logger.log(name + ': 「dedup_hash」列が見つかりません。先に migrateAddObservationColumns() を実行してください。');
      return;
    }

    // 各列のインデックス（なければ undefined のままで安全に処理する）
    const idxTitle       = colMap[COL.TITLE];
    const idxUrl         = colMap[COL.URL];
    const idxRssPubDate  = colMap[COL.RSS_PUBDATE] !== undefined ? colMap[COL.RSS_PUBDATE] : colMap[COL.PUB_DATE];
    const idxDesc        = colMap[COL.RSS_SUMMARY];
    const idxTitleNorm   = colMap['title_normalized'];
    const idxDomain      = colMap['source_domain'];
    const idxLawRefs     = colMap['law_refs_raw'];
    const idxInstRefs    = colMap['institution_refs_raw'];
    const idxTagSource   = colMap['tag_source'];

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) { Logger.log(name + ': データなし'); return; }

    const data = sheet.getDataRange().getValues();
    let processed = 0;
    let skipped   = 0;

    for (let i = 1; i < data.length && processed < limit; i++) {
      const row = data[i];

      // dedup_hash が既に入っている行はスキップ（上書きしない）
      if (row[idxHash] && String(row[idxHash]).trim() !== '') {
        skipped++;
        continue;
      }

      // 元データの取得（列が存在しない場合は空文字）
      const title   = idxTitle       !== undefined ? String(row[idxTitle]      || '') : '';
      const url     = idxUrl         !== undefined ? String(row[idxUrl]        || '') : '';
      const pubDate = idxRssPubDate  !== undefined ? String(row[idxRssPubDate] || '') : '';
      const desc    = idxDesc        !== undefined ? String(row[idxDesc]       || '') : '';

      if (!title && !url) {
        skipped++;
        continue; // タイトル・URL両方空の行は処理対象外
      }

      const titleNorm = normalizeTitle(title);
      const domain    = extractDomain(url);
      const rawText   = title + ' ' + desc;

      // 空欄のみ埋める（既存値がある列は触らない）
      function setIfEmpty(idx, value) {
        if (idx === undefined) return;
        if (row[idx] !== undefined && String(row[idx]).trim() !== '') return; // 既存値あり・スキップ
        sheet.getRange(i + 1, idx + 1).setValue(value);
      }

      setIfEmpty(idxTitleNorm, titleNorm);
      setIfEmpty(idxDomain,    domain);
      setIfEmpty(idxHash,      computeDedupHash(titleNorm, pubDate, domain));
      setIfEmpty(idxLawRefs,   extractLawRefs(rawText));
      setIfEmpty(idxInstRefs,  extractInstitutionRefs(rawText));
      setIfEmpty(idxTagSource, 'rule');

      processed++;
      Logger.log('[付与] ' + name + ' 行' + (i + 1) + ' 「' + title.slice(0, 40) + '」'
        + ' domain:' + domain
        + (extractLawRefs(rawText) ? ' law:' + extractLawRefs(rawText) : '')
        + (extractInstitutionRefs(rawText) ? ' inst:' + extractInstitutionRefs(rawText) : ''));
    }

    Logger.log('');
    Logger.log('===== ' + name + ' backfill サマリ =====');
    Logger.log('付与件数: ' + processed + '件 / スキップ（既存値あり or 空行）: ' + skipped + '件');
    Logger.log('残件確認：dedup_hashが空欄の行が残っている場合は再度 backfillObservationFields(' + limit + ') を実行してください。');
  });

  Logger.log('===== backfillObservationFields 完了 =====');
}

// ===== 窓（展示室）候補抽出 =====

const WINDOW_MASTER_FILE_ID  = '1JFxiFddm-km8rTwiIMY_wHMgpIv7l3glWYc0TScH-Y8';
const WINDOW_EXHIBITS_FILE_ID = '1aDKAW1AH6mi-xgBS3G_o7IsNwvmrCygIvqZnmoRI83Q';

function loadWindowMaster() {
  const ss = SpreadsheetApp.openById(WINDOW_MASTER_FILE_ID);
  const sheet = ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map(function(row) {
    const obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    obj._keywords    = String(obj.keywords    || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
    obj._tags        = String(obj.tags        || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
    obj._law_refs    = String(obj.law_refs    || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
    obj._inst_refs   = String(obj.institution_refs || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
    return obj;
  });
}

// 1記事に対し、候補となる窓IDのリストを返す
function matchWindowsForRow(row, windows) {
  const text = [
    row['タイトル']      || '',
    row['出来事タグ']    || '',
    row['構造タグ']      || '',
    row['状態タグ']      || '',
    row['law_refs_raw']  || '',
    row['institution_refs_raw'] || '',
  ].join(' ');

  return windows
    .filter(function(w) {
      return w._keywords.some(function(k){ return k && text.includes(k); })
          || w._tags.some(function(t){ return t && text.includes(t); })
          || w._law_refs.some(function(l){ return l && text.includes(l); })
          || w._inst_refs.some(function(i){ return i && text.includes(i); });
    })
    .map(function(w){ return w.window_id; });
}

// kansokuDB から指定窓の候補記事を取得して返す
function getWindowCandidates(windowId) {
  const windows = loadWindowMaster();
  const target  = windows.filter(function(w){ return w.window_id === windowId; });
  if (!target.length) { Logger.log('窓ID不明: ' + windowId); return []; }

  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const sheet   = ss.getSheetByName('kansokuDB');
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];

  const candidates = [];
  data.slice(1).forEach(function(row) {
    const obj = {};
    headers.forEach(function(h, i){ obj[h] = row[i]; });
    if (!obj['タイトル']) return;
    const matched = matchWindowsForRow(obj, target);
    if (matched.length) candidates.push(obj);
  });

  Logger.log('[窓候補] ' + windowId + ': ' + candidates.length + '件');
  return candidates;
}

// テスト用：全窓の候補件数をログに出す
function testWindowCandidates() {
  const windows = loadWindowMaster();
  windows.forEach(function(w) {
    const results = getWindowCandidates(w.window_id);
    Logger.log(w.window_name + '（' + w.window_id + '）: ' + results.length + '件');
  });
}

// ===== 当事者・市民メディア RSS テスト =====

function testTojishaRss() {
  const sources = [
    { name: 'ビッグイシュー',         url: 'https://www.bigissue.jp/feed/' },
    { name: 'マガジン9',              url: 'https://www.magazine9.jp/feed/' },
    { name: 'POSSE（FC2）',           url: 'https://magazine-posse.blog.fc2.com/?xml' },
    { name: 'DPI日本会議',            url: 'https://dpi-japan.org/feed/' },
    { name: '反貧困ネット',           url: 'https://antipoverty-network.org/feed/' },
    { name: '生活保護問題対策全国会議', url: 'http://seikatuhogotaisaku.blog.fc2.com/?xml' },
    { name: '移住連',                 url: 'https://migrants.jp/feed/' },
    { name: 'ヒューライツ大阪',        url: 'https://www.hurights.or.jp/archives/feed' },
    { name: 'NPO法人ホームレス支援',  url: 'https://www.homeless-net.org/feed/' },
    { name: '女性の貧困ネットワーク',  url: 'https://joseipoverty.wordpress.com/feed/' },
    { name: 'JCLU自由人権協会',       url: 'https://jclu.or.jp/feed/' },
    { name: 'コモンズ(Commons)',       url: 'https://commonsonline.co.jp/feed/' },
    { name: 'Dialogue for People',    url: 'https://d4p.world/feed/' },
    { name: 'OurPlanet-TV',           url: 'https://www.ourplanet-tv.org/?q=feeds/all' },
    { name: 'IWJ',                    url: 'https://iwj.co.jp/wj/open/feed' },
    { name: '週刊金曜日',             url: 'https://www.kinyobi.co.jp/feed/' },
    { name: 'ReBit',                  url: 'https://rebitlgbt.org/feed/' },
    { name: '難民支援協会',           url: 'https://www.refugee.or.jp/feed/' },
    { name: 'CALL4',                  url: 'https://www.call4.jp/feed/' },
    { name: '自治労連',               url: 'https://www.jichiroren.jp/feed/' },
  ];

  sources.forEach(function(s) {
    try {
      const res = UrlFetchApp.fetch(s.url, { muteHttpExceptions: true, followRedirects: true });
      const code = res.getResponseCode();
      const ct   = res.getHeaders()['Content-Type'] || '';
      const isXml = ct.includes('xml') || ct.includes('rss') || ct.includes('atom');
      Logger.log('[' + code + '] ' + (isXml ? '✅' : '⚠️ ') + ' ' + s.name + ' — ' + s.url);
    } catch(e) {
      Logger.log('[ERR] ' + s.name + ' — ' + e.message);
    }
  });
}

// ===== Gemini API で記事を窓に振り分ける =====
// GASのスクリプトプロパティに GEMINI_API_KEY を設定しておくこと

function classifyArticleWithGemini(title, description) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) { Logger.log('GEMINI_API_KEY が設定されていません'); return []; }

  const prompt = `以下の記事タイトルと本文冒頭を読んで、この記事が関連する観点をJSONの配列で答えてください。
選択肢（複数選択可、該当なければ空配列）:
- "democracy"  … 民主主義・行政・議会・公益通報・情報公開・選挙
- "human_rights" … 人権・差別・生存権・福祉・医療
- "mental"     … 心・精神・トラウマ・孤立・自己肯定
- "war"        … 戦争・軍事・平和・安保
- "media"      … メディア・報道・情報・SNS

回答形式は必ずJSONのみ。例: ["democracy","human_rights"]

タイトル: ${title}
本文冒頭: ${description || '（なし）'}`;

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey;
  const payload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 64 }
  });

  try {
    const res = UrlFetchApp.fetch(url, {
      method: 'POST',
      contentType: 'application/json',
      payload: payload,
      muteHttpExceptions: true
    });
    const json = JSON.parse(res.getContentText());
    const text = json.candidates[0].content.parts[0].text.trim();
    const match = text.match(/\[.*?\]/s);
    if (!match) return [];
    return JSON.parse(match[0]);
  } catch(e) {
    Logger.log('Gemini API エラー: ' + e.message);
    return [];
  }
}

// 全件ログの未分類記事にGeminiで窓IDを付与する
function classifyUnlabeledRows() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('観測DB（全件ログ）');
  if (!sheet) { Logger.log('シートが見つかりません'); return; }

  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const titleCol  = headers.indexOf('タイトル');
  const descCol   = headers.indexOf('description');

  // window_ids 列がなければ末尾に追加
  let winCol = headers.indexOf('window_ids');
  if (winCol === -1) {
    winCol = headers.length;
    sheet.getRange(1, winCol + 1).setValue('window_ids');
  }

  let count = 0;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[winCol]) continue; // 既に分類済みはスキップ
    const title = row[titleCol] || '';
    const desc  = row[descCol]  || '';
    if (!title) continue;

    const windows = classifyArticleWithGemini(title, desc);
    if (windows.length > 0) {
      sheet.getRange(i + 1, winCol + 1).setValue(windows.join(','));
      count++;
      Logger.log('[' + count + '] ' + title.slice(0, 40) + ' → ' + windows.join(','));
    }
    Utilities.sleep(500); // API制限対策
    if (count >= 50) { Logger.log('50件処理しました。続きは再実行してください。'); break; }
  }
  Logger.log('完了: ' + count + '件に窓IDを付与しました');
}

// ===== 当事者メディア収集 =====
// 思想：「誰が書いているか」が先にある。当事者自身の言葉・当事者メディアの記事だけを収集する。

const TOJISHA_SOURCES = [
  // 障害・福祉
  // DPI日本会議: 直接RSS→GASからIPブロック → Googleニュース site:絞り込みで代替
  { name: 'DPI日本会議', url: 'https://news.google.com/rss/search?q=site%3Adpi-japan.org&hl=ja&gl=JP&ceid=JP:ja', category: '障害' },
  { name: 'POSSE', url: 'https://www.npoposse.jp/feed/', category: '労働・貧困' },
  // 外国籍・移民
  { name: '移住連', url: 'https://prtimes.jp/companyrdf.php?company_id=88687', category: '移民・外国籍' },
  { name: '難民支援協会', url: 'https://www.refugee.or.jp/feed/', category: '難民' },
  // 在日コリアン
  // 朝鮮新報: 直接RSS全501・YouTube404 → Googleニュース site:絞り込みで代替
  { name: '朝鮮新報', url: 'https://news.google.com/rss/search?q=site%3Achosonsinbo.com&hl=ja&gl=JP&ceid=JP:ja', category: '在日コリアン' },
  // 在日本大韓民国民団: 直接RSS→HTML → Googleニュース site:絞り込みで代替
  { name: '在日本大韓民国民団', url: 'https://news.google.com/rss/search?q=site%3Amindan.org&hl=ja&gl=JP&ceid=JP:ja', category: '在日コリアン' },
  { name: '在日本大韓民国民団大阪府本部', url: 'https://prtimes.jp/companyrdf.php?company_id=170584', category: '在日コリアン' },
  // 貧困・生活困窮
  { name: 'ビッグイシュー日本', url: 'https://www.bigissue.jp/feed/', category: '貧困' },
  // 反貧困ネットワーク（hanhinkonnetwork.org）はRSSなし
  // 部落解放同盟: RSSなし・PR Timesなし → Googleニュース site:絞り込みで代替
  { name: '部落解放同盟', url: 'https://news.google.com/rss/search?q=site%3Abll.gr.jp&hl=ja&gl=JP&ceid=JP:ja', category: '部落・差別' },
  // コリアNGOセンター（korea-ngo.org）はRSSなし → 要調査
  // 戦争・沖縄（当事者メディアとして）
  { name: '沖縄タイムス', url: 'https://www.okinawatimes.co.jp/list/feed/rss', category: '沖縄・戦争' },
  // 琉球新報: 直接RSS→GASからIPブロック → Googleニュース site:絞り込みで代替
  { name: '琉球新報', url: 'https://news.google.com/rss/search?q=site%3Aryukyushimpo.jp&hl=ja&gl=JP&ceid=JP:ja', category: '沖縄・戦争' },
  // LGBTQ+
  { name: 'ReBit', url: 'https://prtimes.jp/companyrdf.php?company_id=47512', category: 'LGBTQ+' },
];

// RSSを持たない当事者団体のXアカウント
// RSSHub（https://rsshub.app）経由でXのタイムラインをRSSとして取得
const X_SOURCES = [
  { name: '反貧困ネットワーク', account: 'anti_poverty_NW', category: '貧困' },
  // 移住連・ReBitはPR Times RSSで収集（TOJISHA_SOURCESへ移動）
];

const RSSHUB_BASE = 'https://rsshub.app/twitter/user/';

// XソースのRSShub疎通確認（GASエディタから手動実行）
function testXSources() {
  X_SOURCES.forEach(source => {
    const url = RSSHUB_BASE + source.account;
    try {
      const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const code = res.getResponseCode();
      const len = res.getContentText().length;
      Logger.log('[' + code + '] ' + source.name + ' (' + len + 'bytes) ' + url);
    } catch(e) {
      Logger.log('[ERR] ' + source.name + ': ' + e.message);
    }
  });
}

// XソースをRSSHub経由で収集
function collectXSources() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('当事者の声');
  if (!sheet) {
    sheet = ss.insertSheet('当事者の声');
    sheet.appendRow(['収集日時', 'タイトル', 'URL', 'description', '発信者', 'カテゴリ', '収集元URL']);
  }

  const existingUrls = sheet.getDataRange().getValues().slice(1).map(r => r[2]);
  let added = 0;

  X_SOURCES.forEach(source => {
    const url = RSSHUB_BASE + source.account;
    try {
      const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) {
        Logger.log('[SKIP] ' + source.name + ': HTTP ' + res.getResponseCode());
        return;
      }
      const items = extractRssItems(res.getContentText());
      items.forEach(item => {
        if (!item.link || existingUrls.includes(item.link)) return;
        sheet.appendRow([new Date(), item.title, item.link, item.desc, source.name, source.category, url]);
        existingUrls.push(item.link);
        added++;
      });
      Logger.log('[OK] ' + source.name + ': ' + items.length + '件');
    } catch(e) {
      Logger.log('[ERR] ' + source.name + ': ' + e.message);
    }
  });
  Logger.log('X収集完了: ' + added + '件追加');
}

// 朝鮮新報のRSS候補URLをまとめて試す（GASエディタから手動実行）
function testChosonsinboRss() {
  const candidates = [
    'https://chosonsinbo.com/feed/',
    'https://chosonsinbo.com/feed/rss/',
    'https://chosonsinbo.com/feed/atom/',
    'https://chosonsinbo.com/rss.xml',
    'https://chosonsinbo.com/atom.xml',
    'https://chosonsinbo.com/jp/feed/',
    'https://chosonsinbo.com/category/jp/feed/',
  ];
  candidates.forEach(url => {
    try {
      const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const code = res.getResponseCode();
      const text = res.getContentText().slice(0, 200);
      Logger.log('[' + code + '] ' + url);
      if (code === 200) Logger.log('  → ' + text);
    } catch(e) {
      Logger.log('[ERR] ' + url + ': ' + e.message);
    }
  });
}

// 当事者ソースのRSS疎通確認（GASエディタから手動実行）
// 0件ソースのRSS構造を診断する（GASエディタから手動実行）
function debugZeroSources() {
  const targets = [
    { name: 'DPI日本会議', url: 'https://dpi-japan.org/feed/' },
    { name: '琉球新報', url: 'https://ryukyushimpo.jp/rss/' },
    { name: '民団', url: 'https://www.mindan.org/feed/' },
  ];
  targets.forEach(source => {
    try {
      const res = UrlFetchApp.fetch(source.url, {
        muteHttpExceptions: true,
        headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' }
      });
      const xml = res.getContentText();
      Logger.log('=== ' + source.name + ' (先頭500文字) ===');
      Logger.log(xml.slice(0, 500));
      const itemCount = (xml.match(/<item/gi) || []).length;
      const entryCount = (xml.match(/<entry/gi) || []).length;
      const linkSamples = xml.match(/<link[^>]*>/gi) || [];
      Logger.log('itemタグ数: ' + itemCount + ' / entryタグ数: ' + entryCount);
      Logger.log('linkタグ例: ' + linkSamples.slice(0, 3).join(' | '));
    } catch(e) {
      Logger.log('[ERR] ' + source.name + ': ' + e.message);
    }
  });
}

function testTojishaSources() {
  TOJISHA_SOURCES.forEach(source => {
    try {
      const res = UrlFetchApp.fetch(source.url, { muteHttpExceptions: true });
      const code = res.getResponseCode();
      const len = res.getContentText().length;
      Logger.log('[' + code + '] ' + source.name + ' (' + len + 'bytes) ' + source.url);
    } catch(e) {
      Logger.log('[ERR] ' + source.name + ': ' + e.message);
    }
  });
}

// RSSから<item>を正規表現で抽出（壊れたXMLでも動作）
function extractRssItems(xml) {
  const items = [];
  const re = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null && items.length < 20) {
    const body = m[1];
    const getVal = (tag) => {
      const r = new RegExp('<' + tag + '[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/' + tag + '>', 'i');
      return (body.match(r) || [])[1] || '';
    };
    const link = getVal('link') || getVal('guid');
    const title = getVal('title');
    const desc = getVal('description').replace(/<[^>]+>/g, '').slice(0, 200);
    if (link.trim()) items.push({ title: title.trim(), link: link.trim(), desc: desc.trim() });
  }
  // Atom形式（YouTubeなど）も対応
  if (items.length === 0) {
    const reEntry = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    while ((reEntry.exec(xml)) !== null && items.length < 20) {
      const body = reEntry.lastMatch || '';
      const entryMatch = /<entry[^>]*>([\s\S]*?)<\/entry>/i.exec(xml.slice(reEntry.lastIndex - (reEntry.lastMatch || '').length));
      if (!entryMatch) break;
      const eb = entryMatch[1];
      const linkMatch = eb.match(/<link[^>]+href="([^"]+)"/i);
      const titleMatch = eb.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const descMatch = eb.match(/<media:description[^>]*>([\s\S]*?)<\/media:description>/i) ||
                        eb.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
      const link = linkMatch ? linkMatch[1] : '';
      const title = titleMatch ? titleMatch[1].trim() : '';
      const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').slice(0, 200).trim() : '';
      if (link) items.push({ title, link, desc });
    }
  }
  return items;
}

// AtomフィードからYouTube動画エントリを抽出
function extractAtomEntries(xml) {
  const items = [];
  const re = /<entry>([\s\S]*?)<\/entry>/gi;
  let m;
  while ((m = re.exec(xml)) !== null && items.length < 20) {
    const body = m[1];
    const linkMatch = body.match(/<link[^>]+href="([^"]+)"/i);
    const titleMatch = body.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const descMatch = body.match(/<media:description>([\s\S]*?)<\/media:description>/i);
    const link = linkMatch ? linkMatch[1] : '';
    const title = titleMatch ? titleMatch[1].trim() : '';
    const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').slice(0, 200).trim() : '';
    if (link) items.push({ title, link, desc });
  }
  return items;
}

// 当事者メディアから記事を収集してスプレッドシートに保存
function collectTojishaSources() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('当事者の声');
  if (!sheet) {
    sheet = ss.insertSheet('当事者の声');
    sheet.appendRow(['収集日時', 'タイトル', 'URL', 'description', '発信者', 'カテゴリ', '収集元URL']);
  }

  const existingUrls = sheet.getDataRange().getValues().slice(1).map(r => r[2]);
  let added = 0;

  TOJISHA_SOURCES.forEach(source => {
    try {
      const res = UrlFetchApp.fetch(source.url, { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) {
        Logger.log('[SKIP] ' + source.name + ': HTTP ' + res.getResponseCode());
        return;
      }
      const xml = res.getContentText();
      // YouTube Atom形式か通常RSS形式かを判別
      const items = xml.includes('<entry>') ? extractAtomEntries(xml) : extractRssItems(xml);
      items.forEach(item => {
        if (!item.link || existingUrls.includes(item.link)) return;
        sheet.appendRow([new Date(), item.title, item.link, item.desc, source.name, source.category, source.url]);
        existingUrls.push(item.link);
        added++;
      });
      Logger.log('[OK] ' + source.name + ': ' + items.length + '件');
    } catch(e) {
      Logger.log('[ERR] ' + source.name + ': ' + e.message);
    }
  });
  Logger.log('当事者ソース収集完了: ' + added + '件追加');
}

// ===== 当事者の声 Gemini分類 =====
// 「当事者の声」シートの未分類行をGeminiで分類し、結果を書き戻す
// limit: 1回の実行で処理する上限件数（デフォルト10件）
function classifyTojishaArticles(limit) {
  limit = limit || 10;
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) { Logger.log('GEMINI_API_KEY が設定されていません'); return; }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('当事者の声');
  if (!sheet) { Logger.log('「当事者の声」シートが見つかりません'); return; }

  // ヘッダー確認・列追加
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const ensureCol = (name) => {
    let idx = headers.indexOf(name);
    if (idx === -1) {
      idx = headers.length;
      sheet.getRange(1, idx + 1).setValue(name);
      headers.push(name);
    }
    return idx + 1; // 1-based
  };
  const COL_EXHIBIT  = ensureCol('展示対象');
  const COL_TYPE     = ensureCol('種別');
  const COL_VILLAGES = ensureCol('村');
  const COL_SUMMARY  = ensureCol('要約');
  const COL_QUOTE    = ensureCol('引用');
  const COL_STATUS   = ensureCol('分類状態');

  const rows = sheet.getDataRange().getValues();
  let classified = 0;

  for (let i = 1; i < rows.length; i++) {
    if (classified >= limit) break; // 上限件数で停止

    const row = rows[i];
    const status = row[COL_STATUS - 1];
    if (status === '分類済み') continue; // スキップ

    const title  = row[1] || '';
    const url    = row[2] || '';
    const desc   = row[3] || '';
    const sender = row[4] || '';
    if (!title) continue;

    const prompt = `以下は当事者・当事者団体が発信した記事です。内容を読んで次の項目をJSONで答えてください。

【記事情報】
発信者: ${sender}
タイトル: ${title}
概要: ${desc}

【回答形式】必ずJSONのみで返すこと。
{
  "exhibit": true か false,
  "reason": "展示する/しない理由（1文）",
  "type": "当事者の証言" | "団体の声明" | "調査・報告" | "イベント・告知" | "その他",
  "villages": ["人権","民主主義","戦争","心","メディア"] の中から該当するものを配列で,
  "summary": "何をどう訴えているかの1行要約（展示不要なら空文字）",
  "quote": "記事中の核心的な一文（あれば。なければ空文字）"
}

exhibitがfalseになるのは：イベント告知・寄付依頼・採用情報など、制度や社会への訴えではないもの。`;

    const url_api = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + apiKey;
    try {
      const res = UrlFetchApp.fetch(url_api, {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 400 }
        }),
        muteHttpExceptions: true
      });
      const rawResponse = res.getContentText();
      const json = JSON.parse(rawResponse);
      if (!json.candidates || !json.candidates[0]) {
        Logger.log('[ERR] Gemini応答なし: ' + rawResponse.slice(0, 200));
        continue;
      }
      const text = json.candidates[0].content.parts[0].text.trim();
      // マークダウンのコードブロックも考慮
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) { Logger.log('[SKIP] JSON取得失敗: ' + text.slice(0, 100)); continue; }

      const result = JSON.parse(match[0]);
      sheet.getRange(i + 1, COL_EXHIBIT).setValue(result.exhibit ? '展示' : '非展示');
      sheet.getRange(i + 1, COL_TYPE).setValue(result.type || '');
      sheet.getRange(i + 1, COL_VILLAGES).setValue((result.villages || []).join('・'));
      sheet.getRange(i + 1, COL_SUMMARY).setValue(result.summary || '');
      sheet.getRange(i + 1, COL_QUOTE).setValue(result.quote || '');
      sheet.getRange(i + 1, COL_STATUS).setValue('分類済み');
      classified++;
      Logger.log('[OK] ' + title.slice(0, 30) + ' → ' + (result.exhibit ? '展示' : '非展示') + ' ' + (result.villages || []).join('・'));
      Utilities.sleep(3000); // レート制限対策：3秒待機
    } catch(e) {
      Logger.log('[ERR] ' + title.slice(0, 30) + ': ' + e.message);
      Utilities.sleep(5000); // エラー時は5秒待機
    }
  }
  Logger.log('Gemini分類完了: ' + classified + '件（上限: ' + limit + '件）');
}

// ===== 当事者の声 Claude再確認 =====
// Geminiが「非展示」と判断した記事を含む全記事をClaudeが再確認する
// Claude APIを使って展示判断を見直す（Geminiより文脈・思想を重視）
function reviewTojishaWithClaude(limit) {
  limit = limit || 5;
  const apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!apiKey) { Logger.log('CLAUDE_API_KEY が設定されていません'); return; }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('当事者の声');
  if (!sheet) { Logger.log('「当事者の声」シートが見つかりません'); return; }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const ensureCol = (name) => {
    let idx = headers.indexOf(name);
    if (idx === -1) {
      idx = headers.length;
      sheet.getRange(1, idx + 1).setValue(name);
      headers.push(name);
    }
    return idx + 1;
  };
  const COL_EXHIBIT       = ensureCol('展示対象');
  const COL_STATUS        = ensureCol('分類状態');
  const COL_CLAUDE_CHECK  = ensureCol('Claude確認');
  const COL_CLAUDE_NOTE   = ensureCol('Claudeメモ');

  const rows = sheet.getDataRange().getValues();
  let reviewed = 0;

  for (let i = 1; i < rows.length; i++) {
    if (reviewed >= limit) break;

    const row = rows[i];
    // Geminiが分類済みだがClaudeがまだ確認していないものを対象
    if (row[COL_STATUS - 1] !== '分類済み') continue;
    if (row[COL_CLAUDE_CHECK - 1] === '確認済み') continue;

    const title  = row[1] || '';
    const desc   = row[3] || '';
    const sender = row[4] || '';
    const geminiJudge = row[COL_EXHIBIT - 1] || '';
    if (!title) continue;

    const prompt = `あなたはPROJECT MANAの展示キュレーターです。
以下は当事者・当事者団体が発信した記事です。Geminiによる仮分類結果も添えます。

【記事情報】
発信者: ${sender}
タイトル: ${title}
概要: ${desc}
Geminiの判断: ${geminiJudge}

【あなたの役割】
制度や社会への訴え、当事者の経験や声、構造的問題の指摘など、
「誰の言葉として迎えるか」という観点で展示価値を判断してください。
Geminiが非展示とした記事も、当事者の声として重要な場合は展示にしてください。

【回答形式】必ずJSONのみで返すこと。
{
  "exhibit": true か false,
  "note": "展示する/しない理由（1〜2文、当事者の声としての価値を軸に）"
}`;

    const url_api = 'https://api.anthropic.com/v1/messages';
    try {
      const res = UrlFetchApp.fetch(url_api, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }]
        }),
        muteHttpExceptions: true
      });
      const raw = res.getContentText();
      const json = JSON.parse(raw);
      if (!json.content || !json.content[0]) {
        Logger.log('[ERR] Claude応答なし: ' + raw.slice(0, 200));
        Utilities.sleep(5000);
        continue;
      }
      const text = json.content[0].text.trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) { Logger.log('[SKIP] JSON取得失敗: ' + text.slice(0, 100)); continue; }

      const result = JSON.parse(match[0]);
      // Claudeが展示に変えた場合のみ上書き（非展示→展示の救済が主目的）
      if (result.exhibit && geminiJudge === '非展示') {
        sheet.getRange(i + 1, COL_EXHIBIT).setValue('展示（Claude判断）');
      }
      sheet.getRange(i + 1, COL_CLAUDE_CHECK).setValue('確認済み');
      sheet.getRange(i + 1, COL_CLAUDE_NOTE).setValue(result.note || '');
      reviewed++;
      Logger.log('[OK] ' + title.slice(0, 30) + ' → Claude: ' + (result.exhibit ? '展示' : '非展示') + ' (Gemini: ' + geminiJudge + ')');
      Utilities.sleep(3000);
    } catch(e) {
      Logger.log('[ERR] ' + title.slice(0, 30) + ': ' + e.message);
      Utilities.sleep(5000);
    }
  }
  Logger.log('Claude再確認完了: ' + reviewed + '件（上限: ' + limit + '件）');
}
