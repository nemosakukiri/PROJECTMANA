import { Check } from "lucide-react";
import ContextHeader from "../components/ContextHeader.jsx";

const INPUT_OPTIONS = [
  { id: "speak", emoji: "🎤", label: "話して記録する" },
  { id: "write", emoji: "✍️", label: "書いて記録する" },
  { id: "both", emoji: "🔄", label: "両方使う" },
];

export default function SettingsScreen({ theme, themeList, currentMode, onChangeMode, themeId, onChangeTheme, onBack }) {
  const { tokens } = theme;
  return (
    <div>
      <ContextHeader tokens={tokens} title="設定" onBack={onBack} />
      <div style={{ padding: "10px 20px 0" }}>
        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 10 }}>
          暮らしを見るレンズ（テーマ）
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
          {themeList.map((t) => (
            <button
              key={t.id}
              onClick={() => onChangeTheme(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                padding: "13px 15px", borderRadius: 12, cursor: "pointer",
                border: `1px solid ${themeId === t.id ? tokens.ink : tokens.line}`,
                background: themeId === t.id ? tokens.card : "transparent",
              }}
            >
              <span style={{ fontSize: 18 }}>{t.emoji}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 14, color: tokens.ink }}>{t.name}</span>
                <span style={{ display: "block", fontSize: 11, color: tokens.inkFaint, marginTop: 1 }}>{t.blurb}</span>
              </span>
              {themeId === t.id && <Check size={16} color={tokens.accent} />}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 10 }}>
          ふだんの入力方法
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
          {INPUT_OPTIONS.map((o) => (
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
              {currentMode === o.id && <Check size={16} color={tokens.accent} />}
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
