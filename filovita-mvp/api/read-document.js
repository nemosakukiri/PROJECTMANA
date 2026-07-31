/* 生活資料ライブラリの第一歩。レシート・CWの入出金アドバイス・支援記録・
   病院の説明書・処方内容・手書きのメモ——写真は入口が違うだけで、すべて
   「Butlerが生活を理解するための材料」という同じ世界の住人として扱う
   （FILOVITA_PHILOSOPHY.md「資料の入口は違っても、Butlerが理解する
   対象は一つである」／MVP_SPEC.md「生活資料ライブラリ」）。

   写真から資料の種類を判定し、Event下書き（結論・ToDo）を作るところまで
   がこのAPIの役割。「Eventへ紐付け・タグを付け・今後の判断で参照する」の
   先はフロントエンド側(App.jsx)とConfirmScreen.jsxが担う。
   AI呼び出しの共通部分はgenerate-draft.js等と_lib/ai.jsを共有する。 */

import { callAI } from "./_lib/ai.js";
import { applyCors } from "./_lib/cors.js";

const DOC_TYPES = ["receipt", "cw_advisory", "support_record", "hospital_note", "prescription", "handwritten_note", "other"];

const DOC_TYPE_LABEL = {
  receipt: "🧾 レシート",
  cw_advisory: "📄 CWの資金計画・アドバイス",
  support_record: "📋 支援記録",
  hospital_note: "🏥 病院の説明書",
  prescription: "💊 処方内容",
  handwritten_note: "✍️ 手書きのメモ",
  other: "📎 その他の資料",
};

const SYSTEM_PROMPT = `あなたは生活記録アプリ「Filovita」のバトラーです。
利用者が撮影した生活資料（レシート・CWの入出金アドバイス・支援記録・
病院の説明書・処方内容・手書きのメモなど）を読み取り、その日の記録
(Event)の下書きを作ります。以下を必ず守ってください。

- 資料に書かれていないことを作ってはいけません。読み取れない文字は
  推測で補わず、実際に読み取れた範囲だけを扱ってください。写真が不鮮明
  で内容がほとんど読み取れない場合は、無理に内容を作らず、その旨を
  "conclusion"に正直に書いてください（例：「資料の文字がかすれていて、
  はっきりとは読み取れませんでした」）。
- まず資料の種類を次のいずれか1つで判定してください：
  "receipt"（レシート）,"cw_advisory"（CWの入出金アドバイス・資金計画）,
  "support_record"（支援記録）,"hospital_note"（病院の説明書）,
  "prescription"（処方内容）,"handwritten_note"（手書きのメモ）,
  "other"（どれにも当てはまらない、または判別できない）
- "conclusion"は、資料から読み取れた内容を要約した一文にしてください
  （例：「スーパーで食料品と日用品を購入した（合計1,280円）」「次回の
  通院は来月10日、血液検査の予定」）。
- 資料の中に「次は〜する」「〜までに〜する」のように、明確にこれからの
  行動が読み取れる場合だけ"todos"として抜き出してください。無ければ
  空配列にしてください。
- レシートで合計金額がはっきり読み取れる場合だけ、"amount"に数値
  （円、記号や桁区切りのカンマは付けない）を入れてください。読み取れ
  ない・レシート以外の資料の場合はnullにしてください。金額を推測で
  埋めてはいけません——この数値は利用者の家計台帳（残高）から実際に
  差し引くために使われるため、誤って多く／少なく書くと生活費の管理に
  直接影響します。

必ず次のJSON形式だけを出力してください。説明文・前置き・コードブロックの
装飾（\`\`\`など）は一切付けないでください。

{"docType":"receipt|cw_advisory|support_record|hospital_note|prescription|handwritten_note|other","conclusion":"要約の一文","todos":["行動1"],"amount":1280}`;

function parseDocumentJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.conclusion !== "string" || !parsed.conclusion.trim()) return null;
    if (!DOC_TYPES.includes(parsed.docType)) return null;
    const todos = Array.isArray(parsed.todos) ? parsed.todos.filter((t) => typeof t === "string" && t.trim()) : [];
    const amount = typeof parsed.amount === "number" && Number.isFinite(parsed.amount) && parsed.amount > 0 ? parsed.amount : null;
    return { docType: parsed.docType, conclusion: parsed.conclusion.trim(), todos, amount };
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

  const { image, mimeType } = req.body || {};
  if (!image || typeof image !== "string") {
    res.status(400).json({ error: "image が必要です" });
    return;
  }

  try {
    const result = await callAI({
      systemPrompt: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: "この生活資料を読み取ってください。",
          image: { mimeType: mimeType || "image/jpeg", data: image },
        },
      ],
      maxTokens: 2000,
      thinkingLevel: "low",
    });
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const parsed = parseDocumentJson(result.reply);
    if (!parsed) {
      console.error("read-document: JSON解析に失敗", result.reply);
      res.status(502).json({ error: "資料をうまく読み取れませんでした。もう一度お試しください。" });
      return;
    }
    res.status(200).json({ ...parsed, docTypeLabel: DOC_TYPE_LABEL[parsed.docType], provider: result.provider });
  } catch (err) {
    console.error("read-document handler error:", err);
    res.status(500).json({ error: "バトラーがうまく応答できませんでした。しばらくしてからもう一度お試しください。" });
  }
}
