/* 案内人の言葉。ヘルプではなくアシスト——マニュアル調の説明文にしない。
   「〜とは」で始めず、隣に座った誰かが話しかける文体にする。
   ONBOARDING.mdの文例をそのまま採用。 */
export const GUIDES = [
  { id: "calendar", emoji: "👋", text: "ここがあなたの生活です。予定ではなく、起こった出来事がここに並びます。" },
  { id: "input", emoji: "🎤", text: "ここから出来事を残せます。話しても、書いても大丈夫。あとでAIが整理を手伝います。" },
  { id: "tags", emoji: "🏷", text: "タグは人や場所とのつながりです。何度も出てくるものを登録すると、あとで探しやすくなります。" },
  { id: "toolbox", emoji: "🧰", text: "タグには道具を入れられます。電話番号や地図を一度登録すると、次からすぐ使えます。" },
];

export function guideById(id) {
  return GUIDES.find((g) => g.id === id);
}
