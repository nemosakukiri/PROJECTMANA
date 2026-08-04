/* コンポーネントテーマ専用部品：揺れる蝋燭の灯り。未処理のToDoがある時だけ灯る。 */
export default function CandleFlicker({ active = true, color = "#E8A23A" }) {
  return (
    <span style={{ display: "inline-flex" }}>
      <style>{`
        @keyframes candleFlicker {
          0%, 100% { opacity: 1; transform: scale(1); }
          30% { opacity: 0.75; transform: scale(0.92); }
          55% { opacity: 1; transform: scale(1.05); }
          80% { opacity: 0.85; transform: scale(0.97); }
        }
      `}</style>
      <span
        style={{
          display: "inline-block",
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: color,
          boxShadow: active ? `0 0 7px 3px ${color}66, 0 0 3px 1px ${color}` : "none",
          opacity: active ? 1 : 0.3,
          animation: active ? "candleFlicker 1.8s ease-in-out infinite" : "none",
        }}
      />
    </span>
  );
}
