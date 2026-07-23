import { rareMoment, traceLayout } from "../worldEngine.js";

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

const WINDOW = "<rect x='150' y='30' width='60' height='70' fill='none' stroke='#8FA5C9' stroke-opacity='0.18' stroke-width='2'/>";

/* Rare Moments：いつも閉まっている扉が、その日だけ少し開いている。それだけ。説明はしない。 */
const AJAR_DOOR =
  "<rect x='230' y='40' width='22' height='60' fill='#EDE6F0' fill-opacity='0.1'/>" +
  "<path d='M252 42 L258 44 L258 96 L252 98 Z' fill='#E8A23A' fill-opacity='0.18'/>";

/* Time Philosophy：ホラーにとって時間が変えるのは部屋の中身ではない。
   この部屋は最初からずっと同じ——変わるのは、利用者がそれをどう感じるか。
   だからここでは、月の日付が進んでも家具は増えない。積み重なるのは色味だけ。 */
function buildRoomSilhouette(doorAjar) {
  return svgUrl(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 420 150' preserveAspectRatio='xMidYMax slice'>" +
      "<rect x='0' y='96' width='420' height='5' fill='#EDE6F0' fill-opacity='0.14'/>" +
      BOOK_SLOTS.join("") +
      FIREPLACE +
      WINDOW +
      (doorAjar ? AJAR_DOOR : "") +
      "</svg>"
  );
}

/* 恐怖から親しみへ。色味だけが、週を追うごとに冷たさから暖かさへ動いていく。 */
const VIGNETTE_TINT = [
  "rgba(70,90,150,0.24)",
  "rgba(120,95,130,0.22)",
  "rgba(181,110,90,0.19)",
  "rgba(214,150,70,0.18)",
  "rgba(232,172,80,0.2)",
];

/* User Traces：記録した日にだけ残る、「この家に住み始めた」痕跡。
   栞・引かれた椅子・置かれたカップ——恐怖の館ではなく、住み始めた館。 */
function traceMark(index) {
  const kind = index % 3;
  if (kind === 0) return { shape: "rect", w: 3, h: 8, r: 1, color: "#B5324A" }; // 栞
  if (kind === 1) return { shape: "rect", w: 8, h: 5, r: 1.5, color: "#8A6E44" }; // 引かれた椅子
  return { shape: "circle", w: 6, h: 6, r: 3, color: "#EDE6F0" }; // カップ
}

/* コンポーネントテーマ専用部品：ひび割れたガラス。走査線の代わりに画面全体へ重ねる質感。
   中身の情報構造・操作順序には一切手を加えない（見た目だけの重ね掛け）。 */
export default function CrackedGlass({ stage = 2, date, recordedDays = [], children }) {
  const doorAjar = date ? rareMoment(date, "ajarDoor", 0.18) : false;
  const traces = traceLayout(recordedDays, { bottomBase: 8, bottomJitter: 10 });
  const tint = VIGNETTE_TINT[stage] ?? VIGNETTE_TINT[2];
  return (
    <div style={{ position: "relative", overflow: "hidden", minHeight: "100vh" }}>
      <style>{`
        @keyframes gothicAmbient {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
        @keyframes hearthGlow {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
        @keyframes traceGlow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.62; }
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
          backgroundImage: buildRoomSilhouette(doorAjar),
          backgroundRepeat: "no-repeat",
          backgroundPosition: "bottom center",
          backgroundSize: "100% 100%",
        }}
      />
      {/* User Traces：住み始めた跡 */}
      {traces.map((t) => {
        const mark = traceMark(t.day);
        return (
          <span
            key={`trace-${t.day}`}
            style={{
              position: "absolute",
              left: t.left,
              bottom: t.bottom,
              width: mark.w,
              height: mark.h,
              borderRadius: mark.shape === "circle" ? "50%" : mark.r,
              background: mark.color,
              opacity: 0.4,
              pointerEvents: "none",
              animation: "traceGlow 4.2s ease-in-out infinite",
            }}
          />
        );
      })}
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
      {/* Time Philosophy：恐怖が親しみへ変わっていく色味。部屋そのものは変わらない、感じ方だけが変わる */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          boxShadow: `inset 0 0 110px rgba(0,0,0,0.7), inset 0 0 28px ${tint}`,
          transition: "box-shadow 0.6s ease",
        }}
      />
    </div>
  );
}
