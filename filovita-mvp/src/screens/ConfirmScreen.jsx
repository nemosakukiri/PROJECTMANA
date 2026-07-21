import { useState } from "react";
import { Check } from "lucide-react";
import { tokens } from "../theme/tokens.js";
import ContextHeader from "../components/ContextHeader.jsx";

/* ④確認画面（心臓部） */
export default function ConfirmScreen({ draft, onBack, onConfirm }) {
  const [conclusion, setConclusion] = useState(draft.conclusion.value);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div>
      <ContextHeader breadcrumb="新しい記録" title="一緒に確認しましょう" onBack={onBack} />
      <div style={{ padding: "6px 20px 0" }}>
        <p style={{ fontSize: 12.5, color: tokens.inkSoft, marginTop: 0 }}>
          AIが下書きを作りました。違うところだけ、教えてください。
        </p>
        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 6 }}>今回の結論</div>
        <textarea
          value={conclusion} onChange={(e) => setConclusion(e.target.value)} rows={3}
          style={{ width: "100%", padding: 10, fontSize: 15, border: `1px solid ${tokens.line}`, borderRadius: 12, marginBottom: 20, boxSizing: "border-box" }}
        />

        {!confirmed ? (
          <button
            onClick={() => setConfirmed(true)}
            style={{ width: "100%", background: tokens.ink, color: tokens.paper, border: "none", borderRadius: 14, padding: "15px 0", fontSize: 15.5, fontWeight: 600, cursor: "pointer" }}
          >
            この内容で確定する
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", background: tokens.moss, color: "#fff", borderRadius: 14, padding: "14px 0", marginBottom: 12 }}>
            <Check size={16} /> これで終わりです、おつかれさまでした
          </div>
        )}
        {confirmed && (
          <button onClick={() => onConfirm(conclusion)} style={{ width: "100%", background: "none", border: `1px solid ${tokens.line}`, color: tokens.inkSoft, borderRadius: 14, padding: "12px 0", fontSize: 13.5, cursor: "pointer", marginBottom: 30 }}>
            カレンダーへ戻る
          </button>
        )}
      </div>
    </div>
  );
}
