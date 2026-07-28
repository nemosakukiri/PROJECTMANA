/* 買い物相談の本物の会話窓口。自由入力に対して実際に考えて答える。
   MVP_SPEC.md「相談は往復である：診断ではなく会話」に基づく——「判断する」
   ではなく「一緒に考える」プロンプトにすること。
   AI呼び出し・プロバイダ切り替えの共通部分は_lib/ai.jsを参照
   （shopping-final-verdict.jsと共有。両者とも同じ「暮らしの予定」を
   判断材料として使うため、コンテキストの組み立て方も揃えている）。 */

import { PROVIDERS, resolveProvider } from "./_lib/ai.js";
import { applyCors } from "./_lib/cors.js";
import { formatScheduleLines, todayLabel } from "./_lib/scheduleContext.js";

const SYSTEM_PROMPT = `あなたは生活記録アプリ「Filovita」の中で暮らしに寄り添う「バトラー」です。
利用者から買い物についての自由な相談を受けます。以下を必ず守ってください。

- 判断を代行するのではなく、利用者と一緒に考え、断定せず、暮らし全体を踏まえた見通しを伝えてください。
- 「大丈夫です」ではなく「大丈夫そうです」のように、含みを持たせてください。今ある情報での見立てであり、保証ではありません。
- あなたが見ているのは単なる残高計算ではありません。今日の日付・入金予定・支払い予定・次の買い物日・必需品の補充予定という時間軸と、決まって買うもの・今回追加したいものという優先順位を、両方とも踏まえて判断してください。
- 「買っていいか」だけでなく、「いつ買うか」「何を優先するか」まで一緒に考えてください。見通しは次の3種類で答えるのが基本です：「今買っても大丈夫そうです」「来週（入金・支払いの後）でもよさそうです」「それより先に○○（必需品の補充等）を確保した方が安心です」。
- 利用者が会話の途中で新しい事情（「今日しか安い」「これは絶対に必要」等）を伝えたら、それを踏まえて見立てを更新してください。決めつけて終わらせないでください。
- 医療・法律など専門家の判断が要ることには踏み込まず、買い物の見通しに関する会話に留めてください。
- 短く、話し言葉で答えてください。数字の羅列だけで終わらせず、生活の実感に翻訳してください。
- 必要なら、利用者に一つだけ問い返してよいです（例：「果物は足りていますか？」）。一度に多くを聞き返さないでください。
- あなたの役割は「正解を出すこと」ではなく、「利用者が納得して判断できるよう一緒に考えること」です。`;

function buildContextBlock(context = {}) {
  const {
    companionName, budget, balance, nextShoppingDate, cwPlanNote,
    incomeSchedule = [], paymentSchedule = [], restockSchedule = [],
    recurringItems = [], itemsToAdd = [],
  } = context;
  const recurringLines = recurringItems.map((i) => `  - ${i.name}：¥${Number(i.amount).toLocaleString()}`).join("\n") || "  （なし）";
  const addLines = itemsToAdd.map((i) => `  - ${i.name}：¥${Number(i.price ?? i.amount).toLocaleString()}`).join("\n") || "  （なし）";
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
- 決まって買うもの：
${recurringLines}
- 今回追加したいもの：
${addLines}`;
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

  const { message, history = [], context = {} } = req.body || {};
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message が必要です" });
    return;
  }

  const provider = resolveProvider();
  const call = PROVIDERS[provider];

  const messages = [
    ...history
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  try {
    const result = await call({
      systemPrompt: `${SYSTEM_PROMPT}\n\n${buildContextBlock(context)}`,
      messages,
    });
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(200).json({ reply: result.reply, provider });
  } catch (err) {
    console.error("shopping-chat handler error:", err);
    res.status(500).json({ error: "バトラーがうまく応答できませんでした。しばらくしてからもう一度お試しください。" });
  }
}
