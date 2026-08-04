/* World Engine ——「森を作る仕組み」ではなく「一か月を一つの世界として暮らす仕組み」。
   ここに置くのは、どのテーマにも共通する土台だけ。絵・物語・言葉は各テーマ側(theme/<name>/)が持つ。

   Time Philosophy  … 日付から、月内のどのあたりかを取り出す
   Living Changes   … 「発見イベント」ではなく、独立した小さな今日らしさの集まり
   Rare Moments     … Living Changesよりもさらに希少で、はっきり目立ってよい特別な一日
   User Traces      … 記録のある日にだけ残る、暮らしの跡の配置
   （Monthly Story・Seasonal Toneは、テーマごとの絵や言葉そのものなのでエンジン側には置かない） */

export function getDayOfMonth(dateStr) {
  return Number(dateStr.slice(-2));
}

export function getMonthNumber(dateStr) {
  return Number(dateStr.slice(5, 7));
}

/* Time Philosophy の既定値：1か月を5段階に均す。
   テーマが「時間は何を変えるのか」への答えとしてこの区切り方自体を変えてもよい。今はまだ全テーマ共通。 */
export function getMonthStage(day) {
  if (day <= 2) return 0;
  if (day <= 9) return 1;
  if (day <= 19) return 2;
  if (day <= 29) return 3;
  return 4;
}

function seededRatio(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

/* Living Changes：一つの「発見イベント」に頼らず、独立した小さな信号の組み合わせで
   「なぜかは分からないけど今日は違う」を作る。同じ日付なら常に同じ結果になる。
   signalDefsは {信号名: 起きる割合(0〜1)}。何が信号になるかはテーマごとに違ってよい。 */
export function livingSignals(dateStr, signalDefs) {
  const out = {};
  for (const [key, frequency] of Object.entries(signalDefs)) {
    out[key] = seededRatio(`${dateStr}:${key}`) < frequency;
  }
  return out;
}

/* 0〜1の連続値が欲しい信号（位置のずれ、明るさの揺れなど）向け。booleanにしたくない時はこちらを使う。 */
export function livingRatio(dateStr, name) {
  return seededRatio(`${dateStr}:ratio:${name}`);
}

/* Rare Moments：Living Changesより希少で、演出として目立ってよい特別な出来事。
   仕組みは同じ日付シードだが、目的が違う——「今日は特別」と気づいてもらってよい。 */
export function rareMoment(dateStr, name, frequency) {
  return seededRatio(`${dateStr}:rare:${name}`) < frequency;
}

/* User Traces：記録した日にだけ残る印の配置。絵や色はテーマ側が決める。 */
export function traceLayout(recordedDays, { bottomBase = 12, bottomJitter = 14, leftMargin = 6 } = {}) {
  return recordedDays.map((day) => ({
    day,
    left: `${leftMargin + (Math.min(day, 31) / 31) * (100 - leftMargin * 2)}%`,
    bottom: `${bottomBase + ((day * 53) % bottomJitter)}px`,
  }));
}
