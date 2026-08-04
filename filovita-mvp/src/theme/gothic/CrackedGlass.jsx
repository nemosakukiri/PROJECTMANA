import { rareMoment, traceLayout } from "../worldEngine.js";
import gothicRoomImg from "../../assets/gothic-room.jpg";
import bookmarkImg from "../../assets/gothic-trace-bookmark.png";
import chairImg from "../../assets/gothic-trace-chair.png";
import cupImg from "../../assets/gothic-trace-cup.png";
import doorAjarImg from "../../assets/gothic-door-ajar.png";

/* 恐怖から親しみへ。色味だけが、週を追うごとに冷たさから暖かさへ動いていく。
   部屋そのもの(実写)は変わらない——利用者の受け取り方だけが変わる。 */
const VIGNETTE_TINT = [
  "rgba(70,90,150,0.28)",
  "rgba(120,95,130,0.24)",
  "rgba(181,110,90,0.18)",
  "rgba(214,150,70,0.14)",
  "rgba(232,172,80,0.12)",
];

/* User Traces：記録した日にだけ残る、「この家に住み始めた」痕跡。
   栞・引かれた椅子・置かれたカップ——恐怖の館ではなく、住み始めた館。 */
const TRACE_IMAGES = [bookmarkImg, chairImg, cupImg];

/* コンポーネントテーマ専用部品：ひび割れたガラス。走査線の代わりに画面全体へ重ねる質感。
   中身の情報構造・操作順序には一切手を加えない（見た目だけの重ね掛け）。 */
export default function CrackedGlass({ stage = 2, date, recordedDays = [], children }) {
  const doorAjar = date ? rareMoment(date, "ajarDoor", 0.18) : false;
  const traces = traceLayout(recordedDays, { bottomBase: 8, bottomJitter: 60, leftMargin: 8 });
  const tint = VIGNETTE_TINT[stage] ?? VIGNETTE_TINT[2];
  return (
    <div style={{ position: "relative", overflow: "hidden", minHeight: "100vh" }}>
      <style>{`
        @keyframes gothicAmbient {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
        @keyframes traceGlow {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.8; }
        }
        @keyframes doorPeek {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.75; }
        }
      `}</style>
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage: `url(${gothicRoomImg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      {/* User Traces：住み始めた跡 */}
      {traces.map((t, i) => (
        <img
          key={`trace-${t.day}`}
          src={TRACE_IMAGES[t.day % TRACE_IMAGES.length]}
          alt=""
          style={{
            position: "absolute",
            left: t.left,
            bottom: t.bottom,
            width: 30,
            pointerEvents: "none",
            opacity: 0.7,
            animation: "traceGlow 4.2s ease-in-out infinite",
            animationDelay: `${i * 0.4}s`,
          }}
        />
      ))}
      {/* Rare Moments：いつも閉まっている扉が、その日だけ少し開いている。説明はしない。 */}
      {doorAjar && (
        <img
          src={doorAjarImg}
          alt=""
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 46,
            borderRadius: 4,
            pointerEvents: "none",
            opacity: 0.6,
            animation: "doorPeek 5s ease-in-out infinite",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(72deg, transparent 48%, rgba(230,220,235,0.06) 49%, transparent 50%), linear-gradient(155deg, transparent 62%, rgba(230,220,235,0.05) 63%, transparent 64%), linear-gradient(20deg, transparent 78%, rgba(230,220,235,0.04) 79%, transparent 80%)",
          animation: "gothicAmbient 4.5s ease-in-out infinite",
        }}
      />
      {/* Time Philosophy：恐怖が親しみへ変わっていく色味。部屋そのものは変わらない、感じ方だけが変わる */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          boxShadow: `inset 0 0 110px rgba(0,0,0,0.55), inset 0 0 28px ${tint}`,
          transition: "box-shadow 0.6s ease",
        }}
      />
    </div>
  );
}
