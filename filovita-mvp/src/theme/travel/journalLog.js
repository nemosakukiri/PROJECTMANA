/* Time Philosophy：旅にとって時間は攻略ではない。地図が少しずつ描き足されていく。
   森が「育つ」なら、旅は「描かれていく」——歩いた分だけ、まっさらな地図に道が伸びる。
   完成する一枚の絵は、その月だけの旅ノートの見開きページ。 */
export const stageLabels = [
  "まだ何も描かれていない地図",
  "森の小道を歩きはじめたところ",
  "湖が見えてきたところ",
  "高台からの景色が見えてきたところ",
  "旅の全貌が見えてきたところ",
];

/* User Traces：記録した日にだけ、地図の余白に増えていく旅のしるし */
export const TRAVEL_MARKS = [
  "きれいな花を見つけた",
  "チケットを貼った",
  "スタンプを押した",
];

import { rareMoment, traceLayout } from "../worldEngine.js";

export function journalTraces(recordedDays) {
  return traceLayout(recordedDays, { bottomBase: 8, bottomJitter: 26, leftMargin: 10 });
}

/* Rare Moments：まれに見つかる特別な発見。説明はしない */
export function hasRareDiscovery(dateStr) {
  return rareMoment(dateStr, "travelFind", 0.16);
}
