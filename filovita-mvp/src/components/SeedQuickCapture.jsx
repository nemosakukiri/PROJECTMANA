import { useState } from "react";

/* 暮らしの種の入力口（v1）。docs/LIFE_MODEL.md「暮らしの種」参照。
   「手帳に『映画』と書く時、人は確認ボタンを押さない」という利用者の
   言葉通り、確認画面は挟まない——Enterまたはボタンで、その場に直接
   保存する。分類は一切させない（内容はtextとして生のまま持つだけ）。
   このアプリには独立した「ホーム画面」が無く、カレンダー画面がその
   役割を兼ねているため、v1の入口はカレンダー画面に置く（本来は
   「決まったことを確認するモード」のカレンダーとは性質が違うため、
   将来的にはButlerとの会話等、複数の入口を横断的に持たせたい——利用者
   からの指摘、まだ未着手）。 */
export default function SeedQuickCapture({ tokens, onAdd }) {
  const [text, setText] = useState("");

  function submit() {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  }

  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        placeholder="この映画見たい、あの店行ってみたい…"
        data-testid="seed-quick-capture-input"
        style={{
          flex: 1, padding: "10px 12px", fontSize: 13, borderRadius: 12,
          border: `1px solid ${tokens.line}`, fontFamily: "inherit", background: tokens.card, color: tokens.ink,
        }}
      />
      <button
        onClick={submit}
        data-testid="seed-quick-capture-submit"
        style={{
          padding: "10px 14px", fontSize: 15, borderRadius: 12, border: "none",
          background: tokens.ink, color: tokens.paper, cursor: "pointer",
        }}
        aria-label="暮らしの種を置く"
      >
        🌱
      </button>
    </div>
  );
}
