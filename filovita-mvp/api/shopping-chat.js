/* 買い物相談の本物の会話窓口。ルールベースの判定(lib/shoppingJudgment.js)とは別に、
   自由入力に対して実際に考えて答える。MVP_SPEC.md「相談は往復である：診断ではなく会話」
   に基づく——「判断する」ではなく「一緒に考える」プロンプトにすること。
   APIキーはここ(サーバー側)だけで扱い、クライアントには一切渡さない。 */

const SYSTEM_PROMPT = `あなたは生活記録アプリ「Filovita」の中で暮らしに寄り添う「バトラー」です。
利用者から買い物についての自由な相談を受けます。以下を必ず守ってください。

- 判断を代行するのではなく、利用者と一緒に考え、断定せず、暮らし全体を踏まえた見通しを伝えてください。
- 「大丈夫です」ではなく「大丈夫そうです」のように、含みを持たせてください。今ある情報での見立てであり、保証ではありません。
- 生活は一つの支出ではなく、決まって買うもの・次の買い物日・2週間の予算という複数の周期が重なってできています。それらを踏まえて答えてください。
- 医療・法律など専門家の判断が要ることには踏み込まず、買い物の見通しに関する会話に留めてください。
- 短く、話し言葉で答えてください。数字の羅列だけで終わらせず、生活の実感に翻訳してください。
- 必要なら、利用者に一つだけ問い返してよいです（例：「果物は足りていますか？」）。一度に多くを聞き返さないでください。`;

function buildContextBlock(context = {}) {
  const {
    companionName, budget, balance, nextShoppingDate,
    recurringItems = [], itemsToAdd = [],
  } = context;
  const recurringLines = recurringItems.map((i) => `  - ${i.name}：¥${Number(i.amount).toLocaleString()}`).join("\n") || "  （なし）";
  const addLines = itemsToAdd.map((i) => `  - ${i.name}：¥${Number(i.price ?? i.amount).toLocaleString()}`).join("\n") || "  （なし）";
  return `現在の生活の状況：
- 呼び名：${companionName || "バトラー"}
- 2週間の予算：¥${Number(budget || 0).toLocaleString()}
- 現在の残額：¥${Number(balance || 0).toLocaleString()}
- 次の買い物日：${nextShoppingDate || "未設定"}
- 決まって買うもの：
${recurringLines}
- 今回追加したいもの：
${addLines}`;
}

// GitHub Pagesにデプロイした本体アプリから、別オリジンのこの関数を呼ぶために必要
// (静的ホスティングのGitHub Pagesにはサーバー機能が無いため、APIだけをここに置いている)
const ALLOWED_ORIGINS = [
  "https://nemosakukiri.github.io",
  "http://localhost:5173", "http://localhost:5900",
];

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin) || (origin && origin.endsWith(".vercel.app"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "サーバー側にAPIキーが設定されていません（管理者向け：ANTHROPIC_API_KEYを設定してください）" });
    return;
  }

  const { message, history = [], context = {} } = req.body || {};
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message が必要です" });
    return;
  }

  const messages = [
    ...history
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: `${SYSTEM_PROMPT}\n\n${buildContextBlock(context)}`,
        messages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Anthropic API error:", response.status, errBody);
      res.status(502).json({ error: "バトラーがうまく応答できませんでした。しばらくしてからもう一度お試しください。" });
      return;
    }

    const data = await response.json();
    const reply = data.content?.find((block) => block.type === "text")?.text?.trim();
    if (!reply) {
      res.status(502).json({ error: "バトラーがうまく応答できませんでした。しばらくしてからもう一度お試しください。" });
      return;
    }
    res.status(200).json({ reply });
  } catch (err) {
    console.error("shopping-chat handler error:", err);
    res.status(500).json({ error: "バトラーがうまく応答できませんでした。しばらくしてからもう一度お試しください。" });
  }
}
