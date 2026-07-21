import Leaflet from "./Leaflet.jsx";

/* コンポーネントテーマ専用部品：木肌のパネル。角に葉をあしらった、
   まっすぐでない縁取り（生きているものの質感）を持つ。
   as で div/button を切り替え、他のpropsはそのまま転送する。 */
export default function BarkPanel({ as: Tag = "div", children, style, ...rest }) {
  return (
    <Tag
      {...rest}
      style={{
        position: "relative",
        display: "block",
        width: "100%",
        textAlign: "left",
        background:
          "radial-gradient(ellipse at 30% 15%, rgba(143,168,120,0.28), transparent 60%)," +
          "linear-gradient(160deg, #F1F4EA 0%, #E6EDDB 55%, #DCE6D0 100%)",
        border: "1px solid rgba(47,107,58,0.3)",
        borderRadius: "18px 24px 16px 26px",
        padding: "14px 16px",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -3px 6px rgba(47,107,58,0.12)",
        fontFamily: "inherit",
        ...style,
      }}
    >
      <span style={{ position: "absolute", top: -5, left: 12, transform: "rotate(-20deg)" }}>
        <Leaflet />
      </span>
      <span style={{ position: "absolute", bottom: -5, right: 12, transform: "rotate(165deg)" }}>
        <Leaflet />
      </span>
      {children}
    </Tag>
  );
}
