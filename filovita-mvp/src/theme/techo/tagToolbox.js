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
