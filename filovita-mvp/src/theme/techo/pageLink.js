/* 手帳だけの道具：ページリンク。「→ 8月5日を見る」のように、日付を含む文字列から
   実際の日付(YYYY-MM-DD)を取り出し、その日のページへ飛べるようにする。
   紙の手帳で「あのページ見て」とめくる感覚をEventシステムと結びつける。 */
export function parseJpDateToStr(text, year = 2026) {
  const m = text?.match(/(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  const month = String(m[1]).padStart(2, "0");
  const day = String(m[2]).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
