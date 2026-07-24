import { useRef, useState } from "react";
import { MARK_TYPES, markInlineStyle } from "./marks.js";

/* 文章を選択すると、その場に強調の選択肢(🟨✏️⭐❗📌)が浮かぶ。
   選ぶとその一文だけに印がつく。印をタップすると解除できる。 */
function buildSegments(text, marks) {
  let segments = [{ text }];
  for (const mark of marks) {
    const next = [];
    for (const seg of segments) {
      const idx = !seg.mark && seg.text ? seg.text.indexOf(mark.text) : -1;
      if (idx === -1 || !mark.text) { next.push(seg); continue; }
      const before = seg.text.slice(0, idx);
      const after = seg.text.slice(idx + mark.text.length);
      if (before) next.push({ text: before });
      next.push({ text: mark.text, mark });
      if (after) next.push({ text: after });
    }
    segments = next;
  }
  return segments;
}

export default function MarkableText({ text, marks = [], onAddMark, onRemoveMark, style }) {
  const containerRef = useRef(null);
  const [pending, setPending] = useState(null);

  function handleMouseUp() {
    const sel = window.getSelection();
    const selectedText = sel?.toString().trim();
    if (!selectedText || !containerRef.current?.contains(sel.anchorNode)) {
      setPending(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    setPending({
      text: selectedText,
      x: Math.min(Math.max(rect.left - containerRect.left + rect.width / 2, 70), containerRect.width - 70),
      y: rect.top - containerRect.top,
    });
  }

  function applyMark(type) {
    if (pending) onAddMark(type, pending.text);
    setPending(null);
    window.getSelection()?.removeAllRanges();
  }

  const segments = buildSegments(text, marks);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <p style={style} onMouseUp={handleMouseUp} onTouchEnd={handleMouseUp}>
        {segments.map((seg, i) =>
          seg.mark ? (
            <span
              key={i}
              onClick={() => onRemoveMark(seg.mark.id)}
              style={{ cursor: "pointer", borderRadius: 3, ...markInlineStyle(seg.mark.type) }}
              title="タップで強調を解除"
            >
              {seg.text}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </p>
      {pending && (
        <div
          style={{
            position: "absolute", left: pending.x, top: Math.max(pending.y - 46, 0), transform: "translateX(-50%)",
            display: "flex", gap: 3, background: "#fff", border: "1px solid #C9C0A8", borderRadius: 10,
            padding: 6, boxShadow: "0 4px 14px rgba(0,0,0,0.18)", zIndex: 10,
          }}
        >
          {MARK_TYPES.map((m) => (
            <button
              key={m.type}
              onClick={() => applyMark(m.type)}
              title={m.label}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 17, padding: "2px 4px" }}
            >
              {m.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
