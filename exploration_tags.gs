// PROJECT MANA — 探索タグ付与スクリプト
// 対象：既存カルテへの遡及付与
// 方針：1日10件・429リトライ・連続5件打ち切り

const ET_KARTE_SHEET  = 'カルテ';
const ET_SLEEP_MS     = 12000; // 呼び出し間隔（12秒 = 5回/分）
const ET_RETRY_MS     = 30000; // 429時のリトライ待機（30秒）
const ET_BATCH_LIMIT  = 10;    // 1バッチの最大件数
const ET_MAX_429      = 5;     // 429連続この件数で打ち切り
const ET_GEMINI_MODEL = 'gemini-2.5-flash-lite';

const EXPLORATION_TAG_MASTER = {
  field: [
    '生活保護', '障害福祉', '介護保険', '児童福祉', '住宅支援',
    '医療扶助', '就労支援', '情報公開', '財政', '教育',
    '国民健康保険', '年金', '生活困窮者支援'
  ],
  target: [
    '生活保護申請者', '生活保護受給者', '障害者', '高齢者', '子ども・家族',
    'ひとり親', '外国籍', 'ホームレス状態', 'DV被害者',
    '精神疾患当事者', '身体障害者', '知的障害者', '難病患者'
  ],
  actor: [
    '福祉事務所', 'ケースワーカー', '市区町村窓口', '都道府県',
    '厚生労働省', '審査機関', '病院・医療機関', '支援団体',
    '弁護士・法律家', '議会・議員', '監査委員', '指定管理者'
  ],
  event_search: [
    '申請を断られた', '書類を要求された', '窓口でたらい回し',
    '長期間放置された', '説明を拒否された', '支給を止められた',
    '記録を改ざんされた', '情報を隠された', '扶養照会を強いられた',
    '不当な条件を付けられた', '職員に暴言を受けた', '審査を引き延ばされた'
  ]
};

// ===== テスト（1件）=====
function testAddExplorationTags() {
  _runExplorationTags(1);
}

// ===== 本番バッチ（10件）=====
function addExplorationTagsBatch() {
  _runExplorationTags(ET_BATCH_LIMIT);
}

// ===== APIキー確認 =====
function checkApiKey() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) {
    Logger.log('❌ GEMINI_API_KEY が未設定です');
  } else {
    Logger.log('✅ キーが設定されています');
    Logger.log('文字数: ' + key.length);
    Logger.log('先頭8文字: ' + key.slice(0, 8));
    Logger.log('末尾4文字: ' + key.slice(-4));
    Logger.log('AIzaで始まるか: ' + key.startsWith('AIza'));
  }
}

// ===== APIキー上書き保存（非推奨・誤実行防止のため改名済み）=====
// 実行用のsetupApiKey()はnews_collector.gsに一本化しています。
// このファイルでキーを上書きしたい場合のみ、明示的にこの関数を呼んでください。
function setupApiKey_DEPRECATED() {
  const NEW_KEY = 'ここに新しいキーを貼る';
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', NEW_KEY);
  const saved = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  Logger.log('保存完了 / 文字数: ' + saved.length + ' / AIzaで始まるか: ' + saved.startsWith('AIza'));
}

// ===== 利用可能なflashモデル一覧 =====
function listGeminiModels() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const res = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey,
    { muteHttpExceptions: true }
  );
  const models = JSON.parse(res.getContentText()).models || [];
  Logger.log('===== flashモデル一覧 =====');
  models.forEach(function(m) {
    if (m.name && m.name.indexOf('flash') !== -1) Logger.log(m.name);
  });
}

// ===== 探索タグ付与状況の確認 =====
function checkExplorationTagStatus() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ET_KARTE_SHEET);
  if (!sheet) { Logger.log('カルテシートが見つかりません'); return; }

  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const idxField  = headers.indexOf('分野タグ');
  const idxTarget = headers.indexOf('対象者タグ');
  const idxActor  = headers.indexOf('行為者タグ');
  const idxSearch = headers.indexOf('出来事タグ（探索）');

  Logger.log('===== 列の確認 =====');
  Logger.log('分野タグ:           ' + (idxField  >= 0 ? (idxField  + 1) + '列目' : '❌ 列なし'));
  Logger.log('対象者タグ:         ' + (idxTarget >= 0 ? (idxTarget + 1) + '列目' : '❌ 列なし'));
  Logger.log('行為者タグ:         ' + (idxActor  >= 0 ? (idxActor  + 1) + '列目' : '❌ 列なし'));
  Logger.log('出来事タグ（探索）:  ' + (idxSearch >= 0 ? (idxSearch + 1) + '列目' : '❌ 列なし'));

  const total = data.length - 1;
  let cntField = 0, cntTarget = 0, cntActor = 0, cntSearch = 0, cntAny = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const f = idxField  >= 0 ? String(row[idxField]  || '').trim() : '';
    const t = idxTarget >= 0 ? String(row[idxTarget] || '').trim() : '';
    const a = idxActor  >= 0 ? String(row[idxActor]  || '').trim() : '';
    const s = idxSearch >= 0 ? String(row[idxSearch] || '').trim() : '';
    if (f) cntField++;
    if (t) cntTarget++;
    if (a) cntActor++;
    if (s) cntSearch++;
    if (f || t || a || s) cntAny++;
  }

  Logger.log('');
  Logger.log('===== 付与状況 =====');
  Logger.log('カルテ総件数:       ' + total + '件');
  Logger.log('分野タグ:           ' + cntField  + '件 (' + Math.round(cntField  / total * 100) + '%)');
  Logger.log('対象者タグ:         ' + cntTarget + '件 (' + Math.round(cntTarget / total * 100) + '%)');
  Logger.log('行為者タグ:         ' + cntActor  + '件 (' + Math.round(cntActor  / total * 100) + '%)');
  Logger.log('出来事タグ（探索）:  ' + cntSearch + '件 (' + Math.round(cntSearch / total * 100) + '%)');
  Logger.log('いずれか付与済み:   ' + cntAny    + '件 (' + Math.round(cntAny    / total * 100) + '%)');
  Logger.log('未付与:             ' + (total - cntAny) + '件');
}

// ===== 探索タグ診断 =====
function diagnoseExplorationTags() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ET_KARTE_SHEET);
  if (!sheet) { Logger.log('カルテシートが見つかりません'); return; }

  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows    = data.slice(1);
  const total   = rows.length;

  const idxField  = headers.indexOf('分野タグ');
  const idxTarget = headers.indexOf('対象者タグ');
  const idxActor  = headers.indexOf('行為者タグ');
  const idxSearch = headers.indexOf('出来事タグ（探索）');

  const PREFS = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
    '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県',
    '富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県',
    '三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県',
    '島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県',
    '福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県',
    '厚労省','総務省','内閣府'];

  Logger.log('========== 探索タグ診断レポート ==========');
  Logger.log('カルテ総件数: ' + total);

  const axes = [
    { name: '分野タグ',           idx: idxField  },
    { name: '対象者タグ',         idx: idxTarget },
    { name: '行為者タグ',         idx: idxActor  },
    { name: '出来事タグ（探索）', idx: idxSearch },
  ];

  const allDataTags = {};
  axes.forEach(function(axis) {
    const tagCount = {};
    let filled = 0, empty = 0;
    rows.forEach(function(row) {
      const val = axis.idx >= 0 ? String(row[axis.idx] || '').trim() : '';
      if (!val) { empty++; return; }
      filled++;
      val.split(/[\/・,、]/).map(function(t) { return t.trim(); }).filter(Boolean).forEach(function(t) {
        tagCount[t] = (tagCount[t] || 0) + 1;
        allDataTags[t] = (allDataTags[t] || 0) + 1;
      });
    });
    const allTags    = Object.keys(tagCount);
    const nonGeoTags = allTags.filter(function(t) { return !PREFS.includes(t); });
    Logger.log(axis.name + ': 入力済み=' + filled + ' 空欄=' + empty + ' ユニーク=' + allTags.length + '種');
    if (nonGeoTags.length) Logger.log('  → ' + nonGeoTags.join(' / '));
  });

  const masterAll = [].concat(
    EXPLORATION_TAG_MASTER.field,
    EXPLORATION_TAG_MASTER.target,
    EXPLORATION_TAG_MASTER.actor,
    EXPLORATION_TAG_MASTER.event_search
  );
  const missingFromData = masterAll.filter(function(t) { return !allDataTags[t]; });
  Logger.log('マスター未出現タグ: ' + missingFromData.length + '/' + masterAll.length + '種');

  const anyFilled = rows.filter(function(row) {
    return axes.some(function(a) { return a.idx >= 0 && String(row[a.idx] || '').trim(); });
  }).length;
  Logger.log('いずれか1列以上入力済み: ' + anyFilled + '件 / 全空欄: ' + (total - anyFilled) + '件');
}

// ===== 共通処理本体 =====
function _runExplorationTags(limit) {
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const sheet  = ss.getSheetByName(ET_KARTE_SHEET);
  const apiKey = String(
    PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || ''
  ).trim();

  if (!sheet)  { Logger.log('カルテシートが見つかりません'); return; }
  if (!apiKey) { Logger.log('APIキーが未設定'); return; }

  const headerRow  = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colIndices = _ensureColumns(sheet, headerRow, [
    '分野タグ', '対象者タグ', '行為者タグ', '出来事タグ（探索）'
  ]);
  const idxField  = colIndices['分野タグ'];
  const idxTarget = colIndices['対象者タグ'];
  const idxActor  = colIndices['行為者タグ'];
  const idxSearch = colIndices['出来事タグ（探索）'];

  const allData = sheet.getDataRange().getValues();
  let processed = 0, skipped = 0, consecutive429 = 0;

  Logger.log('===== 探索タグ付与開始 limit=' + limit + ' =====');

  for (let i = 1; i < allData.length; i++) {
    if (processed >= limit) break;

    const row     = allData[i];
    const id      = row[0] || '(ID不明)';
    const title   = row[1] || '';
    const summary = row[4] || '';
    const tagE    = row[6] || '';
    const tagS    = row[7] || '';

    // 探索タグ4列すべて空欄の行のみ処理
    const fieldVal  = String(row[idxField]  || '').trim();
    const targetVal = String(row[idxTarget] || '').trim();
    const actorVal  = String(row[idxActor]  || '').trim();
    const searchVal = String(row[idxSearch] || '').trim();
    if (fieldVal || targetVal || actorVal || searchVal) {
      skipped++;
      continue;
    }

    if (!title && !summary) {
      Logger.log('[SKIP] ' + id + ' (行' + (i + 1) + ') — タイトル・概要なし');
      skipped++;
      continue;
    }

    // 429リトライループ（最大ET_MAX_429回）
    let geminiResponse = null;
    let retryCount = 0;

    while (retryCount <= ET_MAX_429) {
      geminiResponse = _callGemini(title, summary, tagE, tagS, apiKey);

      if (geminiResponse.status !== 429) break; // 成功 or 429以外のエラー → ループ脱出

      consecutive429++;
      retryCount++;

      if (consecutive429 >= ET_MAX_429) {
        Logger.log('[429] ' + id + ' (行' + (i + 1) + ') — 連続' + consecutive429 + '件、処理を終了');
        Logger.log('===== 完了 処理:' + processed + ' スキップ:' + skipped + ' =====');
        return;
      }

      Logger.log('[429→RETRY] ' + id + ' (行' + (i + 1) + ') — ' + ET_RETRY_MS / 1000 + '秒待機後リトライ (' + retryCount + '/' + ET_MAX_429 + ')');
      Utilities.sleep(ET_RETRY_MS);
    }

    const status = geminiResponse.status;
    const result = geminiResponse.result;

    if (!result) {
      Logger.log('[FAIL] ' + id + ' (行' + (i + 1) + ') — HTTP ' + status + ' 空文字を記録');
      _writeTagRow(sheet, i + 1, idxField, idxTarget, idxActor, idxSearch, '', '', '', '');
      processed++;
      consecutive429 = 0;
      Utilities.sleep(ET_SLEEP_MS);
      continue;
    }

    // タグマスター検証
    const fieldTags  = _filterByMaster(result.tags_field,        EXPLORATION_TAG_MASTER.field,        id, '分野タグ');
    const targetTags = _filterByMaster(result.tags_target,       EXPLORATION_TAG_MASTER.target,       id, '対象者タグ');
    const actorTags  = _filterByMaster(result.tags_actor,        EXPLORATION_TAG_MASTER.actor,        id, '行為者タグ');
    const searchTags = _filterByMaster(result.tags_event_search, EXPLORATION_TAG_MASTER.event_search, id, '出来事タグ（探索）');

    _writeTagRow(sheet, i + 1, idxField, idxTarget, idxActor, idxSearch,
                 fieldTags, targetTags, actorTags, searchTags);

    Logger.log('[OK] ' + id + ' (行' + (i + 1) + '/' + allData.length + ') ' + String(title).slice(0, 25));
    Logger.log('     分野:   ' + fieldTags);
    Logger.log('     対象:   ' + targetTags);
    Logger.log('     行為:   ' + actorTags);
    Logger.log('     出来事: ' + searchTags);

    processed++;
    consecutive429 = 0;
    Utilities.sleep(ET_SLEEP_MS);
  }

  Logger.log('===== 完了 処理:' + processed + ' スキップ:' + skipped + ' =====');
}

// ===== Gemini呼び出し =====
function _callGemini(title, summary, tagsEvent, tagsStructure, apiKey) {
  const masterHints = {
    field:  EXPLORATION_TAG_MASTER.field.join('／'),
    target: EXPLORATION_TAG_MASTER.target.join('／'),
    actor:  EXPLORATION_TAG_MASTER.actor.join('／'),
    search: EXPLORATION_TAG_MASTER.event_search.join('／')
  };

  const prompt =
    '以下の事案カルテに探索用タグを付与してください。\n\n' +
    '【事案情報】\n' +
    '事案名：' + title + '\n' +
    '概要：' + summary + '\n' +
    '出来事タグ（観測）：' + tagsEvent + '\n' +
    '構造タグ：' + tagsStructure + '\n\n' +
    '【付与指示】\n' +
    '- 分野タグ（1〜2個）候補: ' + masterHints.field + '\n' +
    '- 対象者タグ（1〜3個）候補: ' + masterHints.target + '\n' +
    '- 行為者タグ（1〜2個）候補: ' + masterHints.actor + '\n' +
    '- 出来事タグ（探索）（1〜3個）候補: ' + masterHints.search + '\n' +
    '  ※市民が「自分がされたこと」として検索しそうな言葉を選ぶこと\n' +
    '  ※候補にない場合のみ自由記述可\n\n' +
    '【出力形式】JSONオブジェクトのみ。説明文・コードブロック記号は不要。\n' +
    '{"tags_field":"A / B","tags_target":"A / B","tags_actor":"A","tags_event_search":"A / B"}';

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    ET_GEMINI_MODEL +
    ':generateContent?key=' +
    encodeURIComponent(apiKey);

  try {
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 300 }
      }),
      muteHttpExceptions: true
    });

    const httpStatus = res.getResponseCode();
    if (httpStatus === 429) return { status: 429, result: null };

    const json = JSON.parse(res.getContentText());
    if (json.error) {
      Logger.log('GeminiAPIエラー: ' + JSON.stringify(json.error));
      return { status: httpStatus, result: null };
    }

    const raw = (
      json.candidates &&
      json.candidates[0] &&
      json.candidates[0].content &&
      json.candidates[0].content.parts &&
      json.candidates[0].content.parts[0] &&
      json.candidates[0].content.parts[0].text
    ) ? json.candidates[0].content.parts[0].text : '';

    if (!raw) { Logger.log('Gemini: rawText空'); return { status: httpStatus, result: null }; }

    let result = null;
    const blockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (blockMatch) { try { result = JSON.parse(blockMatch[1].trim()); } catch(e) {} }
    if (!result) {
      const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
      if (s !== -1 && e > s) { try { result = JSON.parse(raw.slice(s, e + 1)); } catch(e2) {} }
    }
    if (!result) {
      const m = raw.match(/\{[\s\S]*?\}/);
      if (m) { try { result = JSON.parse(m[0]); } catch(e3) {} }
    }
    if (!result) {
      Logger.log('JSON抽出失敗。rawText先頭200文字: ' + raw.slice(0, 200));
      return { status: httpStatus, result: null };
    }
    return { status: httpStatus, result: result };

  } catch(e) {
    Logger.log('Gemini呼び出し例外: ' + e.message);
    return { status: 0, result: null };
  }
}

// ===== 列の確認・自動追加 =====
function _ensureColumns(sheet, headerRow, colNames) {
  const indices = {};
  colNames.forEach(function(name) {
    let idx = headerRow.indexOf(name);
    if (idx === -1) {
      idx = headerRow.length;
      sheet.getRange(1, idx + 1).setValue(name);
      headerRow.push(name);
      Logger.log('列を追加: ' + name + ' (列' + (idx + 1) + ')');
    } else {
      Logger.log('列を確認: ' + name + ' (列' + (idx + 1) + ') — 既存');
    }
    indices[name] = idx;
  });
  return indices;
}

// ===== タグマスター検証 =====
// ===== 観測値の保存（マスター外も破棄しない）=====
// MANAルール：観測と解釈を分離する。
// タグマスターは保存可否のフィルターではなく、検索・整理のための索引。
// Geminiが抽出した値は、マスターに載っているかどうかに関わらずそのまま保存する。
// マスター外の値はログに記録するが、削除はしない（将来の解釈・マスター拡張のため）。
function _filterByMaster(rawStr, masterList, karteId, axisName) {
  if (!rawStr) return '';
  const candidates = String(rawStr)
    .split(/[\/・,、]/)
    .map(function(t) { return t.trim(); })
    .filter(Boolean);

  // マスター外の候補をログに記録するのみ（保存からは除外しない）
  const outsideMaster = candidates.filter(function(t) {
    return masterList.indexOf(t) === -1;
  });
  if (outsideMaster.length) {
    Logger.log('[MASTER外・保存継続] ' + karteId + ' / ' + axisName + ': ' + outsideMaster.join(', '));
  }

  // 観測できた値はすべて保存する（解釈・分類は後段で行う）
  return candidates.join(' / ');
}

// ===== シートへの書き込み =====
function _writeTagRow(sheet, rowNum, idxField, idxTarget, idxActor, idxSearch,
                      fieldVal, targetVal, actorVal, searchVal) {
  sheet.getRange(rowNum, idxField  + 1).setValue(fieldVal);
  sheet.getRange(rowNum, idxTarget + 1).setValue(targetVal);
  sheet.getRange(rowNum, idxActor  + 1).setValue(actorVal);
  sheet.getRange(rowNum, idxSearch + 1).setValue(searchVal);
}