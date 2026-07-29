import { useState } from "react";
import { Trash2 } from "lucide-react";
import ContextHeader from "../components/ContextHeader.jsx";
import ShoppingChat from "../components/ShoppingChat.jsx";
import SteelPanel from "../theme/industrial/SteelPanel.jsx";
import OrnateFrame from "../theme/gothic/OrnateFrame.jsx";
import BarkPanel from "../theme/forest/BarkPanel.jsx";
import { computeShoppingJudgment } from "../lib/shoppingJudgment.js";

const JUDGMENT_EMOJI = { empty: "🛒", ok: "🙂", tight: "🤔", over: "😟" };

function ItemListEditor({ tokens, items, onAdd, onRemove, onEditAmount, amountKey, namePlaceholder, addLabel }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  function submit() {
    if (!name.trim() || !amount) return;
    onAdd({ name: name.trim(), [amountKey]: Number(amount) });
    setName("");
    setAmount("");
  }

  return (
    <div style={{ marginBottom: 22 }}>
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 12px", border: `1px solid ${tokens.line}`, borderRadius: 10,
              }}
            >
              <span style={{ fontSize: 13.5, color: tokens.ink }}>{item.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: tokens.inkFaint }}>¥</span>
                <input
                  type="number" value={item[amountKey]}
                  onChange={(e) => onEditAmount(item.id, e.target.value === "" ? 0 : Number(e.target.value))}
                  style={{ width: 72, padding: "5px 7px", fontSize: 13, borderRadius: 7, border: `1px solid ${tokens.line}`, color: tokens.inkSoft, textAlign: "right", fontFamily: "inherit" }}
                />
                <button
                  onClick={() => onRemove(item.id)}
                  style={{ background: "none", border: "none", color: tokens.inkFaint, cursor: "pointer", padding: 2 }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={namePlaceholder}
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
          {addLabel}
        </button>
      </div>
    </div>
  );
}

/* 「暮らしの予定」：入金・支払い・必需品の補充など、時間軸を持つ予定。
   MVP_SPEC.md「Filovita内部に暮らしの予定を持つ」の実装——Google Calendar
   連携を待たず、まずFilovita自身が時間軸を判断材料として持てるようにする。
   showAmount=falseの場合（必需品の補充予定）は金額を持たない。 */
function ScheduleListEditor({ tokens, items, onAdd, onRemove, namePlaceholder, showAmount = true }) {
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");

  function submit() {
    if (!label.trim() || !date.trim()) return;
    const entry = { label: label.trim(), date: date.trim() };
    if (showAmount && amount) entry.amount = Number(amount);
    onAdd(entry);
    setLabel("");
    setDate("");
    setAmount("");
  }

  return (
    <div style={{ marginBottom: 22 }}>
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 12px", border: `1px solid ${tokens.line}`, borderRadius: 10,
              }}
            >
              <span style={{ fontSize: 13.5, color: tokens.ink }}>{item.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12.5, color: tokens.inkFaint }}>{item.date}</span>
                {showAmount && item.amount != null && (
                  <span style={{ fontSize: 13, color: tokens.inkSoft }}>¥{Number(item.amount).toLocaleString()}</span>
                )}
                <button
                  onClick={() => onRemove(item.id)}
                  style={{ background: "none", border: "none", color: tokens.inkFaint, cursor: "pointer", padding: 2 }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={namePlaceholder}
          style={{ flex: 1, padding: "9px 11px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
        />
        <input
          type="text" value={date} onChange={(e) => setDate(e.target.value)} placeholder="例：8月15日"
          style={{ width: 90, padding: "9px 11px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
        />
        {showAmount && (
          <input
            type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="金額(任意)"
            style={{ width: 90, padding: "9px 11px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
          />
        )}
        <button
          onClick={submit}
          style={{ padding: "9px 14px", fontSize: 12.5, borderRadius: 9, border: "none", background: tokens.ink, color: tokens.paper, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          追加
        </button>
      </div>
    </div>
  );
}

/* 買い物相談：家計簿画面ではなく、バトラーとの相談窓口。
   複数の周期(食料品・タバコ・日用品・ヘルパー訪問など)を利用者が
   頭の中で同時に管理する負担を、バトラーが見渡して引き受ける。
   MVP_SPEC.md「複数周期の統合判断」参照。 */
export default function ShoppingConsultScreen({
  theme, companionName,
  budget, balance, nextShoppingDate,
  cwPlanNote, onChangeCwPlanNote,
  incomeSchedule, onAddIncomeSchedule, onRemoveIncomeSchedule,
  paymentSchedule, onAddPaymentSchedule, onRemovePaymentSchedule,
  restockSchedule, onAddRestockSchedule, onRemoveRestockSchedule,
  recurringItems, itemsToAdd,
  onChangeBudget, onChangeBalance, onChangeNextShoppingDate,
  onAddRecurringItem, onRemoveRecurringItem, onEditRecurringItemAmount,
  onAddItemToAdd, onRemoveItemToAdd, onEditItemToAddPrice,
  onGenerateList,
  chatHistory, onAppendChatMessage,
  onBack,
}) {
  const { tokens } = theme;
  const isIndustrial = theme.componentTheme === "industrial";
  const isGothic = theme.componentTheme === "gothic";
  const isForest = theme.componentTheme === "forest";
  const [showDetail, setShowDetail] = useState(false);
  const result = computeShoppingJudgment({ budget, balance, recurringItems, itemsToAdd });
  const speaker = companionName || "バトラー";

  return (
    <div>
      <ContextHeader theme={theme} breadcrumb="暮らし" title="買い物を相談する" onBack={onBack} />
      <div style={{ padding: "6px 20px 40px" }}>
        <p style={{ fontSize: 12.5, color: tokens.inkFaint, marginTop: 0, marginBottom: 20, lineHeight: 1.7 }}>
          今回追加したいものを入れると、{speaker}が今の予算と決まって買うものを見渡して、
          今回はこれで大丈夫そうかを一緒に見立てます。
        </p>

        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 10 }}>
          予算状況
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          <label style={{ fontSize: 12, color: tokens.inkSoft }}>
            2週間の予算
            <input
              type="number" value={budget} onChange={(e) => onChangeBudget(Number(e.target.value))}
              style={{ display: "block", width: "100%", marginTop: 5, padding: "9px 11px", fontSize: 14, borderRadius: 9, border: `1px solid ${tokens.line}`, boxSizing: "border-box", fontFamily: "inherit" }}
            />
          </label>
          <label style={{ fontSize: 12, color: tokens.inkSoft }}>
            現在の残額
            <input
              type="number" value={balance} onChange={(e) => onChangeBalance(Number(e.target.value))}
              style={{ display: "block", width: "100%", marginTop: 5, padding: "9px 11px", fontSize: 14, borderRadius: 9, border: `1px solid ${tokens.line}`, boxSizing: "border-box", fontFamily: "inherit" }}
            />
          </label>
          <label style={{ fontSize: 12, color: tokens.inkSoft }}>
            次の買い物日
            <input
              type="text" value={nextShoppingDate} onChange={(e) => onChangeNextShoppingDate(e.target.value)}
              placeholder="例：7月25日"
              style={{ display: "block", width: "100%", marginTop: 5, padding: "9px 11px", fontSize: 14, borderRadius: 9, border: `1px solid ${tokens.line}`, boxSizing: "border-box", fontFamily: "inherit" }}
            />
          </label>
        </div>

        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 10 }}>
          暮らしの予定（いつ・何が入るか。時間軸を一緒に考える材料）
        </div>
        <p style={{ fontSize: 11, color: tokens.inkFaint, marginTop: 0, marginBottom: 10 }}>
          入金予定
        </p>
        <ScheduleListEditor
          tokens={tokens} items={incomeSchedule} onAdd={onAddIncomeSchedule} onRemove={onRemoveIncomeSchedule}
          namePlaceholder="例：年金、お給料"
        />
        <p style={{ fontSize: 11, color: tokens.inkFaint, marginTop: 0, marginBottom: 10 }}>
          支払い予定
        </p>
        <ScheduleListEditor
          tokens={tokens} items={paymentSchedule} onAdd={onAddPaymentSchedule} onRemove={onRemovePaymentSchedule}
          namePlaceholder="例：家賃、光熱費"
        />
        <p style={{ fontSize: 11, color: tokens.inkFaint, marginTop: 0, marginBottom: 10 }}>
          必需品の補充予定
        </p>
        <ScheduleListEditor
          tokens={tokens} items={restockSchedule} onAdd={onAddRestockSchedule} onRemove={onRemoveRestockSchedule}
          namePlaceholder="例：犬のフード" showAmount={false}
        />
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, color: tokens.inkSoft }}>
            CWの資金計画メモ（任意）
            <textarea
              value={cwPlanNote} onChange={(e) => onChangeCwPlanNote(e.target.value)}
              placeholder="例：食費は1日1000円までで計画している"
              rows={2}
              style={{ display: "block", width: "100%", marginTop: 5, padding: "9px 11px", fontSize: 14, borderRadius: 9, border: `1px solid ${tokens.line}`, boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }}
            />
          </label>
        </div>

        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 10 }}>
          決まって買うもの
        </div>
        <ItemListEditor
          tokens={tokens} items={recurringItems} onAdd={onAddRecurringItem} onRemove={onRemoveRecurringItem}
          onEditAmount={onEditRecurringItemAmount}
          amountKey="amount" namePlaceholder="例：食料品、タバコ" addLabel="追加"
        />

        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 10 }}>
          今回追加したいもの
        </div>
        <ItemListEditor
          tokens={tokens} items={itemsToAdd} onAdd={onAddItemToAdd} onRemove={onRemoveItemToAdd}
          onEditAmount={onEditItemToAddPrice}
          amountKey="price" namePlaceholder="例：コーヒー" addLabel="追加"
        />

        {(() => {
          const judgmentBody = (
            <>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{JUDGMENT_EMOJI[result.judgment]}</span>
                <p style={{ margin: 0, fontSize: 13.5, color: tokens.ink, lineHeight: 1.7 }} data-testid="shopping-judgment">
                  {speaker}：{result.message}
                </p>
              </div>
              <button
                onClick={() => setShowDetail((v) => !v)}
                style={{ marginTop: 10, background: "none", border: "none", color: tokens.inkFaint, fontSize: 11.5, cursor: "pointer", padding: 0, textDecoration: "underline" }}
              >
                {showDetail ? "根拠を閉じる" : "根拠を見る"}
              </button>
              {showDetail && (
                <div style={{ marginTop: 10, fontSize: 12, color: tokens.inkSoft, lineHeight: 1.8 }}>
                  <div>決まって買うものの合計：¥{result.recurringTotal.toLocaleString()}</div>
                  <div>決まって買うものを確保したあとの残り：¥{result.reserved.toLocaleString()}</div>
                  <div>今回追加したいものの合計：¥{result.addTotal.toLocaleString()}</div>
                  <div>追加後に残る見込み：¥{result.remainingAfterAdd.toLocaleString()}</div>
                </div>
              )}
            </>
          );
          if (isIndustrial) return <SteelPanel style={{ marginTop: 22 }}>{judgmentBody}</SteelPanel>;
          if (isGothic) return <OrnateFrame style={{ marginTop: 22 }}>{judgmentBody}</OrnateFrame>;
          if (isForest) return <BarkPanel style={{ marginTop: 22 }}>{judgmentBody}</BarkPanel>;
          return (
            <div
              style={{
                marginTop: 22, padding: "16px 16px 14px", borderRadius: 14,
                background: tokens.accentBg || tokens.card, border: `1px solid ${tokens.line}`,
              }}
            >
              {judgmentBody}
            </div>
          );
        })()}

        <ShoppingChat
          theme={theme} speaker={speaker} chatHistory={chatHistory} onAppendChatMessage={onAppendChatMessage}
          context={{
            companionName, budget, balance, nextShoppingDate, cwPlanNote,
            incomeSchedule, paymentSchedule, restockSchedule, recurringItems, itemsToAdd,
          }}
        />

        {(recurringItems.length > 0 || itemsToAdd.length > 0) && (
          <button
            onClick={onGenerateList}
            style={{
              display: "block", width: "100%", marginTop: 18, padding: "13px 0", fontSize: 14, fontWeight: 600,
              borderRadius: 12, border: "none", background: tokens.ink, color: tokens.paper, cursor: "pointer",
            }}
          >
            🧾 買い物リストを作る
          </button>
        )}
      </div>
    </div>
  );
}
