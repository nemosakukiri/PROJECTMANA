import { rareMoment, traceLayout } from "../worldEngine.js";
import { OBSERVATION_LOGS } from "./systemLog.js";
import sceneImg from "../../assets/sf-scene.jpg";
import planetIcon from "../../assets/sf-trace-planet.png";
import dishIcon from "../../assets/sf-trace-dish.png";
import ufoImg from "../../assets/sf-ufo.png";

const TRACE_ICONS = [planetIcon, dishIcon];

/* コンポーネントテーマ専用部品：観測窓。中身の情報構造・操作順序には一切手を加えない。
   Time Philosophy：目的地までの距離が縮まっていく（見出し下のキャプションで表現）。
   写真自体にDESTINATION/SYSTEM STATUSパネルが写り込んでいるため、
   重複するHUDをここで重ねて置くことはしない——traces・rare momentだけを足す。 */
export default function StarWindow({ stage = 2, date, recordedDays = [], children }) {
  const ufoSighting = date ? rareMoment(date, "ufo", 0.15) : false;
  const traces = traceLayout(recordedDays, { bottomBase: 10, bottomJitter: 70, leftMargin: 8 });

  return (
    <div style={{ position: "relative", overflow: "hidden", minHeight: "100vh" }}>
      <style>{`
        @keyframes sfTraceGlow {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.85; }
        }
        @keyframes ufoDrift {
          0%, 100% { opacity: 0.6; transform: translateX(0); }
          50% { opacity: 0.85; transform: translateX(6px); }
        }
      `}</style>
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage: `url(${sceneImg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div
        style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", background: "rgba(6,12,24,0.38)" }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>

      {/* Rare Moments：まれに映り込む、素性の分からない飛行体。説明はしない */}
      {ufoSighting && (
        <img
          src={ufoImg}
          alt=""
          style={{
            position: "absolute", top: "30%", right: 20, zIndex: 2, width: 60, opacity: 0.75,
            pointerEvents: "none", animation: "ufoDrift 6s ease-in-out infinite",
          }}
        />
      )}

      {/* User Traces：記録した日にだけ残る観測ログ */}
      {traces.map((t, i) => (
        <div
          key={`trace-${t.day}`}
          style={{
            position: "absolute", left: t.left, bottom: t.bottom, zIndex: 2, pointerEvents: "none",
            display: "flex", alignItems: "center", gap: 4,
            animation: "sfTraceGlow 4.4s ease-in-out infinite", animationDelay: `${i * 0.3}s`,
          }}
        >
          <img src={TRACE_ICONS[t.day % TRACE_ICONS.length]} alt="" style={{ width: 16, opacity: 0.85 }} />
          <span style={{ fontFamily: "monospace", fontSize: 7.5, color: "#9FE3EE", opacity: 0.75, whiteSpace: "nowrap" }}>
            {OBSERVATION_LOGS[t.day % OBSERVATION_LOGS.length]}
          </span>
        </div>
      ))}
    </div>
  );
}
