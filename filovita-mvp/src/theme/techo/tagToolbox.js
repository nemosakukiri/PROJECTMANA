/* 手帳だけの情報層：タグの道具箱。
   「タグは分類ではなく、自分専用の道具箱である」——使うほど、そのタグに紐づく
   参照(いつものサイト・地図・電話番号・ファイル・Event)が増えて育っていく。

   tagNameそのものをキーにすると、タグの表示名を変えたときに道具箱との
   紐付けが切れてしまう。そのため、内部的にはtagIdで紐付け、表示名は
   tagRegistry(tagName→tagId)を介して引く。 */
export const REFERENCE_TYPES = [
  { type: "web", emoji: "🌐", label: "Web" },
  { type: "map", emoji: "🗺️", label: "地図" },
  { type: "phone", emoji: "📞", label: "電話" },
  { type: "file", emoji: "📄", label: "ファイル" },
  { type: "event", emoji: "🔗", label: "Event" },
];

export function referenceTypeInfo(type) {
  return REFERENCE_TYPES.find((t) => t.type === type) ?? REFERENCE_TYPES[0];
}

export function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/* 行動のアクセシビリティ：情報を見せるだけで終わらせず、電話をかける・地図を開く・
   サイトを開くところまで実際に到達できるようにする。
   特に音声入力の利用者にとっては、電話番号が「見える」だけでは足りない——
   ボタン一つで発信の画面まで進めることが支援になる。 */
export function referenceHref(ref) {
  if (!ref?.value) return null;
  if (ref.type === "phone") return `tel:${ref.value.replace(/[^\d+]/g, "")}`;
  if (ref.type === "web") return /^https?:\/\//i.test(ref.value) ? ref.value : `https://${ref.value}`;
  if (ref.type === "map") {
    return /^https?:\/\//i.test(ref.value)
      ? ref.value
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ref.value)}`;
  }
  return null;
}

export function referenceActionLabel(type) {
  if (type === "phone") return "電話する";
  if (type === "web") return "開く";
  if (type === "map") return "地図を開く";
  return null;
}
