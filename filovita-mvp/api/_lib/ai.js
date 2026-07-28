/* Anthropic/Gemini呼び出しの共通部分。shopping-chat.js・shopping-final-verdict.js
   から共有する。プロバイダはAI_PROVIDER環境変数で切り替える（"gemini" | "anthropic"、
   未設定時は"anthropic"）。APIキーはここ(サーバー側)だけで扱う。 */

export async function callAnthropic({ systemPrompt, messages, maxTokens = 500 }) {
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

export async function callGemini({ systemPrompt, messages, maxTokens = 500 }) {
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
        generationConfig: { maxOutputTokens: maxTokens },
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

export function resolveProvider() {
  return process.env.AI_PROVIDER === "gemini" ? "gemini" : "anthropic";
}
