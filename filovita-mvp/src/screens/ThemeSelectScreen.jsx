import { themes } from "../theme/themes.js";

/* テーマ選択：初回起動時に一度選ぶ。あとから設定画面でいつでも変更できる。
   ここで翻訳してよいのは色・語彙・呼びかけだけ。選ぶ操作の構造自体は変えない。 */
export default function ThemeSelectScreen({ themeList, onSelect }) {
  const neutral = themes.techo.tokens;
  return (
    <div style={{ padding: "48px 22px 40px", background: neutral.paper, minHeight: "100vh" }}>
      <div style={{ fontSize: 28, marginBottom: 12, textAlign: "center" }}>🎨</div>
      <h1 style={{ fontFamily: neutral.headingFont, fontSize: 20, fontWeight: 700, color: neutral.ink, margin: "0 0 10px", textAlign: "center" }}>
        暮らしを見るレンズを選びましょう
      </h1>
      <p style={{ fontSize: 13, color: neutral.inkSoft, lineHeight: 1.8, margin: "0 0 26px", textAlign: "center" }}>
        同じ記録でも、見え方や言葉づかいが変わります。
        <br />
        あとからいつでも変更できます。
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {themeList.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            style={{
              display: "flex", alignItems: "center", gap: 14, textAlign: "left",
              padding: "14px 16px", borderRadius: 14, border: `1px solid ${neutral.line}`,
              background: neutral.card, cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: t.tokens.accentBg, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, border: `1px solid ${t.tokens.accent}`,
              }}
            >
              {t.emoji}
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: neutral.ink }}>{t.name}</span>
              <span style={{ display: "block", fontSize: 12, color: neutral.inkFaint, marginTop: 2, lineHeight: 1.5 }}>{t.blurb}</span>
            </span>
            <span
              style={{ width: 14, height: 14, borderRadius: "50%", background: t.tokens.accent, flexShrink: 0 }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
