/* 「今日の買い物」画面の最終見立て。固定ルールでgo/remove/skipを決めるのではなく、
   入金予定・支払い予定・必需品の補充予定・次の買い物日・決まって買うもの・
   今回追加したいもの・CWの資金計画メモ・これまでの相談の会話——今Filovitaが
   持っている判断材料をひとつのコンテキストとしてLLMに渡し、品目ごとに
   「今買う／来週でよい／先に確保すべき／見送る」を判断させる。

   これは「AIが判断できる器」であり、OCRやGoogle Calendar連携は将来この
   コンテキストへ材料を追加する入力手段として位置づける（MVP_SPEC.md参照）。
   AI呼び出しの共通部分はshopping-chat.jsと_lib/ai.jsを共有する。

   このプロンプトも docs/FILOVITA_PHILOSOPHY.md「家計相談の憲法」8条の
   実装の一つ。8条自体はプロンプトではなく仕様として扱い、モデルや
   プロバイダを差し替えるときも必ず満たしているかを確認すること。 */

import { callAI } from "./_lib/ai.js";
import { applyCors } from "./_lib/cors.js";
import { formatScheduleLines, todayLabel } from "./_lib/scheduleContext.js";

const CATEGORIES = ["now", "later", "priority", "skip"];

const SYSTEM_PROMPT = `あなたは生活記録アプリ「Filovita」の「今日の買い物」画面で、
最終的な見立てを出すバトラーです。買い物リストを作ることが目的ではなく、
利用者が「結局このまま買っていいの？」と迷わず、安心して買い物へ行ける
状態を作ることが目的です。

渡される情報（今日の日付・入金予定・支払い予定・必需品の補充予定・次の
買い物日・CWの資金計画メモ・これまでの相談の会話・今日のリストの品目）
を総合的に踏まえて、リストの品目ひとつひとつについて、次の4つのいずれか
に分類してください。

判断の出発点は「現在の残額」ではありません。登録されている入金予定
（年金・生活保護・給付・お給料等）を推論の前提として最優先で考慮して
ください。まず今日の日付から見て次の入金予定がいつで、そこまで何日
あるかを必ず把握し、次にその日数のあいだに必ず発生する支出（支払い
予定・必需品の補充予定・決まって買うもの）を洗い出したうえで、今回の
品目がその期間をやりくりできる範囲かを判断してください。残額だけを
根拠にした一般的な節約アドバイス（例：「残額に余裕があるので買って
大丈夫です」とだけ言う）はしないでください。

渡される「現在の残額」は家計台帳（利用者が入力・確定した数値）です。
これはあなたが判断の中で計算し直したり、別の数字に置き換えたりしては
いけません。会話より台帳、推測より台帳です。同じ状況で聞かれるたびに
違う金額を答えることは信頼を損ないます。summaryは「買えます」で終わら
せず、その先の影響まで含めてください（例：「買えます。ただし次の入金
までは家計が厳しくなりそうです」）。今の一回の判断だけでなく、次の
入金までの見通し全体を示すのが目的です。あなたの目的は利用者を安心
させることではなく、生活を守ることです。安心させるためだけの根拠の
薄い"now"判定を出してはいけません。

入金予定・支払い予定・残額など、判断に必要な情報が実質的に把握できない
品目については、安易に"now"（今日買ってよい）と判定してはいけません。
その場合は"later"または"priority"とし、reasonに「情報が確認できて
いないため」の旨を明記してください。確認できていない状態を、安心させる
ためだけに"now"へ丸めることは禁止します。

- "now"：今日買ってよい（入金予定・支払い予定・残額のいずれも確認できている場合のみ）
- "later"：来週（次の入金・支払いの後等）でよい、または判断に必要な情報がまだ確認できていない
- "priority"：それより先に確保すべき（必需品の補充が近い等）
- "skip"：今回は見送った方がよい

断定しすぎず、含みのある短い理由を品目ごとに添えてください。可能な範囲で
「次の入金まであと○日ある」「その間に△△の支払いがある」のように、
日数と具体的な支出を理由に含めてください（例：「次の入金まであと6日あり、
家賃の支払いもその前にあるので」「必需品の在庫が近そうなので」）。

さらに、この判断全体を通して何を最も重視したかを一言で表してください
（例：「明日の生活費確保」「疲労軽減」「楽しみを優先」）。これは後から
振り返ったときに「この時のバトラーは何を大事にしたか」が分かるように
するためのものです。

必ず次のJSON形式だけを出力してください。説明文・前置き・コードブロックの
装飾（\`\`\`など）は一切付けないでください。

{"items":[{"name":"品目名","category":"now"|"later"|"priority"|"skip","reason":"一言の理由"}],"summary":"全体を通した一言の結論","focus":"この判断で最も重視したことを一言で"}

items配列には、渡された品目をすべて過不足なく含めてください。`;

function formatItemLines(items = []) {
  return (
    items
      .map((i) => {
        const amount = i.amount ?? i.price;
        const amountLabel = amount != null ? `¥${Number(amount).toLocaleString()}` : "金額未定";
        return `  - ${i.name}：${amountLabel}（${i.section === "add" ? "今回追加" : "いつもの買い物"}）`;
      })
      .join("\n") || "  （なし）"
  );
}

function buildContextBlock(context = {}) {
  const {
    companionName, budget, balance, nextShoppingDate, cwPlanNote,
    incomeSchedule = [], paymentSchedule = [], restockSchedule = [],
    items = [],
  } = context;
  return `現在の生活の状況：
- 今日の日付：${todayLabel()}
- 呼び名：${companionName || "バトラー"}
- 2週間の予算：¥${Number(budget || 0).toLocaleString()}
- 現在の残額：¥${Number(balance || 0).toLocaleString()}
- 次の買い物日：${nextShoppingDate || "未設定"}
- 入金予定：
${formatScheduleLines(incomeSchedule)}
- 支払い予定：
${formatScheduleLines(paymentSchedule)}
- 必需品の補充予定：
${formatScheduleLines(restockSchedule)}
- CWの資金計画メモ：${cwPlanNote || "（なし）"}
- 今日の買い物リストの品目：
${formatItemLines(items)}

上記の品目すべてについて、指定のJSON形式で最終見立てを出してください。`;
}

function parseVerdictJson(text) {
  // AIが前後に説明文やコードブロックを付けてしまった場合でも、
  // 最初に現れる{...}ブロックだけを取り出して寛容にパースする
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.items)) return null;
    const items = parsed.items
      .filter((i) => i && typeof i.name === "string" && CATEGORIES.includes(i.category))
      .map((i) => ({ name: i.name, category: i.category, reason: typeof i.reason === "string" ? i.reason : "" }));
    if (items.length === 0) return null;
    return {
      items,
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      focus: typeof parsed.focus === "string" ? parsed.focus : "",
    };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "POSTのみ対応しています" });
    return;
  }

  const { context = {}, history = [] } = req.body || {};
  const items = Array.isArray(context.items) ? context.items : [];
  if (items.length === 0) {
    res.status(400).json({ error: "見立ての対象となる品目がありません" });
    return;
  }

  const messages = [
    ...history
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: buildContextBlock(context) },
  ];

  try {
    // 構造化JSONを即答させるだけの用途なので、Gemini 3系のthinkingLevelを
    // 下げて思考トークンの消費を抑える。それでも2000では内部の思考が
    // maxOutputTokensを消費しJSONが途中で打ち切られることがあった
    // (2026-07-29に実際に発生)ため、上限にも余裕を持たせる。
    // temperatureも下げる——同じ状況で聞くたびに判断がぶれると
    // 「バトラーの返事がコロコロ変わる」という不信につながる
    // (2026-07-29、利用者からの実際の指摘)。会話(shopping-chat.js)と
    // 違い、ここは断定的な分類タスクなので一貫性を優先してよい。
    const result = await callAI({ systemPrompt: SYSTEM_PROMPT, messages, maxTokens: 3000, thinkingLevel: "low", temperature: 0.2 });
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const verdict = parseVerdictJson(result.reply);
    if (!verdict) {
      console.error("shopping-final-verdict: JSON解析に失敗", result.reply);
      res.status(502).json({ error: "バトラーの見立てをうまく読み取れませんでした。もう一度お試しください。" });
      return;
    }
    res.status(200).json({ ...verdict, provider: result.provider });
  } catch (err) {
    console.error("shopping-final-verdict handler error:", err);
    res.status(500).json({ error: "バトラーがうまく応答できませんでした。しばらくしてからもう一度お試しください。" });
  }
}
