/* 音声入力の共通部分。InputScreen.jsx（Event記録）とShoppingChat.jsx（買い物相談）
   の両方で使う——実装がずれると「片方は動くのにもう片方は動かない」という
   不整合が起きるため、一箇所にまとめる。

   2026-07-29の監査で判明：recognition.onerrorはこれまで握りつぶされ、
   利用者には「聞いています」から静かに元の状態へ戻るだけで、何が起きたのか
   一切伝わっていなかった。権限拒否・マイク無し・ネットワーク不通など、
   実機で起こりうる失敗はすべてこのエラーとして届く。 */

export const SpeechRecognitionApi =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const ERROR_MESSAGES = {
  "not-allowed": "マイクの使用が許可されていません。ブラウザの設定でマイクへのアクセスを許可してください。",
  "permission-denied": "マイクの使用が許可されていません。ブラウザの設定でマイクへのアクセスを許可してください。",
  "audio-capture": "マイクを認識できませんでした。マイクが接続・有効になっているか確認してください。",
  network: "ネットワークの問題で音声を認識できませんでした。しばらくしてからもう一度お試しください。",
  "no-speech": "音声が聞き取れませんでした。もう一度お試しください。",
  aborted: "音声入力が中断されました。",
};

export function describeSpeechError(code) {
  return ERROR_MESSAGES[code] || "音声を認識できませんでした。「書く」に切り替えてお試しください。";
}
