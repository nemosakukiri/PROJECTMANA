/* 生活資料ライブラリのフロントエンド窓口。写真から復元できる「入力にない
   事実」は存在しないため、generateDraft.jsのような静かなフォールバックは
   作らない——失敗したときは、断定せず正直にその旨を伝える。 */
export async function readDocument({ base64, mimeType }) {
  const fallbackMessage = "資料を読み取れませんでした。この環境ではまだこの機能が使えないかもしれません。";
  try {
    const response = await fetch("/api/read-document", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: base64, mimeType }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.conclusion) {
      return { error: data?.error || fallbackMessage };
    }
    return {
      draft: {
        conclusion: { value: data.conclusion, confidence: 1 },
        todos: (data.todos || []).map((text) => ({ text })),
      },
      docType: data.docType,
      docTypeLabel: data.docTypeLabel,
    };
  } catch {
    return { error: fallbackMessage };
  }
}
