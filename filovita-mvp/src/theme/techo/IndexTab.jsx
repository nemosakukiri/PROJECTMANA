/* 手帳だけの道具：インデックス。#タグではなく、手帳の見出しインデックスのように見せる。
   タップできるようにすると、タグの道具箱(theme/techo/tagToolbox.js)を開く入口になる */
export default function IndexTab({ children, onClick, style }) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 12, fontWeight: 600, padding: "3px 10px 3px 8px",
        borderRadius: "3px 10px 10px 3px", borderLeft: "3px solid #3F5C42",
        background: "#E7EEE4", color: "#2E4430",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      📑 {children}
    </Comp>
  );
}
