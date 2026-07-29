/* 音声入力の共通部分。InputScreen.jsx（Event記録）とShoppingChat.jsx（買い物相談）
   の両方で使う——実装がずれると「片方は動くのにもう片方は動かない」という
   不整合が起きるため、一箇所にまとめる。

   2026-07-29の監査で判明：recognition.onerrorはこれまで握りつぶされ、
   利用者には「聞いています」から静かに元の状態へ戻るだけで、何が起きたのか
   一切伝わっていなかった。権限拒否・マイク無し・ネットワーク不通など、
   実機で起こりうる失敗はすべてこのエラーとして届く。 */

export const SpeechRecognitionApi =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

// event.errorの値ごとに、原因が分かる文言を出し分ける
// （利用者からの指摘：「マイクをクリックするなり『音声を認識できません
// でした』と出る」——コード別に分岐していなかったため、権限拒否も
// マイク未接続もネットワーク不通も同じ曖昧な文言になっていた）
const ERROR_MESSAGES = {
  "not-allowed": "マイクの使用が許可されていません。",
  "service-not-allowed": "マイクの使用が許可されていません。",
  "audio-capture": "マイクが利用できません。",
  network: "音声認識サービスに接続できません。",
  "no-speech": "音声が聞き取れませんでした。もう一度お話しください。",
};

export function describeSpeechError(code) {
  return ERROR_MESSAGES[code] || "音声入力を開始できませんでした。";
}

/* 診断用（2026-07-29追記）：Chromeの「マイク: 許可」表示にも関わらず
   error: "not-allowed"が出るという利用者からの指摘を受けて追加。
   Web Speech APIの権限は、getUserMediaのマイク権限（chrome://settings/
   content/microphoneに出るもの）とは別系統で管理されており、両者は
   必ずしも一致しない——このズレを実際に確認するため、生のevent.errorと
   navigator.permissions.query(microphone)の結果を両方コンソールに残す。
   加えて、原因コードを画面上のメッセージにも(error: xxx)の形で出し、
   DevToolsを開かなくても報告できるようにする。 */
export function logMicPermissionState(label) {
  if (!navigator.permissions?.query) {
    console.log(`[speechRecognition:${label}] navigator.permissions.query未対応`);
    return;
  }
  navigator.permissions
    .query({ name: "microphone" })
    .then((status) => {
      console.log(`[speechRecognition:${label}] navigator.permissions microphone state = "${status.state}"`);
    })
    .catch((err) => {
      console.log(`[speechRecognition:${label}] navigator.permissions.query失敗:`, err);
    });
}

export function handleSpeechError(label, event) {
  console.error(`[speechRecognition:${label}] raw error event.error =`, event?.error, "event.message =", event?.message, event);
  logMicPermissionState(`${label}:onerror`);
  const code = event?.error;
  return `${describeSpeechError(code)}（error: ${code || "unknown"}）`;
}
