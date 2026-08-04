import { STAMP_EMOJI } from "./stamps.js";

/* 手帳だけの道具：スタンプ。押した/押していないの2状態を持つボタンにも、
   すでに押されたタグの表示にも、同じ見た目を使う。 */
export default function StampBadge({ label, active = true, onClick, style }) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 700, fontSize: 12,
        padding: "4px 11px 4px 8px", borderRadius: 999,
        border: `2px solid ${active ? "#B23B3B" : "#C9C0A8"}`,
        color: active ? "#B23B3B" : "#9A947F",
        background: active ? "rgba(178,59,59,0.07)" : "transparent",
        transform: active ? "rotate(-2deg)" : "none",
        cursor: onClick ? "pointer" : "default",
        opacity: active ? 1 : 0.55,
        ...style,
      }}
    >
      <span style={{ fontSize: 12 }}>{STAMP_EMOJI[label] ?? "🔖"}</span>
      {label}
    </Comp>
  );
}
