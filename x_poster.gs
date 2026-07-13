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

// ===== 診断用：鍵の値の長さと前後の空白を確認（中身は表示しない）=====
function diagnoseXKeyFormat() {
  const props = PropertiesService.getScriptProperties();
  const names = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'];
  names.forEach(name => {
    const v = props.getProperty(name);
    if (!v) {
      Logger.log(name + ' : 未設定');
      return;
    }
    const trimmed = v.trim();
    Logger.log(
      name + ' : 長さ=' + v.length +
      ' / trim後の長さ=' + trimmed.length +
      ' / 前後に空白あり=' + (v.length !== trimmed.length) +
      ' / ハイフン含む=' + v.includes('-')
    );
  });
}

// ===== 診断用：投稿せずに認証だけテストする（読み取りAPI）=====
function verifyXCredentials() {
  const url = 'https://api.twitter.com/2/users/me';
  const authHeader = buildOAuth1Header('GET', url, {});

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: authHeader },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();
  Logger.log('認証テスト結果 (' + code + '): ' + body);
}

// ===== 診断用：署名アルゴリズム自体のセルフテスト（実際の鍵は使わない）=====
// Twitter公式ドキュメントに載っている既知のサンプル値を使い、
// 自前実装したOAuth1.0a署名計算が正しいかどうかだけを検証する。
// ここが一致すれば「計算ロジックは正しい」→ 問題は鍵側にあると判断できる。
// ここが不一致なら「計算ロジックにバグがある」と確定できる。
function testOAuthSignatureAlgorithm() {
  const method = 'POST';
  const url = 'https://api.twitter.com/1/statuses/update.json';

  // Twitter公式サンプルの固定値（本番の鍵とは無関係）
  const consumerSecret = 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw';
  const tokenSecret = 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE';

  const params = {
    oauth_consumer_key: 'xvz1evFS4wEEPTGEFPHBog',
    oauth_nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: '1318622958',
    oauth_token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
    oauth_version: '1.0',
    status: 'Hello Ladies + Gentlemen, a signed OAuth request!',
    include_entities: 'true'
  };

  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys
    .map(k => percentEncode(k) + '=' + percentEncode(params[k]))
    .join('&');

  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString)
  ].join('&');

  const signingKey = percentEncode(consumerSecret) + '&' + percentEncode(tokenSecret);
  const signatureBytes = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_1, baseString, signingKey
  );
  const signature = Utilities.base64Encode(signatureBytes);

  const expected = 'tnnArxj06cWHq44gCs1OSKk/jLY=';

  Logger.log('計算結果: ' + signature);
  Logger.log('期待値  : ' + expected);
  Logger.log(signature === expected ? '一致：署名アルゴリズムは正しい' : '不一致：署名アルゴリズムにバグがある');
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
function pickUnpostedObservation(ss) {
  const sheet = ss.getSheetByName(PUBLIC_SHEET);
  if (!sheet) {
    Logger.log('kansokuDBシートが見つかりません');
    return null;
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const map = getColMap(sheet);
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const posted = getAlreadyPostedUrls(ss);

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
function buildTweetText(item) {
  const URL_RESERVED = 24;
  const maxBodyLen = 280 - URL_RESERVED - 12;

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
  const apiKey = (props.getProperty('X_API_KEY') || '').trim();
  const apiSecret = (props.getProperty('X_API_SECRET') || '').trim();
  const accessToken = (props.getProperty('X_ACCESS_TOKEN') || '').trim();
  const accessSecret = (props.getProperty('X_ACCESS_TOKEN_SECRET') || '').trim();

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
function setXPostTrigger() {
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
