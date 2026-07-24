import { useRef, useState } from "react";
import ContextHeader from "../components/ContextHeader.jsx";

const SpeechRecognitionApi =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/* 入力→確認画面（＋ボタンから。共通ナビゲーションの先） */
export default function InputScreen({ theme, mode = "both", onBack, onSubmit }) {
  const { tokens } = theme;
  const [text, setText] = useState("");
  const [activeMode, setActiveMode] = useState(mode === "speak" ? "speak" : "write");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  function startListening() {
    if (!SpeechRecognitionApi) return;
    const recognition = new SpeechRecognitionApi();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (e) => {
      let combined = "";
      for (let i = 0; i < e.results.length; i++) combined += e.results[i][0].transcript;
      setText(combined);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
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
        </div>

        {activeMode === "speak" ? (
          <div style={{ textAlign: "center", padding: "20px 0 30px" }}>
            <button
              onClick={() => (listening ? stopListening() : startListening())}
              disabled={!SpeechRecognitionApi}
              style={{
                width: 84, height: 84, borderRadius: "50%", border: "none",
                background: !SpeechRecognitionApi ? tokens.line : listening ? tokens.accent : tokens.ink,
                color: tokens.paper, fontSize: 28, cursor: SpeechRecognitionApi ? "pointer" : "default",
                marginBottom: 18, animation: listening ? "micPulse 1.3s ease-out infinite" : "none",
              }}
            >
              🎤
            </button>
            <p style={{ fontSize: 13, color: tokens.inkSoft }}>
              {!SpeechRecognitionApi
                ? "このブラウザは音声入力に対応していません。「✍️ 書く」に切り替えてください"
                : listening
                  ? "聞いています。もう一度タップで終わります"
                  : text
                    ? "続けて話す場合はもう一度タップしてください"
                    : "タップして話しはじめる"}
            </p>
            {text && (
              <p style={{
                textAlign: "left", fontSize: 14, color: tokens.ink, lineHeight: 1.8,
                background: tokens.card, border: `1px solid ${tokens.line}`, borderRadius: 12,
                padding: 12, marginTop: 14, fontFamily: tokens.bodyFont || "inherit",
              }}>
                {text}
              </p>
            )}
            {text.trim() && !listening && (
              <button
                onClick={() => onSubmit(text)}
                style={{
                  marginTop: 12, width: "100%", padding: "13px 0", fontSize: 15, borderRadius: 12,
                  border: "none", background: tokens.ink, color: tokens.paper, cursor: "pointer",
                }}
              >
                次へ
              </button>
            )}
          </div>
        ) : (
          <>
            <textarea
              autoFocus value={text} onChange={(e) => setText(e.target.value)}
              placeholder="話した内容、決まったことをそのまま書いてください" rows={7}
              style={{ width: "100%", padding: 12, fontSize: 14, lineHeight: 1.8, fontFamily: tokens.bodyFont || "inherit", border: `1px solid ${tokens.line}`, borderRadius: 12, boxSizing: "border-box" }}
            />
            <button
              onClick={() => text.trim() && onSubmit(text)}
              disabled={!text.trim()}
              style={{
                marginTop: 12, width: "100%", padding: "13px 0", fontSize: 15, borderRadius: 12, border: "none",
                background: text.trim() ? tokens.ink : tokens.line, color: tokens.paper, cursor: text.trim() ? "pointer" : "default",
              }}
            >
              次へ
            </button>
          </>
        )}
      </div>
    </div>
  );
}
