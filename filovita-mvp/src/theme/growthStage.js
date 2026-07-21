/* 背景は装飾ではなく、そのテーマの世界そのもの。
   カレンダーの日付が進むにつれ、月末に向けて少しずつ育っていく。
   5段階：1〜2日／3〜9日／10〜19日／20〜29日／30〜31日 */

export function getDayOfMonth(dateStr) {
  return Number(dateStr.slice(-2));
}

export function getMonthStage(day) {
  if (day <= 2) return 0;
  if (day <= 9) return 1;
  if (day <= 19) return 2;
  if (day <= 29) return 3;
  return 4;
}
