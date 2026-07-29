/* 本物のAI(api/generate-draft.js、lib/generateDraft.js経由)が使えない
   環境（バックエンド不在・応答失敗）でのフォールバック。結論は入力
   テキストをそのまま渡し、ToDoは抽出せず空配列で返す——これ自体が
   「入力にない事実を作らない」を満たす、断定しない代替である。 */
export function generateDraftFake(rawInput) {
  return { conclusion: { value: rawInput.trim(), confidence: 1 }, todos: [] };
}
