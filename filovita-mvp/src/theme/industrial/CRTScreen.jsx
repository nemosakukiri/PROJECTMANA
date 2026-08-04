import { rareMoment, livingRatio, traceLayout } from "../worldEngine.js";

const GLITCH_STRINGS = ["UNKNOWN_PROC.exe", "0xFA12::NULL", "??? node lost", "ghost_session_04"];

function glitchText(date) {
  const idx = Number(date.slice(-2)) % GLITCH_STRINGS.length;
  return GLITCH_STRINGS[idx];
}

/* コンポーネントテーマ専用部品：CRT画面。走査線と発光を重ねるが、
   中身の情報構造・操作順序には一切手を加えない（見た目だけの重ね掛け）。
   Time Philosophy：世界は育たず、馴染まず、めくられもしない。ただ稼働し続け、書き換わり続ける。 */
export default function CRTScreen({ date, recordedDays = [], children }) {
  const glitch = date && rareMoment(date, "glitch", 0.16) ? glitchText(date) : null;
  const signalBars = date ? 1 + Math.floor(livingRatio(date, "signal") * 4) : 4;
  const traces = traceLayout(recordedDays, { bottomBase: 10, bottomJitter: 40 });

  return (
    <div style={{ position: "relative", overflow: "hidden", minHeight: "100vh" }}>
      <style>{`
        @keyframes crtFlicker {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 1; }
        }
        @keyframes glitchFlicker {
          0%, 100% { opacity: 0; }
          48% { opacity: 0; }
          50% { opacity: 0.6; }
          52% { opacity: 0; }
          80% { opacity: 0; }
          82% { opacity: 0.5; }
          85% { opacity: 0; }
        }
        @keyframes nodePing {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.3); }
        }
      `}</style>
      {children}
      {/* Rare Moments：ときどき紛れ込む、説明のつかないプロセス名。何もかもは説明しない */}
      {glitch && (
        <span
          style={{
            position: "absolute", top: 10, left: 10, fontFamily: "monospace", fontSize: 10,
            color: "#39FF6A", pointerEvents: "none", animation: "glitchFlicker 6s ease-in-out infinite",
          }}
        >
          {glitch}
        </span>
      )}
      {/* Living Changes：日によってわずかに違う信号強度。世界は常に書き換わっている */}
      <span
        style={{
          position: "absolute", bottom: 10, left: 10, fontFamily: "monospace", fontSize: 9,
          color: "#39FF6A", opacity: 0.55, pointerEvents: "none", letterSpacing: 1,
        }}
      >
        SIG:{"▂▄▆█".slice(0, signalBars)}
      </span>
      {/* User Traces：記録のある日にだけ灯る、接続済みノード */}
      {traces.map((t) => (
        <span
          key={`node-${t.day}`}
          style={{
            position: "absolute", left: t.left, bottom: t.bottom, width: 4, height: 4, borderRadius: "50%",
            background: "#39FF6A", opacity: 0.5, pointerEvents: "none",
            animation: "nodePing 3.6s ease-in-out infinite",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 2px, transparent 3px)",
          mixBlendMode: "multiply",
          animation: "crtFlicker 2.6s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          boxShadow: "inset 0 0 90px rgba(0,0,0,0.65), inset 0 0 24px rgba(57,255,106,0.14)",
        }}
      />
    </div>
  );
}
