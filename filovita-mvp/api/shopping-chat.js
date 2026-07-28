/* 買い物相談の本物の会話窓口。ルールベースの判定(lib/shoppingJudgment.js)とは別に、
   自由入力に対して実際に考えて答える。MVP_SPEC.md「相談は往復である：診断ではなく会話」
   に基づく——「判断する」ではなく「一緒に考える」プロンプトにすること。
   APIキーはここ(サーバー側)だけで扱い、クライアントには一切渡さない。

   プロバイダはAI_PROVIDER環境変数で切り替える（"gemini" | "anthropic"、
   未設定時は"anthropic"）。開発・テスト中はGeminiの無料枠を使い、実運用に
   進める際はAnthropicまたはGeminiの有料枠にコードを変更せず切り替えられる
   ようにしている。Anthropic実装は削除せず両方を残す。 */

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

function formatScheduleLines(entries = []) {
  return entries
    .map((e) => `  - ${e.label}：${e.date}${e.amount != null ? `（¥${Number(e.amount).toLocaleString()}）` : ""}`)
    .join("\n") || "  （なし）";
}

function buildContextBlock(context = {}) {
  const {
    companionName, budget, balance, nextShoppingDate, cwPlanNote,
    incomeSchedule = [], paymentSchedule = [], restockSchedule = [],
    recurringItems = [], itemsToAdd = [],
  } = context;
  const recurringLines = recurringItems.map((i) => `  - ${i.name}：¥${Number(i.amount).toLocaleString()}`).join("\n") || "  （なし）";
  const addLines = itemsToAdd.map((i) => `  - ${i.name}：¥${Number(i.price ?? i.amount).toLocaleString()}`).join("\n") || "  （なし）";
  const today = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date());
  return `現在の生活の状況：
- 今日の日付：${today}
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

async function callAnthropic({ systemPrompt, messages }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: "サーバー側にAPIキーが設定されていません（管理者向け：ANTHROPIC_API_KEYを設定してください）", status: 503 };
  }

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
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error("Anthropic API error:", response.status, errBody);
    if (response.status === 429) {
      return { error: "今は少し混み合っているようです。1分ほど待ってからもう一度お試しください。", status: 429 };
    }
    return { error: "バトラーがうまく応答できませんでした。しばらくしてからもう一度お試しください。", status: 502 };
  }

  const data = await response.json();
  const reply = data.content?.find((block) => block.type === "text")?.text?.trim();
  if (!reply) {
    return { error: "バトラーがうまく応答できませんでした。しばらくしてからもう一度お試しください。", status: 502 };
  }
  return { reply };
}

async function callGemini({ systemPrompt, messages }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { error: "サーバー側にAPIキーが設定されていません（管理者向け：GEMINI_API_KEYを設定してください）", status: 503 };
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  // AnthropicのassistantロールはGeminiでは"model"
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 400 },
      }),
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    console.error("Gemini API error:", response.status, errBody);
    if (response.status === 429) {
      return { error: "今は少し混み合っているようです（無料枠の利用上限）。1分ほど待ってからもう一度お試しください。", status: 429 };
    }
    return { error: "バトラーがうまく応答できませんでした。しばらくしてからもう一度お試しください。", status: 502 };
  }

  const data = await response.json();
  const reply = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim();
  if (!reply) {
    return { error: "バトラーがうまく応答できませんでした。しばらくしてからもう一度お試しください。", status: 502 };
  }
  return { reply };
}

const PROVIDERS = { anthropic: callAnthropic, gemini: callGemini };

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

  const provider = process.env.AI_PROVIDER === "gemini" ? "gemini" : "anthropic";
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
