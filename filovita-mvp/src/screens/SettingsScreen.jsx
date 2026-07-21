import { Check } from "lucide-react";
import { tokens } from "../theme/tokens.js";
import ContextHeader from "../components/ContextHeader.jsx";

const OPTIONS = [
  { id: "speak", emoji: "🎤", label: "話して記録する" },
  { id: "write", emoji: "✍️", label: "書いて記録する" },
  { id: "both", emoji: "🔄", label: "両方使う" },
];

export default function SettingsScreen({ currentMode, onChangeMode, onBack }) {
  return (
    <div>
      <ContextHeader title="設定" onBack={onBack} />
      <div style={{ padding: "10px 20px 0" }}>
        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 10 }}>
          ふだんの入力方法
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              onClick={() => onChangeMode(o.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                padding: "13px 15px", borderRadius: 12, cursor: "pointer",
                border: `1px solid ${currentMode === o.id ? tokens.ink : tokens.line}`,
                background: currentMode === o.id ? tokens.card : "transparent",
              }}
            >
              <span style={{ fontSize: 18 }}>{o.emoji}</span>
              <span style={{ fontSize: 14, color: tokens.ink, flex: 1 }}>{o.label}</span>
              {currentMode === o.id && <Check size={16} color={tokens.moss} />}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 10 }}>
          カレンダー連携
        </div>
        <div style={{ fontSize: 13, color: tokens.inkSoft, padding: "13px 15px", border: `1px solid ${tokens.line}`, borderRadius: 12 }}>
          未連携（後日）
        </div>
      </div>
    </div>
  );
}
