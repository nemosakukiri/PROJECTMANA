/* Time Philosophy：旅にとって時間は攻略ではない。帳面も地図も、最初からずっと同じ。
   変わるのは記録の数だけ——歩いた日、書き留めた日の分だけ、同じページの余白に
   スクラップブックのしるし(押し花・チケット・スタンプ)が少しずつ増えていく。
   月末の姿は「記録された姿」。地図を描き切ることではなく、増えたしるしの数がそのまま
   その月に歩いた証になる。 */
export function journalCaption(recordedCount) {
  if (recordedCount === 0) return "まだ何も貼られていない旅ノート";
  if (recordedCount <= 3) return `旅のしるしが${recordedCount}つ増えた`;
  if (recordedCount <= 7) return `旅のしるしが${recordedCount}つ、少しずつ賑やかに`;
  return `旅のしるしが${recordedCount}つ、ページいっぱいに`;
}

import { rareMoment, traceLayout } from "../worldEngine.js";

/* User Traces：記録した日にだけ、ページの余白に増えていく旅のしるし */
export function journalTraces(recordedDays) {
  return traceLayout(recordedDays, { bottomBase: 10, bottomJitter: 74, leftMargin: 8 });
}

/* Rare Moments：まれに見つかる特別な発見。説明はしない */
export function hasRareDiscovery(dateStr) {
  return rareMoment(dateStr, "travelFind", 0.16);
}
