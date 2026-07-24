/* コンポーネントテーマ専用部品：葉の形をしたタグ。イベントのタグ表示に使う。 */
export default function LeafTag({ children, style }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 12px 4px 16px",
        borderRadius: "2px 16px 2px 16px",
        background: "linear-gradient(135deg, #4B7A4F 0%, #2F6B3A 100%)",
        color: "#F2F7EC",
        fontWeight: 600,
        fontSize: 12,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 2px rgba(0,0,0,0.15)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
