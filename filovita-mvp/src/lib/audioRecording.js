/* 音声入力の共通部分。InputScreen.jsx（Event記録）とShoppingChat.jsx（買い物相談）
   の両方で使う。以前はブラウザ内蔵のSpeechRecognition（webkitSpeechRecognition）
   に頼っていたが、2026-07-30、利用者の実機（iOS Safari）で検証した結果、
   マイク権限・OSのディクテーション設定がどちらも正しく、本物のSafari.appで
   直接開いても"service-not-allowed"が再現し、Apple側でも長年未解決の既知の
   不具合として報告され続けていることを確認した。ブラウザ内蔵の音声認識には
   もう頼らず、MediaRecorderで録音した音声データをサーバーへ送り、AIに
   文字起こしさせる方式に切り替えた（transcribeVoice.js経由）。
   MediaRecorderによる録音自体は標準的なgetUserMedia権限モデルに乗っており、
   iOS Safariを含め広く安定して動く（詳細はMVP_SPEC.md参照）。 */

export const isAudioRecordingSupported =
  typeof window !== "undefined" &&
  typeof window.MediaRecorder !== "undefined" &&
  !!window.navigator?.mediaDevices?.getUserMedia;

// ブラウザによって録音できる形式が異なる（Chrome/Android系はwebm、
// SafariはMP4/AAC系が中心）。対応している中から先頭のものを使う。
const CANDIDATE_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMimeType() {
  if (typeof window.MediaRecorder?.isTypeSupported !== "function") return "";
  return CANDIDATE_MIME_TYPES.find((type) => window.MediaRecorder.isTypeSupported(type)) || "";
}

// getUserMediaの失敗理由ごとに、原因が分かる文言を出し分ける
// （音声認識サービスの権限とは異なり、これはgetUserMediaの標準的な
// マイク権限モデルなので、Chromeの「マイク: 許可」設定と実際に一致する）
export function describeRecordingError(err) {
  const name = err?.name;
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "マイクの使用が許可されていません。ブラウザの設定でマイクへのアクセスを許可してください。";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "マイクが見つかりませんでした。マイクが接続・有効になっているか確認してください。";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "マイクを利用できませんでした。他のアプリがマイクを使用中かもしれません。";
  }
  return "録音を開始できませんでした。「書く」に切り替えてお試しください。";
}

/* 録音を開始する。呼び出し側は返ってきたrecorderをstop()すれば録音が終わり、
   stoppedが録音済みのBlobで解決する。getUserMedia自体が失敗した場合は
   例外を投げるので、呼び出し側でdescribeRecordingErrorに渡して表示する。 */
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  const recorder = new window.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" }));
    };
  });
  recorder.start();
  return { recorder, stopped };
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
