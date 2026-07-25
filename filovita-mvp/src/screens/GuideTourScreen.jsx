import { useState } from "react";
import ContextHeader from "../components/ContextHeader.jsx";
import { GUIDES } from "../theme/guide/guideContent.js";

const CLOSING = {
  emoji: "🌱",
  text: "これで準備はできました。\n\n分からなくなったら、「はじめてガイド」はいつでももう一度見ることができます。\n\n全部覚えなくても大丈夫。少しずつ、あなたのペースで使ってください。",
  cta: "Filovitaをはじめる",
};

/* 「📖 はじめてガイド」：一度見た案内を、いつでも最初から見返せる場所。
   「もう見た」を理由に消してしまわず、呼べば戻ってくる案内人。
   最後に一度だけ、戻ってこられることを伝える一言を添える。 */
export default function GuideTourScreen({ theme, onBack }) {
  const { tokens } = theme;
  const [index, setIndex] = useState(0);
  const isClosing = index === GUIDES.length;
  const guide = isClosing ? null : GUIDES[index];

  return (
    <div>
      <ContextHeader theme={theme} breadcrumb="設定" title="はじめてガイド" onBack={onBack} />
      <div style={{ padding: "20px 20px 0", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 18 }}>{isClosing ? CLOSING.emoji : guide.emoji}</div>
        <p style={{ fontSize: 15, color: tokens.ink, lineHeight: 1.9, margin: "0 0 30px", whiteSpace: "pre-line" }}>
          {isClosing ? CLOSING.text : guide.text}
        </p>
        {!isClosing && (
          <div style={{ fontSize: 11, color: tokens.inkFaint, marginBottom: 20 }}>
            {index + 1} / {GUIDES.length}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 30 }}>
          {index > 0 && (
            <button
              onClick={() => setIndex((i) => i - 1)}
              style={{
                padding: "11px 20px", fontSize: 13.5, borderRadius: 999,
                border: `1px solid ${tokens.line}`, background: "none", color: tokens.inkSoft, cursor: "pointer",
              }}
            >
              戻る
            </button>
          )}
          <button
            onClick={() => (isClosing ? onBack() : setIndex((i) => i + 1))}
            style={{
              padding: "11px 24px", fontSize: 13.5, borderRadius: 999, border: "none",
              background: tokens.ink, color: tokens.paper, cursor: "pointer",
            }}
          >
            {isClosing ? CLOSING.cta : "次へ"}
          </button>
        </div>
      </div>
    </div>
  );
}
