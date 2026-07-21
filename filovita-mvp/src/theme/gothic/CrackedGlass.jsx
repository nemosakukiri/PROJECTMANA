function svgUrl(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const BOOK_SLOTS = [
  "<rect x='18' y='58' width='14' height='38' fill='#EDE6F0' fill-opacity='0.12'/>",
  "<rect x='36' y='46' width='10' height='50' fill='#EDE6F0' fill-opacity='0.12'/>",
  "<rect x='50' y='64' width='16' height='32' fill='#EDE6F0' fill-opacity='0.12'/>",
  "<rect x='70' y='40' width='11' height='56' fill='#EDE6F0' fill-opacity='0.12'/>",
  "<rect x='85' y='60' width='13' height='36' fill='#EDE6F0' fill-opacity='0.12'/>",
  "<rect x='102' y='50' width='9' height='46' fill='#EDE6F0' fill-opacity='0.12'/>",
];

const FIREPLACE =
  "<path d='M300 150 L300 78 Q300 34 340 34 Q380 34 380 78 L380 150 Z M312 150 L312 82 Q312 46 340 46 Q368 46 368 82 L368 150 Z' fill='#EDE6F0' fill-opacity='0.12' fill-rule='evenodd'/>";

function rainWindow() {
  const streaks = Array.from({ length: 5 })
    .map((_, i) => `<line x1='${158 + i * 10}' y1='34' x2='${150 + i * 10}' y2='96' stroke='#8FA5C9' stroke-opacity='0.16' stroke-width='1.5'/>`)
    .join("");
  return `<rect x='150' y='30' width='60' height='70' fill='none' stroke='#8FA5C9' stroke-opacity='0.18' stroke-width='2'/>${streaks}`;
}

const HALLWAY_LIGHT = "<path d='M395 150 L410 150 L406 40 L399 40 Z' fill='#E8A23A' fill-opacity='0.14'/>";

/* 屋敷の背景は、月の日付とともに積み重なる小さな物語。
   1〜2日：静かな部屋（本は少なく、暖炉は消えている）
   3〜9日：暖炉に火が灯る
   10〜19日：本棚に本が一冊増える
   20〜29日：窓の外が雨になる
   30〜31日：廊下に明かりが灯る */
function buildRoomSilhouette(stage) {
  const bookCount = Math.min(2 + stage, BOOK_SLOTS.length);
  const books = BOOK_SLOTS.slice(0, bookCount).join("");
  const rain = stage >= 3 ? rainWindow() : "";
  const hallway = stage >= 4 ? HALLWAY_LIGHT : "";

  return svgUrl(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 420 150' preserveAspectRatio='xMidYMax slice'>" +
      "<rect x='0' y='96' width='420' height='5' fill='#EDE6F0' fill-opacity='0.14'/>" +
      books +
      FIREPLACE +
      rain +
      hallway +
      "</svg>"
  );
}

/* コンポーネントテーマ専用部品：ひび割れたガラス。走査線の代わりに画面全体へ重ねる質感。
   中身の情報構造・操作順序には一切手を加えない（見た目だけの重ね掛け）。 */
export default function CrackedGlass({ stage = 2, children }) {
  const fireLit = stage >= 1;
  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes gothicAmbient {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
        @keyframes hearthGlow {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
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
          backgroundImage: buildRoomSilhouette(stage),
          backgroundRepeat: "no-repeat",
          backgroundPosition: "bottom center",
          backgroundSize: "100% 100%",
        }}
      />
      {fireLit && (
        <div
          style={{
            position: "absolute",
            left: "70%",
            bottom: 0,
            width: "18%",
            height: 80,
            pointerEvents: "none",
            background: "radial-gradient(circle at 50% 100%, rgba(232,162,58,0.4), transparent 70%)",
            animation: "hearthGlow 2.2s ease-in-out infinite",
          }}
        />
      )}
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
      {/* 埃っぽい古い窓ガラス越し：画面全体にかかる、むらのある曇り。カレンダーそのものを窓越しに見ているように */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 230px 170px at 18% 22%, rgba(205,195,210,0.12), transparent 65%)," +
            "radial-gradient(ellipse 190px 150px at 82% 68%, rgba(205,195,210,0.10), transparent 65%)," +
            "radial-gradient(ellipse 270px 190px at 58% 12%, rgba(205,195,210,0.08), transparent 70%)",
          animation: "gothicAmbient 5.5s ease-in-out infinite",
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
