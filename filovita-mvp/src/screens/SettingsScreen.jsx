import { Check } from "lucide-react";
import ContextHeader from "../components/ContextHeader.jsx";

const INPUT_OPTIONS = [
  { id: "speak", emoji: "🎤", label: "話して記録する" },
  { id: "write", emoji: "✍️", label: "書いて記録する" },
  { id: "both", emoji: "🔄", label: "両方使う" },
];

const STAGE_OPTIONS = [
  { stage: 0, label: "1〜2日目" },
  { stage: 1, label: "3〜9日目" },
  { stage: 2, label: "10〜19日目" },
  { stage: 3, label: "20〜29日目" },
  { stage: 4, label: "30〜31日目" },
];

export default function SettingsScreen({
  theme, themeList, currentMode, onChangeMode, themeId, onChangeTheme,
  stagePreview, onChangeStagePreview, onBack,
}) {
  const { tokens } = theme;
  const GROWTH_THEMES = ["forest", "gothic", "adventure"];
  const hasGrowth = GROWTH_THEMES.includes(theme.componentTheme);
  return (
    <div>
      <ContextHeader theme={theme} title="設定" onBack={onBack} />
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

        {hasGrowth && (
          <>
            <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 10 }}>
              背景の育ちぐあいを試す
            </div>
            <p style={{ fontSize: 11.5, color: tokens.inkFaint, marginTop: 0, marginBottom: 10, lineHeight: 1.6 }}>
              実際の日付は変わりません。見た目だけを、その日の姿で確認できます。
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 26 }}>
              {STAGE_OPTIONS.map((o) => (
                <button
                  key={o.stage}
                  onClick={() => onChangeStagePreview(o.stage)}
                  style={{
                    padding: "7px 12px", fontSize: 12.5, borderRadius: 999, cursor: "pointer",
                    border: `1px solid ${stagePreview === o.stage ? tokens.ink : tokens.line}`,
                    background: stagePreview === o.stage ? tokens.card : "transparent",
                    color: tokens.ink,
                  }}
                >
                  {o.label}
                </button>
              ))}
              <button
                onClick={() => onChangeStagePreview(null)}
                style={{
                  padding: "7px 12px", fontSize: 12.5, borderRadius: 999, cursor: "pointer",
                  border: `1px solid ${stagePreview === null ? tokens.ink : tokens.line}`,
                  background: stagePreview === null ? tokens.card : "transparent",
                  color: tokens.inkSoft,
                }}
              >
                今日に戻す
              </button>
            </div>
          </>
        )}

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
