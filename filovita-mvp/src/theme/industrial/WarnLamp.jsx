/* コンポーネントテーマ専用部品：点滅する警告灯。未処理の案件がある時だけ点灯する。 */
export default function WarnLamp({ active = true, color = "#FFB020" }) {
  return (
    <span style={{ display: "inline-flex" }}>
      <style>{`
        @keyframes warnPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
      <span
        style={{
          display: "inline-block",
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: color,
          boxShadow: active ? `0 0 6px 2px ${color}` : "none",
          opacity: active ? 1 : 0.3,
          animation: active ? "warnPulse 1.3s ease-in-out infinite" : "none",
        }}
      />
    </span>
  );
}
