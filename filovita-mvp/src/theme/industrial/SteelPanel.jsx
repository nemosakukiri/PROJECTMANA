import Rivet from "./Rivet.jsx";

/* コンポーネントテーマ専用部品：鋼板パネル。四隅にリベットを持つ、凹凸のある質感。
   as で div/button を切り替え、他のpropsはそのまま転送する。 */
export default function SteelPanel({ as: Tag = "div", children, style, ...rest }) {
  return (
    <Tag
      {...rest}
      style={{
        position: "relative",
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "linear-gradient(155deg, #1C231C 0%, #12160F 60%, #0C0F0B 100%)",
        border: "1px solid #33402E",
        borderRadius: 8,
        padding: "14px 16px",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -3px 6px rgba(0,0,0,0.55)",
        fontFamily: "inherit",
        ...style,
      }}
    >
      <span style={{ position: "absolute", top: 6, left: 6 }}><Rivet /></span>
      <span style={{ position: "absolute", top: 6, right: 6 }}><Rivet /></span>
      <span style={{ position: "absolute", bottom: 6, left: 6 }}><Rivet /></span>
      <span style={{ position: "absolute", bottom: 6, right: 6 }}><Rivet /></span>
      {children}
    </Tag>
  );
}
