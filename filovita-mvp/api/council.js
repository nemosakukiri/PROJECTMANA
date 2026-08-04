/* 開発用「AI会議室」v1。Filovitaの利用者向け機能ではなく、Filovitaを
   作るための開発環境。麻奈さんが「翻訳者・通訳係」として毎回コピペする
   負荷を減らすための道具（2026-08-01、設計対話より）。

   最小構成（欲張らない）：
   1. 議題入力
   2. プロジェクトの記憶（councilContext.js、docs/を焼き込んだもの）を
      両方のAIに読ませる
   3. Claude（実装担当の視点）へ送信
   4. GPT（別視点のレビュー担当）へ送信
   5. 両方の回答を並べて表示——「相違点」（問題認識・懸念点・推奨案）を
      比較できる形で返す
   6. 決定はブラウザ側（localStorage）に保存するだけに留める（v1）

   AI同士を自律的に討論させない。両方が同じ資料を読み、それぞれの視点で
   意見を述べるだけで、統合や結論は人間（麻奈さん）の仕事として残す。 */

import { callAnthropic } from "./_lib/ai.js";
import { applyCors } from "./_lib/cors.js";
import { COUNCIL_CONTEXT } from "./_lib/councilContext.js";

const RESPONSE_SCHEMA_INSTRUCTION = `必ず次のJSON形式だけを出力してください。説明文・前置き・コードブロックの装飾（\`\`\`など）は一切付けないでください。

{"problemUnderstanding":"この議題で何が問題・論点だと理解したか（一言）","concerns":"懸念点・リスク・引っかかる点（一言）","recommendation":"あなたが推奨する方向（一言）","fullText":"詳しい説明（数文程度）"}`;

function buildRolePrompt(role) {
  const roleText =
    role === "implementer"
      ? "あなたはこの開発会議での「実装担当」です。技術的にどう作るか、実装上の現実的な選択肢を中心に意見を述べてください。"
      : "あなたはこの開発会議での「レビュー担当」です。実装案を鵜呑みにせず、見落とし・リスク・別の視点を中心に意見を述べてください。実装担当と同じ意見になることを恐れず、違う点があれば率直に指摘してください。";
  return `${COUNCIL_CONTEXT}

---

上記はFilovitaプロジェクトの現在の資料です。これを踏まえて、これから提示される議題について意見を述べてください。

${roleText}

議論を勝手に結論づけたり、最終決定を下したりしないでください——決めるのは人間（プロジェクトの持ち主）です。あなたの役目は、意見と、その根拠・懸念点を分かりやすく提示することです。

${RESPONSE_SCHEMA_INSTRUCTION}`;
}

function parseCouncilReply(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (
      typeof parsed.problemUnderstanding !== "string" ||
      typeof parsed.concerns !== "string" ||
      typeof parsed.recommendation !== "string" ||
      typeof parsed.fullText !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function callOpenAI({ systemPrompt, topic }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: "サーバー側にOpenAIのAPIキーが設定されていません（OPENAI_API_KEY）" };
  }
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `議題：${topic}` },
      ],
      temperature: 0.4,
    }),
  });
  if (!response.ok) {
    const errBody = await response.text();
    console.error("OpenAI API error:", response.status, errBody);
    return { error: "GPTからの応答を取得できませんでした。しばらくしてからもう一度お試しください。" };
  }
  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) return { error: "GPTからの応答を取得できませんでした。" };
  return { reply };
}

async function callClaude({ systemPrompt, topic }) {
  const result = await callAnthropic({
    systemPrompt,
    messages: [{ role: "user", content: `議題：${topic}` }],
    maxTokens: 1200,
    temperature: 0.4,
  });
  if (result.error) return { error: result.error };
  return { reply: result.reply };
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

  const { topic } = req.body || {};
  if (!topic || typeof topic !== "string") {
    res.status(400).json({ error: "topic が必要です" });
    return;
  }

  const [claudeResult, gptResult] = await Promise.all([
    callClaude({ systemPrompt: buildRolePrompt("implementer"), topic }),
    callOpenAI({ systemPrompt: buildRolePrompt("reviewer"), topic }),
  ]);

  function toPanel(result) {
    if (result.error) return { error: result.error };
    const parsed = parseCouncilReply(result.reply);
    if (!parsed) return { error: "応答の形式を読み取れませんでした。", fullText: result.reply };
    return parsed;
  }

  res.status(200).json({
    claude: toPanel(claudeResult),
    gpt: toPanel(gptResult),
  });
}
