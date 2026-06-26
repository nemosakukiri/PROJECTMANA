// PROJECT MANA — 事案カルテ自動生成スクリプト
// 判断基準：地域＋分野＋時期（主）＋構造タグ（補助）

// ===== 設定 =====
const KARTE_SHEET  = 'カルテ';
const SOURCE_SHEET = 'kansokuDB';
const KARTE_DAYS   = 30; // 同一事案とみなす期間（日）

// ===== 採番：カルテシート内の最大番号+1を発行 =====
// 行数ベースの相対採番（kartes.length等）は廃止。
// 必ずカルテシートの既存IDを全走査し、最大番号+1を返す。
// 欠番・削除済みIDは再利用しない。
function _getNextKarteNumber(karteSheet) {
  const data = karteSheet.getDataRange().getValues();
  const kIdIdx = data[0].indexOf('カルテID');
  let maxNum = 0;
  data.slice(1).forEach(function(row) {
    const id = String(row[kIdIdx] || '').trim();
    const m = id.match(/KARTE-(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  });
  return maxNum + 1;
}

// ===== メイン関数（毎日自動実行 or 手動）=====
function generateKartes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const karteSheet  = getOrCreateKarteSheet(ss);
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  if (!sourceSheet) { Logger.log('kansokuDBシートが見つかりません'); return; }
  if (!apiKey)      { Logger.log('APIキーが未設定'); return; }

  // 収集記事を取得
  const sourceData    = sourceSheet.getDataRange().getValues();
  const sourceHeaders = sourceData[0];
  const articles = sourceData.slice(1).map(row => {
    const obj = {};
    sourceHeaders.forEach((h, i) => obj[h] = row[i] || '');
    return obj;
  }).filter(r => r['タイトル']);

  // 既存カルテを取得
  const karteData = karteSheet.getDataRange().getValues();
  const kartes = karteData.slice(1).map(row => ({
    id:             row[0],
    title:          row[1],
    region:         row[2],
    field:          row[3],
    summary:        row[4],
    progress:       row[5],
    tags_event:     row[6],
    tags_structure: row[7],
    tags_status:    row[8],
    tags_evidence:  row[9],
    related_urls:   row[10],
    mana_comment:   row[11],
    created_at:     row[12],
    updated_at:     row[13],
    start_date:     row[14],
  }));

  // カルテに未紐付けの記事だけ処理
  const linkedUrls = new Set(
    kartes.flatMap(k => (k.related_urls || '').split('\n').filter(Boolean))
  );
  const unlinked = articles.filter(a => a['URL'] && !linkedUrls.has(a['URL']));

  Logger.log('未紐付け記事: ' + unlinked.length + '件');
  if (!unlinked.length) { Logger.log('新しい記事なし'); return; }

  let newKartes     = 0;
  let updatedKartes = 0;
  let skippedKartes = 0;

  // ===== 共通処理関数（generateKartesForUnlinked()と共用）=====
  _processArticles(unlinked, karteSheet, kartes, apiKey);
  Logger.log('新規カルテ: ' + newKartes + '件 / 統合: ' + updatedKartes + '件');
}

// ===== 記事処理の共通ロジック =====
// generateKartes() / generateKartesForUnlinked() 両方から呼ばれる
// 必須条件：
//   1. extractObservationItems() が成功していること
//   2. is_japan === true であること
//   3. judgeMatchingKarte() を通過していること
//   4. 429/APIエラー連続でその場で停止すること
function _processArticles(articles, karteSheet, kartes, apiKey) {
  const MAX_CONSEC_ERR = 3;
  let consecErr  = 0;
  let newCount   = 0;
  let updateCount= 0;
  let skipCount  = 0;

  // ===== 待機時間調整の効果測定用カウンタ =====
  let totalArticlesAttempted = 0; // ループに入った記事数（処理試行数）
  let extractSuccessCount    = 0; // extractObservationItems()成功回数
  let extractFailCount       = 0; // extractObservationItems()失敗回数（429含む）
  let generateSuccessCount   = 0; // generateNewKarteStrict()成功回数
  let generateFailCount      = 0; // generateNewKarteStrict()失敗回数（429含む）
  const runStartTime = new Date();

  for (let i = 0; i < articles.length; i++) {
    totalArticlesAttempted++;
    const article = articles[i];
    const title   = (article['タイトル'] || '').slice(0, 35);

    // ===== Step 1: 観測項目抽出（必須）=====
    let items = extractObservationItems(article, apiKey);

    if (!items) {
      // APIエラー / 429 → スキップ。連続エラーカウント
      extractFailCount++;
      consecErr++;
      Logger.log('[SKIP-APIエラー ' + consecErr + '/' + MAX_CONSEC_ERR + '] 「' + title + '」');
      if (consecErr >= MAX_CONSEC_ERR) {
        Logger.log('[処理中断] 連続APIエラー' + MAX_CONSEC_ERR + '件。未処理記事は次回実行で処理されます。');
        break;
      }
      Utilities.sleep(5000);
      continue;
    }
    extractSuccessCount++;
    consecErr = 0; // 成功したらリセット

    // ルールベース地域補完：Geminiが取れなかった地域・市区町村を
    // タイトル・地域・市区町村・分野・要約から補完する
    items = applyRegionFallback(items, [
      article['タイトル'], article['地域'], article['市区町村'],
      article['分野'], article['要約'], article['URL']
    ]);

    // 抽出成功 → 生成APIを呼ぶ前に間隔を空ける（RPM対策）
    Utilities.sleep(2500);

    // ===== Step 2: 国籍確認（必須）=====
    if (items.is_japan !== true) {
      const reason = items.is_japan === false ? '海外記事' : '国籍不明';
      Logger.log('[SKIP-' + reason + '] 「' + title + '」');
      skipCount++;
      Utilities.sleep(300);
      continue;
    }

    // ===== Step 3: 同一事案判定（必須）=====
    const judgment = judgeMatchingKarte(article, items, kartes);

    // ===== Step 4: 統合 or 新規生成 =====
    if (judgment.matched) {
      // updateKarte()内でも最終チェックあり
      const accepted = updateKarte(karteSheet, judgment.matched, article, kartes, judgment.reason);
      if (accepted) updateCount++;
      Utilities.sleep(2500);

    } else {
      // 新規カルテ生成（フォールバックなし・失敗したら未処理のまま残す）
      Logger.log('[新規判定] ' + judgment.reason);
      const index    = _getNextKarteNumber(karteSheet);
      const newKarte = generateNewKarteStrict(article, index, apiKey, items);

      if (!newKarte) {
        generateFailCount++;
        Logger.log('[SKIP-生成失敗] 「' + title + '」 未処理として残します');
        Utilities.sleep(4000);
        continue;
      }
      generateSuccessCount++;

      if (judgment.isRelated && judgment.relatedIds && judgment.relatedIds.length) {
        newKarte.mana_comment = '関連カルテ候補: ' + judgment.relatedIds.join(', ');
      }

      karteSheet.appendRow([
        newKarte.id,          newKarte.title,    newKarte.region,
        newKarte.field,       newKarte.summary,  newKarte.progress,
        newKarte.tags_event,  newKarte.tags_structure, newKarte.tags_status,
        newKarte.tags_evidence, newKarte.related_urls, newKarte.mana_comment || '',
        new Date().toISOString(), new Date().toISOString(), newKarte.start_date,
        newKarte.profile_field, newKarte.profile_target, newKarte.profile_actor,
        newKarte.profile_event, newKarte.profile_status, newKarte.profile_institution,
      ]);
      Logger.log('  プロフィール: field=' + (newKarte.profile_field || '—') +
        ' / target=' + (newKarte.profile_target || '—') +
        ' / actor=' + (newKarte.profile_actor || '—') +
        ' / event=' + (newKarte.profile_event || '—'));

      // 代表記事にのみカルテIDを書き戻す
      if (article['URL']) writeKarteIdToDb(article['URL'], newKarte.id);
      kartes.push(newKarte);
      newCount++;
      Logger.log('[新規] ' + newKarte.id + ': ' + newKarte.title.slice(0, 35));
      Utilities.sleep(4000);
    }
  }

  const runEndTime = new Date();
  const elapsedSec = Math.round((runEndTime - runStartTime) / 1000);

  Logger.log('===== 処理完了 新規:' + newCount + '件 / 統合:' + updateCount + '件 / スキップ:' + skipCount + '件 =====');
  Logger.log('');
  Logger.log('===== 待機時間調整 効果測定サマリ =====');
  Logger.log('処理試行記事数:                 ' + totalArticlesAttempted + '件');
  Logger.log('extractObservationItems 成功:    ' + extractSuccessCount + '件');
  Logger.log('extractObservationItems 失敗:    ' + extractFailCount + '件（429含む）');
  Logger.log('generateNewKarteStrict 成功:     ' + generateSuccessCount + '件');
  Logger.log('generateNewKarteStrict 失敗:     ' + generateFailCount + '件（429含む）');
  Logger.log('API呼び出し失敗合計:             ' + (extractFailCount + generateFailCount) + '件');
  Logger.log('実行時間:                        ' + elapsedSec + '秒');
  Logger.log('========================================');
}

// ===== 観測項目の抽出（Gemini）=====
// AIは「同一事案か」を判断しない。観測項目を抽出するだけ。
function extractObservationItems(article, apiKey) {
  const prompt =
    '以下の記事から観測項目をJSONで抽出してください。\n\n' +
    '【記事情報】\n' +
    'タイトル：' + (article['タイトル'] || '') + '\n' +
    '地域：' + (article['地域'] || '') + '\n' +
    '市区町村：' + (article['市区町村'] || '') + '\n' +
    '分野：' + (article['分野'] || '') + '\n' +
    '要約：' + (article['要約'] || '') + '\n\n' +
    '【抽出ルール】\n' +
    '- is_japan: 日本国内の記事ならtrue、海外・不明ならfalse\n' +
    '- region: 都道府県名のみ（海外・不明は空欄）\n' +
    '- municipality: 市区町村名（不明は空欄）\n' +
    '- field: 制度分野（生活保護・障害福祉・介護保険・財政・情報公開・児童福祉・住宅支援 など）\n' +
    '- actor: 行為者（福祉事務所・市区町村窓口・都道府県・厚生労働省 など、不明は空欄）\n' +
    '- target: 対象者（生活保護受給者・高齢者・障害者 など、不明は空欄）\n' +
    '- event: 出来事（申請妨害・長期放置・記録改ざん・支給停止 など、不明は空欄）\n' +
    '- status: 状態（係争中・是正あり・調査中 など、不明は空欄）\n' +
    '- institution: 固有の機関名（例：桐生市福祉事務所。不明・一般的すぎる場合は空欄）\n\n' +
    '【出力形式】JSONオブジェクトのみ。説明文・コードブロック記号は不要。\n' +
    '{"is_japan":true,"region":"","municipality":"","field":"","actor":"","target":"","event":"","status":"","institution":""}';

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + apiKey;

  try {
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 300 }
      }),
      muteHttpExceptions: true
    });

    if (res.getResponseCode() === 429) return null;

    const json = JSON.parse(res.getContentText());
    const raw  = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!raw) return null;

    let result = null;
    const blockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (blockMatch) { try { result = JSON.parse(blockMatch[1].trim()); } catch(e) {} }
    if (!result) {
      const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
      if (s !== -1 && e > s) { try { result = JSON.parse(raw.slice(s, e + 1)); } catch(e2) {} }
    }
    return result;
  } catch(e) {
    return null;
  }
}

// ===== ルールベース地域補完 =====
// Gemini抽出結果のregion/municipalityが空欄、または取れていない場合に、
// タイトル・URL・要約・観測メモ本文から市区町村名を検出し、都道府県を補完する。
// news_collector.gs の CITY_TO_PREF（市区町村→都道府県マップ）を共用する。
// 同一GASプロジェクト内のためグローバル定数として参照可能。
function applyRegionFallback(items, textSources) {
  if (!items) return items;

  let region = items.region || '';
  let municipality = items.municipality || '';

  if (region && municipality) return items; // 両方揃っていれば何もしない

  const rawText = textSources.filter(Boolean).join(' ');

  if (typeof CITY_TO_PREF === 'undefined') {
    return items; // マップが読み込まれていない場合は安全側で何もしない
  }

  if (!region || !municipality) {
    const sortedCities = Object.keys(CITY_TO_PREF).sort((a, b) => b.length - a.length);
    for (const city of sortedCities) {
      if (rawText.includes(city)) {
        if (!region)       region       = CITY_TO_PREF[city];
        if (!municipality) municipality = city;
        break;
      }
    }
  }

  // 東京23区の補完（テキストに「東京」がある場合のみ）
  if ((!region || !municipality) && rawText.includes('東京') && typeof TOKYO_WARDS !== 'undefined') {
    for (const ward of TOKYO_WARDS) {
      if (rawText.includes(ward)) {
        if (!region)       region       = '東京都';
        if (!municipality) municipality = ward;
        break;
      }
    }
  }

  return {
    ...items,
    region: region,
    municipality: municipality,
  };
}

// ===== 同一事案判定（○×比較）=====
// 戻り値: { matched: karteオブジェクトまたはnull, reason: ログ文字列, isRelated: bool }
function judgeMatchingKarte(article, items, kartes) {
  // items が null = 抽出失敗 → 新規
  if (!items) return { matched: null, reason: '観測項目抽出失敗→新規', isRelated: false };

  // is_japan チェック
  if (items.is_japan === false) {
    return { matched: null, reason: '海外記事→スキップ', isRelated: false };
  }

  const region = (items.region || article['地域'] || '').trim();
  const field  = (items.field  || article['分野'] || '').trim();

  if (!region || !field) {
    return { matched: null, reason: '地域または分野が空欄→新規', isRelated: false };
  }

  const relatedCandidates = [];

  for (const karte of kartes) {
    // ===== 必須一致 =====
    if (!karte.region || karte.region !== region) continue;
    if (!karte.field  || karte.field  !== field)  continue;

    // ===== 強い一致：A または B =====
    const karteInstitution   = (karte.tags_actor || '').trim();
    const itemsInstitution   = (items.institution || '').trim();
    const karteActor         = (karte.tags_actor || '');
    const karteMunicipality  = (karte.region_city || '');
    const karteEvent         = (karte.tags_event || '');

    // 条件A：institution 両方あり・完全一致
    const condA = itemsInstitution &&
                  karteInstitution &&
                  itemsInstitution === karteInstitution;

    // 条件B：municipality / actor / event のうち2つ以上一致
    let bScore = 0;
    const bMatches = [];
    if (items.municipality && karteMunicipality && items.municipality === karteMunicipality) {
      bScore++; bMatches.push('municipality=' + items.municipality);
    }
    if (items.actor && karteActor && karteActor.includes(items.actor)) {
      bScore++; bMatches.push('actor=' + items.actor);
    }
    if (items.event && karteEvent && karteEvent.includes(items.event)) {
      bScore++; bMatches.push('event=' + items.event);
    }
    const condB = bScore >= 2;

    // 補助スコア（関連カルテ候補判定用）
    let auxScore = 0;
    if (items.target && (karte.tags_target || '').includes(items.target)) auxScore++;
    if (items.status && (karte.tags_status || '').includes(items.status)) auxScore++;

    if (condA || condB) {
      // 同一事案と判定
      const reason =
        '必須一致: region=' + region + '○ / field=' + field + '○' +
        (condA ? ' / 強一致A: institution=' + itemsInstitution + '○' : '') +
        (condB ? ' / 強一致B: ' + bMatches.join(', ') : '') +
        ' / 補助スコア=' + auxScore;
      return { matched: karte, reason: reason, isRelated: false };
    }

    // 必須一致するが強い一致なし → 関連カルテ候補
    relatedCandidates.push(karte);
  }

  // 関連カルテ候補がある場合
  if (relatedCandidates.length > 0) {
    const ids = relatedCandidates.map(k => k.id).join(', ');
    return {
      matched: null,
      reason: '必須一致のみ・強い一致なし→新規（関連候補: ' + ids + '）',
      isRelated: true,
      relatedIds: relatedCandidates.map(k => k.id)
    };
  }

  return { matched: null, reason: '必須一致なし→新規', isRelated: false };
}

// ===== 既存カルテとのマッチング（旧版・互換用）=====
// 新設計では judgeMatchingKarte() を使う
function findMatchingKarte(article, kartes) {
  // 旧スコア判定は使わない。judgeMatchingKarte()に委譲する際の互換ラッパー
  // generateKartes() は直接 judgeMatchingKarte() を呼ぶよう変更済み
  return null;
}

// ===== 既存カルテを更新 =====
function updateKarte(sheet, karte, article, allKartes, matchReason) {
  // ===== URL追記前の最終チェック =====
  // judgeMatchingKarte()が同一事案と返しても、ここで再確認する
  const articleRegion = (article['地域']    || '').trim();
  const articleField  = (article['分野']    || '').trim();
  const articleCity   = (article['市区町村'] || '').trim();
  const articleEvent  = (article['出来事タグ'] || '').trim();

  const karteRegion = (karte.region || '').trim();
  const karteField  = (karte.field  || '').trim();

  // region・fieldが両方あって不一致なら拒否
  if (karteRegion && articleRegion && karteRegion !== articleRegion) {
    Logger.log('[追記拒否] ' + karte.id + ' ← 「' + (article['タイトル'] || '').slice(0, 30) + '」');
    Logger.log('  理由: 地域不一致（記事:' + articleRegion + ' ≠ カルテ:' + karteRegion + '）');
    return false;
  }
  if (karteField && articleField && karteField !== articleField) {
    Logger.log('[追記拒否] ' + karte.id + ' ← 「' + (article['タイトル'] || '').slice(0, 30) + '」');
    Logger.log('  理由: 分野不一致（記事:' + articleField + ' ≠ カルテ:' + karteField + '）');
    return false;
  }

  // region・fieldが一致しても municipality・event・institution のどれも一致しない場合は拒否
  const karteCity  = (karte.region_city || '').trim();
  const karteEvent = (karte.tags_event  || '').trim();
  const karteActor = (karte.tags_actor  || '').trim();

  const cityMatch  = articleCity  && karteCity  && articleCity  === karteCity;
  const eventMatch = articleEvent && karteEvent && karteEvent.includes(articleEvent);
  const actorMatch = articleEvent && karteActor && karteActor.includes(articleEvent);

  // region・fieldどちらかが空欄の場合は municipality/event の一致を必須にする
  if ((!karteRegion || !articleRegion || !karteField || !articleField)) {
    if (!cityMatch && !eventMatch && !actorMatch) {
      Logger.log('[追記拒否] ' + karte.id + ' ← 「' + (article['タイトル'] || '').slice(0, 30) + '」');
      Logger.log('  理由: region/fieldが不完全かつ municipality/event/institution も不一致');
      return false;
    }
  }

  // ===== チェック通過 → URL追記 =====
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === karte.id) {
      const urls = data[i][10]
        ? data[i][10] + '\n' + article['URL']
        : article['URL'];
      sheet.getRange(i + 1, 11).setValue(urls);

      const newStatus = mergeStr(data[i][8], article['状態タグ']);
      sheet.getRange(i + 1, 9).setValue(newStatus);
      sheet.getRange(i + 1, 14).setValue(new Date().toISOString());

      // 追記ログ
      const matched = [];
      if (karteRegion && articleRegion && karteRegion === articleRegion) matched.push('region=' + karteRegion);
      if (karteField  && articleField  && karteField  === articleField)  matched.push('field=' + karteField);
      if (cityMatch)  matched.push('municipality=' + articleCity);
      if (eventMatch) matched.push('event一致');
      if (actorMatch) matched.push('actor一致');

      Logger.log('[URL追記] ' + karte.id + '「' + (karte.title || '').slice(0, 25) + '」');
      Logger.log('  追加記事: 「' + (article['タイトル'] || '').slice(0, 35) + '」');
      Logger.log('  一致項目: ' + matched.join(' / '));
      if (matchReason) Logger.log('  判定理由: ' + matchReason);
      break;
    }
  }
  return true;
}

// ===== 新規カルテを生成（Gemini）=====
function generateNewKarte(article, index, apiKey) {
  const prompt = `以下の記事から「事案カルテ」を生成してください。

【記事情報】
タイトル：${article['タイトル']}
地域：${article['地域']}${article['市区町村'] ? ' / ' + article['市区町村'] : ''}
分野：${article['分野']}
要約：${article['要約']}
出来事タグ：${article['出来事タグ']}
構造タグ：${article['構造タグ']}
状態タグ：${article['状態タグ']}
根拠タグ：${article['根拠タグ']}

【生成ルール】
- 事案名：この事案を一言で表す（30文字以内）
- 概要：構造的問題として2〜3文で説明
- 経過：現時点の状況を1文で
- 構造タグは組織・制度レベルの観点で必ず1つ以上付与

【出力形式】
以下のJSONオブジェクトのみを出力してください。
前後に説明文・コードブロック記号は不要です。

{"title":"事案名","summary":"概要","progress":"経過","tags_event":"出来事タグ","tags_structure":"構造タグ","tags_status":"状態タグ","tags_evidence":"根拠タグ"}`;

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + apiKey;

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
      }),
      muteHttpExceptions: true
    });

    const json = JSON.parse(response.getContentText());

    Logger.log('Gemini HTTPステータス: ' + response.getResponseCode());
    Logger.log('Geminiレスポンスキー: ' + Object.keys(json).join(', '));
    if (json.error) {
      Logger.log('GeminiAPIエラー: ' + JSON.stringify(json.error));
    }

    const candidate = json.candidates?.[0];
    if (!candidate) {
      Logger.log('candidatesが空: ' + JSON.stringify(json).slice(0, 300));
      return fallbackKarte(article, index);
    }

    const rawText = candidate.content?.parts?.[0]?.text || '';
    Logger.log('rawText長さ: ' + rawText.length + '文字');
    if (rawText.length === 0) {
      Logger.log('rawTextが空。candidate全体: ' + JSON.stringify(candidate).slice(0, 300));
      return fallbackKarte(article, index);
    }

    // JSON抽出：3段階で試みる
    let result = null;

    // 方法1: ```json ... ``` ブロック
    const blockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (blockMatch) {
      try { result = JSON.parse(blockMatch[1].trim()); } catch(e) {}
    }

    // 方法2: 最初の { から最後の }
    if (!result) {
      const start = rawText.indexOf('{');
      const end   = rawText.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        try { result = JSON.parse(rawText.slice(start, end + 1)); } catch(e) {}
      }
    }

    // 方法3: 正規表現
    if (!result) {
      const objMatch = rawText.match(/\{[\s\S]*?\}/);
      if (objMatch) {
        try { result = JSON.parse(objMatch[0]); } catch(e) {}
      }
    }

    if (!result) {
      Logger.log('=== JSON抽出失敗 ===');
      Logger.log('rawText先頭500文字:\n[' + rawText.slice(0, 500) + ']');
      Logger.log('rawText末尾100文字:\n[' + rawText.slice(-100) + ']');
      return fallbackKarte(article, index);
    }

    const id = 'KARTE-' + String(index).padStart(4, '0');
    return {
      id,
      title:          result.title          || article['タイトル'].slice(0, 30),
      region:         article['地域']        || '',
      field:          article['分野']        || '',
      summary:        result.summary        || article['要約'] || '',
      progress:       result.progress       || '',
      tags_event:     result.tags_event     || article['出来事タグ'] || '',
      tags_structure: result.tags_structure || article['構造タグ']  || '',
      tags_status:    result.tags_status    || article['状態タグ']  || '',
      tags_evidence:  result.tags_evidence  || article['根拠タグ']  || '',
      related_urls:   article['URL']        || '',
      start_date:     article['日付']        || formatDate(new Date()),
    };

  } catch(e) {
    Logger.log('カルテ生成エラー（例外）: ' + e.message);
    return fallbackKarte(article, index);
  }
}

// ===== Gemini失敗時のフォールバック =====
function fallbackKarte(article, index) {
  return {
    id:             'KARTE-' + String(index).padStart(4, '0'),
    title:          article['タイトル'].slice(0, 30),
    region:         article['地域']       || '',
    field:          article['分野']       || '',
    summary:        article['要約']       || '',
    progress:       '',
    tags_event:     article['出来事タグ'] || '',
    tags_structure: article['構造タグ']   || '',
    tags_status:    article['状態タグ']   || '',
    tags_evidence:  article['根拠タグ']   || '',
    related_urls:   article['URL']        || '',
    start_date:     article['日付']       || formatDate(new Date()),
  };
}

// ===== カルテシート 取得/作成 =====
function getOrCreateKarteSheet(ss) {
  let sheet = ss.getSheetByName(KARTE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(KARTE_SHEET);
    const headers = [
      'カルテID', '事案名', '地域', '分野', '概要', '経過',
      '出来事タグ', '構造タグ', '状態タグ', '根拠タグ',
      '関連記事URL', 'MANAコメント', '作成日', '最終更新日', '事案開始日',
      '分野タグ', '対象者タグ', '行為者タグ', '出来事タグ（探索）',
      '状態タグ（探索）', '固有機関名'
    ];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    const h = sheet.getRange(1, 1, 1, headers.length);
    h.setBackground('#0f0e0d');
    h.setFontColor('#faf9f6');
    h.setFontWeight('bold');
    sheet.setColumnWidth(2,  250);
    sheet.setColumnWidth(5,  350);
    sheet.setColumnWidth(6,  200);
    sheet.setColumnWidth(11, 300);
  }
  return sheet;
}

// ===== ユーティリティ =====
function splitStr(str) {
  if (!str) return [];
  return str.split(/[\/・,、]/).map(t => t.trim()).filter(Boolean);
}

function mergeStr(existing, newStr) {
  const arr = [...new Set([...splitStr(existing), ...splitStr(newStr)])];
  return arr.join(' / ');
}

function formatDate(date) {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

// ===== トリガー設定 =====
function setKarteTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('generateKartes')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();
  Logger.log('カルテ生成トリガーを設定しました（毎朝7時）');
}

// ===== 未カルテ化記事の確認 =====
// 観測DBのURLとカルテの関連記事URLを照合し、
// カルテ未作成の記事一覧をログに出力する
function checkUnlinkedArticles() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  const karteSheet  = ss.getSheetByName(KARTE_SHEET);

  if (!sourceSheet) { Logger.log('kansokuDBシートが見つかりません'); return; }
  if (!karteSheet)  { Logger.log('カルテシートが見つかりません'); return; }

  // 観測DBの全記事URLを収集
  const sourceData    = sourceSheet.getDataRange().getValues();
  const sourceHeaders = sourceData[0];
  const urlIdx        = sourceHeaders.indexOf('URL');
  const titleIdx      = sourceHeaders.indexOf('タイトル');
  const dateIdx       = sourceHeaders.indexOf('日付');

  if (urlIdx < 0) { Logger.log('観測DBにURL列が見つかりません'); return; }

  const articles = sourceData.slice(1)
    .map(row => ({
      url:   String(row[urlIdx]   || '').trim(),
      title: String(row[titleIdx] || '').trim(),
      date:  String(row[dateIdx]  || '').trim(),
    }))
    .filter(a => a.url && a.title);

  // カルテの関連記事URLを全件収集
  const karteData    = karteSheet.getDataRange().getValues();
  const karteHeaders = karteData[0];
  const relIdx       = karteHeaders.indexOf('関連記事URL');

  if (relIdx < 0) { Logger.log('カルテシートに関連記事URL列が見つかりません'); return; }

  const linkedUrls = new Set();
  karteData.slice(1).forEach(row => {
    const urls = String(row[relIdx] || '');
    urls.split('\n').forEach(u => {
      const trimmed = u.trim().replace(/\/$/, '');
      if (trimmed) linkedUrls.add(trimmed);
    });
  });

  // 照合：カルテ未作成の記事を抽出
  const unlinked = articles.filter(a => {
    const normalized = a.url.replace(/\/$/, '');
    return !linkedUrls.has(normalized);
  });

  Logger.log('===== 未カルテ化記事の確認 =====');
  Logger.log('観測DB総件数: ' + articles.length + '件');
  Logger.log('カルテ紐付き: ' + (articles.length - unlinked.length) + '件');
  Logger.log('未カルテ化:   ' + unlinked.length + '件');
  Logger.log('');

  if (unlinked.length === 0) {
    Logger.log('未カルテ化の記事はありません。');
    return;
  }

  Logger.log('--- 未カルテ化記事一覧 ---');
  unlinked.forEach((a, i) => {
    Logger.log((i + 1) + '. [' + a.date + '] ' + a.title);
    Logger.log('   URL: ' + a.url);
  });

  Logger.log('');
  Logger.log('→ generateKartesForUnlinked() を実行すると未カルテ化分のみ生成します。');
}

// ===== 未カルテ化記事のみカルテ生成 =====
// generateKartes() は「全件ログにない新着」を対象にするが、
// この関数は「カルテのrelatedURLsに含まれていない記事」を対象にする。
// すでに全件ログに入っている既存記事もカルテ未作成なら対象になる。

// ===== 新規カルテ生成（厳格版・フォールバックなし）=====
// APIエラー時はnullを返す。タイトルだけの空カルテは作らない。
function generateNewKarteStrict(article, index, apiKey, items) {
  const prompt = `以下の記事から「事案カルテ」を生成してください。

【記事情報】
タイトル：${article['タイトル']}
地域：${article['地域']}${article['市区町村'] ? ' / ' + article['市区町村'] : ''}
分野：${article['分野']}
要約：${article['要約']}
出来事タグ：${article['出来事タグ']}
構造タグ：${article['構造タグ']}
状態タグ：${article['状態タグ']}
根拠タグ：${article['根拠タグ']}

【生成ルール】
- 事案名：この事案を一言で表す（30文字以内）
- 概要：構造的問題として2〜3文で説明
- 経過：現時点の状況を1文で
- 構造タグは組織・制度レベルの観点で必ず1つ以上付与

【出力形式】
以下のJSONオブジェクトのみを出力してください。
前後に説明文・コードブロック記号は不要です。

{"title":"事案名","summary":"概要","progress":"経過","tags_event":"出来事タグ","tags_structure":"構造タグ","tags_status":"状態タグ","tags_evidence":"根拠タグ"}`;

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + apiKey;

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
      }),
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    if (statusCode === 429) {
      Logger.log('[generateNewKarteStrict] 429 → null を返します（フォールバックなし）');
      return null;
    }

    const json = JSON.parse(response.getContentText());
    if (json.error) {
      Logger.log('[generateNewKarteStrict] APIエラー: ' + JSON.stringify(json.error).slice(0, 100));
      return null;
    }

    const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!rawText) {
      Logger.log('[generateNewKarteStrict] rawText空 → null');
      return null;
    }

    let result = null;
    const blockMatch = rawText.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
    if (blockMatch) { try { result = JSON.parse(blockMatch[1].trim()); } catch(e) {} }
    if (!result) {
      const s = rawText.indexOf('{'), e = rawText.lastIndexOf('}');
      if (s !== -1 && e > s) { try { result = JSON.parse(rawText.slice(s, e + 1)); } catch(e2) {} }
    }
    if (!result) {
      Logger.log('[generateNewKarteStrict] JSON抽出失敗 → null');
      return null;
    }

    const id = 'KARTE-' + String(index).padStart(4, '0');
    return {
      id,
      title:          result.title          || article['タイトル'].slice(0, 30),
      region:         article['地域']        || '',
      field:          article['分野']        || '',
      summary:        result.summary        || '',
      progress:       result.progress       || '',
      tags_event:     result.tags_event     || article['出来事タグ'] || '',
      tags_structure: result.tags_structure || article['構造タグ']  || '',
      tags_status:    result.tags_status    || article['状態タグ']  || '',
      tags_evidence:  result.tags_evidence  || article['根拠タグ']  || '',
      related_urls:   article['URL']        || '',
      mana_comment:   '',
      start_date:     article['日付']        || formatDate(new Date()),
      // ===== 観測項目（extractObservationItems由来）をプロフィール列に保存 =====
      profile_field:    items ? (items.field        || '') : '',
      profile_target:   items ? (items.target       || '') : '',
      profile_actor:    items ? (items.actor        || '') : '',
      profile_event:    items ? (items.event        || '') : '',
      profile_status:   items ? (items.status       || '') : '',
      profile_institution: items ? (items.institution || '') : '',
    };
  } catch(e) {
    Logger.log('[generateNewKarteStrict] 例外: ' + e.message + ' → null');
    return null;
  }
}

function generateKartesForUnlinked() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const karteSheet  = getOrCreateKarteSheet(ss);
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  const apiKey      = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  if (!sourceSheet) { Logger.log('kansokuDBシートが見つかりません'); return; }
  if (!apiKey)      { Logger.log('APIキーが未設定'); return; }

  // 観測DBの全記事を取得
  const sourceData    = sourceSheet.getDataRange().getValues();
  const sourceHeaders = sourceData[0];
  const articles = sourceData.slice(1).map(row => {
    const obj = {};
    sourceHeaders.forEach((h, i) => obj[h] = row[i] || '');
    return obj;
  }).filter(r => r['タイトル']);

  // 既存カルテのrelated_urlsを収集
  const karteData = karteSheet.getDataRange().getValues();
  const karteHeaders = karteData[0];
  const relIdx = karteHeaders.indexOf('関連記事URL');

  const linkedUrls = new Set();
  karteData.slice(1).forEach(row => {
    const urls = String(row[relIdx] || '');
    urls.split('\n').forEach(u => {
      const trimmed = u.trim().replace(/\/$/, '');
      if (trimmed) linkedUrls.add(trimmed);
    });
  });

  // 既存カルテをオブジェクト化（マッチング用）
  const kartes = karteData.slice(1).map(row => ({
    id:             row[0],
    title:          row[1],
    region:         row[2],
    field:          row[3],
    summary:        row[4],
    progress:       row[5],
    tags_event:     row[6],
    tags_structure: row[7],
    tags_status:    row[8],
    tags_evidence:  row[9],
    related_urls:   row[10],
    mana_comment:   row[11],
    created_at:     row[12],
    updated_at:     row[13],
    start_date:     row[14],
  }));

  // カルテ未作成の記事を抽出
  const unlinked = articles.filter(a => {
    if (!a['URL']) return false;
    const normalized = a['URL'].trim().replace(/\/$/, '');
    return !linkedUrls.has(normalized);
  });

  Logger.log('未カルテ化記事: ' + unlinked.length + '件を処理します');
  if (!unlinked.length) { Logger.log('未カルテ化の記事はありません'); return; }

  let newKartes     = 0;
  let updatedKartes = 0;

  // 共通処理関数に委譲（429停止・is_japan確認・判定通過を必須とするフロー）
  _processArticles(unlinked, karteSheet, kartes, apiKey);
}

// ===== kansokuDB への カルテID 書き戻し =====
// kansokuDB の末尾列に「カルテID」ヘッダーを追加し、
// カルテの関連記事URLと一致する行にカルテIDを一括書き込みする

const DB_KARTEID_COL_NAME = 'カルテID';

// kansokuDB の「カルテID」列インデックスを取得（なければ末尾に追加）
function _ensureDbKarteIdCol(sourceSheet) {
  const headers = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues()[0];
  let idx = headers.indexOf(DB_KARTEID_COL_NAME);
  if (idx === -1) {
    idx = headers.length;
    sourceSheet.getRange(1, idx + 1).setValue(DB_KARTEID_COL_NAME);
    Logger.log('kansokuDB に「カルテID」列を追加: ' + (idx + 1) + '列目');
  } else {
    Logger.log('kansokuDB「カルテID」列: ' + (idx + 1) + '列目（既存）');
  }
  return idx; // 0-indexed
}

// URL正規化（末尾スラッシュ除去・trim）
function _normalizeUrl(url) {
  return String(url || '').trim().replace(/\/$/, '');
}

// ===== 一括反映：既存カルテ全件 → kansokuDB（先頭URLのみ） =====
function backfillKarteIds() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  const karteSheet  = ss.getSheetByName(KARTE_SHEET);

  if (!sourceSheet) { Logger.log('kansokuDBシートが見つかりません'); return; }
  if (!karteSheet)  { Logger.log('カルテシートが見つかりません'); return; }

  const dbData    = sourceSheet.getDataRange().getValues();
  const dbHeaders = dbData[0];
  const urlColIdx = dbHeaders.indexOf('URL');
  if (urlColIdx < 0) { Logger.log('kansokuDB に URL 列が見つかりません'); return; }

  const karteIdColIdx = _ensureDbKarteIdCol(sourceSheet);

  const karteData    = karteSheet.getDataRange().getValues();
  const karteHeaders = karteData[0];
  const kIdIdx       = karteHeaders.indexOf('カルテID');
  const relIdx       = karteHeaders.indexOf('関連記事URL');

  if (kIdIdx < 0 || relIdx < 0) {
    Logger.log('カルテシートに「カルテID」または「関連記事URL」列が見つかりません');
    return;
  }

  // 先頭URLのみ → カルテIDのマップを作成
  // 2行目以降のURLは「関連記事」として扱い、カルテIDを書き込まない
  const urlToKarteId = {};
  let multiUrlCount = 0;

  karteData.slice(1).forEach(function(row) {
    const karteId = String(row[kIdIdx] || '').trim();
    const relUrls = String(row[relIdx] || '');
    if (!karteId) return;

    const urls = relUrls.split('\n').map(function(u) {
      return u.trim().replace(/\/$/, '');
    }).filter(Boolean);

    if (urls.length === 0) return;

    // 先頭URLのみ代表記事として登録
    const primaryUrl = urls[0];
    if (urlToKarteId[primaryUrl] && urlToKarteId[primaryUrl] !== karteId) {
      Logger.log('[先頭URL重複] ' + primaryUrl + ' → ' + urlToKarteId[primaryUrl] + ' と ' + karteId);
    } else {
      urlToKarteId[primaryUrl] = karteId;
    }

    if (urls.length > 1) multiUrlCount++;
  });

  Logger.log('先頭URLマップ作成完了: ' + Object.keys(urlToKarteId).length + '件');
  Logger.log('複数URL登録カルテ数（2行目以降はスキップ）: ' + multiUrlCount + '件');

  // クリア時のログ用にカルテタイトルマップを作成
  const kTitIdx2 = karteHeaders.indexOf('事案名');
  const karteMap = {};
  karteData.slice(1).forEach(function(row) {
    const kid = String(row[kIdIdx] || '').trim();
    if (kid) karteMap[kid] = { title: String(row[kTitIdx2] || '').trim() };
  });

  // DB記事タイトル列インデックス
  const titleIdx = dbHeaders.indexOf('タイトル');

  let writeCount   = 0;
  let clearCount   = 0;
  let skipCount    = 0;
  let alreadyCount = 0;
  let noMatchCount = 0;

  for (let i = 1; i < dbData.length; i++) {
    const row      = dbData[i];
    const url      = _normalizeUrl(row[urlColIdx]);
    const existing = String(row[karteIdColIdx] || '').trim();
    const karteId  = url ? (urlToKarteId[url] || '') : '';

    if (!url) { skipCount++; continue; }

    if (!karteId) {
      // 先頭URLに一致しない → カルテIDを書くべきでない
      // 既に書き込まれていたら空欄にクリア（ズレを修正）
      if (existing) {
        // クリア前にカルテタイトルを取得してログ出力
        const oldKarte = karteMap[existing];
        const oldKarteTitle = oldKarte ? oldKarte.title : '（カルテシートに存在しない）';
        sourceSheet.getRange(i + 1, karteIdColIdx + 1).setValue('');
        clearCount++;
        Logger.log('[クリア] 行' + (i + 1));
        Logger.log('  DB記事:   「' + String(row[titleIdx] || '').slice(0, 50) + '」');
        Logger.log('  旧カルテID: ' + existing);
        Logger.log('  旧カルテ:  「' + oldKarteTitle.slice(0, 50) + '」');
        Logger.log('  クリア理由: 先頭URL不一致（代表記事ではない）');
        Logger.log('');
      } else {
        noMatchCount++;
      }
      continue;
    }

    if (existing === karteId) { alreadyCount++; continue; }

    sourceSheet.getRange(i + 1, karteIdColIdx + 1).setValue(karteId);
    writeCount++;
    Logger.log('[書込] 行' + (i + 1) + ' → ' + karteId + ' | ' + url.slice(0, 60));
  }

  Logger.log('');
  Logger.log('===== backfillKarteIds（先頭URL限定版）完了 =====');
  Logger.log('書き込み:             ' + writeCount + '件');
  Logger.log('クリア（ズレ修正）:   ' + clearCount + '件');
  Logger.log('照合なし（正常）:     ' + noMatchCount + '件');
  Logger.log('URL空欄スキップ:      ' + skipCount + '件');
  Logger.log('書込済みスキップ:     ' + alreadyCount + '件');
  Logger.log('対象行合計:           ' + (dbData.length - 1) + '件');
}

// ===== 単一記事へのカルテID書き戻し（新規カルテ生成時に呼ぶ）=====
// articleのURL が kansokuDB に存在する場合、カルテID列に書き込む
function writeKarteIdToDb(articleUrl, karteId) {
  if (!articleUrl || !karteId) return;
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  if (!sourceSheet) return;

  const dbData    = sourceSheet.getDataRange().getValues();
  const dbHeaders = dbData[0];
  const urlIdx    = dbHeaders.indexOf('URL');
  if (urlIdx < 0) return;

  const karteIdColIdx = _ensureDbKarteIdCol(sourceSheet);
  const normTarget    = _normalizeUrl(articleUrl);

  for (let i = 1; i < dbData.length; i++) {
    const rowUrl = _normalizeUrl(dbData[i][urlIdx]);
    if (rowUrl === normTarget) {
      const existing = String(dbData[i][karteIdColIdx] || '').trim();
      if (existing && existing !== karteId) {
        Logger.log('[書戻警告] 行' + (i + 1) + ' に既に別のカルテID: ' + existing + ' → 上書き: ' + karteId);
      }
      sourceSheet.getRange(i + 1, karteIdColIdx + 1).setValue(karteId);
      Logger.log('[書戻] 行' + (i + 1) + ' ' + normTarget.slice(0, 50) + ' → ' + karteId);
      return; // URL一致は1件のみ想定
    }
  }
  Logger.log('[書戻スキップ] kansokuDB に URL 未発見: ' + normTarget.slice(0, 60));
}

// ===== カルテシートのURL重複診断 =====
// 同じURLが複数カルテに登録されていないか調査する
// 修正はしない・ログ出力のみ
function diagnoseUrlDuplication() {
  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  const karteSheet = ss.getSheetByName(KARTE_SHEET);
  if (!karteSheet) { Logger.log('カルテシートが見つかりません'); return; }

  const data    = karteSheet.getDataRange().getValues();
  const headers = data[0];
  const kIdIdx  = headers.indexOf('カルテID');
  const relIdx  = headers.indexOf('関連記事URL');

  if (kIdIdx < 0 || relIdx < 0) {
    Logger.log('「カルテID」または「関連記事URL」列が見つかりません');
    Logger.log('ヘッダー: ' + headers.join(', '));
    return;
  }

  // URL → [カルテID] のマップを構築
  const urlToKartes = {};
  let totalUrls = 0;
  let emptyCount = 0;

  data.slice(1).forEach(function(row) {
    const karteId = String(row[kIdIdx] || '').trim();
    const relUrls = String(row[relIdx] || '').trim();

    if (!relUrls) { emptyCount++; return; }

    relUrls.split('\n').forEach(function(u) {
      const norm = u.trim().replace(/\/$/, '');
      if (!norm) return;
      totalUrls++;
      if (!urlToKartes[norm]) urlToKartes[norm] = [];
      urlToKartes[norm].push(karteId);
    });
  });

  // 重複URLを抽出（2件以上のカルテに登録されているURL）
  const duplicates = Object.entries(urlToKartes).filter(function(e) {
    return e[1].length >= 2;
  });

  Logger.log('========== URL重複診断レポート ==========');
  Logger.log('カルテ総件数:       ' + (data.length - 1) + '件');
  Logger.log('関連記事URL空欄:    ' + emptyCount + '件');
  Logger.log('URLエントリ総数:    ' + totalUrls + '件（延べ）');
  Logger.log('ユニークURL数:      ' + Object.keys(urlToKartes).length + '件');
  Logger.log('重複URL数:          ' + duplicates.length + '件');
  Logger.log('');

  if (duplicates.length === 0) {
    Logger.log('重複URLは見つかりませんでした。');
    return;
  }

  Logger.log('---------- 重複URL一覧 ----------');
  duplicates.forEach(function(e, i) {
    const url     = e[0];
    const kartes  = e[1];
    Logger.log((i + 1) + '. ' + kartes.length + '件のカルテに登録:');
    Logger.log('   URL: ' + url);
    Logger.log('   カルテ: ' + kartes.join(', '));
  });

  Logger.log('');
  Logger.log('========== 診断完了 ==========');
}

// ===== kansokuDB と カルテの紐付け不整合を診断 =====
// カルテIDが書き込まれているDB行について、
// そのカルテの先頭URLと一致しているかを全件チェックする
function diagnoseKarteIdMismatch() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  const karteSheet  = ss.getSheetByName(KARTE_SHEET);

  if (!sourceSheet || !karteSheet) { Logger.log('シートが見つかりません'); return; }

  const dbData    = sourceSheet.getDataRange().getValues();
  const dbHeaders = dbData[0];
  const urlIdx    = dbHeaders.indexOf('URL');
  const titleIdx  = dbHeaders.indexOf('タイトル');
  const karteIdColIdx = dbHeaders.indexOf('カルテID');

  if (urlIdx < 0 || karteIdColIdx < 0) {
    Logger.log('URL列またはカルテID列が見つかりません');
    return;
  }

  // カルテの先頭URL → カルテIDマップ
  const karteData    = karteSheet.getDataRange().getValues();
  const karteHeaders = karteData[0];
  const kIdIdx  = karteHeaders.indexOf('カルテID');
  const relIdx  = karteHeaders.indexOf('関連記事URL');
  const titIdx  = karteHeaders.indexOf('事案名');

  const karteMap = {}; // karteId → {primaryUrl, title}
  karteData.slice(1).forEach(function(row) {
    const karteId = String(row[kIdIdx] || '').trim();
    const relUrls = String(row[relIdx] || '');
    const title   = String(row[titIdx] || '');
    if (!karteId) return;
    const primaryUrl = _normalizeUrl(relUrls.split('\n')[0] || '');
    karteMap[karteId] = { primaryUrl, title };
  });

  let mismatchCount = 0;
  let matchCount    = 0;
  let emptyCount    = 0;

  Logger.log('===== カルテID不整合診断 =====');

  for (let i = 1; i < dbData.length; i++) {
    const row     = dbData[i];
    const karteId = String(row[karteIdColIdx] || '').trim();
    if (!karteId) { emptyCount++; continue; }

    const dbUrl    = _normalizeUrl(row[urlIdx] || '');
    const dbTitle  = String(row[titleIdx] || '').slice(0, 30);
    const karte    = karteMap[karteId];

    if (!karte) {
      Logger.log('[不明カルテ] 行' + (i+1) + ' ' + karteId + ' はカルテシートに存在しない');
      mismatchCount++;
      continue;
    }

    if (karte.primaryUrl && dbUrl !== karte.primaryUrl) {
      mismatchCount++;
      Logger.log('[不整合] 行' + (i+1) +
        ' DB記事:「' + dbTitle + '」' +
        ' → ' + karteId + '「' + karte.title.slice(0, 25) + '」' +
        ' | DB-URL末尾:' + dbUrl.slice(-30) +
        ' | カルテ先頭URL末尾:' + karte.primaryUrl.slice(-30));
    } else {
      matchCount++;
    }
  }

  Logger.log('');
  Logger.log('===== 診断結果 =====');
  Logger.log('カルテIDあり・一致:    ' + matchCount + '件');
  Logger.log('カルテIDあり・不整合:  ' + mismatchCount + '件 ← これをクリアすべき');
  Logger.log('カルテIDなし:          ' + emptyCount + '件');
  Logger.log('対象行合計:            ' + (dbData.length - 1) + '件');

  if (mismatchCount > 0) {
    Logger.log('');
    Logger.log('→ backfillKarteIds() を再実行するとクリアされます');
  }
}

// ===== テスト：新しい同一事案判定を数件だけ試す =====
// いきなり全件実行せず、まずこれで判定ログを確認してください
function testJudgeMatching() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  const karteSheet  = ss.getSheetByName(KARTE_SHEET);
  const apiKey      = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  if (!sourceSheet || !karteSheet) { Logger.log('シートが見つかりません'); return; }
  if (!apiKey) { Logger.log('APIキーが未設定'); return; }

  // 観測DBから最新5件を取得
  const sourceData    = sourceSheet.getDataRange().getValues();
  const sourceHeaders = sourceData[0];
  const TEST_COUNT    = 5;

  const articles = sourceData.slice(1).map(row => {
    const obj = {};
    sourceHeaders.forEach((h, i) => obj[h] = row[i] || '');
    return obj;
  }).filter(r => r['タイトル']).slice(0, TEST_COUNT);

  // 既存カルテを取得
  const karteData = karteSheet.getDataRange().getValues();
  const kartes = karteData.slice(1).map(row => ({
    id:             row[0],
    title:          row[1],
    region:         row[2],
    field:          row[3],
    summary:        row[4],
    tags_event:     row[6],
    tags_structure: row[7],
    tags_status:    row[8],
    tags_evidence:  row[9],
    related_urls:   row[10],
    tags_actor:     row[17] || '',
    tags_target:    row[16] || '',
    region_city:    '',
    start_date:     row[14],
    created_at:     row[12],
  }));

  Logger.log('===== 同一事案判定テスト（' + TEST_COUNT + '件）=====');
  Logger.log('※ 実際の書き込みは一切しません');
  Logger.log('');

  articles.forEach((article, i) => {
    Logger.log('--- 記事' + (i+1) + ': 「' + (article['タイトル'] || '').slice(0, 40) + '」');
    Logger.log('    地域:' + (article['地域'] || '未設定') + ' / 分野:' + (article['分野'] || '未設定'));

    // 観測項目抽出
    let items = extractObservationItems(article, apiKey);
    if (items) {
      items = applyRegionFallback(items, [
        article['タイトル'], article['地域'], article['市区町村'],
        article['分野'], article['要約'], article['URL']
      ]);
      Logger.log('    抽出: is_japan=' + items.is_japan +
        ' / region=' + (items.region || '—') +
        ' / municipality=' + (items.municipality || '—') +
        ' / actor=' + (items.actor || '—') +
        ' / event=' + (items.event || '—') +
        ' / institution=' + (items.institution || '—'));
    } else {
      Logger.log('    抽出: 失敗（APIエラーまたは429）');
    }

    // 判定
    const judgment = judgeMatchingKarte(article, items, kartes);
    Logger.log('    判定: ' + judgment.reason);
    if (judgment.matched) {
      Logger.log('    → 統合先: ' + judgment.matched.id + '「' + (judgment.matched.title || '').slice(0, 25) + '」');
    } else {
      Logger.log('    → 新規カルテ生成');
    }
    Logger.log('');

    Utilities.sleep(2000);
  });

  Logger.log('===== テスト完了 =====');
}

// ===== Gemini疎通確認（karte_generator用）=====
function testGeminiFromKarteGen() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  Logger.log('APIキー確認: ' + (apiKey ? '長さ' + apiKey.length : '未設定'));

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + apiKey;
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      contents: [{ parts: [{ text: 'こんにちは' }] }],
      generationConfig: { maxOutputTokens: 10 }
    }),
    muteHttpExceptions: true
  });
  Logger.log('HTTPステータス: ' + res.getResponseCode());
  Logger.log('レスポンス: ' + res.getContentText().slice(0, 200));
}

// ===== 観測DB × カルテ タイトルズレ診断 =====
// 修正は一切しない。ログ出力のみ。
function diagnoseDbKarteTitleMismatch() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  const karteSheet  = ss.getSheetByName(KARTE_SHEET);

  if (!sourceSheet || !karteSheet) { Logger.log('シートが見つかりません'); return; }

  const dbData    = sourceSheet.getDataRange().getValues();
  const dbHeaders = dbData[0];
  const urlIdx    = dbHeaders.indexOf('URL');
  const titleIdx  = dbHeaders.indexOf('タイトル');
  const regionIdx = dbHeaders.indexOf('地域');
  const fieldIdx  = dbHeaders.indexOf('分野');
  const karteIdColIdx = dbHeaders.indexOf('カルテID');

  if (karteIdColIdx < 0) { Logger.log('カルテID列が見つかりません'); return; }

  // カルテシートをマップ化
  const karteData    = karteSheet.getDataRange().getValues();
  const karteHeaders = karteData[0];
  const kIdIdx   = karteHeaders.indexOf('カルテID');
  const kTitIdx  = karteHeaders.indexOf('事案名');
  const kRegIdx  = karteHeaders.indexOf('地域');
  const kFldIdx  = karteHeaders.indexOf('分野');
  const kRelIdx  = karteHeaders.indexOf('関連記事URL');

  const karteMap = {};
  karteData.slice(1).forEach(function(row) {
    const kid = String(row[kIdIdx] || '').trim();
    if (!kid) return;
    karteMap[kid] = {
      title:      String(row[kTitIdx] || '').trim(),
      region:     String(row[kRegIdx] || '').trim(),
      field:      String(row[kFldIdx] || '').trim(),
      primaryUrl: _normalizeUrl((String(row[kRelIdx] || '').split('\n')[0] || '')),
    };
  });

  let totalWithId = 0;
  let matchCount  = 0;
  let mismatchCount = 0;
  const mismatches = [];

  for (let i = 1; i < dbData.length; i++) {
    const row     = dbData[i];
    const karteId = String(row[karteIdColIdx] || '').trim();
    if (!karteId) continue;

    totalWithId++;
    const dbUrl    = _normalizeUrl(row[urlIdx] || '');
    const dbTitle  = String(row[titleIdx] || '').trim();
    const dbRegion = String(row[regionIdx] || '').trim();
    const dbField  = String(row[fieldIdx]  || '').trim();
    const karte    = karteMap[karteId];

    if (!karte) {
      mismatchCount++;
      mismatches.push({
        row: i + 1, karteId,
        dbTitle, dbRegion, dbField, dbUrl,
        karteTitle: '（カルテシートに存在しない）',
        karteRegion: '', karteField: '', primaryUrl: '',
        reason: 'カルテIDがカルテシートに存在しない'
      });
      continue;
    }

    // 判定1: カルテ先頭URLとDB URLが一致するか
    const urlMatch = karte.primaryUrl && dbUrl && (karte.primaryUrl === dbUrl);

    // 判定2: 地域が一致するか
    const regionMatch = !dbRegion || !karte.region || dbRegion === karte.region;

    // 判定3: 分野が一致するか
    const fieldMatch = !dbField || !karte.field || dbField === karte.field;

    if (urlMatch && regionMatch && fieldMatch) {
      matchCount++;
    } else {
      mismatchCount++;
      const reasons = [];
      if (!urlMatch)    reasons.push('URL不一致');
      if (!regionMatch) reasons.push('地域不一致(' + dbRegion + '≠' + karte.region + ')');
      if (!fieldMatch)  reasons.push('分野不一致(' + dbField + '≠' + karte.field + ')');

      mismatches.push({
        row: i + 1, karteId,
        dbTitle, dbRegion, dbField, dbUrl,
        karteTitle:  karte.title,
        karteRegion: karte.region,
        karteField:  karte.field,
        primaryUrl:  karte.primaryUrl,
        reason: reasons.join(' / ')
      });
    }
  }

  Logger.log('========== 観測DB×カルテ タイトルズレ診断 ==========');
  Logger.log('カルテIDあり行数:     ' + totalWithId + '件');
  Logger.log('一致（正常）:         ' + matchCount + '件');
  Logger.log('ズレ候補:             ' + mismatchCount + '件');
  Logger.log('');

  if (mismatches.length === 0) {
    Logger.log('ズレ候補はありませんでした。');
    return;
  }

  Logger.log('---------- ズレ候補一覧 ----------');
  mismatches.forEach(function(m, i) {
    Logger.log((i + 1) + '. 行' + m.row + ' [' + m.karteId + '] ' + m.reason);
    Logger.log('   DB記事:  「' + m.dbTitle.slice(0, 40) + '」 ' + m.dbRegion + ' ' + m.dbField);
    Logger.log('   カルテ:  「' + m.karteTitle.slice(0, 40) + '」 ' + m.karteRegion + ' ' + m.karteField);
    Logger.log('   DB-URL:  ' + m.dbUrl.slice(0, 70));
    Logger.log('   代表URL: ' + m.primaryUrl.slice(0, 70));
    Logger.log('');
  });

  Logger.log('========== 診断完了 ==========');
  Logger.log('→ 修正は backfillKarteIds() を再実行するとクリアできます');
}

// ===== 不整合73件のカルテIDを直接クリア =====
// diagnoseDbKarteTitleMismatch()で特定した行を対象に
// kansokuDBのカルテID列を空欄にする（修正はしない・クリアのみ）
function clearMismatchedKarteIds() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  const karteSheet  = ss.getSheetByName(KARTE_SHEET);

  if (!sourceSheet || !karteSheet) { Logger.log('シートが見つかりません'); return; }

  const dbData    = sourceSheet.getDataRange().getValues();
  const dbHeaders = dbData[0];
  const titleIdx      = dbHeaders.indexOf('タイトル');
  const karteIdColIdx = dbHeaders.indexOf('カルテID');

  // カルテタイトルマップ
  const karteData    = karteSheet.getDataRange().getValues();
  const karteHeaders = karteData[0];
  const kIdIdx  = karteHeaders.indexOf('カルテID');
  const kTitIdx = karteHeaders.indexOf('事案名');
  const karteMap = {};
  karteData.slice(1).forEach(function(row) {
    const kid = String(row[kIdIdx] || '').trim();
    if (kid) karteMap[kid] = String(row[kTitIdx] || '').trim();
  });

  // diagnoseDbKarteTitleMismatch()で確認した不整合行番号（シート行番号）
  const MISMATCH_ROWS = [
    162,163,164,165,166,167,168,169,170,171,172,173,174,175,177,178,179,180,181,182,183,184,
    230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,255,256,257,
    312,313,314,315,316,317,318,319,320,321,322,323,324,325,
    341,343,344,347,348,350,351,352,353
  ];

  Logger.log('===== 不整合カルテIDクリア =====');
  Logger.log('対象: ' + MISMATCH_ROWS.length + '件');
  Logger.log('');

  let clearCount = 0;
  let skipCount  = 0;

  MISMATCH_ROWS.forEach(function(rowNum) {
    const rowIdx    = rowNum - 1; // 0-indexed
    const row       = dbData[rowIdx];
    if (!row) { Logger.log('[スキップ] 行' + rowNum + ' データなし'); skipCount++; return; }

    const existing  = String(row[karteIdColIdx] || '').trim();
    const dbTitle   = String(row[titleIdx] || '').trim().slice(0, 40);
    const oldTitle  = existing ? (karteMap[existing] || '（不明）').slice(0, 40) : '';

    if (!existing) {
      Logger.log('[スキップ] 行' + rowNum + ' 「' + dbTitle + '」すでに空欄');
      skipCount++;
      return;
    }

    sourceSheet.getRange(rowNum, karteIdColIdx + 1).setValue('');
    clearCount++;
    Logger.log('[クリア] 行' + rowNum);
    Logger.log('  DB記事:    「' + dbTitle + '」');
    Logger.log('  旧カルテID: ' + existing);
    Logger.log('  旧カルテ:  「' + oldTitle + '」');
    Logger.log('  クリア理由: 診断で不整合と確認済み（URL・地域・分野の不一致）');
    Logger.log('');
  });

  Logger.log('===== クリア完了 =====');
  Logger.log('クリア: ' + clearCount + '件');
  Logger.log('スキップ（既に空欄）: ' + skipCount + '件');
}

// ===== カルテ内部の関連記事URL汚染診断 =====
// 各カルテの関連記事URLと対応するDB記事タイトルを照合し、
// カルテタイトルと著しく異なる記事を含むカルテを一覧化する
// 修正はしない・ログ出力のみ
function diagnoseKarteRelatedUrls() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  const karteSheet  = ss.getSheetByName(KARTE_SHEET);

  if (!sourceSheet || !karteSheet) { Logger.log('シートが見つかりません'); return; }

  // kansokuDB をURL→{title,region,field}マップ化
  const dbData    = sourceSheet.getDataRange().getValues();
  const dbHeaders = dbData[0];
  const dbUrlIdx   = dbHeaders.indexOf('URL');
  const dbTitleIdx = dbHeaders.indexOf('タイトル');
  const dbRegIdx   = dbHeaders.indexOf('地域');
  const dbFldIdx   = dbHeaders.indexOf('分野');

  const dbMap = {};
  dbData.slice(1).forEach(function(row) {
    const url = _normalizeUrl(row[dbUrlIdx] || '');
    if (url) dbMap[url] = {
      title:  String(row[dbTitleIdx] || '').trim(),
      region: String(row[dbRegIdx]   || '').trim(),
      field:  String(row[dbFldIdx]   || '').trim(),
    };
  });

  // カルテ全件を走査
  const karteData    = karteSheet.getDataRange().getValues();
  const karteHeaders = karteData[0];
  const kIdIdx   = karteHeaders.indexOf('カルテID');
  const kTitIdx  = karteHeaders.indexOf('事案名');
  const kRegIdx  = karteHeaders.indexOf('地域');
  const kFldIdx  = karteHeaders.indexOf('分野');
  const kRelIdx  = karteHeaders.indexOf('関連記事URL');

  let totalKartes      = 0;
  let multiUrlKartes   = 0;
  let suspectKartes    = 0;
  const suspects       = [];

  karteData.slice(1).forEach(function(row, i) {
    const karteId    = String(row[kIdIdx]  || '').trim();
    const karteTitle = String(row[kTitIdx] || '').trim();
    const karteRegion= String(row[kRegIdx] || '').trim();
    const karteField = String(row[kFldIdx] || '').trim();
    const relUrls    = String(row[kRelIdx] || '').trim();

    if (!karteId || !relUrls) return;
    totalKartes++;

    const urls = relUrls.split('\n').map(function(u) {
      return _normalizeUrl(u);
    }).filter(Boolean);

    if (urls.length <= 1) return; // 1件のみは問題なし
    multiUrlKartes++;

    // 2件目以降の記事がカルテと地域・分野で一致するか確認
    const suspectUrls = [];
    urls.slice(1).forEach(function(url, j) {
      const dbArticle = dbMap[url];
      if (!dbArticle) return; // DB未収録は無視

      const regionOk = !karteRegion || !dbArticle.region || karteRegion === dbArticle.region;
      const fieldOk  = !karteField  || !dbArticle.field  || karteField  === dbArticle.field;

      if (!regionOk || !fieldOk) {
        suspectUrls.push({
          urlNum:      j + 2, // 2件目以降
          url:         url,
          dbTitle:     dbArticle.title,
          dbRegion:    dbArticle.region,
          dbField:     dbArticle.field,
          reason:      (!regionOk ? '地域不一致(' + dbArticle.region + '≠' + karteRegion + ')' : '') +
                       (!fieldOk  ? ' 分野不一致(' + dbArticle.field  + '≠' + karteField  + ')' : ''),
        });
      }
    });

    if (suspectUrls.length > 0) {
      suspectKartes++;
      suspects.push({
        karteId, karteTitle, karteRegion, karteField,
        primaryUrl: urls[0],
        primaryDbTitle: dbMap[urls[0]] ? dbMap[urls[0]].title : '（DB未収録）',
        suspectUrls,
        totalUrls: urls.length,
      });
    }
  });

  Logger.log('========== カルテ関連記事URL汚染診断 ==========');
  Logger.log('カルテ総件数（URL有）:     ' + totalKartes + '件');
  Logger.log('複数URL登録カルテ数:       ' + multiUrlKartes + '件');
  Logger.log('汚染疑いカルテ数:          ' + suspectKartes + '件');
  Logger.log('');

  if (suspects.length === 0) {
    Logger.log('汚染疑いのカルテはありませんでした。');
    return;
  }

  Logger.log('---------- 汚染疑い一覧 ----------');
  suspects.forEach(function(s, i) {
    Logger.log((i + 1) + '. [' + s.karteId + '] 「' + s.karteTitle.slice(0, 35) + '」' +
      ' (' + s.karteRegion + ' / ' + s.karteField + ') 全' + s.totalUrls + 'URL');
    Logger.log('   代表URL記事: 「' + s.primaryDbTitle.slice(0, 40) + '」');
    s.suspectUrls.forEach(function(u) {
      Logger.log('   [疑い' + u.urlNum + '件目] 「' + u.dbTitle.slice(0, 40) + '」' +
        ' (' + u.dbRegion + ' / ' + u.dbField + ')');
      Logger.log('            理由: ' + u.reason);
    });
    Logger.log('');
  });

  Logger.log('========== 診断完了 ==========');
  Logger.log('→ 修正は別途 cleanKarteRelatedUrls() で行います（未実装）');
}

// ===== カルテ関連記事URL 詳細診断（全件）=====
// 複数URLを持つ全カルテについて、各URLのDB記事タイトルを出力する
// 地域・分野の不一致に加え、全URLのタイトルを表示して目視確認できる形にする
// 修正はしない・ログ出力のみ
function diagnoseAllKarteRelatedUrls() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  const karteSheet  = ss.getSheetByName(KARTE_SHEET);

  if (!sourceSheet || !karteSheet) { Logger.log('シートが見つかりません'); return; }

  // kansokuDB を URL→{title,region,field} マップ化
  const dbData    = sourceSheet.getDataRange().getValues();
  const dbHeaders = dbData[0];
  const dbUrlIdx   = dbHeaders.indexOf('URL');
  const dbTitleIdx = dbHeaders.indexOf('タイトル');
  const dbRegIdx   = dbHeaders.indexOf('地域');
  const dbFldIdx   = dbHeaders.indexOf('分野');

  const dbMap = {};
  dbData.slice(1).forEach(function(row) {
    const url = _normalizeUrl(row[dbUrlIdx] || '');
    if (url) dbMap[url] = {
      title:  String(row[dbTitleIdx] || '').trim(),
      region: String(row[dbRegIdx]   || '').trim(),
      field:  String(row[dbFldIdx]   || '').trim(),
    };
  });

  // カルテ全件を走査
  const karteData    = karteSheet.getDataRange().getValues();
  const karteHeaders = karteData[0];
  const kIdIdx  = karteHeaders.indexOf('カルテID');
  const kTitIdx = karteHeaders.indexOf('事案名');
  const kRegIdx = karteHeaders.indexOf('地域');
  const kFldIdx = karteHeaders.indexOf('分野');
  const kRelIdx = karteHeaders.indexOf('関連記事URL');

  let totalMulti   = 0;
  let suspectCount = 0;
  let cleanCount   = 0;

  Logger.log('========== カルテ関連記事URL 詳細診断（全件）==========');
  Logger.log('複数URLを持つカルテを全件出力します（修正なし）');
  Logger.log('');

  karteData.slice(1).forEach(function(row) {
    const karteId    = String(row[kIdIdx]  || '').trim();
    const karteTitle = String(row[kTitIdx] || '').trim();
    const karteRegion= String(row[kRegIdx] || '').trim();
    const karteField = String(row[kFldIdx] || '').trim();
    const relUrls    = String(row[kRelIdx] || '').trim();

    if (!karteId || !relUrls) return;

    const urls = relUrls.split('\n').map(function(u) {
      return _normalizeUrl(u);
    }).filter(Boolean);

    if (urls.length <= 1) return; // 1件のみはスキップ
    totalMulti++;

    // 各URLについてDB記事情報を取得・照合
    let hasSuspect = false;
    const urlResults = [];

    urls.forEach(function(url, j) {
      const db = dbMap[url];
      const isPrimary = j === 0;
      let suspect = false;
      let reason  = '';

      if (db) {
        const regionMismatch = karteRegion && db.region && karteRegion !== db.region;
        const fieldMismatch  = karteField  && db.field  && karteField  !== db.field;
        if (regionMismatch || fieldMismatch) {
          suspect = true;
          hasSuspect = true;
          reason = (regionMismatch ? '地域不一致(' + db.region + '≠' + karteRegion + ') ' : '') +
                   (fieldMismatch  ? '分野不一致(' + db.field  + '≠' + karteField  + ')' : '');
        }
      }

      urlResults.push({
        num:       j + 1,
        isPrimary: isPrimary,
        url:       url,
        dbTitle:   db ? db.title  : '（DB未収録）',
        dbRegion:  db ? db.region : '',
        dbField:   db ? db.field  : '',
        suspect:   suspect,
        reason:    reason,
      });
    });

    if (hasSuspect) {
      suspectCount++;
      Logger.log('【疑い】[' + karteId + '] 「' + karteTitle.slice(0, 35) + '」' +
        ' (' + karteRegion + ' / ' + karteField + ') 全' + urls.length + 'URL');
      urlResults.forEach(function(r) {
        const mark = r.isPrimary ? '★代表' : '　関連';
        const flag = r.suspect   ? ' ⚠️ ' + r.reason : '';
        Logger.log('  ' + mark + r.num + ': 「' + r.dbTitle.slice(0, 40) + '」' +
          (r.dbRegion ? ' [' + r.dbRegion + ']' : '') +
          (r.dbField  ? '[' + r.dbField + ']' : '') +
          flag);
      });
      Logger.log('');
    } else {
      cleanCount++;
    }
  });

  Logger.log('========== 診断結果 ==========');
  Logger.log('複数URLカルテ総数: ' + totalMulti + '件');
  Logger.log('疑いあり:          ' + suspectCount + '件');
  Logger.log('問題なし:          ' + cleanCount + '件');
  Logger.log('');
  Logger.log('疑いありカルテの「関連」URLに⚠️が付いているものが汚染候補です。');
  Logger.log('修正は cleanKarteRelatedUrls() で行います（別途実装）。');
}

// ===== 誤生成カルテの診断・削除 =====
// KARTE-0364〜KARTE-0390を対象に内容を一覧表示する（削除はしない）
function listSuspectKartes() {
  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  const karteSheet = ss.getSheetByName(KARTE_SHEET);
  if (!karteSheet) { Logger.log('カルテシートが見つかりません'); return; }

  const data    = karteSheet.getDataRange().getValues();
  const headers = data[0];
  const kIdIdx  = headers.indexOf('カルテID');
  const kTitIdx = headers.indexOf('事案名');
  const kRegIdx = headers.indexOf('地域');
  const kFldIdx = headers.indexOf('分野');
  const kSumIdx = headers.indexOf('概要');
  const kRelIdx = headers.indexOf('関連記事URL');
  const kCreIdx = headers.indexOf('作成日');

  const TARGET_IDS = [
    'KARTE-0364','KARTE-0366','KARTE-0368','KARTE-0370',
    'KARTE-0372','KARTE-0374','KARTE-0376','KARTE-0378',
    'KARTE-0380','KARTE-0382','KARTE-0384','KARTE-0386',
    'KARTE-0388','KARTE-0390'
  ];

  Logger.log('===== 誤生成疑いカルテ一覧（KARTE-0364〜0390）=====');
  Logger.log('※ 削除はしません。確認のみ。');
  Logger.log('');

  let found = 0;
  data.slice(1).forEach(function(row, i) {
    const kid = String(row[kIdIdx] || '').trim();
    if (!TARGET_IDS.includes(kid)) return;
    found++;
    Logger.log('[' + kid + '] 「' + String(row[kTitIdx] || '').slice(0, 40) + '」');
    Logger.log('  地域:' + (row[kRegIdx] || '空欄') + ' / 分野:' + (row[kFldIdx] || '空欄'));
    Logger.log('  概要:' + String(row[kSumIdx] || '').slice(0, 60));
    Logger.log('  URL: ' + String(row[kRelIdx] || '').split('\n')[0].slice(0, 70));
    Logger.log('  作成: ' + String(row[kCreIdx] || ''));
    Logger.log('  行番号: ' + (i + 2));
    Logger.log('');
  });

  Logger.log('対象カルテ数: ' + found + '/' + TARGET_IDS.length + '件');
  Logger.log('→ 削除する場合は deleteSuspectKartes() を実行してください');
}

// ===== 誤生成カルテの削除 + kansokuDB カルテIDクリア =====
// listSuspectKartes()で確認後に実行してください
function deleteSuspectKartes() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const karteSheet  = ss.getSheetByName(KARTE_SHEET);
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  if (!karteSheet || !sourceSheet) { Logger.log('シートが見つかりません'); return; }

  const TARGET_IDS = [
    'KARTE-0364','KARTE-0366','KARTE-0368','KARTE-0370',
    'KARTE-0372','KARTE-0374','KARTE-0376','KARTE-0378',
    'KARTE-0380','KARTE-0382','KARTE-0384','KARTE-0386',
    'KARTE-0388','KARTE-0390'
  ];

  // カルテシートから該当行を削除（後ろから削除）
  const karteData    = karteSheet.getDataRange().getValues();
  const karteHeaders = karteData[0];
  const kIdIdx = karteHeaders.indexOf('カルテID');
  const kRelIdx = karteHeaders.indexOf('関連記事URL');

  const rowsToDelete = [];
  const urlsToClear  = new Set();

  karteData.slice(1).forEach(function(row, i) {
    const kid = String(row[kIdIdx] || '').trim();
    if (!TARGET_IDS.includes(kid)) return;
    rowsToDelete.push(i + 2); // 1-indexed + header
    // このカルテに紐付いたURLを収集（kansokuDBのクリア用）
    String(row[kRelIdx] || '').split('\n').forEach(function(u) {
      const norm = _normalizeUrl(u);
      if (norm) urlsToClear.add(norm);
    });
  });

  // 後ろから削除（行番号がずれないように）
  rowsToDelete.reverse().forEach(function(rowNum) {
    karteSheet.deleteRow(rowNum);
    Logger.log('[カルテ削除] 行' + rowNum);
  });
  Logger.log('カルテ削除: ' + rowsToDelete.length + '件');

  // kansokuDBのカルテID列をクリア
  const dbData    = sourceSheet.getDataRange().getValues();
  const dbHeaders = dbData[0];
  const dbUrlIdx      = dbHeaders.indexOf('URL');
  const karteIdColIdx = dbHeaders.indexOf('カルテID');

  if (karteIdColIdx < 0) { Logger.log('kansokuDBにカルテID列なし'); return; }

  let clearCount = 0;
  for (let i = 1; i < dbData.length; i++) {
    const url      = _normalizeUrl(dbData[i][dbUrlIdx] || '');
    const existing = String(dbData[i][karteIdColIdx] || '').trim();
    if (!existing || !urlsToClear.has(url)) continue;
    if (!TARGET_IDS.includes(existing)) continue;
    sourceSheet.getRange(i + 1, karteIdColIdx + 1).setValue('');
    clearCount++;
    Logger.log('[kansokuDBクリア] 行' + (i + 1) + ' ' + existing + ' → 空欄');
  }

  Logger.log('kansokuDBクリア: ' + clearCount + '件');
  Logger.log('===== deleteSuspectKartes 完了 =====');
}

// ===== カルテID採番状況の確認 =====
function checkKarteIdStatus() {
  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  const karteSheet = ss.getSheetByName(KARTE_SHEET);
  if (!karteSheet) { Logger.log('カルテシートが見つかりません'); return; }

  const data   = karteSheet.getDataRange().getValues();
  const kIdIdx = data[0].indexOf('カルテID');

  const ids = data.slice(1).map(function(row) {
    return String(row[kIdIdx] || '').trim();
  }).filter(Boolean);

  const nums = ids.map(function(id) {
    const m = id.match(/KARTE-(\d+)/);
    return m ? parseInt(m[1]) : null;
  }).filter(function(n) { return n !== null; }).sort(function(a,b) { return a-b; });

  const maxNum = nums.length ? nums[nums.length - 1] : 0;

  // 欠番を検出
  const gaps = [];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] - nums[i-1] > 1) {
      for (let g = nums[i-1]+1; g < nums[i]; g++) {
        gaps.push('KARTE-' + String(g).padStart(4,'0'));
      }
    }
  }

  Logger.log('===== カルテID採番状況 =====');
  Logger.log('総カルテ数: ' + ids.length + '件');
  Logger.log('最小ID:     KARTE-' + String(nums[0]).padStart(4,'0'));
  Logger.log('最大ID:     KARTE-' + String(maxNum).padStart(4,'0'));
  Logger.log('欠番数:     ' + gaps.length + '件');
  if (gaps.length > 0) {
    Logger.log('欠番一覧:   ' + gaps.join(', '));
  }
  Logger.log('次回生成ID: KARTE-' + String(maxNum + 1).padStart(4,'0'));
}

// ===== 現状サマリ診断 =====
function checkCurrentStatus() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const karteSheet  = ss.getSheetByName(KARTE_SHEET);
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  if (!karteSheet || !sourceSheet) { Logger.log('シートが見つかりません'); return; }

  // カルテ総数
  const karteData    = karteSheet.getDataRange().getValues();
  const karteTotal   = karteData.length - 1;

  // kansokuDB
  const dbData    = sourceSheet.getDataRange().getValues();
  const dbHeaders = dbData[0];
  const karteIdColIdx = dbHeaders.indexOf('カルテID');
  const urlIdx        = dbHeaders.indexOf('URL');
  const relIdx        = karteData[0].indexOf('関連記事URL');

  // カルテIDなし件数
  let noKarteId = 0;
  dbData.slice(1).forEach(function(row) {
    if (!String(row[karteIdColIdx] || '').trim()) noKarteId++;
  });

  // generateKartesForUnlinked() の対象（カルテのrelated_urlsに含まれていない記事）
  const linkedUrls = new Set();
  karteData.slice(1).forEach(function(row) {
    String(row[relIdx] || '').split('\n').forEach(function(u) {
      const t = u.trim().replace(/\/$/, '');
      if (t) linkedUrls.add(t);
    });
  });

  let unlinkedCount = 0;
  dbData.slice(1).forEach(function(row) {
    const url = String(row[urlIdx] || '').trim().replace(/\/$/, '');
    if (url && !linkedUrls.has(url)) unlinkedCount++;
  });

  Logger.log('===== 現状サマリ =====');
  Logger.log('カルテ総数:                   ' + karteTotal + '件');
  Logger.log('観測DB総件数:                 ' + (dbData.length - 1) + '件');
  Logger.log('カルテIDなし（ボタン非表示）: ' + noKarteId + '件');
  Logger.log('カルテIDあり（ボタン表示）:   ' + (dbData.length - 1 - noKarteId) + '件');
  Logger.log('未カルテ化（未処理対象）:     ' + unlinkedCount + '件');
  Logger.log('========================');
}

// ===== カルテシートにプロフィール列を追加（既存シート対応）=====
// 一度だけ実行。既に列があればスキップ。
function ensureKarteProfileColumns() {
  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  const karteSheet = ss.getSheetByName(KARTE_SHEET);
  if (!karteSheet) { Logger.log('カルテシートが見つかりません'); return; }

  const headers = karteSheet.getRange(1, 1, 1, karteSheet.getLastColumn()).getValues()[0];
  const need = ['分野タグ', '対象者タグ', '行為者タグ', '出来事タグ（探索）', '状態タグ（探索）', '固有機関名', '処理日時（プロフィール抽出）'];

  let added = 0;
  need.forEach(function(name) {
    if (!headers.includes(name)) {
      const col = karteSheet.getLastColumn() + 1;
      karteSheet.getRange(1, col).setValue(name);
      headers.push(name);
      Logger.log('列を追加: ' + name + ' (' + col + '列目)');
      added++;
    } else {
      Logger.log('既存: ' + name);
    }
  });
  Logger.log('===== 完了 追加:' + added + '件 =====');
}

// ===== テスト：1件だけ新規カルテ生成してプロフィール列を確認 =====
function testGenerateOneKarteWithProfile() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const karteSheet  = getOrCreateKarteSheet(ss);
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  const apiKey      = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  if (!sourceSheet) { Logger.log('kansokuDBシートが見つかりません'); return; }
  if (!apiKey)      { Logger.log('APIキーが未設定'); return; }

  // 観測DBの全記事を取得
  const sourceData    = sourceSheet.getDataRange().getValues();
  const sourceHeaders = sourceData[0];
  const articles = sourceData.slice(1).map(row => {
    const obj = {};
    sourceHeaders.forEach((h, i) => obj[h] = row[i] || '');
    return obj;
  }).filter(r => r['タイトル']);

  // 既存カルテのrelated_urlsを収集
  const karteData    = karteSheet.getDataRange().getValues();
  const karteHeaders = karteData[0];
  const relIdx = karteHeaders.indexOf('関連記事URL');

  const linkedUrls = new Set();
  karteData.slice(1).forEach(row => {
    String(row[relIdx] || '').split('\n').forEach(u => {
      const t = u.trim().replace(/\/$/, '');
      if (t) linkedUrls.add(t);
    });
  });

  const unlinked = articles.filter(a => {
    if (!a['URL']) return false;
    return !linkedUrls.has(a['URL'].trim().replace(/\/$/, ''));
  });

  if (!unlinked.length) { Logger.log('未カルテ化記事がありません'); return; }

  const article = unlinked[0];
  Logger.log('===== テスト対象記事 =====');
  Logger.log('タイトル: ' + article['タイトル']);
  Logger.log('地域: ' + (article['地域'] || '未設定') + ' / 分野: ' + (article['分野'] || '未設定'));
  Logger.log('');

  // Step1: 観測項目抽出
  let items = extractObservationItems(article, apiKey);
  if (!items) {
    Logger.log('❌ 観測項目抽出に失敗しました（APIエラーまたは429）');
    return;
  }
  items = applyRegionFallback(items, [
    article['タイトル'], article['地域'], article['市区町村'],
    article['分野'], article['要約'], article['URL']
  ]);

  Logger.log('===== 抽出された観測項目 =====');
  Logger.log('is_japan:    ' + items.is_japan);
  Logger.log('region:      ' + (items.region      || '—'));
  Logger.log('field:       ' + (items.field       || '—'));
  Logger.log('target:      ' + (items.target      || '—'));
  Logger.log('actor:       ' + (items.actor       || '—'));
  Logger.log('event:       ' + (items.event       || '—'));
  Logger.log('status:      ' + (items.status      || '—'));
  Logger.log('institution: ' + (items.institution || '—'));
  Logger.log('');

  if (items.is_japan !== true) {
    Logger.log('❌ is_japanがtrueではないため、このテストでは新規カルテ生成しません');
    return;
  }

  // 既存カルテオブジェクト化（judgeMatchingKarte用）
  const kartes = karteData.slice(1).map(row => ({
    id: row[0], title: row[1], region: row[2], field: row[3],
    summary: row[4], tags_event: row[6], tags_structure: row[7],
    tags_status: row[8], tags_evidence: row[9], related_urls: row[10],
    tags_actor: row[17] || '', tags_target: row[16] || '',
    region_city: '', start_date: row[14], created_at: row[12],
  }));

  const judgment = judgeMatchingKarte(article, items, kartes);
  Logger.log('===== 同一事案判定 =====');
  Logger.log(judgment.reason);
  Logger.log('');

  if (judgment.matched) {
    Logger.log('→ 既存カルテに統合される判定です（' + judgment.matched.id + '）。新規生成テストは行いません。');
    Logger.log('別の記事でテストするか、updateKarte()のテストを別途行ってください。');
    return;
  }

  // Step2: 新規カルテ生成（実際にシートに書き込む）
  const index    = _getNextKarteNumber(karteSheet);
  const newKarte = generateNewKarteStrict(article, index, apiKey, items);

  if (!newKarte) {
    Logger.log('❌ カルテ生成に失敗しました');
    return;
  }

  karteSheet.appendRow([
    newKarte.id,          newKarte.title,    newKarte.region,
    newKarte.field,       newKarte.summary,  newKarte.progress,
    newKarte.tags_event,  newKarte.tags_structure, newKarte.tags_status,
    newKarte.tags_evidence, newKarte.related_urls, newKarte.mana_comment || '',
    new Date().toISOString(), new Date().toISOString(), newKarte.start_date,
    newKarte.profile_field, newKarte.profile_target, newKarte.profile_actor,
    newKarte.profile_event, newKarte.profile_status, newKarte.profile_institution,
  ]);

  if (article['URL']) writeKarteIdToDb(article['URL'], newKarte.id);

  Logger.log('===== 生成・保存結果 =====');
  Logger.log('カルテID: ' + newKarte.id);
  Logger.log('タイトル: ' + newKarte.title);
  Logger.log('');
  Logger.log('--- カルテシートに保存されたプロフィール列 ---');
  Logger.log('分野タグ:           ' + (newKarte.profile_field       || '（空欄）'));
  Logger.log('対象者タグ:         ' + (newKarte.profile_target      || '（空欄）'));
  Logger.log('行為者タグ:         ' + (newKarte.profile_actor       || '（空欄）'));
  Logger.log('出来事タグ（探索）:  ' + (newKarte.profile_event       || '（空欄）'));
  Logger.log('状態タグ（探索）:    ' + (newKarte.profile_status      || '（空欄）'));
  Logger.log('固有機関名:         ' + (newKarte.profile_institution || '（空欄）'));
  Logger.log('');
  Logger.log('✅ スプレッドシートのカルテシートで ' + newKarte.id + ' の行を直接確認してください');
}

// ===== B案調査：既存345件の現行ルール移行可能性診断 =====
// 実行のみ。修正・再生成は一切しない。
function diagnoseRegenerationFeasibility() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const karteSheet  = ss.getSheetByName(KARTE_SHEET);
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  if (!karteSheet || !sourceSheet) { Logger.log('シートが見つかりません'); return; }

  // kansokuDB を URL→記事情報マップ化
  const dbData    = sourceSheet.getDataRange().getValues();
  const dbHeaders = dbData[0];
  const dbUrlIdx   = dbHeaders.indexOf('URL');
  const dbTitleIdx = dbHeaders.indexOf('タイトル');
  const dbRegIdx   = dbHeaders.indexOf('地域');
  const dbFldIdx   = dbHeaders.indexOf('分野');
  const dbSumIdx   = dbHeaders.indexOf('要約');

  const dbMap = {};
  dbData.slice(1).forEach(function(row) {
    const url = _normalizeUrl(row[dbUrlIdx] || '');
    if (url) dbMap[url] = {
      title:  String(row[dbTitleIdx] || '').trim(),
      region: String(row[dbRegIdx]   || '').trim(),
      field:  String(row[dbFldIdx]   || '').trim(),
      summary:String(row[dbSumIdx]   || '').trim(),
    };
  });

  // カルテ全件を走査
  const karteData    = karteSheet.getDataRange().getValues();
  const karteHeaders = karteData[0];
  const kIdIdx   = karteHeaders.indexOf('カルテID');
  const kTitIdx  = karteHeaders.indexOf('事案名');
  const kRelIdx  = karteHeaders.indexOf('関連記事URL');
  const kManaIdx = karteHeaders.indexOf('MANAコメント');
  const kProfFieldIdx = karteHeaders.indexOf('分野タグ');
  const kProfTargetIdx= karteHeaders.indexOf('対象者タグ');

  const total = karteData.length - 1;
  let resolvedCount   = 0; // 代表URLがDBに存在
  let unresolvedCount = 0; // 代表URLがDB未収録
  let multiUrlCount   = 0; // 複数URL
  let hasManaComment  = 0; // MANAコメントが何か入っている
  let hasProfileData  = 0; // プロフィール6列のどれかに値がある

  const unresolvedSamples = [];

  karteData.slice(1).forEach(function(row) {
    const relUrls = String(row[kRelIdx] || '').trim();
    const urls = relUrls.split('\n').map(function(u) { return _normalizeUrl(u); }).filter(Boolean);

    if (urls.length > 1) multiUrlCount++;

    const primaryUrl = urls[0] || '';
    if (primaryUrl && dbMap[primaryUrl]) {
      resolvedCount++;
    } else {
      unresolvedCount++;
      if (unresolvedSamples.length < 10) {
        unresolvedSamples.push({
          id: row[kIdIdx], title: String(row[kTitIdx] || '').slice(0, 40),
          url: primaryUrl.slice(0, 60) || '（URLなし）'
        });
      }
    }

    if (String(row[kManaIdx] || '').trim()) hasManaComment++;
    if (String(row[kProfFieldIdx] || '').trim() || String(row[kProfTargetIdx] || '').trim()) hasProfileData++;
  });

  Logger.log('========== B案調査：現行ルール移行可能性診断 ==========');
  Logger.log('');
  Logger.log('【1】カルテ総数:                          ' + total + '件');
  Logger.log('【1】代表URLが観測DBに対応付け可能:        ' + resolvedCount + '件 (' + Math.round(resolvedCount/total*100) + '%)');
  Logger.log('【2】代表URL不明（DB未収録 or URLなし）:   ' + unresolvedCount + '件 (' + Math.round(unresolvedCount/total*100) + '%)');
  Logger.log('【3】複数URLカルテ:                        ' + multiUrlCount + '件');
  Logger.log('');
  Logger.log('【4】現行ルールで再生成可能な件数:          ' + resolvedCount + '件');
  Logger.log('     （代表URLがDBに存在 = extractObservationItems()を再実行できる）');
  Logger.log('');
  Logger.log('--- 代表URL不明の例（最大10件）---');
  unresolvedSamples.forEach(function(s) {
    Logger.log('  [' + s.id + '] 「' + s.title + '」 URL: ' + s.url);
  });
  Logger.log('');
  Logger.log('【参考】MANAコメントが入っているカルテ:     ' + hasManaComment + '件 (' + Math.round(hasManaComment/total*100) + '%)');
  Logger.log('【参考】プロフィール6列に値があるカルテ:    ' + hasProfileData + '件 (' + Math.round(hasProfileData/total*100) + '%)');
  Logger.log('');
  Logger.log('========== 診断完了（修正なし）==========');
}

// ===== B案：既存カルテへのプロフィール6列補完（テスト10件）=====
// 代表URLから観測DB記事を取得 → extractObservationItems() → 6列を更新
// 修正対象：分野タグ・対象者タグ・行為者タグ・出来事タグ（探索）・状態タグ（探索）・固有機関名
function backfillProfileColumnsTest10() {
  _backfillProfileColumns(10);
}

// ===== 本番：50件 =====
function backfillProfileColumns50() {
  _backfillProfileColumns(50);
}

// ===== 本番：全件 =====
function backfillProfileColumnsAll() {
  _backfillProfileColumns(99999);
}

// ===== 共通処理 =====
function _backfillProfileColumns(limit) {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const karteSheet  = ss.getSheetByName(KARTE_SHEET);
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  const apiKey      = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  if (!karteSheet || !sourceSheet) { Logger.log('シートが見つかりません'); return; }
  if (!apiKey) { Logger.log('APIキーが未設定'); return; }

  // kansokuDB を URL→記事情報マップ化
  const dbData    = sourceSheet.getDataRange().getValues();
  const dbHeaders = dbData[0];
  const dbUrlIdx  = dbHeaders.indexOf('URL');
  const dbTitleIdx= dbHeaders.indexOf('タイトル');
  const dbRegIdx  = dbHeaders.indexOf('地域');
  const dbCityIdx = dbHeaders.indexOf('市区町村');
  const dbFldIdx  = dbHeaders.indexOf('分野');
  const dbSumIdx  = dbHeaders.indexOf('要約');

  const dbMap = {};
  dbData.slice(1).forEach(function(row) {
    const url = _normalizeUrl(row[dbUrlIdx] || '');
    if (url) dbMap[url] = {
      'タイトル': String(row[dbTitleIdx] || ''),
      '地域':     String(row[dbRegIdx]   || ''),
      '市区町村': String(row[dbCityIdx]  || ''),
      '分野':     String(row[dbFldIdx]   || ''),
      '要約':     String(row[dbSumIdx]   || ''),
    };
  });

  // カルテシート列インデックス
  const karteData    = karteSheet.getDataRange().getValues();
  const karteHeaders = karteData[0];
  const kIdIdx    = karteHeaders.indexOf('カルテID');
  const kTitIdx   = karteHeaders.indexOf('事案名');
  const kSumIdx   = karteHeaders.indexOf('概要');
  const kRegIdx   = karteHeaders.indexOf('地域');
  const kRelIdx   = karteHeaders.indexOf('関連記事URL');
  const kProfFieldIdx  = karteHeaders.indexOf('分野タグ');
  const kProfTargetIdx = karteHeaders.indexOf('対象者タグ');
  const kProfActorIdx  = karteHeaders.indexOf('行為者タグ');
  const kProfEventIdx  = karteHeaders.indexOf('出来事タグ（探索）');
  const kProfStatusIdx = karteHeaders.indexOf('状態タグ（探索）');
  const kProfInstIdx   = karteHeaders.indexOf('固有機関名');
  const kProfDoneIdx   = karteHeaders.indexOf('処理日時（プロフィール抽出）');

  if ([kProfFieldIdx, kProfTargetIdx, kProfActorIdx, kProfEventIdx, kProfStatusIdx, kProfInstIdx, kProfDoneIdx].includes(-1)) {
    Logger.log('プロフィール列が見つかりません。ensureKarteProfileColumns()を先に実行してください');
    return;
  }

  Logger.log('===== B案：プロフィール6列補完 limit=' + limit + ' =====');
  Logger.log('');

  let processed = 0;
  let skipped   = 0;
  let consecErr = 0;
  const MAX_CONSEC_ERR = 3;

  for (let i = 1; i < karteData.length && processed < limit; i++) {
    const row = karteData[i];
    const karteId = String(row[kIdIdx] || '').trim();
    if (!karteId) continue;

    // 処理日時マーカーがあればスキップ（結果が空欄でも「処理済み」として扱う）
    const alreadyDone = String(row[kProfDoneIdx] || '').trim();
    if (alreadyDone) { skipped++; continue; }

    const relUrls = String(row[kRelIdx] || '').trim();
    const primaryUrl = _normalizeUrl(relUrls.split('\n')[0] || '');
    const dbArticle = dbMap[primaryUrl];

    if (!dbArticle) {
      Logger.log('[SKIP-DB未収録] ' + karteId + ' 代表URL: ' + primaryUrl.slice(0, 60));
      // DB未収録は恒久的にDB側が変わらない限り再試行しても無駄ではないため
      // マーカーは付けずスキップのみ（次回また試せるようにする）
      skipped++;
      continue;
    }

    // extractObservationItems() を呼ぶ（article形式に変換）
    let items = extractObservationItems(dbArticle, apiKey);

    if (!items) {
      consecErr++;
      Logger.log('[SKIP-APIエラー ' + consecErr + '/' + MAX_CONSEC_ERR + '] ' + karteId);
      if (consecErr >= MAX_CONSEC_ERR) {
        Logger.log('[処理中断] 連続APIエラー' + MAX_CONSEC_ERR + '件');
        break;
      }
      Utilities.sleep(5000);
      continue;
    }
    consecErr = 0;
    const rowNum = i + 1;

    // ルールベース地域補完：カルテの事案名・概要（観測メモ本文）も補完ソースに含める
    items = applyRegionFallback(items, [
      dbArticle['タイトル'], dbArticle['地域'], dbArticle['市区町村'],
      dbArticle['分野'], dbArticle['要約'],
      String(row[kTitIdx] || ''), String(row[kSumIdx] || '')
    ]);

    // カルテシート本体の「地域」列が空欄の場合のみ補完結果を書き込む
    // （Geminiが当初取れていた地域は上書きしない）
    if (kRegIdx >= 0) {
      const existingRegion = String(row[kRegIdx] || '').trim();
      if (!existingRegion && items.region) {
        karteSheet.getRange(rowNum, kRegIdx + 1).setValue(items.region);
        Logger.log('[地域補完] ' + karteId + ' 地域列を補完: ' + items.region +
          (items.municipality ? '（' + items.municipality + '）' : ''));
      }
    }

    // 6列を書き込み（結果が空欄でも処理日時マーカーは必ず記録する）
    karteSheet.getRange(rowNum, kProfFieldIdx  + 1).setValue(items.field       || '');
    karteSheet.getRange(rowNum, kProfTargetIdx + 1).setValue(items.target      || '');
    karteSheet.getRange(rowNum, kProfActorIdx  + 1).setValue(items.actor       || '');
    karteSheet.getRange(rowNum, kProfEventIdx  + 1).setValue(items.event       || '');
    karteSheet.getRange(rowNum, kProfStatusIdx + 1).setValue(items.status      || '');
    karteSheet.getRange(rowNum, kProfInstIdx   + 1).setValue(items.institution || '');
    karteSheet.getRange(rowNum, kProfDoneIdx   + 1).setValue(new Date().toISOString());

    Logger.log('[更新] ' + karteId + ' 「' + String(row[kTitIdx] || '').slice(0, 30) + '」');
    Logger.log('  分野タグ:           ' + (items.field       || '（空欄）'));
    Logger.log('  対象者タグ:         ' + (items.target      || '（空欄）'));
    Logger.log('  行為者タグ:         ' + (items.actor       || '（空欄）'));
    Logger.log('  出来事タグ（探索）:  ' + (items.event       || '（空欄）'));
    Logger.log('  状態タグ（探索）:    ' + (items.status      || '（空欄）'));
    Logger.log('  固有機関名:         ' + (items.institution || '（空欄）'));
    Logger.log('');

    processed++;
    Utilities.sleep(4000);
  }

  Logger.log('===== 完了 処理:' + processed + '件 スキップ:' + skipped + '件 =====');
}

// ===== テスト：gemini-2.5-flash-lite の疎通確認 =====
// 本番処理には一切影響しない独立テスト関数。
// モデル名以外はtestGeminiFromKarteGen()と同等。
function testGemini25FlashLite() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) { Logger.log('APIキー未設定'); return; }

  const TEST_MODEL = 'gemini-2.5-flash-lite';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + TEST_MODEL + ':generateContent?key=' + apiKey;

  Logger.log('===== gemini-2.5-flash-lite 疎通テスト =====');
  Logger.log('モデル: ' + TEST_MODEL);
  Logger.log('');

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      contents: [{ parts: [{ text: 'こんにちは。JSONで{"result":"ok"}とだけ返してください。' }] }],
      generationConfig: { maxOutputTokens: 50 }
    }),
    muteHttpExceptions: true
  });

  const statusCode = res.getResponseCode();
  const rawText    = res.getContentText();

  Logger.log('HTTPステータス: ' + statusCode);
  Logger.log('');

  if (statusCode === 429) {
    Logger.log('❌ 429が発生しました');
    Logger.log('--- 生レスポンス全文 ---');
    Logger.log(rawText);

    // limit:0 の有無を確認
    if (rawText.includes('"limit": 0') || rawText.includes('"limit":0')) {
      Logger.log('');
      Logger.log('⚠️ limit:0 を検出しました（gemini-2.0-flash-liteと同じ状態）');
    } else {
      Logger.log('');
      Logger.log('✅ limit:0 は検出されませんでした（2.0系とは異なるクォータの可能性）');
    }
    return;
  }

  let json;
  try {
    json = JSON.parse(rawText);
  } catch(e) {
    Logger.log('❌ JSONパース失敗');
    Logger.log('--- 生レスポンス先頭500文字 ---');
    Logger.log(rawText.slice(0, 500));
    return;
  }

  if (json.error) {
    Logger.log('❌ APIエラー（429以外）');
    Logger.log('--- エラー内容 ---');
    Logger.log(JSON.stringify(json.error, null, 2));
    return;
  }

  const hasCandidates = !!(json.candidates && json.candidates.length);
  Logger.log('candidates有無: ' + (hasCandidates ? '✅ あり' : '❌ なし'));

  if (hasCandidates) {
    const text = json.candidates[0]?.content?.parts?.[0]?.text || '';
    Logger.log('応答テキスト: ' + text);

    // JSON応答が取れるか確認
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        Logger.log('✅ JSON抽出・パース成功: ' + JSON.stringify(parsed));
      } catch(e2) {
        Logger.log('⚠️ JSON抽出はできたがパース失敗: ' + jsonMatch[0]);
      }
    } else {
      Logger.log('⚠️ 応答からJSON部分を抽出できませんでした');
    }
  } else {
    Logger.log('--- レスポンス全体 ---');
    Logger.log(JSON.stringify(json, null, 2).slice(0, 1000));
  }

  Logger.log('');
  Logger.log('===== テスト完了 =====');
  Logger.log('✅ 成功（429なし）。本番への適用を検討できます。');
}

// ===== 既存処理済みカルテへの処理日時マーカー後付け =====
// 6列補完の判定ロジックを修正する前に処理された分（結果が空欄でもOK）に
// 処理日時マーカーを付与し、二重処理を防ぐ
function backfillDoneMarkerForExisting() {
  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  const karteSheet = ss.getSheetByName(KARTE_SHEET);
  if (!karteSheet) { Logger.log('カルテシートが見つかりません'); return; }

  const data    = karteSheet.getDataRange().getValues();
  const headers = data[0];
  const kIdIdx       = headers.indexOf('カルテID');
  const kProfFieldIdx  = headers.indexOf('分野タグ');
  const kProfTargetIdx = headers.indexOf('対象者タグ');
  const kProfActorIdx  = headers.indexOf('行為者タグ');
  const kProfEventIdx  = headers.indexOf('出来事タグ（探索）');
  const kProfStatusIdx = headers.indexOf('状態タグ（探索）');
  const kProfInstIdx   = headers.indexOf('固有機関名');
  const kProfDoneIdx   = headers.indexOf('処理日時（プロフィール抽出）');

  if (kProfDoneIdx < 0) { Logger.log('処理日時列がありません。ensureKarteProfileColumns()を先に実行してください'); return; }

  // 対象：今回のテストで処理済みと分かっているカルテID
  const KNOWN_PROCESSED = [
    'KARTE-0001','KARTE-0007','KARTE-0011','KARTE-0013','KARTE-0015',
    'KARTE-0017','KARTE-0019','KARTE-0021','KARTE-0023','KARTE-0025'
  ];

  let marked = 0;
  data.slice(1).forEach(function(row, i) {
    const karteId = String(row[kIdIdx] || '').trim();
    if (!KNOWN_PROCESSED.includes(karteId)) return;

    const rowNum = i + 2;
    const alreadyDone = String(row[kProfDoneIdx] || '').trim();
    if (alreadyDone) { Logger.log('[スキップ] ' + karteId + ' 既にマーカーあり'); return; }

    karteSheet.getRange(rowNum, kProfDoneIdx + 1).setValue(new Date().toISOString());
    Logger.log('[マーカー付与] ' + karteId);
    marked++;
  });

  Logger.log('===== 完了 マーカー付与: ' + marked + '件 =====');
}

// ===== 全体診断：観測DB×カルテ 4指標サマリ =====
// 修正は一切しない。集計のみ。
function diagnoseFullStatus() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  const karteSheet  = ss.getSheetByName(KARTE_SHEET);
  if (!sourceSheet || !karteSheet) { Logger.log('シートが見つかりません'); return; }

  // --- kansokuDB読み込み ---
  const dbData    = sourceSheet.getDataRange().getValues();
  const dbHeaders = dbData[0];
  const dbUrlIdx      = dbHeaders.indexOf('URL');
  const dbTitleIdx    = dbHeaders.indexOf('タイトル');
  const karteIdColIdx = dbHeaders.indexOf('カルテID');

  if (karteIdColIdx < 0) { Logger.log('kansokuDBにカルテID列がありません'); return; }

  // --- カルテシート読み込み ---
  const karteData    = karteSheet.getDataRange().getValues();
  const karteHeaders = karteData[0];
  const kIdIdx  = karteHeaders.indexOf('カルテID');
  const kTitIdx = karteHeaders.indexOf('事案名');
  const kRelIdx = karteHeaders.indexOf('関連記事URL');

  // カルテID → {title, urls[], rowNum} マップ。重複検出のため配列で持つ
  const karteMap = {};       // 1件目のみ
  const karteIdAllRows = {}; // 全行（重複検出用）

  karteData.slice(1).forEach(function(row, i) {
    const kid = String(row[kIdIdx] || '').trim();
    if (!kid) return;
    const urls = String(row[kRelIdx] || '').split('\n')
      .map(function(u) { return _normalizeUrl(u); })
      .filter(Boolean);

    if (!karteIdAllRows[kid]) karteIdAllRows[kid] = [];
    karteIdAllRows[kid].push(i + 2); // シート行番号

    if (!karteMap[kid]) {
      karteMap[kid] = { title: String(row[kTitIdx] || ''), urls: urls, rowNum: i + 2 };
    }
  });

  // ===== 指標1：存在しないカルテID件数 =====
  // kansokuDBのカルテID列に値があるが、カルテシートに存在しないID
  let notExistCount = 0;
  const notExistSamples = [];

  // ===== 指標2：IDは存在するが関連記事URLが一致しない件数 =====
  let urlMismatchCount = 0;
  const urlMismatchSamples = [];

  // ===== 指標4：カルテ削除後に残存した参照件数 =====
  // 指標1と概念的に重なるが、明示的に「IDが空ではないのにカルテ側に存在しない」をカウント
  // （ここでは指標1と同一の集計とする。削除由来かどうかはログでは判別不可のため）

  let withKarteId = 0;

  for (let i = 1; i < dbData.length; i++) {
    const row = dbData[i];
    const kid = String(row[karteIdColIdx] || '').trim();
    if (!kid) continue;
    withKarteId++;

    const karte = karteMap[kid];
    if (!karte) {
      notExistCount++;
      if (notExistSamples.length < 15) {
        notExistSamples.push({
          row: i + 1, karteId: kid,
          dbTitle: String(row[dbTitleIdx] || '').slice(0, 40)
        });
      }
      continue;
    }

    const dbUrl = _normalizeUrl(row[dbUrlIdx] || '');
    // カルテのURLリストのどこかにdbUrlが含まれているかで判定
    // （先頭一致ではなく「カルテの関連記事に含まれているか」を見る = 表示が壊れていないかの確認）
    const found = karte.urls.indexOf(dbUrl) !== -1;
    if (!found) {
      urlMismatchCount++;
      if (urlMismatchSamples.length < 15) {
        urlMismatchSamples.push({
          row: i + 1, karteId: kid,
          dbTitle: String(row[dbTitleIdx] || '').slice(0, 40),
          karteTitle: karte.title.slice(0, 40),
          dbUrl: dbUrl.slice(-50)
        });
      }
    }
  }

  // ===== 指標3：ID重複件数（カルテシート内で同じカルテIDが複数行ある）=====
  const duplicateIds = Object.entries(karteIdAllRows).filter(function(e) { return e[1].length >= 2; });

  // ===== ログ出力 =====
  Logger.log('========== 全体診断サマリ ==========');
  Logger.log('実行日時: ' + new Date().toISOString());
  Logger.log('');
  Logger.log('観測DB総件数:                 ' + (dbData.length - 1) + '件');
  Logger.log('カルテシート総件数:           ' + (karteData.length - 1) + '件');
  Logger.log('観測DBでカルテIDあり:         ' + withKarteId + '件');
  Logger.log('');
  Logger.log('【指標1】カルテシートに存在しないカルテID参照: ' + notExistCount + '件');
  Logger.log('【指標2】IDは存在するが関連記事URLが不一致:     ' + urlMismatchCount + '件');
  Logger.log('【指標3】カルテID重複（カルテシート内）:        ' + duplicateIds.length + '件');
  Logger.log('【指標4】削除後残存参照（指標1と同義の集計）:   ' + notExistCount + '件');
  Logger.log('');

  Logger.log('---------- 指標1 詳細（最大15件）----------');
  notExistSamples.forEach(function(s) {
    Logger.log('  行' + s.row + ' [' + s.karteId + '] DB記事:「' + s.dbTitle + '」');
  });
  Logger.log('');

  Logger.log('---------- 指標2 詳細（最大15件）----------');
  urlMismatchSamples.forEach(function(s) {
    Logger.log('  行' + s.row + ' [' + s.karteId + ']');
    Logger.log('    DB記事:    「' + s.dbTitle + '」');
    Logger.log('    カルテ:    「' + s.karteTitle + '」');
    Logger.log('    DB-URL末尾: ' + s.dbUrl);
  });
  Logger.log('');

  Logger.log('---------- 指標3 詳細 ----------');
  duplicateIds.forEach(function(e) {
    Logger.log('  [' + e[0] + '] 行: ' + e[1].join(', '));
  });

  Logger.log('');
  Logger.log('========== 診断完了（修正なし）==========');
}

// ===== 重複カルテID 詳細診断 =====
// カルテシート内で同じIDが複数行存在するケースを全件洗い出し、
// 判断材料（観測DB参照状況・プロフィール充実度・作成日時）を提示する。
// 修正・削除は一切しない。
function diagnoseDuplicateKarteIds() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const karteSheet  = ss.getSheetByName(KARTE_SHEET);
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  if (!karteSheet || !sourceSheet) { Logger.log('シートが見つかりません'); return; }

  // --- kansokuDB: カルテID → 参照しているDB記事の一覧 ---
  const dbData    = sourceSheet.getDataRange().getValues();
  const dbHeaders = dbData[0];
  const dbTitleIdx    = dbHeaders.indexOf('タイトル');
  const dbUrlIdx      = dbHeaders.indexOf('URL');
  const karteIdColIdx = dbHeaders.indexOf('カルテID');

  const dbRefsByKarteId = {}; // karteId -> [{title, url}]
  dbData.slice(1).forEach(function(row) {
    const kid = String(row[karteIdColIdx] || '').trim();
    if (!kid) return;
    if (!dbRefsByKarteId[kid]) dbRefsByKarteId[kid] = [];
    dbRefsByKarteId[kid].push({
      title: String(row[dbTitleIdx] || '').slice(0, 40),
      url:   _normalizeUrl(row[dbUrlIdx] || '')
    });
  });

  // --- カルテシート全行 ---
  const karteData    = karteSheet.getDataRange().getValues();
  const karteHeaders = karteData[0];
  const kIdIdx    = karteHeaders.indexOf('カルテID');
  const kTitIdx   = karteHeaders.indexOf('事案名');
  const kRelIdx   = karteHeaders.indexOf('関連記事URL');
  const kCreIdx   = karteHeaders.indexOf('作成日');
  const kUpdIdx   = karteHeaders.indexOf('最終更新日');
  const kProfFieldIdx  = karteHeaders.indexOf('分野タグ');
  const kProfTargetIdx = karteHeaders.indexOf('対象者タグ');
  const kProfActorIdx  = karteHeaders.indexOf('行為者タグ');

  // カルテID → 行情報リスト
  const rowsByKarteId = {};
  karteData.slice(1).forEach(function(row, i) {
    const kid = String(row[kIdIdx] || '').trim();
    if (!kid) return;
    if (!rowsByKarteId[kid]) rowsByKarteId[kid] = [];

    const relUrls = String(row[kRelIdx] || '').split('\n').map(function(u){return _normalizeUrl(u);}).filter(Boolean);
    const profileFilled = [
      String(row[kProfFieldIdx]  || '').trim(),
      String(row[kProfTargetIdx] || '').trim(),
      String(row[kProfActorIdx]  || '').trim()
    ].filter(Boolean).length;

    rowsByKarteId[kid].push({
      rowNum:    i + 2,
      title:     String(row[kTitIdx] || ''),
      primaryUrl: relUrls[0] || '',
      urlCount:  relUrls.length,
      created:   String(row[kCreIdx] || ''),
      updated:   String(row[kUpdIdx] || ''),
      profileFilledCount: profileFilled, // 0〜3（分野/対象者/行為者のうち埋まっている数）
    });
  });

  // 重複のみ抽出
  const duplicates = Object.entries(rowsByKarteId).filter(function(e) { return e[1].length >= 2; });

  Logger.log('========== 重複カルテID 詳細診断 ==========');
  Logger.log('重複ID件数: ' + duplicates.length + '件');
  Logger.log('修正・削除は一切行いません。判断材料の提示のみです。');
  Logger.log('');

  duplicates.forEach(function(entry, idx) {
    const kid  = entry[0];
    const rows = entry[1];

    Logger.log('--- [' + (idx + 1) + '/' + duplicates.length + '] カルテID: ' + kid + ' (' + rows.length + '行重複) ---');

    rows.forEach(function(r, j) {
      const dbRefs = dbRefsByKarteId[kid] || [];
      // この行の代表URLを参照しているDB記事を抽出
      const matchingRefs = dbRefs.filter(function(ref) { return ref.url === r.primaryUrl; });

      Logger.log('  候補' + (j + 1) + ': 行' + r.rowNum);
      Logger.log('    事案名:       「' + r.title.slice(0, 40) + '」');
      Logger.log('    代表URL末尾:  ' + r.primaryUrl.slice(-50));
      Logger.log('    関連URL数:    ' + r.urlCount + '件');
      Logger.log('    作成日:       ' + r.created.slice(0, 10));
      Logger.log('    最終更新日:   ' + r.updated.slice(0, 10));
      Logger.log('    プロフィール充実度: ' + r.profileFilledCount + '/3');
      Logger.log('    観測DB側でこの代表URLを参照: ' + matchingRefs.length + '件');
      if (matchingRefs.length > 0) {
        matchingRefs.forEach(function(ref) {
          Logger.log('      └ 「' + ref.title + '」');
        });
      }
    });

    // 全体としてこのIDを参照しているDB記事数（代表URL不問）
    const totalDbRefs = (dbRefsByKarteId[kid] || []).length;
    Logger.log('  ※ このカルテIDを参照する観測DB行の合計: ' + totalDbRefs + '件（候補のどちらかに紐づくべき）');
    Logger.log('');
  });

  Logger.log('========== 診断完了（修正なし）==========');
}

// ===== 重複カルテID分離：ドライラン =====
// 候補1（作成日が最も早い行）は既存IDを維持。
// 候補2以降には新しいIDを採番する（最大番号+1から連番）。
// 観測DB側で候補2・候補3を参照している行のカルテIDも新IDに更新する対象として列挙。
// このバージョンは書き込みを一切行わない。対応表のログ出力のみ。
function dryRunSplitDuplicateKarteIds() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const karteSheet  = ss.getSheetByName(KARTE_SHEET);
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  if (!karteSheet || !sourceSheet) { Logger.log('シートが見つかりません'); return; }

  // --- kansokuDB: URL → 行番号マップ（更新対象特定用） ---
  const dbData    = sourceSheet.getDataRange().getValues();
  const dbHeaders = dbData[0];
  const dbUrlIdx      = dbHeaders.indexOf('URL');
  const dbTitleIdx    = dbHeaders.indexOf('タイトル');
  const karteIdColIdx = dbHeaders.indexOf('カルテID');

  const dbRowsByUrl = {}; // normalizedUrl -> [{rowNum, title, currentKarteId}]
  dbData.slice(1).forEach(function(row, i) {
    const url = _normalizeUrl(row[dbUrlIdx] || '');
    if (!url) return;
    if (!dbRowsByUrl[url]) dbRowsByUrl[url] = [];
    dbRowsByUrl[url].push({
      rowNum: i + 1,
      title:  String(row[dbTitleIdx] || '').slice(0, 40),
      currentKarteId: String(row[karteIdColIdx] || '').trim(),
    });
  });

  // --- カルテシート全行 ---
  const karteData    = karteSheet.getDataRange().getValues();
  const karteHeaders = karteData[0];
  const kIdIdx  = karteHeaders.indexOf('カルテID');
  const kTitIdx = karteHeaders.indexOf('事案名');
  const kRelIdx = karteHeaders.indexOf('関連記事URL');
  const kCreIdx = karteHeaders.indexOf('作成日');

  const rowsByKarteId = {};
  karteData.slice(1).forEach(function(row, i) {
    const kid = String(row[kIdIdx] || '').trim();
    if (!kid) return;
    if (!rowsByKarteId[kid]) rowsByKarteId[kid] = [];

    const relUrls = String(row[kRelIdx] || '').split('\n').map(function(u){return _normalizeUrl(u);}).filter(Boolean);
    rowsByKarteId[kid].push({
      sheetRowNum: i + 2,
      title:       String(row[kTitIdx] || ''),
      primaryUrl:  relUrls[0] || '',
      created:     String(row[kCreIdx] || ''),
    });
  });

  const duplicates = Object.entries(rowsByKarteId).filter(function(e) { return e[1].length >= 2; });

  // 採番用：現在の最大番号を取得し、以降は仮想的にインクリメントしていく
  let virtualMaxNum = _getNextKarteNumber(karteSheet) - 1; // 現在の最大値

  Logger.log('========== 重複カルテID分離：ドライラン ==========');
  Logger.log('対象重複ID件数: ' + duplicates.length + '件');
  Logger.log('現在のカルテシート最大番号: KARTE-' + String(virtualMaxNum).padStart(4,'0'));
  Logger.log('※ 書き込みは一切行いません。対応表の確認のみです。');
  Logger.log('');

  const plan = []; // {oldId, sheetRowNum, newId, dbRowsToUpdate:[rowNum,...]}

  duplicates.forEach(function(entry) {
    const oldId = entry[0];
    // 作成日の昇順でソート（最も早い = 候補1 = ID維持）
    const rows = entry[1].slice().sort(function(a, b) {
      return new Date(a.created) - new Date(b.created);
    });

    Logger.log('--- ' + oldId + ' (' + rows.length + '行) ---');
    Logger.log('  [維持] 行' + rows[0].sheetRowNum + ' 「' + rows[0].title.slice(0,35) + '」作成日:' + rows[0].created.slice(0,10) + ' → ' + oldId + ' のまま');

    for (let j = 1; j < rows.length; j++) {
      virtualMaxNum++;
      const newId = 'KARTE-' + String(virtualMaxNum).padStart(4, '0');
      const r = rows[j];

      // この行の代表URLを参照している観測DB行を特定
      const dbMatches = dbRowsByUrl[r.primaryUrl] || [];
      const dbRowNums = dbMatches.map(function(m) { return m.rowNum; });

      Logger.log('  [再採番] 行' + r.sheetRowNum + ' 「' + r.title.slice(0,35) + '」作成日:' + r.created.slice(0,10) + ' → ' + newId);
      if (dbMatches.length) {
        dbMatches.forEach(function(m) {
          Logger.log('      観測DB行' + m.rowNum + ' 更新対象:「' + m.title + '」現在のカルテID:' + (m.currentKarteId || '(空欄)') + ' → ' + newId);
        });
      } else {
        Logger.log('      観測DB側に対応する参照行なし');
      }

      plan.push({
        oldId: oldId,
        karteSheetRow: r.sheetRowNum,
        newId: newId,
        dbRowsToUpdate: dbRowNums,
      });
    }
    Logger.log('');
  });

  Logger.log('========== ドライラン完了 ==========');
  Logger.log('再採番予定件数: ' + plan.length + '件');
  Logger.log('次の本番採番開始番号: KARTE-' + String(virtualMaxNum + 1).padStart(4,'0'));
  Logger.log('');
  Logger.log('この内容で問題なければ、本実行用の splitDuplicateKarteIds() を別途用意します。');
}

// ===== バックアップ：カルテシート・kansokuDBシートを複製 =====
function backupBeforeSplit() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmmss');

  const karteSheet  = ss.getSheetByName(KARTE_SHEET);
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);

  if (!karteSheet || !sourceSheet) { Logger.log('シートが見つかりません'); return; }

  const karteBackupName  = KARTE_SHEET  + '_backup_' + timestamp;
  const sourceBackupName = SOURCE_SHEET + '_backup_' + timestamp;

  const karteCopy  = karteSheet.copyTo(ss);
  karteCopy.setName(karteBackupName);

  const sourceCopy = sourceSheet.copyTo(ss);
  sourceCopy.setName(sourceBackupName);

  Logger.log('===== バックアップ完了 =====');
  Logger.log('カルテシート バックアップ:   ' + karteBackupName);
  Logger.log('kansokuDB バックアップ:      ' + sourceBackupName);
  Logger.log('');
  Logger.log('→ 確認後、splitDuplicateKarteIds() を実行してください');
}

// ===== 重複カルテID分離：本実行 =====
// 必ず backupBeforeSplit() を先に実行してください。
function splitDuplicateKarteIds() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const karteSheet  = ss.getSheetByName(KARTE_SHEET);
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  if (!karteSheet || !sourceSheet) { Logger.log('シートが見つかりません'); return; }

  // --- kansokuDB: URL → 行番号マップ ---
  const dbData    = sourceSheet.getDataRange().getValues();
  const dbHeaders = dbData[0];
  const dbUrlIdx      = dbHeaders.indexOf('URL');
  const dbTitleIdx    = dbHeaders.indexOf('タイトル');
  const karteIdColIdx = dbHeaders.indexOf('カルテID');

  const dbRowsByUrl = {};
  dbData.slice(1).forEach(function(row, i) {
    const url = _normalizeUrl(row[dbUrlIdx] || '');
    if (!url) return;
    if (!dbRowsByUrl[url]) dbRowsByUrl[url] = [];
    dbRowsByUrl[url].push({ rowNum: i + 2, title: String(row[dbTitleIdx] || '').slice(0, 40) });
  });

  // --- カルテシート全行 ---
  const karteData    = karteSheet.getDataRange().getValues();
  const karteHeaders = karteData[0];
  const kIdIdx  = karteHeaders.indexOf('カルテID');
  const kTitIdx = karteHeaders.indexOf('事案名');
  const kRelIdx = karteHeaders.indexOf('関連記事URL');
  const kCreIdx = karteHeaders.indexOf('作成日');

  const rowsByKarteId = {};
  karteData.slice(1).forEach(function(row, i) {
    const kid = String(row[kIdIdx] || '').trim();
    if (!kid) return;
    if (!rowsByKarteId[kid]) rowsByKarteId[kid] = [];

    const relUrls = String(row[kRelIdx] || '').split('\n').map(function(u){return _normalizeUrl(u);}).filter(Boolean);
    rowsByKarteId[kid].push({
      sheetRowNum: i + 2,
      title:       String(row[kTitIdx] || ''),
      primaryUrl:  relUrls[0] || '',
      created:     String(row[kCreIdx] || ''),
    });
  });

  const duplicates = Object.entries(rowsByKarteId).filter(function(e) { return e[1].length >= 2; });

  let virtualMaxNum = _getNextKarteNumber(karteSheet) - 1;

  Logger.log('========== 重複カルテID分離：本実行 =====');
  Logger.log('対象重複ID件数: ' + duplicates.length + '件');
  Logger.log('');

  const idChanges = []; // {oldId, newId, karteRow}
  let karteUpdateCount = 0;
  let dbUpdateCount    = 0;

  duplicates.forEach(function(entry) {
    const oldId = entry[0];
    const rows = entry[1].slice().sort(function(a, b) {
      return new Date(a.created) - new Date(b.created);
    });

    // 候補1は変更しない（rows[0]）

    for (let j = 1; j < rows.length; j++) {
      virtualMaxNum++;
      const newId = 'KARTE-' + String(virtualMaxNum).padStart(4, '0');
      const r = rows[j];

      // カルテシート側：カルテID列を新IDに書き換え
      karteSheet.getRange(r.sheetRowNum, kIdIdx + 1).setValue(newId);
      karteUpdateCount++;

      // 観測DB側：この行の代表URLを参照している行のカルテID列を新IDに書き換え
      const dbMatches = dbRowsByUrl[r.primaryUrl] || [];
      dbMatches.forEach(function(m) {
        sourceSheet.getRange(m.rowNum, karteIdColIdx + 1).setValue(newId);
        dbUpdateCount++;
        Logger.log('[観測DB更新] 行' + m.rowNum + ' 「' + m.title + '」 ' + oldId + ' → ' + newId);
      });

      Logger.log('[カルテ更新] 行' + r.sheetRowNum + ' 「' + r.title.slice(0,35) + '」 ' + oldId + ' → ' + newId);

      idChanges.push({ oldId: oldId, newId: newId, karteRow: r.sheetRowNum });
    }
  });

  Logger.log('');
  Logger.log('========== 処理完了サマリ ==========');
  Logger.log('変更件数（カルテ行）:        ' + karteUpdateCount + '件');
  Logger.log('観測DB更新件数:              ' + dbUpdateCount + '件');
  Logger.log('');
  Logger.log('--- 変更された旧ID→新ID一覧 ---');
  idChanges.forEach(function(c) {
    Logger.log('  ' + c.oldId + ' → ' + c.newId + ' (カルテ行' + c.karteRow + ')');
  });
  Logger.log('');
  Logger.log('次回採番開始番号: KARTE-' + String(virtualMaxNum + 1).padStart(4,'0'));
  Logger.log('========================================');
}

// ===== 観測DB側カルテID復元：ドライラン =====
// splitDuplicateKarteIds()のrowNum計算バグ（i+1→i+2の誤り）により、
// 観測DB側のカルテID更新が1行ズレて書き込まれた問題を修復する。
// このバージョンは書き込みを一切行わない。対応表の確認のみ。
function dryRunRestoreKansokuDbKarteIds() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  if (!sourceSheet) { Logger.log('kansokuDBシートが見つかりません'); return; }

  // 最新のバックアップシートを自動検出
  const allSheets = ss.getSheets();
  const backupSheets = allSheets.filter(function(s) {
    return s.getName().indexOf(SOURCE_SHEET + '_backup_') === 0;
  });

  if (backupSheets.length === 0) {
    Logger.log('❌ kansokuDBのバックアップシートが見つかりません');
    return;
  }

  // 名前末尾のタイムスタンプで最新を選ぶ
  backupSheets.sort(function(a, b) { return b.getName().localeCompare(a.getName()); });
  const backupSheet = backupSheets[0];
  Logger.log('使用するバックアップ: ' + backupSheet.getName());
  Logger.log('');

  const backupData    = backupSheet.getDataRange().getValues();
  const backupHeaders = backupData[0];
  const bKarteIdIdx = backupHeaders.indexOf('カルテID');
  const bUrlIdx     = backupHeaders.indexOf('URL');
  const bTitleIdx   = backupHeaders.indexOf('タイトル');

  const currentData    = sourceSheet.getDataRange().getValues();
  const currentHeaders = currentData[0];
  const cKarteIdIdx = currentHeaders.indexOf('カルテID');
  const cUrlIdx     = currentHeaders.indexOf('URL');
  const cTitleIdx   = currentHeaders.indexOf('タイトル');

  if (bKarteIdIdx < 0 || cKarteIdIdx < 0) {
    Logger.log('カルテID列が見つかりません');
    return;
  }

  // splitDuplicateKarteIds()が対象とした新ID一覧（KARTE-0398〜KARTE-0461）
  const NEW_ID_MIN = 398;
  const NEW_ID_MAX = 461;

  Logger.log('========== 観測DBカルテID復元：ドライラン ==========');
  Logger.log('対象新IDレンジ: KARTE-' + String(NEW_ID_MIN).padStart(4,'0') + ' 〜 KARTE-' + String(NEW_ID_MAX).padStart(4,'0'));
  Logger.log('');

  // 現在のシートで誤って新IDが書き込まれている行を特定
  const wronglyAssigned = [];
  for (let i = 1; i < currentData.length; i++) {
    const kid = String(currentData[i][cKarteIdIdx] || '').trim();
    const m = kid.match(/KARTE-(\d+)/);
    if (!m) continue;
    const num = parseInt(m[1], 10);
    if (num >= NEW_ID_MIN && num <= NEW_ID_MAX) {
      wronglyAssigned.push({
        currentRowNum: i + 1,
        currentTitle:  String(currentData[i][cTitleIdx] || '').slice(0, 40),
        currentUrl:    _normalizeUrl(currentData[i][cUrlIdx] || ''),
        newId:         kid,
      });
    }
  }

  Logger.log('現在シート上で新ID(0398-0461)が付与されている行: ' + wronglyAssigned.length + '件');
  Logger.log('');

  // バックアップ側：URLをキーに「本来のカルテID（分離前の旧ID）」を引けるようにする
  const backupByUrl = {};
  backupData.slice(1).forEach(function(row) {
    const url = _normalizeUrl(row[bUrlIdx] || '');
    if (!url) return;
    backupByUrl[url] = {
      karteId: String(row[bKarteIdIdx] || '').trim(),
      title:   String(row[bTitleIdx] || '').slice(0, 40),
    };
  });

  // 対応表：現在誤って新IDが付いている行のURLから、
  // 「そのURLが本来どの新IDを受け取るべきだったか」を再計算する。
  // 再計算には splitDuplicateKarteIds() のロジック（修正版）を再利用する。

  // カルテシート側で新IDを持つ行（候補2以降）の代表URLを再取得
  const karteSheet = ss.getSheetByName(KARTE_SHEET);
  const karteData2 = karteSheet.getDataRange().getValues();
  const karteHeaders2 = karteData2[0];
  const kIdIdx2  = karteHeaders2.indexOf('カルテID');
  const kRelIdx2 = karteHeaders2.indexOf('関連記事URL');
  const kTitIdx2 = karteHeaders2.indexOf('事案名');

  const correctUrlForNewId = {}; // newId -> {url, title}
  karteData2.slice(1).forEach(function(row) {
    const kid = String(row[kIdIdx2] || '').trim();
    const m = kid.match(/KARTE-(\d+)/);
    if (!m) return;
    const num = parseInt(m[1], 10);
    if (num < NEW_ID_MIN || num > NEW_ID_MAX) return;

    const relUrls = String(row[kRelIdx2] || '').split('\n').map(function(u){return _normalizeUrl(u);}).filter(Boolean);
    correctUrlForNewId[kid] = {
      url: relUrls[0] || '',
      title: String(row[kTitIdx2] || '').slice(0, 40),
    };
  });

  Logger.log('---------- 復元対応表 ----------');
  const restorePlan = []; // {newId, correctRowNum, correctTitle, wrongRowNum, wrongTitle}

  Object.entries(correctUrlForNewId).forEach(function(entry) {
    const newId = entry[0];
    const correctUrl = entry[1].url;
    const correctKarteTitle = entry[1].title;

    // このURLが現在のkansokuDBの何行目にあるか（正しい行）
    let correctDbRowNum = null;
    let correctDbTitle  = '';
    for (let i = 1; i < currentData.length; i++) {
      if (_normalizeUrl(currentData[i][cUrlIdx] || '') === correctUrl) {
        correctDbRowNum = i + 1;
        correctDbTitle  = String(currentData[i][cTitleIdx] || '').slice(0, 40);
        break;
      }
    }

    // 現在誤ってこのnewIdが付いている行（1行前にズレている）
    const wrong = wronglyAssigned.find(function(w) { return w.newId === newId; });

    Logger.log(newId + ' (カルテ:「' + correctKarteTitle + '」):');
    if (wrong) {
      Logger.log('  現在誤って書込まれている行: ' + wrong.currentRowNum + ' 「' + wrong.currentTitle + '」 ← これをクリアする');
    } else {
      Logger.log('  現在誤って書込まれている行: 見つからず');
    }
    if (correctDbRowNum) {
      Logger.log('  本来書き込むべき行:        ' + correctDbRowNum + ' 「' + correctDbTitle + '」 ← ここに ' + newId + ' を書く');
    } else {
      Logger.log('  本来書き込むべき行:        見つからず（要確認）');
    }
    Logger.log('');

    restorePlan.push({
      newId: newId,
      wrongRowNum:   wrong ? wrong.currentRowNum : null,
      correctRowNum: correctDbRowNum,
      correctTitle:  correctDbTitle,
    });
  });

  Logger.log('========== ドライラン完了 ==========');
  Logger.log('復元予定件数: ' + restorePlan.length + '件');
  Logger.log('この内容で問題なければ restoreKansokuDbKarteIds() を実行してください（未実装・要依頼）');
}

// ===== 観測DB側カルテID復元：本実行 =====
// dryRunRestoreKansokuDbKarteIds()のロジックと同一。
// 誤って書き込まれた行をクリアし、正しい行に新IDを書き込む。
function restoreKansokuDbKarteIds() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  if (!sourceSheet) { Logger.log('kansokuDBシートが見つかりません'); return; }

  const allSheets = ss.getSheets();
  const backupSheets = allSheets.filter(function(s) {
    return s.getName().indexOf(SOURCE_SHEET + '_backup_') === 0;
  });
  if (backupSheets.length === 0) { Logger.log('❌ バックアップシートが見つかりません'); return; }
  backupSheets.sort(function(a, b) { return b.getName().localeCompare(a.getName()); });
  const backupSheet = backupSheets[0];
  Logger.log('使用するバックアップ: ' + backupSheet.getName());
  Logger.log('');

  const currentData    = sourceSheet.getDataRange().getValues();
  const currentHeaders = currentData[0];
  const cKarteIdIdx = currentHeaders.indexOf('カルテID');
  const cUrlIdx     = currentHeaders.indexOf('URL');
  const cTitleIdx   = currentHeaders.indexOf('タイトル');

  const NEW_ID_MIN = 398;
  const NEW_ID_MAX = 461;

  // 誤って新IDが付与されている行を特定
  const wronglyAssigned = [];
  for (let i = 1; i < currentData.length; i++) {
    const kid = String(currentData[i][cKarteIdIdx] || '').trim();
    const m = kid.match(/KARTE-(\d+)/);
    if (!m) continue;
    const num = parseInt(m[1], 10);
    if (num >= NEW_ID_MIN && num <= NEW_ID_MAX) {
      wronglyAssigned.push({ rowNum: i + 1, newId: kid, title: String(currentData[i][cTitleIdx] || '').slice(0,40) });
    }
  }

  // カルテシート側から正しいURLを取得
  const karteSheet = ss.getSheetByName(KARTE_SHEET);
  const karteData2 = karteSheet.getDataRange().getValues();
  const karteHeaders2 = karteData2[0];
  const kIdIdx2  = karteHeaders2.indexOf('カルテID');
  const kRelIdx2 = karteHeaders2.indexOf('関連記事URL');
  const kTitIdx2 = karteHeaders2.indexOf('事案名');

  const correctUrlForNewId = {};
  karteData2.slice(1).forEach(function(row) {
    const kid = String(row[kIdIdx2] || '').trim();
    const m = kid.match(/KARTE-(\d+)/);
    if (!m) return;
    const num = parseInt(m[1], 10);
    if (num < NEW_ID_MIN || num > NEW_ID_MAX) return;
    const relUrls = String(row[kRelIdx2] || '').split('\n').map(function(u){return _normalizeUrl(u);}).filter(Boolean);
    correctUrlForNewId[kid] = { url: relUrls[0] || '', title: String(row[kTitIdx2] || '').slice(0,40) };
  });

  Logger.log('========== 観測DBカルテID復元：本実行 ==========');
  Logger.log('');

  let clearCount   = 0;
  let restoreCount = 0;
  const restoreLog = [];

  // Step1: 誤って書き込まれた行を全てクリア
  wronglyAssigned.forEach(function(w) {
    sourceSheet.getRange(w.rowNum, cKarteIdIdx + 1).setValue('');
    clearCount++;
    Logger.log('[クリア] 行' + w.rowNum + ' 「' + w.title + '」 ' + w.newId + ' → 空欄');
  });

  Logger.log('');

  // Step2: 正しい行に新IDを書き込み
  Object.entries(correctUrlForNewId).forEach(function(entry) {
    const newId = entry[0];
    const correctUrl = entry[1].url;
    const correctKarteTitle = entry[1].title;

    let correctDbRowNum = null;
    let correctDbTitle  = '';
    for (let i = 1; i < currentData.length; i++) {
      if (_normalizeUrl(currentData[i][cUrlIdx] || '') === correctUrl) {
        correctDbRowNum = i + 1;
        correctDbTitle  = String(currentData[i][cTitleIdx] || '').slice(0, 40);
        break;
      }
    }

    if (!correctDbRowNum) {
      Logger.log('[警告] ' + newId + ' の対応URL行が見つかりません（カルテ:「' + correctKarteTitle + '」）');
      return;
    }

    sourceSheet.getRange(correctDbRowNum, cKarteIdIdx + 1).setValue(newId);
    restoreCount++;
    Logger.log('[復元] 行' + correctDbRowNum + ' 「' + correctDbTitle + '」 → ' + newId);
    restoreLog.push({ newId: newId, rowNum: correctDbRowNum, title: correctDbTitle });
  });

  Logger.log('');
  Logger.log('========== 処理完了サマリ ==========');
  Logger.log('クリア件数:   ' + clearCount + '件');
  Logger.log('復元件数:     ' + restoreCount + '件');
  Logger.log('========================================');
}

// ===== テスト：単一カルテの地域補完確認（KARTE-0402等）=====
// 既存カルテ1件を対象に、ルールベース地域補完が正しく動くかをログで確認する。
// 実際に書き込みも行う（_backfillProfileColumns(1)相当だが対象を指定できる）。
function testRegionFallbackForKarte(targetKarteId) {
  targetKarteId = targetKarteId || 'KARTE-0402';

  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const karteSheet  = ss.getSheetByName(KARTE_SHEET);
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET);
  if (!karteSheet || !sourceSheet) { Logger.log('シートが見つかりません'); return; }

  const karteData    = karteSheet.getDataRange().getValues();
  const karteHeaders = karteData[0];
  const kIdIdx  = karteHeaders.indexOf('カルテID');
  const kTitIdx = karteHeaders.indexOf('事案名');
  const kSumIdx = karteHeaders.indexOf('概要');
  const kRegIdx = karteHeaders.indexOf('地域');
  const kRelIdx = karteHeaders.indexOf('関連記事URL');

  let targetRow = null;
  let targetRowNum = null;
  for (let i = 1; i < karteData.length; i++) {
    if (String(karteData[i][kIdIdx] || '').trim() === targetKarteId) {
      targetRow = karteData[i];
      targetRowNum = i + 1;
      break;
    }
  }

  if (!targetRow) {
    Logger.log('❌ ' + targetKarteId + ' が見つかりません');
    return;
  }

  const title   = String(targetRow[kTitIdx] || '');
  const summary = String(targetRow[kSumIdx] || '');
  const currentRegion = String(targetRow[kRegIdx] || '').trim();

  Logger.log('===== ' + targetKarteId + ' 地域補完テスト =====');
  Logger.log('事案名: ' + title);
  Logger.log('概要（先頭80字）: ' + summary.slice(0, 80));
  Logger.log('現在の地域列: ' + (currentRegion || '（空欄）'));
  Logger.log('');

  // ルールベース補完のみで試す（Gemini不要・テキストマッチのみ確認）
  const dummyItems = { region: '', municipality: '' };
  const result = applyRegionFallback(dummyItems, [title, summary]);

  Logger.log('--- ルールベース補完結果 ---');
  Logger.log('region: ' + (result.region || '（検出されず）'));
  Logger.log('municipality: ' + (result.municipality || '（検出されず）'));
  Logger.log('');

  if (!currentRegion && result.region) {
    karteSheet.getRange(targetRowNum, kRegIdx + 1).setValue(result.region);
    Logger.log('✅ 地域列に書き込みました: ' + result.region);
  } else if (currentRegion) {
    Logger.log('地域列に既に値があるため書き込みはスキップしました（既存値: ' + currentRegion + '）');
  } else {
    Logger.log('❌ 補完できる地域が見つかりませんでした');
  }

  Logger.log('===== テスト完了 =====');
}

// ===== 既存カルテへの地域遡及補完（ルールベースのみ・Gemini不要） =====
// 地域列が空欄のカルテについて、事案名・概要本文から市区町村名を検出し、
// 地域（都道府県）を補完する。Geminiを呼ばないため429の影響を受けない。
function backfillRegionForExistingKartes() {
  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  const karteSheet = ss.getSheetByName(KARTE_SHEET);
  if (!karteSheet) { Logger.log('カルテシートが見つかりません'); return; }

  const karteData    = karteSheet.getDataRange().getValues();
  const karteHeaders = karteData[0];
  const kIdIdx  = karteHeaders.indexOf('カルテID');
  const kTitIdx = karteHeaders.indexOf('事案名');
  const kSumIdx = karteHeaders.indexOf('概要');
  const kRegIdx = karteHeaders.indexOf('地域');

  if (kRegIdx < 0) { Logger.log('地域列が見つかりません'); return; }

  Logger.log('===== 既存カルテ地域遡及補完（ルールベースのみ） =====');

  let checked  = 0;
  let filled   = 0;
  let notFound = 0;

  karteData.slice(1).forEach(function(row, i) {
    const karteId = String(row[kIdIdx] || '').trim();
    if (!karteId) return;

    const existingRegion = String(row[kRegIdx] || '').trim();
    if (existingRegion) return; // 既に地域があればスキップ

    checked++;
    const title   = String(row[kTitIdx] || '');
    const summary = String(row[kSumIdx] || '');

    const result = applyRegionFallback({ region: '', municipality: '' }, [title, summary]);

    const rowNum = i + 2;
    if (result.region) {
      karteSheet.getRange(rowNum, kRegIdx + 1).setValue(result.region);
      filled++;
      Logger.log('[補完] ' + karteId + ' 「' + title.slice(0, 30) + '」 → ' + result.region +
        (result.municipality ? '（' + result.municipality + '）' : ''));
    } else {
      notFound++;
    }
  });

  Logger.log('');
  Logger.log('===== 完了 =====');
  Logger.log('地域空欄チェック対象: ' + checked + '件');
  Logger.log('補完できた件数:       ' + filled + '件');
  Logger.log('検出できなかった件数: ' + notFound + '件（市区町村名が本文に見つからない、または海外/国レベルの事案）');
}