/* コンポーネントテーマ専用部品：小さな葉。BarkPanelの角を飾る。 */
export default function Leaflet({ color = "#2F6B3A", style }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 11,
        height: 14,
        background: color,
        opacity: 0.55,
        borderRadius: "0% 100% 0% 100%",
        boxShadow: "inset 1px 1px 2px rgba(255,255,255,0.2)",
        ...style,
      }}
    />
  );
}
