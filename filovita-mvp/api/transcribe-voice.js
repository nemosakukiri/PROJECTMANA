/* 音声入力の文字起こし。ブラウザ内蔵のSpeechRecognition（webkitSpeechRecognition）
   には頼らない——2026-07-30、利用者の実機（iOS Safari）で実際に検証した結果、
   マイク権限・OSのディクテーション設定がどちらも正しく、アプリ内ブラウザでは
   なく本物のSafari.appで直接開いても"service-not-allowed"が再現し、Apple側にも
   長年未解決の既知の不具合として報告され続けていることを確認した
   （MVP_SPEC.md「音声入力の方式変更」参照）。かわりに、録音した音声データを
   ここへ送り、AIに文字起こしさせる方式に切り替える——生活資料ライブラリ
   （read-document.js）で写真を「サーバー側で読む」方式にしたのと同じ考え方。

   AnthropicのMessages APIは音声入力に対応していないため、callAI（プロバイダ
   自動切り替え）ではなくcallGeminiを直接呼ぶ。GEMINI_API_KEYが無い環境では、
   固定の文字起こし結果を作らず、正直にエラーを返す（read-document.jsと同じ
   方針——読み取れないものの代替をでっち上げない）。 */

import { callGemini } from "./_lib/ai.js";
import { applyCors } from "./_lib/cors.js";

const SYSTEM_PROMPT = `あなたは生活記録アプリ「Filovita」の音声入力の文字起こしを担当します。
以下を必ず守ってください。

- 渡された音声を、話されたとおりに日本語のテキストとして書き起こしてください。
- 要約したり、言い換えたり、内容を解釈したりしないでください。話されていない
  内容を作ってはいけません。
- 一部が聞き取れない場合は、聞き取れた範囲だけを書き起こしてください。
  ほとんど聞き取れない場合は、無理に文章を作らず「うまく聞き取れませんでした」
  とだけ伝えてください。
- 書き起こした本文だけを出力してください。前置き・説明・カギ括弧などの
  装飾は一切付けないでください。`;

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

  const { audio, mimeType } = req.body || {};
  if (!audio || typeof audio !== "string") {
    res.status(400).json({ error: "audio が必要です" });
    return;
  }

  try {
    const result = await callGemini({
      systemPrompt: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: "この音声を書き起こしてください。",
          audio: { mimeType: mimeType || "audio/webm", data: audio },
        },
      ],
      maxTokens: 1000,
      thinkingLevel: "low",
    });
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const transcript = result.reply?.trim();
    if (!transcript) {
      res.status(502).json({ error: "音声をうまく聞き取れませんでした。もう一度お試しください。" });
      return;
    }
    res.status(200).json({ transcript, provider: "gemini" });
  } catch (err) {
    console.error("transcribe-voice handler error:", err);
    res.status(500).json({ error: "バトラーがうまく応答できませんでした。しばらくしてからもう一度お試しください。" });
  }
}
