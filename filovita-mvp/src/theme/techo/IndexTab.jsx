/* 手帳だけの道具：インデックス。#タグではなく、手帳の見出しインデックスのように見せる */
export default function IndexTab({ children, style }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 12, fontWeight: 600, padding: "3px 10px 3px 8px",
        borderRadius: "3px 10px 10px 3px", borderLeft: "3px solid #3F5C42",
        background: "#E7EEE4", color: "#2E4430",
        ...style,
      }}
    >
      📑 {children}
    </span>
  );
}
