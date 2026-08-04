/* Time Philosophy：旅にとって時間は攻略ではない。帳面も地図も、最初からずっと同じ。
   変わるのは記録の数だけ——歩いた日、書き留めた日の分だけ、同じページの余白に
   スクラップブックのしるし(押し花・チケット・スタンプ)が少しずつ増えていく。
   月末の姿は「記録された姿」。地図を描き切ることではなく、増えたしるしの数がそのまま
   その月に歩いた証になる。

   ただし旅は他テーマより「情報量が増えやすい」テーマでもある。森やSFには元から余白があるが、
   旅は記録が増えるほど密度が上がる一方なので、以下の3つを設計ルールとして守る：
   1. パーツは最後まで全部埋めない（枠の数より少なく見せる）
   2. 余白そのものをデザインとして残す（枠は紙面の余白部分にだけ置く）
   3. 増えたパーツ同士は重ならない（固定の枠に一つずつだけ、早い者勝ちで場所を譲り合う） */
export function journalCaption(recordedCount) {
  if (recordedCount === 0) return "まだ何も貼られていない旅ノート";
  if (recordedCount <= 3) return `旅のしるしが${recordedCount}つ増えた`;
  if (recordedCount <= 7) return `旅のしるしが${recordedCount}つ、少しずつ賑やかに`;
  return `旅のしるしが${recordedCount}つ、静かに積み重なっている`;
}

import { rareMoment } from "../worldEngine.js";

/* 紙面の余白（挿絵や見出しの少ない縁）にだけ置く、固定の置き場。
   中央の挿絵の上には置かない——余白を余白のまま残すための枠。 */
const SLOTS = [
  { right: "2%", top: "14%" },
  { left: "2%", top: "25%" },
  { right: "2%", top: "36%" },
  { left: "2%", top: "47%" },
  { right: "2%", top: "58%" },
  { left: "2%", top: "69%" },
  { right: "2%", top: "80%" },
  { left: "2%", top: "91%" },
];

/* 枠の数より少なく見せる：どれだけ記録が増えても、最後まで全部は埋めない */
const MAX_VISIBLE = 6;

function slotHash(day) {
  const seed = `travelSlot:${day}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/* User Traces：記録した日にだけ増えていく旅のしるし。
   月の前半〜後半から均等に間引いて選び、固定枠に一つずつ、重ならないように配置する。 */
export function journalTraces(recordedDays) {
  if (recordedDays.length === 0) return [];
  const sorted = [...recordedDays].sort((a, b) => a - b);
  const count = Math.min(sorted.length, MAX_VISIBLE);
  const picked = Array.from({ length: count }, (_, i) => sorted[Math.floor((i * sorted.length) / count)]);

  const usedSlots = new Set();
  return picked.map((day) => {
    let slotIndex = slotHash(day) % SLOTS.length;
    while (usedSlots.has(slotIndex)) slotIndex = (slotIndex + 1) % SLOTS.length;
    usedSlots.add(slotIndex);
    return { day, ...SLOTS[slotIndex] };
  });
}

/* Rare Moments：まれに見つかる特別な発見。説明はしない */
export function hasRareDiscovery(dateStr) {
  return rareMoment(dateStr, "travelFind", 0.16);
}
