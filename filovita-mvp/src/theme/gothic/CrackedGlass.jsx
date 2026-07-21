/* コンポーネントテーマ専用部品：ひび割れたガラス。走査線の代わりに画面全体へ重ねる質感。
   中身の情報構造・操作順序には一切手を加えない（見た目だけの重ね掛け）。 */
export default function CrackedGlass({ children }) {
  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes gothicAmbient {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
      `}</style>
      {children}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: `
            linear-gradient(72deg, transparent 48%, rgba(230,220,235,0.08) 49%, transparent 50%),
            linear-gradient(155deg, transparent 62%, rgba(230,220,235,0.06) 63%, transparent 64%),
            linear-gradient(20deg, transparent 78%, rgba(230,220,235,0.05) 79%, transparent 80%)
          `,
          animation: "gothicAmbient 4.5s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          boxShadow: "inset 0 0 110px rgba(0,0,0,0.7), inset 0 0 28px rgba(181,50,74,0.16)",
        }}
      />
    </div>
  );
}
