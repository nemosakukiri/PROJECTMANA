/* 入力（話した内容・書いた内容）から、その日の記録(Event)の下書きを作る。
   MVP_SPEC.md「生活資料ライブラリ」の最初の一歩——音声・文字の入力を、
   Butlerが理解して構造化する。将来の写真/OCR資料も同じ思想で扱う。

   fakeGenerateDraft.jsの「入力にない事実を作らない」という制約は、
   本物のAIに差し替えても緩めない（FILOVITA_PHILOSOPHY.md第三層）。
   AI呼び出しの共通部分はshopping-chat.js等と_lib/ai.jsを共有する。 */

import { callAI } from "./_lib/ai.js";
import { applyCors } from "./_lib/cors.js";

const SYSTEM_PROMPT = `あなたは生活記録アプリ「Filovita」のバトラーです。
利用者が話した、または書いた内容から、その日の出来事の記録(Event)の
下書きを作ります。以下を必ず守ってください。

- 入力されていない事実を作ってはいけません。話されていないことを推測や
  想像で補わないでください。
- "conclusion"（結論）は、入力内容を要約した一文にしてください。言い
  淀みや繰り返しは整理してかまいませんが、内容を変えたり新しい情報を
  加えてはいけません。
- 入力の中で「次は〜する」「今度〜しないと」のように、明確にこれからの
  行動として述べられたものだけを"todos"として抜き出してください。曖昧な
  ものや感想は含めないでください。無ければ空配列にしてください。

必ず次のJSON形式だけを出力してください。説明文・前置き・コードブロックの
装飾（\`\`\`など）は一切付けないでください。

{"conclusion":"整理した結論の一文","todos":["行動1","行動2"]}`;

function parseDraftJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.conclusion !== "string" || !parsed.conclusion.trim()) return null;
    const todos = Array.isArray(parsed.todos) ? parsed.todos.filter((t) => typeof t === "string" && t.trim()) : [];
    return { conclusion: parsed.conclusion.trim(), todos };
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

  const { text } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "text が必要です" });
    return;
  }

  try {
    const result = await callAI({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
      maxTokens: 1500,
      thinkingLevel: "low",
    });
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const draft = parseDraftJson(result.reply);
    if (!draft) {
      console.error("generate-draft: JSON解析に失敗", result.reply);
      res.status(502).json({ error: "下書きをうまく読み取れませんでした。もう一度お試しください。" });
      return;
    }
    res.status(200).json({ ...draft, provider: result.provider });
  } catch (err) {
    console.error("generate-draft handler error:", err);
    res.status(500).json({ error: "バトラーがうまく応答できませんでした。しばらくしてからもう一度お試しください。" });
  }
}
