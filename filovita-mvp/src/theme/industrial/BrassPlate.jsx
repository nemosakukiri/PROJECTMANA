/* コンポーネントテーマ専用部品：真鍮プレート。見出し・タグの表示に使う金属質のラベル。 */
export default function BrassPlate({ children, style }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 14px",
        borderRadius: 4,
        background: "linear-gradient(180deg, #EAC97E 0%, #B8892E 45%, #7A5A1D 100%)",
        color: "#2B1D06",
        fontWeight: 700,
        letterSpacing: "0.06em",
        fontSize: 13,
        border: "1px solid #6B4E17",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 2px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.5)",
        textShadow: "0 1px 0 rgba(255,255,255,0.3)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
