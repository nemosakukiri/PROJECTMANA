import { generateDraftFake } from "./fakeGenerateDraft.js";

/* 入力(話した内容・書いた内容)から、実際にAIへ下書き生成を依頼する。
   バックエンドが無い環境（ローカル開発・GitHub Pages）や、AIが失敗した
   場合は、入力をそのまま結論として使う仮生成(generateDraftFake)に
   フォールバックする——このフォールバック自体が「入力にない事実を
   作らない」という制約を満たしているため、失敗時に断定的な代替を
   作り出すことにはならない。 */
export async function generateDraft(rawInput) {
  try {
    const response = await fetch("/api/generate-draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: rawInput }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.conclusion) {
      return generateDraftFake(rawInput);
    }
    return {
      conclusion: { value: data.conclusion, confidence: 1 },
      todos: (data.todos || []).map((text) => ({ text })),
    };
  } catch {
    return generateDraftFake(rawInput);
  }
}
