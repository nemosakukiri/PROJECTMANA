export default function WelcomeScreen({ theme, onNext }) {
  const { tokens, labels } = theme;
  return (
    <div style={{ padding: "60px 26px 0", textAlign: "center" }}>
      <div style={{ fontSize: 30, marginBottom: 16 }}>{theme.emoji}</div>
      <h1 style={{ fontFamily: "'Shippori Mincho',serif", fontSize: 22, fontWeight: 700, color: tokens.ink, margin: "0 0 18px" }}>
        {labels.welcomeTitle}
      </h1>
      <p style={{ fontSize: 14, color: tokens.inkSoft, lineHeight: 2, margin: "0 0 40px" }}>
        {labels.welcomeBody.map((line, i) => (
          <span key={i}>
            {line}
            {i < labels.welcomeBody.length - 1 && <br />}
          </span>
        ))}
      </p>
      <button
        onClick={onNext}
        style={{
          width: "100%", background: tokens.ink, color: tokens.paper, border: "none", borderRadius: 14,
          padding: "15px 0", fontSize: 15, fontWeight: 600, cursor: "pointer",
        }}
      >
        {labels.welcomeCta}
      </button>
    </div>
  );
}
