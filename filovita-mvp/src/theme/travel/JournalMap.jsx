import { rareMoment } from "../worldEngine.js";
import { journalTraces } from "./journalLog.js";
import bgImg from "../../assets/travel-journal-bg.jpg";
import flowerIcon from "../../assets/travel-trace-flower.png";
import ticketIcon from "../../assets/travel-trace-ticket.png";
import stampIcon from "../../assets/travel-trace-stamp.png";
import starImg from "../../assets/travel-rare-star.png";

const TRACE_ICONS = [flowerIcon, ticketIcon, stampIcon];

/* コンポーネントテーマ専用部品：旅ノート。中身の情報構造・操作順序には一切手を加えない。
   Time Philosophy：帳面も地図も変わらない。記録した分だけ、しるしが増えていく。
   背景全体に薄いクリーム色のウォッシュを重ね、地図やインクの文字の上でも
   実際のUIの文字(tokens.ink)が無理なく読めるようにする。
   しるしは紙面の余白にだけ、最後まで全部は埋めずに、重ならない固定枠へ置く（journalLog.js参照）。 */
export default function JournalMap({ date, recordedDays = [], children }) {
  const rareFind = date ? rareMoment(date, "travelFind", 0.16) : false;
  const traces = journalTraces(recordedDays);

  return (
    <div style={{ position: "relative", overflow: "hidden", minHeight: "100vh" }}>
      <style>{`
        @keyframes journalTraceGlow {
          0%, 100% { opacity: 0.7; transform: translateY(0); }
          50% { opacity: 0.95; transform: translateY(-2px); }
        }
        @keyframes journalStarTwinkle {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.95; transform: scale(1.08); }
        }
      `}</style>
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage: `url(${bgImg})`,
          backgroundSize: "cover",
          backgroundPosition: "top center",
        }}
      />
      <div
        style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", background: "rgba(250,244,230,0.55)" }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>

      {/* Rare Moments：まれに見つかる特別な発見(流れ星)。説明はしない */}
      {rareFind && (
        <img
          src={starImg}
          alt=""
          style={{
            position: "absolute", top: "8%", right: 24, zIndex: 2, width: 34, opacity: 0.85,
            pointerEvents: "none", animation: "journalStarTwinkle 3.4s ease-in-out infinite",
          }}
        />
      )}

      {/* User Traces：記録した日にだけ増えていく旅のしるし(押し花・チケット・スタンプ) */}
      {traces.map((t, i) => (
        <img
          key={`travel-trace-${t.day}`}
          src={TRACE_ICONS[t.day % TRACE_ICONS.length]}
          alt=""
          style={{
            position: "absolute",
            ...(t.left ? { left: t.left } : { right: t.right }),
            top: t.top, zIndex: 2, width: 30,
            opacity: 0.92, pointerEvents: "none",
            animation: "journalTraceGlow 4.6s ease-in-out infinite", animationDelay: `${i * 0.3}s`,
          }}
        />
      ))}
    </div>
  );
}
