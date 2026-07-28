import { useState } from "react";
import { Check } from "lucide-react";
import ContextHeader from "../components/ContextHeader.jsx";
import { computeShoppingJudgment, computeFinalVerdict } from "../lib/shoppingJudgment.js";

const JUDGMENT_EMOJI = { empty: "🛒", ok: "🙂", tight: "🤔", over: "😟" };
const VERDICT_EMOJI = { empty: "🛒", go: "✅", remove: "🤔", skip: "😟" };
const SECTION_LABEL = { usual: "いつもの買い物", add: "今回追加" };
const SECTION_EMOJI = { usual: "🛒", add: "⭐" };

function ListRow({ tokens, item, onToggle }) {
  return (
    <button
      onClick={() => onToggle(item.id)}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
        padding: "10px 12px", borderRadius: 10, border: `1px solid ${tokens.line}`, cursor: "pointer",
        background: item.checked ? "transparent" : (tokens.accentBg || "transparent"), marginBottom: 6,
      }}
    >
      <span
        style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
          border: `1.5px solid ${item.checked ? tokens.ink : tokens.line}`,
          background: item.checked ? tokens.ink : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {item.checked && <Check size={13} color={tokens.paper} />}
      </span>
      <span style={{ flex: 1, fontSize: 14, color: item.checked ? tokens.ink : tokens.inkFaint, textDecoration: item.checked ? "none" : "line-through" }}>
        {item.name}
      </span>
      <span style={{ fontSize: 12.5, color: tokens.inkFaint }}>¥{Number(item.amount).toLocaleString()}</span>
    </button>
  );
}

/* 買い物リスト：スーパーに着いたら、バトラーはもう相談相手ではなく
   秘書としてリストを渡す。チェックを外すだけで「見送り」を表現し、
   店頭でのひらめきの追加にもその場で見立てを返す(考える→買う、が
   地続きにつながる)。MVP_SPEC.md「複数周期の統合判断」参照。 */
export default function ShoppingListScreen({
  theme, companionName, budget, balance,
  items, onToggleItem, onAddItem, onBack,
}) {
  const { tokens } = theme;
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const speaker = companionName || "バトラー";

  const checkedUsual = items.filter((i) => i.section === "usual" && i.checked);
  const checkedAdd = items.filter((i) => i.section === "add" && i.checked);
  const result = computeShoppingJudgment({ budget, balance, recurringItems: checkedUsual, itemsToAdd: checkedAdd });
  const finalVerdict = computeFinalVerdict({ budget, balance, recurringItems: checkedUsual, itemsToAdd: checkedAdd });

  function submit() {
    if (!name.trim() || !amount) return;
    onAddItem({ name: name.trim(), amount: Number(amount) });
    setName("");
    setAmount("");
  }

  return (
    <div>
      <ContextHeader theme={theme} breadcrumb="暮らし" title="今日の買い物" onBack={onBack} />
      <div style={{ padding: "6px 20px 40px" }}>
        <p style={{ fontSize: 12.5, color: tokens.inkFaint, marginTop: 0, marginBottom: 20, lineHeight: 1.7 }}>
          お店ではこれだけ見れば大丈夫です。無かったらチェックを外し、
          その場でひらめいたものは下から追加できます。
        </p>

        {["usual", "add"].map((section) => {
          const sectionItems = items.filter((i) => i.section === section);
          if (sectionItems.length === 0) return null;
          return (
            <div key={section} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12.5, color: tokens.inkSoft, marginBottom: 8 }}>
                {SECTION_EMOJI[section]} {SECTION_LABEL[section]}
              </div>
              {sectionItems.map((item) => (
                <ListRow key={item.id} tokens={tokens} item={item} onToggle={onToggleItem} />
              ))}
            </div>
          );
        })}

        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 10 }}>
          お店でひらめいたものを追加
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 22 }}>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="例：ぶどう"
            style={{ flex: 1, padding: "9px 11px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
          />
          <input
            type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="金額"
            style={{ width: 80, padding: "9px 11px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
          />
          <button
            onClick={submit}
            style={{ padding: "9px 14px", fontSize: 12.5, borderRadius: 9, border: "none", background: tokens.ink, color: tokens.paper, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            追加
          </button>
        </div>

        <div
          style={{
            padding: "16px 16px 14px", borderRadius: 14, marginBottom: 14,
            background: tokens.accentBg || tokens.card, border: `1px solid ${tokens.line}`,
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{JUDGMENT_EMOJI[result.judgment]}</span>
            <p style={{ margin: 0, fontSize: 13.5, color: tokens.ink, lineHeight: 1.7 }} data-testid="shopping-list-judgment">
              {speaker}：{result.judgment === "empty" ? "チェックが入っている今の内容なら、見立てはいつでもここで確認できます。" : result.message}
            </p>
          </div>
        </div>

        {/* 最終見立て：「結局このまま買っていいの？」という利用者の迷いに
            直接答える結論。買い物リストを作ることではなく、安心して買い物へ
            行ける状態を作ることがFilovitaの目的——ここが最後の一言になる。 */}
        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 10 }}>
          🏁 最終見立て
        </div>
        <div
          style={{
            padding: "18px 16px", borderRadius: 14,
            background: tokens.accentBg || tokens.card,
            border: `1.5px solid ${finalVerdict.tone === "go" ? tokens.ink : "#a3432a"}`,
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{VERDICT_EMOJI[finalVerdict.tone]}</span>
            <p
              style={{
                margin: 0, fontSize: 14.5, fontWeight: 600, lineHeight: 1.8,
                color: finalVerdict.tone === "go" ? tokens.ink : "#a3432a",
              }}
              data-testid="shopping-final-verdict"
            >
              {speaker}：{finalVerdict.message}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
