function svgUrl(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// 本棚と暖炉のシルエット。画面下端にごく薄く沈める、部屋の中にいる気配だけの装飾。
const ROOM_SILHOUETTE = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 420 150' preserveAspectRatio='xMidYMax slice'>" +
    "<rect x='0' y='96' width='420' height='5' fill='#EDE6F0' fill-opacity='0.06'/>" +
    "<rect x='18' y='58' width='14' height='38' fill='#EDE6F0' fill-opacity='0.05'/>" +
    "<rect x='36' y='46' width='10' height='50' fill='#EDE6F0' fill-opacity='0.05'/>" +
    "<rect x='50' y='64' width='16' height='32' fill='#EDE6F0' fill-opacity='0.05'/>" +
    "<rect x='70' y='40' width='11' height='56' fill='#EDE6F0' fill-opacity='0.05'/>" +
    "<rect x='85' y='60' width='13' height='36' fill='#EDE6F0' fill-opacity='0.05'/>" +
    "<rect x='102' y='50' width='9' height='46' fill='#EDE6F0' fill-opacity='0.05'/>" +
    "<path d='M300 150 L300 78 Q300 34 340 34 Q380 34 380 78 L380 150 Z M312 150 L312 82 Q312 46 340 46 Q368 46 368 82 L368 150 Z' fill='#EDE6F0' fill-opacity='0.05' fill-rule='evenodd'/>" +
    "</svg>"
);

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
          left: 0,
          right: 0,
          bottom: 0,
          height: 150,
          pointerEvents: "none",
          backgroundImage: ROOM_SILHOUETTE,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "bottom center",
          backgroundSize: "100% 100%",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(72deg, transparent 48%, rgba(230,220,235,0.08) 49%, transparent 50%), linear-gradient(155deg, transparent 62%, rgba(230,220,235,0.06) 63%, transparent 64%), linear-gradient(20deg, transparent 78%, rgba(230,220,235,0.05) 79%, transparent 80%)",
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
