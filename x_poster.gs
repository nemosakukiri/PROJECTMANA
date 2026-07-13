// PROJECT MANA — X（旧Twitter）自動投稿
// 思想：観測DB（kansokuDB）から未投稿の記事を1日1件、淡々と投稿する。
// 既存のdoGet・setDailyTriggerには一切触れない（2026-06-24事故の教訓）。

// ===== 初回設定（一度だけ手動実行）=====
// ★ X APIの鍵はここに直接貼らず、GASエディタの「プロジェクトの設定」→
//    「スクリプト プロパティ」画面から1つずつ入力すること。
//    必要なプロパティ名：
//      X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
// この関数はプロパティが揃っているか確認するためだけに使う。
function checkXKeysConfigured() {
  const props = PropertiesService.getScriptProperties();
  const required = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'];
  const missing = required.filter(k => !props.getProperty(k));
  if (missing.length > 0) {
    Logger.log('未設定のプロパティ: ' + missing.join(', '));
  } else {
    Logger.log('X APIの鍵はすべて設定済みです');
  }
}

// ===== 投稿履歴シート =====
const X_POST_LOG_SHEET = 'X投稿履歴';

function getOrCreateXPostLogSheet(ss) {
  let sheet = ss.getSheetByName(X_POST_LOG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(X_POST_LOG_SHEET);
    sheet.appendRow(['投稿日時', 'カルテID', 'URL', 'ツイート本文', 'ツイートID', '結果']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getAlreadyPostedUrls(ss) {
  const sheet = getOrCreateXPostLogSheet(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return new Set();
  const urls = sheet.getRange(2, 3, lastRow - 1, 1).getValues().flat();
  return new Set(urls.filter(u => u));
}

// ===== 投稿対象を1件選ぶ =====
// kansokuDB（公開用の観測DB）から、URL・タイトル・要約が揃っていて
// まだX投稿履歴に無い行を、新しい順に探して1件返す。
function pickUnpostedObservation(ss) {
  const sheet = ss.getSheetByName(PUBLIC_SHEET); // 'kansokuDB'（コード.gsで定義済み）
  if (!sheet) {
    Logger.log('kansokuDBシートが見つかりません');
    return null;
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const map = getColMap(sheet);
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const posted = getAlreadyPostedUrls(ss);

  // 新しい行（下側）から順にチェック
  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    const url = row[map['URL']];
    const title = row[map['タイトル']];
    const summary = row[map['要約']];
    const isOld = row[map['古い記事']];

    if (!url || !title) continue;
    if (posted.has(url)) continue;
    if (isOld === '古い記事候補') continue;

    return {
      date: row[map['日付']],
      source: row[map['出典']],
      field: row[map['分野']],
      title: title,
      summary: summary || '',
      url: url,
      karteId: map['カルテID'] !== undefined ? row[map['カルテID']] : ''
    };
  }
  return null;
}

// ===== 投稿文の組み立て =====
// X の上限280文字。URL分（t.co短縮後23文字換算）を差し引いて本文を組む。
function buildTweetText(item) {
  const URL_RESERVED = 24; // t.co短縮後の見積り＋改行
  const maxBodyLen = 280 - URL_RESERVED - 12; // ラベル分の余裕を確保

  let dateLabel = '';
  if (item.date) {
    const d = new Date(item.date);
    if (!isNaN(d.getTime())) {
      dateLabel = Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy.MM.dd');
    }
  }

  let body = item.summary && item.summary.length > 0 ? item.summary : item.title;
  const header = '【観測記録】' + (dateLabel ? dateLabel + '\n' : '');
  const sourceLine = item.source ? '\n出典：' + item.source : '';

  let available = maxBodyLen - header.length - sourceLine.length;
  if (available < 20) available = 20;
  if (body.length > available) {
    body = body.slice(0, available - 1) + '…';
  }

  return header + body + sourceLine + '\n' + item.url;
}

// ===== OAuth 1.0a 署名（GASにOAuthライブラリが無いため自前実装）=====
function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/[!*'()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function buildOAuth1Header(method, url, extraParams) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('X_API_KEY');
  const apiSecret = props.getProperty('X_API_SECRET');
  const accessToken = props.getProperty('X_ACCESS_TOKEN');
  const accessSecret = props.getProperty('X_ACCESS_TOKEN_SECRET');

  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: Utilities.getUuid().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0'
  };

  const allParams = Object.assign({}, oauthParams, extraParams || {});
  const sortedKeys = Object.keys(allParams).sort();
  const paramString = sortedKeys
    .map(k => percentEncode(k) + '=' + percentEncode(allParams[k]))
    .join('&');

  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString)
  ].join('&');

  const signingKey = percentEncode(apiSecret) + '&' + percentEncode(accessSecret);
  const signatureBytes = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_1, baseString, signingKey
  );
  const signature = Utilities.base64Encode(signatureBytes);

  oauthParams.oauth_signature = signature;

  const headerParams = Object.keys(oauthParams)
    .sort()
    .map(k => percentEncode(k) + '="' + percentEncode(oauthParams[k]) + '"')
    .join(', ');

  return 'OAuth ' + headerParams;
}

// ===== X への投稿本体 =====
function postTweet(text) {
  const url = 'https://api.twitter.com/2/tweets';
  const authHeader = buildOAuth1Header('POST', url, {});

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: authHeader },
    payload: JSON.stringify({ text: text }),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();
  return { code: code, body: body };
}

// ===== メイン：1日1回呼ばれる関数 =====
function postDailyObservationToX() {
  const props = PropertiesService.getScriptProperties();
  const required = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'];
  const missing = required.filter(k => !props.getProperty(k));
  if (missing.length > 0) {
    Logger.log('X投稿スキップ：鍵が未設定 (' + missing.join(', ') + ')');
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const item = pickUnpostedObservation(ss);

  if (!item) {
    Logger.log('X投稿スキップ：未投稿の観測記録が見つかりませんでした');
    return;
  }

  const text = buildTweetText(item);
  const result = postTweet(text);

  const logSheet = getOrCreateXPostLogSheet(ss);
  const now = new Date().toISOString();

  if (result.code === 201) {
    let tweetId = '';
    try {
      tweetId = JSON.parse(result.body).data.id;
    } catch (e) {}
    logSheet.appendRow([now, item.karteId, item.url, text, tweetId, '成功']);
    Logger.log('X投稿成功: ' + item.url);
  } else {
    logSheet.appendRow([now, item.karteId, item.url, text, '', '失敗:' + result.code + ' ' + result.body]);
    Logger.log('X投稿失敗 (' + result.code + '): ' + result.body);
  }
}

// ===== トリガー設定（一度だけ手動実行）=====
// ★ 既存の setDailyTrigger() は変更しない。独立したトリガーとして追加する。
function setXPostTrigger() {
  // このスクリプトが以前に作ったトリガーだけを消す（他の関数のトリガーは残す）
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'postDailyObservationToX') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('postDailyObservationToX')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
  Logger.log('Xの自動投稿トリガーを設定しました（毎日8:00ごろ実行）');
}

// ===== 手動テスト用（1回だけ即実行して結果を見る）=====
function testPostDailyObservationToX() {
  postDailyObservationToX();
}
