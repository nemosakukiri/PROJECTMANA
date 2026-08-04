/* 案内人：ヘルプではなくアシスト。一度だけそっと教え、呼べばいつでも戻ってくる。
   FILOVITA_PHILOSOPHY.md「案内は『ヘルプ』ではなく『案内人』である」の実装。 */
export default function GuideCard({ theme, emoji, text, onDismiss, dismissLabel = "わかった", secondaryAction }) {
  const { tokens } = theme;
  return (
    <div
      style={{
        display: "flex", gap: 10, alignItems: "flex-start", padding: "13px 14px", marginBottom: 14,
        background: tokens.accentBg || tokens.card, border: `1px solid ${tokens.line}`, borderRadius: 14,
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, color: tokens.ink, lineHeight: 1.7, whiteSpace: "pre-line" }}>{text}</p>
        <div style={{ display: "flex", gap: 10, marginTop: 9 }}>
          <button
            onClick={onDismiss}
            style={{
              padding: "6px 14px", fontSize: 12.5, borderRadius: 999, border: "none",
              background: tokens.ink, color: tokens.paper, cursor: "pointer",
            }}
          >
            {dismissLabel}
          </button>
          {secondaryAction}
        </div>
      </div>
    </div>
  );
}
