const OPTIONS = [
  { id: "speak", emoji: "🎤", label: "話して記録する" },
  { id: "write", emoji: "✍️", label: "書いて記録する" },
  { id: "both", emoji: "🔄", label: "両方使う" },
];

export default function InputModeScreen({ theme, onSelect }) {
  const { tokens } = theme;
  return (
    <div style={{ padding: "60px 26px 0", textAlign: "center" }}>
      <div style={{ fontSize: 30, marginBottom: 16 }}>💬</div>
      <h1 style={{ fontFamily: "'Shippori Mincho',serif", fontSize: 20, fontWeight: 700, color: tokens.ink, margin: "0 0 18px" }}>
        ふだん、どちらで残しますか
      </h1>
      <p style={{ fontSize: 13.5, color: tokens.inkSoft, lineHeight: 1.9, margin: "0 0 30px" }}>
        話すか、書くか。これだけは最初に決めておくと、
        <br />
        次から迷わず記録をはじめられます。
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => onSelect(o.id)}
            style={{
              display: "flex", alignItems: "center", gap: 12, textAlign: "left",
              padding: "14px 16px", borderRadius: 14, border: `1px solid ${tokens.line}`,
              background: tokens.card, cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 20 }}>{o.emoji}</span>
            <span style={{ fontSize: 14.5, color: tokens.ink }}>{o.label}</span>
          </button>
        ))}
      </div>
      <p style={{ fontSize: 11, color: tokens.inkFaint, marginTop: 16 }}>あとから変更できます</p>
    </div>
  );
}
