// PROJECT MANA — 市民の声 受信スクリプト
// 目的：社会観測データの収集（行政窓口での体験・制度運用の実例・当事者の観測）
// 注意：これは観測フィードバック（運営用）とは別系統。混在させない。

// ===== 設定 =====
const VOICE_SHEET = '市民の声';

// ===== シート列構成 =====
// 受付日時・都道府県・窓口の種類・体験の種類・体験の詳細・
// その後の結果・時期・公開可否・構造タグ
const VOICE_HEADERS = [
  '受付日時', '都道府県', '窓口の種類', '体験の種類', '体験の詳細',
  'その後の結果', '時期', '公開可否', '構造タグ'
];

// ===== シート取得/作成 =====
function getOrCreateVoiceSheet(ss) {
  let sheet = ss.getSheetByName(VOICE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(VOICE_SHEET);
    sheet.appendRow(VOICE_HEADERS);
    sheet.setFrozenRows(1);
    const h = sheet.getRange(1, 1, 1, VOICE_HEADERS.length);
    h.setBackground('#0f0e0d');
    h.setFontColor('#faf9f6');
    h.setFontWeight('bold');
    sheet.setColumnWidth(5, 400); // 体験の詳細
    Logger.log('「' + VOICE_SHEET + '」シートを新規作成しました');
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
    const pref   = String(data.pref   || '').trim();
    const detail = String(data.detail || '').trim();

    if (!pref || !detail) {
      Logger.log('[拒否] 必須項目不足: pref=' + pref + ' detail=' + (detail ? '(あり)' : '(空)'));
      return _jsonResponse({ status: 'error', message: '都道府県と体験の詳細は必須です' });
    }

    // ===== 保存 =====
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateVoiceSheet(ss);

    const receivedAt = new Date().toISOString();
    const win    = String(data.window || '').trim();
    const types  = String(data.types  || '').trim();
    const result = String(data.result || '').trim();
    const when   = String(data.when   || '').trim();

    sheet.appendRow([
      receivedAt,
      pref,
      win,
      types,
      detail,
      result,
      when,
      '', // 公開可否（運営が後から判断・記入）
      '', // 構造タグ（運営が後から付与）
    ]);

    Logger.log('[保存成功] ' + receivedAt + ' / ' + pref + ' / ' + win + ' / 詳細文字数:' + detail.length);

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
  return _jsonResponse({ status: 'ok', message: 'PROJECT MANA 市民の声 受信エンドポイントは稼働しています' });
}

// ===== テスト関数：手動でダミーデータを送信して保存できるか確認 =====
function testVoiceSubmission() {
  const dummyEvent = {
    postData: {
      contents: JSON.stringify({
        pref: '京都府',
        window: '生活保護・生活支援',
        types: '申請拒否・妨害、不適切な言動',
        detail: 'これはテスト投稿です。窓口で「まず家族に相談してから」と言われ申請を断られた。',
        result: '未解決',
        when: '2026年6月ごろ',
        timestamp: new Date().toISOString(),
      })
    }
  };

  Logger.log('===== testVoiceSubmission 開始 =====');
  const response = doPost(dummyEvent);
  Logger.log('レスポンス: ' + response.getContent());

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(VOICE_SHEET);
  if (sheet) {
    const lastRow = sheet.getLastRow();
    Logger.log('シート最終行: ' + lastRow);
    if (lastRow > 1) {
      const row = sheet.getRange(lastRow, 1, 1, VOICE_HEADERS.length).getValues()[0];
      Logger.log('保存内容確認:');
      VOICE_HEADERS.forEach((h, i) => Logger.log('  ' + h + ': ' + row[i]));
    }
  }
  Logger.log('===== テスト完了 =====');
}

// ===== 必須項目が無い場合に正しく拒否されるかのテスト =====
function testVoiceSubmissionRejection() {
  const dummyEvent = {
    postData: {
      contents: JSON.stringify({
        pref: '', // 必須項目を空にする
        detail: '',
      })
    }
  };

  Logger.log('===== testVoiceSubmissionRejection 開始 =====');
  const response = doPost(dummyEvent);
  Logger.log('レスポンス: ' + response.getContent());
  Logger.log('（status:errorが返れば正常に拒否されています）');
  Logger.log('===== テスト完了 =====');
}
