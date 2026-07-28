import { useState } from "react";
import { Trash2 } from "lucide-react";
import ContextHeader from "../components/ContextHeader.jsx";
import { computeShoppingJudgment } from "../lib/shoppingJudgment.js";

const JUDGMENT_EMOJI = { empty: "🛒", ok: "🙂", tight: "🤔", over: "😟" };
// GitHub Pagesは静的ホスティングのみのため、この本体アプリと同じオリジンには
// api/shopping-chat.jsは存在しない。別途Vercelにデプロイしたバックエンドの
// 絶対URLに差し替える運用（詳細はMVP_SPEC.md「相談は往復である」参照）。
// 同一オリジンにAPIも同居させる場合は "/api/shopping-chat" のままでよい。
const SHOPPING_CHAT_API_URL = "/api/shopping-chat";

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

/* 自由入力の相談窓口。決まった選択肢の判定ではなく、実際にAIへ渡して
   考えて返す(api/shopping-chat.js)。MVP_SPEC.md「相談は往復である：
   診断ではなく会話」の実装——バックエンドが無い環境（GitHub Pages等）
   では失敗するので、その場合は断定せず状況を伝えるだけに留める。 */
function ShoppingChat({ tokens, speaker, chatHistory, onAppendChatMessage, context }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setError(null);
    onAppendChatMessage("user", text);
    setSending(true);
    try {
      const response = await fetch(SHOPPING_CHAT_API_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, history: chatHistory, context }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.reply) {
        throw new Error(data?.error || "この環境ではまだ相談に答えられないようです。");
      }
      onAppendChatMessage("assistant", data.reply);
    } catch {
      setError("今は相談に答えられませんでした。この環境ではまだ会話機能が使えないかもしれません。");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 10 }}>
        {speaker}に自由に相談する
      </div>
      {/* MVP_SPEC.md「相談は往復である」：開発・テスト中は無料枠のAIを使うため、
          実データを送る前に必ず分かるよう常時表示する。本番運用に切り替えたら外す。 */}
      <div
        style={{
          fontSize: 11, color: tokens.inkFaint, background: tokens.card,
          border: `1px dashed ${tokens.line}`, borderRadius: 8, padding: "6px 10px", marginBottom: 10,
        }}
        data-testid="shopping-chat-test-notice"
      >
        🧪 現在はテスト運用中の会話機能です
      </div>
      {chatHistory.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {chatHistory.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%",
                padding: "8px 12px", borderRadius: 12, fontSize: 13, lineHeight: 1.6,
                background: m.role === "user" ? tokens.ink : (tokens.accentBg || tokens.card),
                color: m.role === "user" ? tokens.paper : tokens.ink,
                border: m.role === "user" ? "none" : `1px solid ${tokens.line}`,
              }}
              data-testid={`shopping-chat-${m.role}`}
            >
              {m.role === "assistant" ? `${speaker}：${m.content}` : m.content}
            </div>
          ))}
        </div>
      )}
      {sending && <p style={{ fontSize: 12, color: tokens.inkFaint, marginBottom: 8 }}>{speaker}が考えています…</p>}
      {error && <p style={{ fontSize: 12, color: "#a3432a", marginBottom: 8 }} data-testid="shopping-chat-error">{error}</p>}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="例：桃が半額だから追加したい"
          style={{ flex: 1, padding: "9px 11px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
        />
        <button
          onClick={send} disabled={sending}
          style={{ padding: "9px 16px", fontSize: 12.5, borderRadius: 9, border: "none", background: tokens.ink, color: tokens.paper, cursor: "pointer", opacity: sending ? 0.6 : 1 }}
        >
          送る
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
  recurringItems, itemsToAdd,
  onChangeBudget, onChangeBalance, onChangeNextShoppingDate,
  onAddRecurringItem, onRemoveRecurringItem, onEditRecurringItemAmount,
  onAddItemToAdd, onRemoveItemToAdd, onEditItemToAddPrice,
  onGenerateList,
  chatHistory, onAppendChatMessage,
  onBack,
}) {
  const { tokens } = theme;
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

        <div
          style={{
            marginTop: 22, padding: "16px 16px 14px", borderRadius: 14,
            background: tokens.accentBg || tokens.card, border: `1px solid ${tokens.line}`,
          }}
        >
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
        </div>

        <ShoppingChat
          tokens={tokens} speaker={speaker} chatHistory={chatHistory} onAppendChatMessage={onAppendChatMessage}
          context={{ companionName, budget, balance, nextShoppingDate, recurringItems, itemsToAdd }}
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
