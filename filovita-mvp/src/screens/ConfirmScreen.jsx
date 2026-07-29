import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import ContextHeader from "../components/ContextHeader.jsx";

/* ④確認画面（心臓部） */
export default function ConfirmScreen({ theme, draft, companionName, pendingTag, onBack, onConfirm }) {
  const { tokens, labels } = theme;
  const [conclusion, setConclusion] = useState(draft.conclusion.value);
  // AIが抽出したToDoも、結論と同じく利用者が確認・修正してから保存する
  // （「AIが生成した内容は常に編集可能」——確認をすり抜けさせない）
  const [todos, setTodos] = useState(() => (draft.todos ?? []).map((t) => ({ text: t.text })));
  const [newTodoText, setNewTodoText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  // 呼び名を決めていたら、「AI」「執事」を実際の呼び名に差し替える
  const confirmIntro = companionName
    ? labels.confirmIntro.replace(/^(AIが|AIは|執事が|執事は)/, `${companionName}が`)
    : labels.confirmIntro;

  function updateTodoText(index, text) {
    setTodos((prev) => prev.map((t, i) => (i === index ? { ...t, text } : t)));
  }

  function removeTodo(index) {
    setTodos((prev) => prev.filter((_, i) => i !== index));
  }

  function addTodo() {
    if (!newTodoText.trim()) return;
    setTodos((prev) => [...prev, { text: newTodoText.trim() }]);
    setNewTodoText("");
  }

  return (
    <div>
      <ContextHeader theme={theme} breadcrumb="新しい記録" title="一緒に確認しましょう" onBack={onBack} />
      <div style={{ padding: "6px 20px 0" }}>
        <p style={{ fontSize: 12.5, color: tokens.inkSoft, marginTop: 0 }}>
          {confirmIntro}
        </p>
        {pendingTag && (
          <div
            style={{
              display: "inline-block", fontSize: 11.5, color: tokens.inkSoft, background: tokens.card,
              border: `1px solid ${tokens.line}`, borderRadius: 999, padding: "4px 12px", marginBottom: 16,
            }}
            data-testid="confirm-pending-tag"
          >
            {pendingTag} として記録します
          </div>
        )}
        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 6 }}>{labels.conclusionLabel}</div>
        <textarea
          value={conclusion} onChange={(e) => setConclusion(e.target.value)} rows={3}
          style={{ width: "100%", padding: 10, fontSize: 15, fontFamily: tokens.bodyFont || "inherit", border: `1px solid ${tokens.line}`, borderRadius: 12, marginBottom: 20, boxSizing: "border-box" }}
        />

        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 6 }}>やること</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }} data-testid="confirm-todos">
          {todos.map((todo, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="text" value={todo.text} onChange={(e) => updateTodoText(i, e.target.value)}
                style={{ flex: 1, padding: "8px 10px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit", boxSizing: "border-box" }}
              />
              <button
                onClick={() => removeTodo(i)}
                style={{ background: "none", border: "none", color: tokens.inkFaint, cursor: "pointer", padding: 4, flexShrink: 0 }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text" value={newTodoText} onChange={(e) => setNewTodoText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTodo(); } }}
              placeholder="例：来週までに薬を受け取る"
              style={{ flex: 1, padding: "8px 10px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit", boxSizing: "border-box" }}
            />
            <button
              onClick={addTodo}
              style={{ padding: "8px 14px", fontSize: 12.5, borderRadius: 9, border: "none", background: tokens.ink, color: tokens.paper, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              追加
            </button>
          </div>
        </div>

        {!confirmed ? (
          <button
            onClick={() => setConfirmed(true)}
            style={{ width: "100%", background: tokens.ink, color: tokens.paper, border: "none", borderRadius: 14, padding: "15px 0", fontSize: 15.5, fontWeight: 600, cursor: "pointer" }}
          >
            {labels.confirmCta}
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", background: tokens.accent, color: "#fff", borderRadius: 14, padding: "14px 0", marginBottom: 12 }}>
            <Check size={16} /> {labels.confirmedMessage}
          </div>
        )}
        {confirmed && (
          <button onClick={() => onConfirm(conclusion, todos)} style={{ width: "100%", background: "none", border: `1px solid ${tokens.line}`, color: tokens.inkSoft, borderRadius: 14, padding: "12px 0", fontSize: 13.5, cursor: "pointer", marginBottom: 30 }}>
            {labels.backToCalendarCta}
          </button>
        )}
      </div>
    </div>
  );
}
