/* コンポーネントテーマ専用部品：リベット。トークンでは表現できない質感（凹凸）を担う。 */
export default function Rivet({ size = 8 }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "radial-gradient(circle at 35% 30%, #D8D8C6, #767666 55%, #302F26 100%)",
        boxShadow: "inset 0 -1px 1px rgba(0,0,0,0.6), 0 1px 1px rgba(255,255,255,0.15)",
      }}
    />
  );
}
