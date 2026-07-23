/* 手帳だけの道具：強調(マーカー・アンダーライン・重要・注意・あとで見る)。
   紙の手帳の「マーカー派・アンダーライン派・赤丸派・星印派」の癖を、
   1つの「強調機能」として選べるようにする。装飾ではなく、あとで
   その一文だけを素早く見つけるための実用品。 */
export const MARK_TYPES = [
  { type: "marker", emoji: "🟨", label: "マーカー", style: { background: "#FFF3A0" } },
  { type: "underline", emoji: "✏️", label: "アンダーライン", style: { textDecoration: "underline", textDecorationColor: "#3F5C42", textDecorationThickness: "2px", textUnderlineOffset: "2px" } },
  { type: "important", emoji: "⭐", label: "重要", style: { background: "#FFE9A8", fontWeight: 700 } },
  { type: "caution", emoji: "❗", label: "注意", style: { background: "#FFD9D9", color: "#B23B3B", fontWeight: 700 } },
  { type: "later", emoji: "📌", label: "あとで見る", style: { background: "#DCEBFF" } },
];

export function markTypeInfo(type) {
  return MARK_TYPES.find((m) => m.type === type) ?? MARK_TYPES[0];
}
