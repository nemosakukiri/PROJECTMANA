// PROJECT MANA — 観測フィードバック 受信スクリプト
// 目的：MANA自体への運営用フィードバック（カルテ誤り・タグ修正提案・地域補完・関連資料提供・サイト改善提案）
// 注意：これは市民の声（社会観測データ）とは別系統。混在させない。

// ===== 設定 =====
const FEEDBACK_SHEET = '観測フィードバック';

// ===== シート列構成 =====
const FEEDBACK_HEADERS = [
  '受付日時', '種別', '対象カルテID', '対象URL', '内容', '連絡先',
  '対応状況', '対応メモ'
];

// ===== シート取得/作成 =====
function getOrCreateFeedbackSheet(ss) {
  let sheet = ss.getSheetByName(FEEDBACK_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(FEEDBACK_SHEET);
    sheet.appendRow(FEEDBACK_HEADERS);
    sheet.setFrozenRows(1);
    const h = sheet.getRange(1, 1, 1, FEEDBACK_HEADERS.length);
    h.setBackground('#0f0e0d');
    h.setFontColor('#faf9f6');
    h.setFontWeight('bold');
    sheet.setColumnWidth(5, 400); // 内容
    Logger.log('「' + FEEDBACK_SHEET + '」シートを新規作成しました');
  }
  return sheet;
}

// ===== Web App エントリーポイント（POST受信） =====
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return _jsonResponse({ status: 'error', message: 'リクエストボディがありません' });
    }

    const data = JSON.parse(e.postData.contents);

    // ===== 必須項目チェック =====
    const type    = String(data.type    || '').trim();
    const content = String(data.content || '').trim();

    if (!type || !content) {
      Logger.log('[拒否] 必須項目不足: type=' + type + ' content=' + (content ? '(あり)' : '(空)'));
      return _jsonResponse({ status: 'error', message: '種別と内容は必須です' });
    }

    // ===== 保存 =====
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateFeedbackSheet(ss);

    const receivedAt    = new Date().toISOString();
    const targetKarteId = String(data.targetKarteId || '').trim();
    const targetUrl      = String(data.targetUrl     || '').trim();
    const contact         = String(data.contact       || '').trim();

    sheet.appendRow([
      receivedAt,
      type,
      targetKarteId,
      targetUrl,
      content,
      contact,
      '未対応', // 対応状況（初期値）
      '',       // 対応メモ（運営が後から記入）
    ]);

    Logger.log('[保存成功] ' + receivedAt + ' / ' + type + ' / 対象カルテ:' + (targetKarteId || 'なし') + ' / 内容文字数:' + content.length);

    return _jsonResponse({ status: 'ok', message: '送信を受け付けました' });

  } catch (err) {
    Logger.log('[エラー] doPost失敗: ' + err.message);
    return _jsonResponse({ status: 'error', message: 'サーバー側でエラーが発生しました: ' + err.message });
  }
}

// ===== JSON レスポンスのヘルパー =====
function _jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== 動作確認用：GET でアクセスした場合 =====
function doGet(e) {
  return _jsonResponse({ status: 'ok', message: 'PROJECT MANA 観測フィードバック 受信エンドポイントは稼働しています' });
}

// ===== テスト関数：手動でダミーデータを送信して保存できるか確認 =====
function testFeedbackSubmission() {
  const dummyEvent = {
    postData: {
      contents: JSON.stringify({
        type: 'カルテの誤り',
        targetKarteId: 'KARTE-0402',
        targetUrl: '',
        content: 'これはテスト投稿です。地域が空欄になっていたため報告します。',
        contact: '',
        timestamp: new Date().toISOString(),
      })
    }
  };

  Logger.log('===== testFeedbackSubmission 開始 =====');
  const response = doPost(dummyEvent);
  Logger.log('レスポンス: ' + response.getContent());

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(FEEDBACK_SHEET);
  if (sheet) {
    const lastRow = sheet.getLastRow();
    Logger.log('シート最終行: ' + lastRow);
    if (lastRow > 1) {
      const row = sheet.getRange(lastRow, 1, 1, FEEDBACK_HEADERS.length).getValues()[0];
      Logger.log('保存内容確認:');
      FEEDBACK_HEADERS.forEach((h, i) => Logger.log('  ' + h + ': ' + row[i]));
    }
  }
  Logger.log('===== テスト完了 =====');
}

// ===== 必須項目が無い場合に正しく拒否されるかのテスト =====
function testFeedbackSubmissionRejection() {
  const dummyEvent = {
    postData: {
      contents: JSON.stringify({
        type: '', // 必須項目を空にする
        content: '',
      })
    }
  };

  Logger.log('===== testFeedbackSubmissionRejection 開始 =====');
  const response = doPost(dummyEvent);
  Logger.log('レスポンス: ' + response.getContent());
  Logger.log('（status:errorが返れば正常に拒否されています）');
  Logger.log('===== テスト完了 =====');
}
