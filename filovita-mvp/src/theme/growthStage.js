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

export function getMonthNumber(dateStr) {
  return Number(dateStr.slice(5, 7));
}

/* 「変化は希少である」の希少さを担保するためのハッシュ。
   同じ日付なら常に同じ結果を返す（リロードのたびに変わってはいけない）。
   おおよそ5日に1日だけ、何か普段と違うものに出会う。 */
function dayHash(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
  return h;
}

export function hasRareDiscovery(dateStr) {
  return dayHash(dateStr) % 5 === 0;
}
