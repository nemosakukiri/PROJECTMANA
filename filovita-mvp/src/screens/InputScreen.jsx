import { useRef, useState } from "react";
import ContextHeader from "../components/ContextHeader.jsx";
import GuideCard from "../components/GuideCard.jsx";
import GuideHelpButton from "../components/GuideHelpButton.jsx";
import { guideById } from "../theme/guide/guideContent.js";
import { isAudioRecordingSupported, startRecording, blobToBase64, describeRecordingError } from "../lib/audioRecording.js";
import { transcribeVoice } from "../lib/transcribeVoice.js";

/* 入力→確認画面（＋ボタンから。共通ナビゲーションの先）
   話す/書くに加え、写真（生活資料ライブラリ、MVP_SPEC.md参照）を追加。
   写真は「入力にない事実を作れない」ため、話す/書くのようなその場の
   フォールバックは無く、失敗時は正直にエラーを表示する。

   「話す」は、ブラウザ内蔵の音声認識（SpeechRecognition）ではなく、
   録音してサーバー側で文字起こしする方式（2026-07-30切り替え、
   audioRecording.js参照）。録音した内容はそのままtextに入り、写真同様
   利用者が読み返してから「次へ」を押す——結果を勝手に確定しない。 */
export default function InputScreen({
  theme, mode = "both", onBack, onSubmit, onSubmitPhoto, isDrafting = false, draftError = null,
  seenGuides = {}, onDismissGuide,
}) {
  const { tokens } = theme;
  const [text, setText] = useState("");
  const [activeMode, setActiveMode] = useState(mode === "speak" ? "speak" : "write");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [guideOpen, setGuideOpen] = useState(!seenGuides.input);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [photoMimeType, setPhotoMimeType] = useState(null);
  const recorderRef = useRef(null);
  const guide = guideById("input");

  async function handleStartRecording() {
    if (!isAudioRecordingSupported) return;
    setVoiceError(null);
    try {
      const { recorder, stopped } = await startRecording();
      recorderRef.current = recorder;
      setRecording(true);
      const blob = await stopped;
      setTranscribing(true);
      const base64 = await blobToBase64(blob);
      const result = await transcribeVoice({ base64, mimeType: blob.type });
      setTranscribing(false);
      if (result.error) {
        setVoiceError(result.error);
        return;
      }
      setText((prev) => (prev.trim() ? `${prev} ${result.transcript}` : result.transcript));
    } catch (err) {
      setRecording(false);
      setVoiceError(describeRecordingError(err));
    }
  }

  function handleStopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function stopListening() {
    if (recording) handleStopRecording();
  }

  function handlePhotoSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const commaIndex = dataUrl.indexOf(",");
      setPhotoPreview(dataUrl);
      setPhotoBase64(dataUrl.slice(commaIndex + 1));
      setPhotoMimeType(file.type || "image/jpeg");
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <style>{`
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,0,0,0.25); }
          50% { box-shadow: 0 0 0 14px rgba(0,0,0,0); }
        }
      `}</style>
      <ContextHeader theme={theme} breadcrumb="新しい記録" title="何がありましたか" onBack={onBack} />
      <div style={{ padding: "10px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <GuideHelpButton theme={theme} onClick={() => setGuideOpen(true)} />
        </div>
        {guideOpen && (
          <GuideCard
            theme={theme}
            emoji={guide.emoji}
            text={guide.text}
            onDismiss={() => { setGuideOpen(false); onDismissGuide?.("input"); }}
          />
        )}
        {/* その場での切り替え。初回に決めた既定値はあくまで初期値で、毎回選び直せる */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <button
            onClick={() => setActiveMode("speak")}
            style={{
              flex: 1, padding: "8px 0", fontSize: 12.5, borderRadius: 999, cursor: "pointer",
              border: `1px solid ${activeMode === "speak" ? tokens.ink : tokens.line}`,
              background: activeMode === "speak" ? tokens.ink : "transparent",
              color: activeMode === "speak" ? tokens.paper : tokens.inkSoft,
            }}
          >
            🎤 話す
          </button>
          <button
            onClick={() => { stopListening(); setActiveMode("write"); }}
            style={{
              flex: 1, padding: "8px 0", fontSize: 12.5, borderRadius: 999, cursor: "pointer",
              border: `1px solid ${activeMode === "write" ? tokens.ink : tokens.line}`,
              background: activeMode === "write" ? tokens.ink : "transparent",
              color: activeMode === "write" ? tokens.paper : tokens.inkSoft,
            }}
          >
            ✍️ 書く
          </button>
          <button
            onClick={() => { stopListening(); setActiveMode("photo"); }}
            style={{
              flex: 1, padding: "8px 0", fontSize: 12.5, borderRadius: 999, cursor: "pointer",
              border: `1px solid ${activeMode === "photo" ? tokens.ink : tokens.line}`,
              background: activeMode === "photo" ? tokens.ink : "transparent",
              color: activeMode === "photo" ? tokens.paper : tokens.inkSoft,
            }}
          >
            📷 資料
          </button>
        </div>

        {activeMode === "speak" && (
          <div style={{ textAlign: "center", padding: "20px 0 30px" }}>
            <button
              onClick={() => (recording ? handleStopRecording() : handleStartRecording())}
              disabled={!isAudioRecordingSupported || transcribing}
              style={{
                width: 84, height: 84, borderRadius: "50%", border: "none",
                background: !isAudioRecordingSupported ? tokens.line : recording ? tokens.accent : tokens.ink,
                color: tokens.paper, fontSize: 28,
                cursor: isAudioRecordingSupported && !transcribing ? "pointer" : "default",
                marginBottom: 18, animation: recording ? "micPulse 1.3s ease-out infinite" : "none",
                opacity: transcribing ? 0.6 : 1,
              }}
            >
              🎤
            </button>
            <p style={{ fontSize: 13, color: tokens.inkSoft }}>
              {!isAudioRecordingSupported
                ? "この端末では音声入力に対応していません。「✍️ 書く」に切り替えてください"
                : transcribing
                  ? "バトラーが聞き取っています…"
                  : recording
                    ? "録音しています。もう一度タップで終わります"
                    : text
                      ? "続けて話す場合はもう一度タップしてください"
                      : "タップして話しはじめる"}
            </p>
            {voiceError && (
              <p style={{ fontSize: 12.5, color: "#a3432a", marginTop: 8 }} data-testid="input-voice-error">
                {voiceError}
              </p>
            )}
            {text && (
              <p style={{
                textAlign: "left", fontSize: 14, color: tokens.ink, lineHeight: 1.8,
                background: tokens.card, border: `1px solid ${tokens.line}`, borderRadius: 12,
                padding: 12, marginTop: 14, fontFamily: tokens.bodyFont || "inherit",
              }}>
                {text}
              </p>
            )}
            {text.trim() && !recording && !transcribing && (
              <button
                onClick={() => !isDrafting && onSubmit(text)}
                disabled={isDrafting}
                style={{
                  marginTop: 12, width: "100%", padding: "13px 0", fontSize: 15, borderRadius: 12,
                  border: "none", background: tokens.ink, color: tokens.paper,
                  cursor: isDrafting ? "default" : "pointer", opacity: isDrafting ? 0.6 : 1,
                }}
              >
                {isDrafting ? "バトラーが読み取っています…" : "次へ"}
              </button>
            )}
          </div>
        )}

        {activeMode === "write" && (
          <>
            <textarea
              autoFocus value={text} onChange={(e) => setText(e.target.value)}
              placeholder="話した内容、決まったことをそのまま書いてください" rows={7}
              style={{ width: "100%", padding: 12, fontSize: 14, lineHeight: 1.8, fontFamily: tokens.bodyFont || "inherit", border: `1px solid ${tokens.line}`, borderRadius: 12, boxSizing: "border-box" }}
            />
            <button
              onClick={() => text.trim() && !isDrafting && onSubmit(text)}
              disabled={!text.trim() || isDrafting}
              style={{
                marginTop: 12, width: "100%", padding: "13px 0", fontSize: 15, borderRadius: 12, border: "none",
                background: text.trim() ? tokens.ink : tokens.line, color: tokens.paper,
                cursor: text.trim() && !isDrafting ? "pointer" : "default", opacity: isDrafting ? 0.6 : 1,
              }}
            >
              {isDrafting ? "バトラーが読み取っています…" : "次へ"}
            </button>
          </>
        )}

        {activeMode === "photo" && (
          <div style={{ textAlign: "center", padding: "10px 0 30px" }}>
            <p style={{ fontSize: 12.5, color: tokens.inkSoft, marginTop: 0, textAlign: "left", lineHeight: 1.7 }}>
              レシート・CWからのお知らせ・支援記録・病院の説明書・手書きのメモなど、
              生活資料を撮影するとバトラーが読み取ります。
            </p>
            <input
              type="file" accept="image/*" capture="environment"
              onChange={handlePhotoSelected} id="input-photo-file"
              style={{ display: "none" }}
            />
            <label
              htmlFor="input-photo-file"
              style={{
                display: "inline-block", padding: "14px 22px", borderRadius: 12,
                border: `1.5px dashed ${tokens.line}`, cursor: "pointer", fontSize: 13, color: tokens.inkSoft,
              }}
            >
              📷 資料を撮影・選択する
            </label>
            {photoPreview && (
              <div style={{ marginTop: 14 }}>
                <img
                  src={photoPreview} alt=""
                  style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 12, border: `1px solid ${tokens.line}` }}
                />
              </div>
            )}
            {draftError && (
              <p style={{ fontSize: 12, color: "#a3432a", marginTop: 12 }} data-testid="photo-draft-error">
                {draftError}
              </p>
            )}
            {photoBase64 && (
              <button
                onClick={() => !isDrafting && onSubmitPhoto(photoBase64, photoMimeType)}
                disabled={isDrafting}
                style={{
                  marginTop: 14, width: "100%", padding: "13px 0", fontSize: 15, borderRadius: 12,
                  border: "none", background: tokens.ink, color: tokens.paper,
                  cursor: isDrafting ? "default" : "pointer", opacity: isDrafting ? 0.6 : 1,
                }}
              >
                {isDrafting ? "バトラーが読み取っています…" : "この資料を読み取る"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
