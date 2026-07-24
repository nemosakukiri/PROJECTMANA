/* 仮AI（入力にない事実を作らない）
   結論は入力テキストをそのまま渡し、ToDoは抽出せず空配列で返す。
   本物のgenerateDraftに差し替えるときも、呼び出し口の形は変えない。 */
export function generateDraftFake(rawInput) {
  return { conclusion: { value: rawInput.trim(), confidence: 1 }, todos: [] };
}
