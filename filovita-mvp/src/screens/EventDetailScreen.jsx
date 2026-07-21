import { useState } from "react";
import { Check } from "lucide-react";
import { tokens } from "../theme/tokens.js";
import ContextHeader from "../components/ContextHeader.jsx";

/* ③Eventカルテ */
export default function EventDetailScreen({ event, onBack, onUpdateNote, onToggleTodo, onAddTodo }) {
  const [addingTodo, setAddingTodo] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");

  return (
    <div>
      <ContextHeader breadcrumb={`${event.dateLabel} の記録`} title={event.kind} onBack={onBack} />
      <div style={{ padding: "10px 20px 0" }}>
        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 6 }}>今回の結論</div>
        <p style={{ fontFamily: "'Shippori Mincho',serif", fontSize: 17, fontWeight: 700, lineHeight: 1.7, marginTop: 0, color: tokens.ink }}>
          {event.conclusion}
        </p>

        {/* ToDo：常に「＋思い出したことを追加」を出す。reminderが欲しいときの、唯一の正しい入口 */}
        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, margin: "16px 0 8px" }}>ToDo</div>
        {event.todos.map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <button
              onClick={() => onToggleTodo(i)}
              style={{
                width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${t.done ? tokens.moss : tokens.inkFaint}`,
                background: t.done ? tokens.moss : "transparent", display: "flex", alignItems: "center",
                justifyContent: "center", cursor: "pointer", flexShrink: 0,
              }}
            >
              {t.done && <Check size={13} color="#fff" />}
            </button>
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
            ＋ 思い出したことを追加
          </button>
        )}

        {event.nextEvent && (
          <>
            <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, margin: "16px 0 6px" }}>次回予定</div>
            <div style={{ fontSize: 15, fontFamily: "'Shippori Mincho',serif", fontWeight: 700, color: tokens.ink }}>{event.nextEvent}</div>
          </>
        )}

        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, margin: "16px 0 6px" }}>タグ</div>
        <div style={{ display: "flex", gap: 6 }}>
          {event.tags.map((t) => (
            <span key={t} style={{ fontSize: 12, background: tokens.mossBg, color: tokens.moss, padding: "3px 10px", borderRadius: 999, fontWeight: 600 }}>#{t}</span>
          ))}
        </div>

        {event.related.length > 0 && (
          <>
            <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, margin: "16px 0 6px" }}>関連Event</div>
            {event.related.map((r, i) => (
              <div key={i} style={{ fontSize: 13, color: tokens.inkSoft, marginBottom: 4 }}>
                {r.date}・{r.label}
              </div>
            ))}
          </>
        )}

        {/* 所感：AIは読むが、決定事項・ToDoには昇格させない。「AIに見せない」のではなく「事実にしない」 */}
        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, margin: "16px 0 6px" }}>
          所感
        </div>
        <textarea
          value={event.myNote}
          onChange={(e) => onUpdateNote(e.target.value)}
          placeholder="そのときの気持ちや、まだ確信のない考えを、ここに"
          rows={3}
          style={{
            width: "100%", border: `1px solid ${tokens.line}`, borderRadius: 12, padding: 12, fontSize: 13.5,
            lineHeight: 1.8, background: tokens.card, color: tokens.ink, resize: "vertical", fontFamily: "inherit",
          }}
        />
        <p style={{ fontSize: 11, color: tokens.inkFaint, marginTop: 6, marginBottom: 30, lineHeight: 1.7 }}>
          ここに書いたことは、決定事項やToDoにはしません。あとで「#所感」を開けば、まとめて辿れます。
        </p>
      </div>
    </div>
  );
}
