export default function CalendarConnectScreen({ theme, onConnect, onSkip }) {
  const { tokens } = theme;
  return (
    <div style={{ padding: "60px 26px 0", textAlign: "center" }}>
      <div style={{ fontSize: 30, marginBottom: 16 }}>📅</div>
      <h1 style={{ fontFamily: tokens.headingFont, fontSize: 20, fontWeight: 700, color: tokens.ink, margin: "0 0 18px" }}>
        カレンダーと連携しますか？
      </h1>
      <p style={{ fontSize: 13.5, color: tokens.inkSoft, lineHeight: 1.9, margin: "0 0 36px" }}>
        Googleカレンダーの予定を読み込み、
        <br />
        暮らしの記録として一緒に表示します。
        <br />
        あとからいつでも設定できます。
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={onConnect}
          style={{
            width: "100%", background: tokens.ink, color: tokens.paper, border: "none", borderRadius: 14,
            padding: "15px 0", fontSize: 15, fontWeight: 600, cursor: "pointer",
          }}
        >
          Googleカレンダーと連携する
        </button>
        <button
          onClick={onSkip}
          style={{
            width: "100%", background: "none", color: tokens.inkSoft, border: `1px solid ${tokens.line}`,
            borderRadius: 14, padding: "13px 0", fontSize: 14, cursor: "pointer",
          }}
        >
          あとで設定する
        </button>
      </div>
    </div>
  );
}
