import { useRef, useState } from "react";
import { Check } from "lucide-react";
import ContextHeader from "../components/ContextHeader.jsx";
import ShoppingChat from "../components/ShoppingChat.jsx";
import SteelPanel from "../theme/industrial/SteelPanel.jsx";
import OrnateFrame from "../theme/gothic/OrnateFrame.jsx";
import BarkPanel from "../theme/forest/BarkPanel.jsx";
import { computeShoppingJudgment } from "../lib/shoppingJudgment.js";

/* CalendarScreen.jsx/EventDetailScreen.jsxと同じ規約：componentThemeごとに
   専用の枠（森=BarkPanel、ホラー=OrnateFrame、cyberpunk=SteelPanel）へ
   差し替える。手帳・絵本・SF・旅は他画面と同様、専用部品を持たないため
   汎用の枠のままにする。買い物画面の各パネルで共通に使う。 */
function ThemedPanel({ theme, style, children }) {
  const isIndustrial = theme.componentTheme === "industrial";
  const isGothic = theme.componentTheme === "gothic";
  const isForest = theme.componentTheme === "forest";
  const { tokens } = theme;
  if (isIndustrial) return <SteelPanel style={style}>{children}</SteelPanel>;
  if (isGothic) return <OrnateFrame style={style}>{children}</OrnateFrame>;
  if (isForest) return <BarkPanel style={style}>{children}</BarkPanel>;
  return (
    <div
      style={{
        padding: "16px 16px 14px", borderRadius: 14,
        background: tokens.accentBg || tokens.card, border: `1px solid ${tokens.line}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const JUDGMENT_EMOJI = { empty: "🛒", ok: "🙂", tight: "🤔", over: "😟" };
const SECTION_LABEL = { usual: "いつもの買い物", add: "今回追加" };
const SECTION_EMOJI = { usual: "🛒", add: "⭐" };
const CATEGORY_LABEL = { now: "今買う", later: "来週でよい", priority: "先に確保すべき", skip: "見送る" };
const CATEGORY_EMOJI = { now: "🛒", later: "📅", priority: "⚠️", skip: "🙅" };
const FINAL_VERDICT_API_URL = "/api/shopping-final-verdict";

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
      <span style={{ fontSize: 12.5, color: tokens.inkFaint }}>
        {item.amount != null ? `¥${Number(item.amount).toLocaleString()}` : "金額未定"}
      </span>
    </button>
  );
}

/* 最終見立て：固定ルールでgo/remove/skipを決めるのではなく、Filovitaが
   持っている判断材料（入金予定・支払い予定・必需品の補充予定・次の買い物日・
   決まって買うもの・今回追加したいもの・CWの資金計画メモ・相談の会話履歴）を
   ひとつのコンテキストとしてLLMに渡し、品目ごとに「今買う／来週でよい／
   先に確保すべき／見送る」を判断してもらう(api/shopping-final-verdict.js)。
   OCRやGoogle Calendar連携は、将来このコンテキストに材料を増やす入力手段として
   後から足す——先にAIが判断できる器を作る。MVP_SPEC.md参照。 */
function FinalVerdictPanel({
  theme, speaker, checkedItems,
  companionName, budget, balance, nextShoppingDate, cwPlanNote,
  incomeSchedule, paymentSchedule, restockSchedule, weeklyLife, chatHistory,
  onVerdictRecorded,
}) {
  const { tokens } = theme;
  const [verdict, setVerdict] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // 同じ状況（品目・予算・暮らしの予定・会話履歴のいずれも未変更）で
  // 何度も聞き直すと、AIは毎回新しく考えるため表現や判断が揺れ、
  // 「バトラーの返事がコロコロ変わる」という不信につながる
  // (2026-07-29、利用者からの実際の指摘)。状況が変わっていなければ、
  // 前回と同じ見立てをそのまま返す——聞き直すたびに答えが変わらない
  // ことも、バトラーが「慎重であり続けようとする」ことの一部。
  const lastRequestRef = useRef(null);

  async function fetchVerdict() {
    if (loading || checkedItems.length === 0) return;
    setError(null);
    // 送ったコンテキストをそのまま記録に残す——「なぜそう言ったか」を
    // あとから説明できるようにする（隠すが、消さない。FILOVITA_PHILOSOPHY.md参照）
    const contextSnapshot = {
      companionName, budget, balance, nextShoppingDate, cwPlanNote,
      incomeSchedule, paymentSchedule, restockSchedule, weeklyLife,
      items: checkedItems.map((i) => ({ name: i.name, amount: i.amount, section: i.section })),
    };
    const requestKey = JSON.stringify({ context: contextSnapshot, history: chatHistory });
    if (verdict && lastRequestRef.current === requestKey) {
      // 状況が変わっていないので、聞き直さず前回の見立てをそのまま見せる
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(FINAL_VERDICT_API_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ history: chatHistory, context: contextSnapshot }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.items) {
        // サーバーからの具体的な理由があればそのまま伝える（断定せず、起きたことを伝える）
        setError(data?.error || "今は最終見立てを聞けませんでした。この環境ではまだこの機能が使えないかもしれません。");
        return;
      }
      setVerdict(data);
      lastRequestRef.current = requestKey;
      onVerdictRecorded?.({
        at: new Date().toISOString(),
        context: contextSnapshot,
        items: data.items,
        summary: data.summary,
        focus: data.focus,
      });
    } catch {
      // fetch自体が失敗＝バックエンドに届いていない（ローカル開発環境やGitHub Pagesなど）
      setError("今は最終見立てを聞けませんでした。この環境ではまだこの機能が使えないかもしれません。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 10 }}>
        🏁 最終見立て
      </div>
      <ThemedPanel theme={theme}>
        <div
          style={{
            fontSize: 11, color: tokens.inkFaint, background: tokens.card,
            border: `1px dashed ${tokens.line}`, borderRadius: 8, padding: "6px 10px", marginBottom: 10,
          }}
          data-testid="shopping-final-verdict-test-notice"
        >
          🧪 現在はテスト運用中の見立て機能です
        </div>

        <button
          onClick={fetchVerdict}
          disabled={loading || checkedItems.length === 0}
          style={{
            display: "block", width: "100%", padding: "12px 0", fontSize: 13.5, fontWeight: 600,
            borderRadius: 12, border: "none", background: tokens.ink, color: tokens.paper,
            cursor: loading || checkedItems.length === 0 ? "default" : "pointer",
            opacity: loading || checkedItems.length === 0 ? 0.6 : 1, marginBottom: verdict || error ? 12 : 0,
          }}
          data-testid="shopping-final-verdict-button"
        >
          {loading ? `${speaker}が考えています…` : `🔮 ${speaker}に最終見立てを聞く`}
        </button>

        {error && (
          <p style={{ fontSize: 12, color: "#a3432a", marginBottom: 0 }} data-testid="shopping-final-verdict-error">
            {error}
          </p>
        )}

        {verdict && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="shopping-final-verdict-items">
            {verdict.items.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 12px", borderRadius: 10,
                  background: tokens.accentBg || tokens.card, border: `1px solid ${tokens.line}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: item.reason ? 4 : 0 }}>
                  <span style={{ fontSize: 15 }}>{CATEGORY_EMOJI[item.category]}</span>
                  <span style={{ fontSize: 13.5, color: tokens.ink, fontWeight: 600 }}>{item.name}</span>
                  <span style={{ fontSize: 11.5, color: tokens.inkFaint, marginLeft: "auto" }}>
                    {CATEGORY_LABEL[item.category]}
                  </span>
                </div>
                {item.reason && (
                  <p style={{ margin: 0, fontSize: 12, color: tokens.inkSoft, lineHeight: 1.6 }}>{item.reason}</p>
                )}
              </div>
            ))}
            {verdict.summary && (
              <div
                style={{
                  padding: "14px 14px", borderRadius: 12, marginTop: 4,
                  background: tokens.accentBg || tokens.card, border: `1.5px solid ${tokens.ink}`,
                }}
              >
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: tokens.ink, lineHeight: 1.8 }} data-testid="shopping-final-verdict-summary">
                  {speaker}：{verdict.summary}
                </p>
                {verdict.focus && (
                  <p style={{ margin: "8px 0 0", fontSize: 11.5, color: tokens.inkFaint }} data-testid="shopping-final-verdict-focus">
                    ※ 今回重視したこと：{verdict.focus}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </ThemedPanel>
    </div>
  );
}

/* 買い物リスト：スーパーに着いたら、バトラーはもう相談相手ではなく
   秘書としてリストを渡す。チェックを外すだけで「見送り」を表現し、
   店頭でのひらめきの追加にもその場で見立てを返す(考える→買う、が
   地続きにつながる)。MVP_SPEC.md「複数周期の統合判断」参照。 */
export default function ShoppingListScreen({
  theme, companionName, budget, balance, nextShoppingDate, cwPlanNote,
  incomeSchedule, paymentSchedule, restockSchedule, weeklyLife, chatHistory, onAppendChatMessage,
  items, onToggleItem, onAddItem, onBack,
  verdictHistory, onVerdictRecorded,
}) {
  const { tokens } = theme;
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const speaker = companionName || "バトラー";

  const checkedUsual = items.filter((i) => i.section === "usual" && i.checked);
  const checkedAdd = items.filter((i) => i.section === "add" && i.checked);
  const result = computeShoppingJudgment({ budget, balance, recurringItems: checkedUsual, itemsToAdd: checkedAdd });

  function submit() {
    // 店頭でひらめいたものは、金額がまだ分からないことも多い
    // （「金額を先に入力しないと追加できない」が、無反応に見える原因
    // だった可能性——2026-07-29、利用者からの指摘）。名前だけでも
    // 追加できるようにし、金額は未定のまま扱う（0円と決めつけない）。
    if (!name.trim()) return;
    onAddItem({ name: name.trim(), amount: amount ? Number(amount) : null });
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

        <ThemedPanel theme={theme} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{JUDGMENT_EMOJI[result.judgment]}</span>
            <p style={{ margin: 0, fontSize: 13.5, color: tokens.ink, lineHeight: 1.7 }} data-testid="shopping-list-judgment">
              {speaker}：{result.judgment === "empty" ? "チェックが入っている今の内容なら、見立てはいつでもここで確認できます。" : result.message}
            </p>
          </div>
        </ThemedPanel>

        <ShoppingChat
          theme={theme} speaker={speaker} chatHistory={chatHistory} onAppendChatMessage={onAppendChatMessage}
          context={{
            companionName, budget, balance, nextShoppingDate, cwPlanNote,
            incomeSchedule, paymentSchedule, restockSchedule, weeklyLife,
            items: [...checkedUsual, ...checkedAdd].map((i) => ({ name: i.name, amount: i.amount, section: i.section })),
          }}
        />

        <div style={{ marginTop: 22 }}>
          <FinalVerdictPanel
            theme={theme} speaker={speaker} checkedItems={[...checkedUsual, ...checkedAdd]}
            companionName={companionName} budget={budget} balance={balance}
            nextShoppingDate={nextShoppingDate} cwPlanNote={cwPlanNote}
            incomeSchedule={incomeSchedule} paymentSchedule={paymentSchedule} restockSchedule={restockSchedule}
            weeklyLife={weeklyLife}
            chatHistory={chatHistory}
            onVerdictRecorded={onVerdictRecorded}
          />
        </div>

        {verdictHistory?.length > 0 && (
          <VerdictHistoryPanel theme={theme} speaker={speaker} history={verdictHistory} />
        )}
      </div>
    </div>
  );
}

/* 過去の最終見立ての履歴。「なんでそう言ったの？」に後から答えられる
   ようにするための記録であり、同時に「この時のバトラーは何を重視したか」
   という人格の履歴でもある(FILOVITA_PHILOSOPHY.md「根拠は画面から隠すが、
   内部からは消さない」参照)。画面には直近だけを表示するが、データ自体は
   全件persistence.js経由で保持する（隠すが、消さない）。 */
function VerdictHistoryPanel({ theme, speaker, history }) {
  const { tokens } = theme;
  const recent = [...history].reverse().slice(0, 5);
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 10 }}>
        🗂 過去の見立て
      </div>
      <ThemedPanel theme={theme}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="verdict-history">
          {recent.map((entry) => (
            <div
              key={entry.id}
              style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${tokens.line}` }}
            >
              <div style={{ fontSize: 11, color: tokens.inkFaint, marginBottom: 4 }}>
                {new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(entry.at))}
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: tokens.ink, lineHeight: 1.6 }}>
                {speaker}：{entry.summary}
              </p>
              {entry.focus && (
                <p style={{ margin: "4px 0 0", fontSize: 11, color: tokens.inkFaint }}>
                  重視したこと：{entry.focus}
                </p>
              )}
            </div>
          ))}
        </div>
      </ThemedPanel>
    </div>
  );
}
