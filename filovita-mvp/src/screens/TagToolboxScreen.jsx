import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import ContextHeader from "../components/ContextHeader.jsx";
import { REFERENCE_TYPES, referenceTypeInfo, referenceHref, referenceActionLabel } from "../theme/techo/tagToolbox.js";
import { markTypeInfo } from "../theme/techo/marks.js";

const EMPTY_FORM = { type: "web", label: "", value: "" };

/* 手帳だけの画面：タグの道具箱。開けば、そのタグでいつも使う参照(サイト・地図・
   電話・ファイル・Event)が並ぶ。使うほど参照が増え、自分専用に育っていく。
   さらに、このタグがついた記録の中でマーカーされた一文だけを一覧表示する
   ——「#病院を開くと、重要な一文だけがそこにある」という体験のため。 */
export default function TagToolboxScreen({ theme, tagName, references, events = [], onBack, onAddReference, onUpdateReference, onDeleteReference }) {
  const { tokens } = theme;
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const markedLines = events
    .filter((e) => e.tags?.includes(tagName))
    .flatMap((e) => (e.marks || []).filter((m) => m.type === "marker").map((m) => ({ ...m, dateLabel: e.dateLabel })));

  function startEdit(ref) {
    setEditingId(ref.id);
    setForm({ type: ref.type, label: ref.label, value: ref.value });
    setAdding(false);
  }

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function save() {
    if (!form.label.trim()) return;
    if (editingId) {
      onUpdateReference(editingId, form);
    } else {
      onAddReference(form);
    }
    cancel();
  }

  const formOpen = adding || editingId;

  return (
    <div>
      <ContextHeader theme={theme} breadcrumb="手帳" title={`📑 ${tagName}の道具箱`} onBack={onBack} />
      <div style={{ padding: "10px 20px 0" }}>
        <p style={{ fontSize: 12, color: tokens.inkFaint, marginTop: 0, marginBottom: 18, lineHeight: 1.7 }}>
          このタグを使うたびに、いつもの参照がここに増えていきます。
        </p>

        {markedLines.length > 0 && (
          <>
            <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 8 }}>
              マーカーされた記録
            </div>
            <div style={{ marginBottom: 20 }}>
              {markedLines.map((m) => (
                <div
                  key={m.id}
                  style={{
                    padding: "9px 12px", marginBottom: 6, borderRadius: 8, fontSize: 13.5, color: tokens.ink,
                    ...markTypeInfo(m.type).style,
                  }}
                >
                  {m.text}
                  <span style={{ fontSize: 10.5, color: tokens.inkFaint, marginLeft: 8, fontWeight: 400 }}>{m.dateLabel}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 10 }}>参照</div>
        {references.length === 0 && !formOpen && (
          <p style={{ fontSize: 13, color: tokens.inkFaint, marginBottom: 18 }}>まだ参照はありません。</p>
        )}

        {references.map((ref) => {
          const info = referenceTypeInfo(ref.type);
          const href = referenceHref(ref);
          const actionLabel = referenceActionLabel(ref.type);
          return (
            <div
              key={ref.id}
              style={{
                padding: "11px 13px", marginBottom: 8,
                background: tokens.card, border: `1px solid ${tokens.line}`, borderRadius: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>{info.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: tokens.ink, fontWeight: 600 }}>{ref.label}</div>
                {ref.value && (
                  <div style={{ fontSize: 12, color: tokens.inkFaint, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ref.value}
                  </div>
                )}
              </div>
              <button
                onClick={() => startEdit(ref)}
                style={{ background: "none", border: "none", color: tokens.inkFaint, cursor: "pointer", padding: 4 }}
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => onDeleteReference(ref.id)}
                style={{ background: "none", border: "none", color: tokens.inkFaint, cursor: "pointer", padding: 4 }}
              >
                <Trash2 size={15} />
              </button>
              </div>
              {href && actionLabel && (
                <a
                  href={href}
                  target={ref.type === "phone" ? undefined : "_blank"}
                  rel={ref.type === "phone" ? undefined : "noopener noreferrer"}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    marginTop: 9, padding: "10px 0", borderRadius: 9, textDecoration: "none",
                    background: tokens.accent, color: "#fff", fontSize: 13.5, fontWeight: 700,
                  }}
                >
                  {info.emoji} {actionLabel}
                </a>
              )}
            </div>
          );
        })}

        {formOpen ? (
          <div style={{ padding: 13, marginBottom: 14, background: tokens.card, border: `1px solid ${tokens.line}`, borderRadius: 12 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {REFERENCE_TYPES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => setForm((f) => ({ ...f, type: t.type }))}
                  style={{
                    padding: "6px 10px", fontSize: 12.5, borderRadius: 999, cursor: "pointer",
                    border: `1px solid ${form.type === t.type ? tokens.ink : tokens.line}`,
                    background: form.type === t.type ? tokens.accentBg : "transparent",
                    color: tokens.ink,
                  }}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
            <input
              autoFocus
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="名前（例：京都大学病院）"
              style={{ width: "100%", padding: "9px 11px", fontSize: 14, border: `1px solid ${tokens.line}`, borderRadius: 8, marginBottom: 8, boxSizing: "border-box" }}
            />
            <input
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              placeholder="URL・住所・電話番号など"
              style={{ width: "100%", padding: "9px 11px", fontSize: 14, border: `1px solid ${tokens.line}`, borderRadius: 8, marginBottom: 10, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={save}
                style={{ flex: 1, padding: "9px 0", fontSize: 13.5, borderRadius: 8, border: "none", background: tokens.ink, color: tokens.paper, cursor: "pointer" }}
              >
                {editingId ? "更新する" : "追加する"}
              </button>
              <button
                onClick={cancel}
                style={{ padding: "9px 16px", fontSize: 13.5, borderRadius: 8, border: `1px solid ${tokens.line}`, background: "none", color: tokens.inkSoft, cursor: "pointer" }}
              >
                やめる
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={startAdd}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px dashed ${tokens.line}`,
              borderRadius: 12, padding: "11px 13px", width: "100%", fontSize: 13.5, color: tokens.inkSoft,
              cursor: "pointer", marginBottom: 30,
            }}
          >
            <Plus size={15} /> 参照を追加
          </button>
        )}
      </div>
    </div>
  );
}
