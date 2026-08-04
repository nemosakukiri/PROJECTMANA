import { useState } from "react";
import ContextHeader from "../components/ContextHeader.jsx";
import { GUIDES } from "../theme/guide/guideContent.js";

const NAMING = {
  emoji: "🌱",
  intro: "はじめまして。\n\nこれから、あなたの暮らしのお手伝いをします。\n\n忘れそうなことを整理したり、\nあとで思い出しやすくしたり。\n\n必要なときだけ、そっとお手伝いします。\n\nまずは、お互いの呼び方を決めませんか。\n\nあなたは、私を何と呼びますか？",
  midText: "ありがとうございます。\n\nでは、あなたのことは何とお呼びすればいいですか？",
  footer: "あとから、いつでも変更できます。",
};

const CLOSING = {
  emoji: "🌱",
  text: "これで準備はできました。\n\n分からなくなったら、「はじめてガイド」はいつでももう一度見ることができます。\n\n全部覚えなくても大丈夫。少しずつ、あなたのペースで使ってください。",
  cta: "Filovitaをはじめる",
};

/* 「📖 はじめてガイド」：一度見た案内を、いつでも最初から見返せる場所。
   「もう見た」を理由に消してしまわず、呼べば戻ってくる案内人。
   4つの画面案内のあと、「はじめまして」から始まる呼び名の交換を挟み、
   最後に一度だけ、戻ってこられることを伝える一言を添える。 */
export default function GuideTourScreen({ theme, onBack, companionName, userName, onSaveNames }) {
  const { tokens } = theme;
  const [index, setIndex] = useState(0);
  const [companionInput, setCompanionInput] = useState(companionName ?? "");
  const [userInput, setUserInput] = useState(userName ?? "");
  const isNaming = index === GUIDES.length;
  const isClosing = index === GUIDES.length + 1;
  const guide = isNaming || isClosing ? null : GUIDES[index];

  const inputStyle = {
    width: "100%", padding: "11px 13px", fontSize: 14, borderRadius: 10,
    border: `1px solid ${tokens.line}`, marginTop: 10, marginBottom: 4, boxSizing: "border-box",
    fontFamily: "inherit", textAlign: "center",
  };

  function goNext() {
    if (isNaming) {
      onSaveNames?.(companionInput.trim(), userInput.trim());
      setIndex((i) => i + 1);
    } else if (isClosing) {
      onBack();
    } else {
      setIndex((i) => i + 1);
    }
  }

  function skipNaming() {
    onSaveNames?.("", "");
    setCompanionInput("");
    setUserInput("");
    setIndex((i) => i + 1);
  }

  return (
    <div>
      <ContextHeader theme={theme} breadcrumb="設定" title="はじめてガイド" onBack={onBack} />
      <div style={{ padding: "20px 20px 0", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 18 }}>
          {isNaming ? NAMING.emoji : isClosing ? CLOSING.emoji : guide.emoji}
        </div>

        {isNaming ? (
          <>
            <p style={{ fontSize: 15, color: tokens.ink, lineHeight: 1.9, margin: "0 0 4px", whiteSpace: "pre-line" }}>
              {NAMING.intro}
            </p>
            <input
              type="text" value={companionInput} onChange={(e) => setCompanionInput(e.target.value)}
              placeholder="例：執事、相棒、ネモ…" style={inputStyle}
            />
            <p style={{ fontSize: 15, color: tokens.ink, lineHeight: 1.9, margin: "22px 0 4px", whiteSpace: "pre-line" }}>
              {NAMING.midText}
            </p>
            <input
              type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)}
              placeholder="呼び方を入力（任意）" style={inputStyle}
            />
            <p style={{ fontSize: 12, color: tokens.inkFaint, margin: "16px 0 26px" }}>{NAMING.footer}</p>
          </>
        ) : (
          <p style={{ fontSize: 15, color: tokens.ink, lineHeight: 1.9, margin: "0 0 30px", whiteSpace: "pre-line" }}>
            {isClosing ? CLOSING.text : guide.text}
          </p>
        )}

        {!isNaming && !isClosing && (
          <div style={{ fontSize: 11, color: tokens.inkFaint, marginBottom: 20 }}>
            {index + 1} / {GUIDES.length}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 30, flexWrap: "wrap" }}>
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
          {isNaming && (
            <button
              onClick={skipNaming}
              style={{
                padding: "11px 20px", fontSize: 13.5, borderRadius: 999,
                border: `1px solid ${tokens.line}`, background: "none", color: tokens.inkSoft, cursor: "pointer",
              }}
            >
              あとで決める
            </button>
          )}
          <button
            onClick={goNext}
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
