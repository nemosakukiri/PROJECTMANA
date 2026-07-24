/* コンポーネントテーマ専用部品：唐草の装飾。OrnateFrameの四隅を飾る。 */
export default function Flourish({ color = "#8F7F99" }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        fontSize: 15,
        color,
        textShadow: "0 1px 1px rgba(0,0,0,0.4)",
        lineHeight: 1,
      }}
    >
      ❧
    </span>
  );
}
