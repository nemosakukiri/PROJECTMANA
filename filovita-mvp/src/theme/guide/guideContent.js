/* 案内人の言葉。ヘルプではなくアシスト——マニュアル調の説明文にしない。
   「〜とは」で始めず、隣に座った誰かが話しかける文体にする。
   ONBOARDING.mdの文例をそのまま採用。 */
export const GUIDES = [
  { id: "calendar", emoji: "👋", text: "起きたことが、そのままここに並びます。\n\n予定ではなく、暮らしの記録です。" },
  { id: "input", emoji: "🎤", text: "話しても、書いても残せます。\n\n整理はあとでAIが手伝います。" },
  { id: "tags", emoji: "🏷", text: "よく会う人や、よく行く場所につけます。\n\nあとで出来事を探しやすくなります。" },
  { id: "toolbox", emoji: "🧰", text: "電話番号や地図を、タグに登録できます。\n\n次からすぐ使えます。" },
];

export function guideById(id) {
  return GUIDES.find((g) => g.id === id);
}
