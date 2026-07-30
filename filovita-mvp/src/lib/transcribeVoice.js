/* 音声入力のフロントエンド窓口。録音から復元できる「入力にない事実」は
   存在しないため、readDocument.jsと同様に静かなフォールバックは作らない
   ——失敗したときは、断定せず正直にその旨を伝える。 */
export async function transcribeVoice({ base64, mimeType }) {
  const fallbackMessage = "音声を文字起こしできませんでした。この環境ではまだこの機能が使えないかもしれません。";
  try {
    const response = await fetch("/api/transcribe-voice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ audio: base64, mimeType }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.transcript) {
      return { error: data?.error || fallbackMessage };
    }
    return { transcript: data.transcript };
  } catch {
    return { error: fallbackMessage };
  }
}
