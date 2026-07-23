import { useState } from "react";
import { Check } from "lucide-react";
import ContextHeader from "../components/ContextHeader.jsx";
import BrassPlate from "../theme/industrial/BrassPlate.jsx";
import WaxSeal from "../theme/gothic/WaxSeal.jsx";
import LeafTag from "../theme/forest/LeafTag.jsx";
import PlannerCheck from "../theme/techo/PlannerCheck.jsx";
import IndexTab from "../theme/techo/IndexTab.jsx";
import StampBadge from "../theme/techo/StampBadge.jsx";
import { STAMP_LABELS } from "../theme/techo/stamps.js";
import { parseJpDateToStr } from "../theme/techo/pageLink.js";

/* ③Eventカルテ */
export default function EventDetailScreen({ theme, event, onBack, onUpdateNote, onToggleTodo, onAddTodo, onToggleTag, onOpenDate, onOpenTagToolbox }) {
  const { tokens, labels } = theme;
  const isIndustrial = theme.componentTheme === "industrial";
  const isGothic = theme.componentTheme === "gothic";
  const isForest = theme.componentTheme === "forest";
  const isTecho = theme.id === "techo";
  const [addingTodo, setAddingTodo] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");

  return (
    <div>
      <ContextHeader theme={theme} breadcrumb={`${event.dateLabel} の記録`} title={event.kind} onBack={onBack} />
      <div style={{ padding: "10px 20px 0" }}>
        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 6 }}>{labels.conclusionLabel}</div>
        <p style={{ fontFamily: tokens.headingFont, fontSize: 17, fontWeight: 700, lineHeight: 1.7, marginTop: 0, color: tokens.ink }}>
          {event.conclusion}
        </p>

        {/* ToDo：常に「＋思い出したことを追加」を出す。reminderが欲しいときの、唯一の正しい入口 */}
        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, margin: "16px 0 8px" }}>{labels.todoSectionLabel}</div>
        {event.todos.map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            {isTecho ? (
              <PlannerCheck done={t.done} onClick={() => onToggleTodo(i)} />
            ) : (
              <button
                onClick={() => onToggleTodo(i)}
                style={{
                  width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${t.done ? tokens.accent : tokens.inkFaint}`,
                  background: t.done ? tokens.accent : "transparent", display: "flex", alignItems: "center",
                  justifyContent: "center", cursor: "pointer", flexShrink: 0,
                }}
              >
                {t.done && <Check size={13} color="#fff" />}
              </button>
            )}
            <span style={{ fontSize: 14, color: tokens.ink, textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.5 : 1 }}>
              {t.text}
            </span>
          </div>
        ))}

        {addingTodo ? (
          <div style={{ display: "flex", gap: 8, marginTop: 4, marginBottom: 6 }}>
            <input
              autoFocus
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTodoText.trim()) {
                  onAddTodo(newTodoText);
                  setNewTodoText("");
                  setAddingTodo(false);
                }
              }}
              placeholder="思い出したこと"
              style={{ flex: 1, padding: "7px 10px", fontSize: 14, border: `1px solid ${tokens.line}`, borderRadius: 8 }}
            />
            <button
              onClick={() => { if (newTodoText.trim()) { onAddTodo(newTodoText); setNewTodoText(""); } setAddingTodo(false); }}
              style={{ padding: "7px 12px", fontSize: 13, borderRadius: 8, border: "none", background: tokens.ink, color: tokens.paper, cursor: "pointer" }}
            >
              追加
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingTodo(true)}
            style={{
              display: "flex", alignItems: "center", gap: 5, background: "none", border: "none",
              padding: "4px 0", marginBottom: 6, fontSize: 13, color: tokens.inkSoft, cursor: "pointer",
            }}
          >
            {labels.addTodoCta}
          </button>
        )}

        {event.nextEvent && (
          <>
            <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, margin: "16px 0 6px" }}>次回予定</div>
            {isTecho ? (
              <button
                onClick={() => { const d = parseJpDateToStr(event.nextEvent); if (d) onOpenDate(d); }}
                style={{
                  display: "block", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer",
                  fontSize: 15, fontFamily: tokens.headingFont, fontWeight: 700, color: tokens.accent,
                }}
              >
                → {event.nextEvent} を見る
              </button>
            ) : (
              <div style={{ fontSize: 15, fontFamily: tokens.headingFont, fontWeight: 700, color: tokens.ink }}>{event.nextEvent}</div>
            )}
          </>
        )}

        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, margin: "16px 0 6px" }}>タグ</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {event.tags.map((t) =>
            isIndustrial ? (
              <BrassPlate key={t} style={{ fontSize: 11, padding: "2px 10px" }}>#{t}</BrassPlate>
            ) : isGothic ? (
              <WaxSeal key={t} style={{ fontSize: 11, padding: "2px 10px" }}>#{t}</WaxSeal>
            ) : isForest ? (
              <LeafTag key={t} style={{ fontSize: 11, padding: "3px 10px 3px 13px" }}>#{t}</LeafTag>
            ) : isTecho ? (
              STAMP_LABELS.includes(t)
                ? <StampBadge key={t} label={t} onClick={() => onToggleTag(t)} />
                : <IndexTab key={t} onClick={() => onOpenTagToolbox(t)}>{t}</IndexTab>
            ) : (
              <span key={t} style={{ fontSize: 12, background: tokens.accentBg, color: tokens.accent, padding: "3px 10px", borderRadius: 999, fontWeight: 600 }}>#{t}</span>
            )
          )}
        </div>

        {/* 手帳だけの道具：スタンプ。押すたびにtagsへ足したり外したりする(データは増やさない) */}
        {isTecho && (
          <>
            <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, margin: "12px 0 6px" }}>スタンプ</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              {STAMP_LABELS.map((label) => (
                <StampBadge
                  key={label} label={label} active={event.tags.includes(label)}
                  onClick={() => onToggleTag(label)}
                />
              ))}
            </div>
          </>
        )}

        {event.related.length > 0 && (
          <>
            <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, margin: "16px 0 6px" }}>関連Event</div>
            {event.related.map((r, i) => {
              const d = parseJpDateToStr(r.date);
              return isTecho ? (
                <button
                  key={i}
                  onClick={() => d && onOpenDate(d)}
                  style={{
                    display: "block", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer",
                    fontSize: 13, color: tokens.accent, fontWeight: 600, marginBottom: 4,
                  }}
                >
                  → {r.date}・{r.label} を見る
                </button>
              ) : (
                <div key={i} style={{ fontSize: 13, color: tokens.inkSoft, marginBottom: 4 }}>
                  {r.date}・{r.label}
                </div>
              );
            })}
          </>
        )}

        {/* 所感：AIは読むが、決定事項・ToDoには昇格させない。「AIに見せない」のではなく「事実にしない」 */}
        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, margin: "16px 0 6px" }}>
          {labels.myNoteLabel}
        </div>
        <textarea
          value={event.myNote}
          onChange={(e) => onUpdateNote(e.target.value)}
          placeholder={labels.myNotePlaceholder}
          rows={3}
          style={{
            width: "100%", border: `1px solid ${tokens.line}`, borderRadius: 12, padding: 12, fontSize: 13.5,
            lineHeight: 1.8, background: tokens.card, color: tokens.ink, resize: "vertical", fontFamily: tokens.bodyFont || "inherit",
          }}
        />
        <p style={{ fontSize: 11, color: tokens.inkFaint, marginTop: 6, marginBottom: 30, lineHeight: 1.7 }}>
          {labels.myNoteHint}
        </p>
      </div>
    </div>
  );
}
