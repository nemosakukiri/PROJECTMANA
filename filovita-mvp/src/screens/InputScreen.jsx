import { useState } from "react";
import { tokens } from "../theme/tokens.js";
import ContextHeader from "../components/ContextHeader.jsx";

/* 入力→確認画面（＋ボタンから。共通ナビゲーションの先） */
export default function InputScreen({ mode = "both", onBack, onSubmit }) {
  const [text, setText] = useState("");
  const [activeMode, setActiveMode] = useState(mode === "speak" ? "speak" : "write");

  return (
    <div>
      <ContextHeader breadcrumb="新しい記録" title="何がありましたか" onBack={onBack} />
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
            onClick={() => setActiveMode("write")}
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
              style={{
                width: 84, height: 84, borderRadius: "50%", border: "none", background: tokens.ink,
                color: tokens.paper, fontSize: 28, cursor: "pointer", marginBottom: 18,
              }}
            >
              🎤
            </button>
            <p style={{ fontSize: 13, color: tokens.inkSoft }}>タップして話しはじめる</p>
          </div>
        ) : (
          <>
            <textarea
              autoFocus value={text} onChange={(e) => setText(e.target.value)}
              placeholder="話した内容、決まったことをそのまま書いてください" rows={7}
              style={{ width: "100%", padding: 12, fontSize: 14, lineHeight: 1.8, border: `1px solid ${tokens.line}`, borderRadius: 12, boxSizing: "border-box" }}
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
