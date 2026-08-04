/* コンポーネントテーマ専用部品：封蝋。見出し・タグの表示に使う、押印されたような質感のラベル。 */
export default function WaxSeal({ children, style }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 14px",
        borderRadius: "40% 45% 42% 48% / 50% 45% 55% 50%",
        background: "radial-gradient(circle at 35% 30%, #C24B62 0%, #8E1F35 55%, #5F1220 100%)",
        color: "#F3DCE1",
        fontWeight: 700,
        letterSpacing: "0.04em",
        fontSize: 13,
        border: "1px solid #4A0F1B",
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.25), inset 0 -2px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.5)",
        textShadow: "0 1px 1px rgba(0,0,0,0.5)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
