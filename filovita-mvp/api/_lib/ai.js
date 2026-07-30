/* Anthropic/Gemini呼び出しの共通部分。shopping-chat.js・shopping-final-verdict.js・
   generate-draft.js・read-document.js・transcribe-voice.jsから共有する。プロバイダは
   AI_PROVIDER環境変数で切り替える（"gemini" | "anthropic"、未設定時は"anthropic"）。
   APIキーはここ(サーバー側)だけで扱う。

   messagesの各要素は{role, content, image?, audio?}の形。image/audioはどちらも
   {mimeType, data(base64)}。imageは生活資料ライブラリ（read-document.js）が写真を
   渡すために使う。audioは音声入力（transcribe-voice.js）が録音データを渡すために
   使う——Anthropicの Messages API は音声入力に対応していないため、audioは
   callGeminiのみで扱う（2026-07-30、iOS SafariのSpeechRecognition実装が
   信頼できないと判明したため、ブラウザ内蔵の音声認識に頼らずサーバー側で
   文字起こしする方式に切り替えた）。 */

function toAnthropicMessages(messages) {
  return messages.map((m) => {
    if (!m.image) return { role: m.role, content: m.content };
    const blocks = [{ type: "image", source: { type: "base64", media_type: m.image.mimeType, data: m.image.data } }];
    if (m.content) blocks.push({ type: "text", text: m.content });
    return { role: m.role, content: blocks };
  });
}

export async function callAnthropic({ systemPrompt, messages, maxTokens = 500, temperature }) {
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
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: toAnthropicMessages(messages),
      ...(temperature != null ? { temperature } : {}),
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

export async function callGemini({ systemPrompt, messages, maxTokens = 500, thinkingLevel, temperature }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { error: "サーバー側にAPIキーが設定されていません（管理者向け：GEMINI_API_KEYを設定してください）", status: 503 };
  }

  // 2026-07-29時点でのGoogle AI Studio上の実際の無料枠モデル。
  // 旧gemini-2.0-flashは2026-06-01に提供終了済み（MVP_SPEC.md参照）
  const model = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
  // AnthropicのassistantロールはGeminiでは"model"
  const contents = messages.map((m) => {
    const parts = [];
    if (m.image) parts.push({ inlineData: { mimeType: m.image.mimeType, data: m.image.data } });
    if (m.audio) parts.push({ inlineData: { mimeType: m.audio.mimeType, data: m.audio.data } });
    if (m.content) parts.push({ text: m.content });
    return { role: m.role === "assistant" ? "model" : "user", parts };
  });

  const generationConfig = { maxOutputTokens: maxTokens };
  // Gemini 3系は内部の思考(thinking)にmaxOutputTokensの一部を使うため、
  // 構造化JSONのような即答でよい用途ではthinkingLevelを下げて打ち切りを防ぐ
  if (thinkingLevel) {
    generationConfig.thinkingConfig = { thinkingLevel };
  }
  if (temperature != null) {
    generationConfig.temperature = temperature;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig,
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

export const PROVIDERS = { anthropic: callAnthropic, gemini: callGemini };

const API_KEY_ENV = { anthropic: "ANTHROPIC_API_KEY", gemini: "GEMINI_API_KEY" };

export function resolveProvider() {
  return process.env.AI_PROVIDER === "gemini" ? "gemini" : "anthropic";
}

/* AI_PROVIDER環境変数の設定ミスや、一方のプロバイダの請求停止・レート
   制限で「バトラーが何も答えられない」状態になるのを避けるための備え。
   主要プロバイダが失敗した場合、もう一方のAPIキーが設定されていれば
   自動でそちらに切り替えて再試行する。両方失敗したら主要プロバイダの
   エラーをそのまま返す（Anthropicのクレジット切れを実際に踏んだ経験を
   踏まえた実装）。 */
export async function callAI({ systemPrompt, messages, maxTokens = 500, thinkingLevel, temperature }) {
  const primary = resolveProvider();
  const primaryResult = await PROVIDERS[primary]({ systemPrompt, messages, maxTokens, thinkingLevel, temperature });
  if (!primaryResult.error) {
    return { ...primaryResult, provider: primary };
  }

  const secondary = primary === "gemini" ? "anthropic" : "gemini";
  if (!process.env[API_KEY_ENV[secondary]]) {
    return { ...primaryResult, provider: primary };
  }

  console.error(`callAI: ${primary}が失敗したため${secondary}へ自動切り替え:`, primaryResult.error);
  const secondaryResult = await PROVIDERS[secondary]({ systemPrompt, messages, maxTokens, thinkingLevel, temperature });
  if (!secondaryResult.error) {
    return { ...secondaryResult, provider: secondary };
  }
  return { ...primaryResult, provider: primary };
}
