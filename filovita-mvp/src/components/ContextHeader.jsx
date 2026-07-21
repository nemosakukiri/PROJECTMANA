import { ArrowLeft } from "lucide-react";

/* 共通：文脈ヘッダー（今どこにいるかを、常に同じ場所に示す） */
export default function ContextHeader({ tokens, breadcrumb, title, onBack }) {
  return (
    <div style={{ padding: "18px 20px 6px" }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{
            background: "none", border: "none", color: tokens.inkSoft, fontSize: 13,
            cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 5, marginBottom: 14,
          }}
        >
          <ArrowLeft size={16} /> 戻る
        </button>
      )}
      {breadcrumb && (
        <div style={{ fontSize: 11, color: tokens.inkFaint, letterSpacing: "0.04em" }}>{breadcrumb}</div>
      )}
      <h1 style={{ fontFamily: "'Shippori Mincho',serif", fontSize: 19, fontWeight: 700, margin: "4px 0 0", color: tokens.ink }}>
        {title}
      </h1>
    </div>
  );
}
