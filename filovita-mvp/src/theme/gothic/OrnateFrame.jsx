import Flourish from "./Flourish.jsx";

/* コンポーネントテーマ専用部品：装飾枠。四隅に唐草をあしらった二重線の額縁。
   as で div/button を切り替え、他のpropsはそのまま転送する。 */
export default function OrnateFrame({ as: Tag = "div", children, style, ...rest }) {
  return (
    <Tag
      {...rest}
      style={{
        position: "relative",
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "linear-gradient(160deg, #2A2033 0%, #241C2C 55%, #1D1622 100%)",
        border: "1px solid #5A4468",
        borderRadius: 4,
        padding: "16px 18px",
        boxShadow: "inset 0 0 0 3px rgba(0,0,0,0.35), inset 0 0 0 4px rgba(181,50,74,0.18)",
        fontFamily: "inherit",
        ...style,
      }}
    >
      <span style={{ position: "absolute", top: 4, left: 6 }}><Flourish /></span>
      <span style={{ position: "absolute", top: 4, right: 6, transform: "scaleX(-1)" }}><Flourish /></span>
      <span style={{ position: "absolute", bottom: 4, left: 6, transform: "scaleY(-1)" }}><Flourish /></span>
      <span style={{ position: "absolute", bottom: 4, right: 6, transform: "scale(-1,-1)" }}><Flourish /></span>
      {children}
    </Tag>
  );
}
