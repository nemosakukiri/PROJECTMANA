export function formatScheduleLines(entries = []) {
  return (
    entries
      .map((e) => `  - ${e.label}：${e.date}${e.amount != null ? `（¥${Number(e.amount).toLocaleString()}）` : ""}`)
      .join("\n") || "  （なし）"
  );
}

export function todayLabel() {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(
    new Date()
  );
}

const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const WEEKDAY_LABEL = { mon: "月", tue: "火", wed: "水", thu: "木", fri: "金", sat: "土", sun: "日" };

// 「今週の暮らし」（②暮らしの定期予定）を、家計相談のコンテキストにも
// 渡すための整形。今日の日付（todayLabel、曜日を含む）と合わせて渡すことで、
// 「明日は○○がありますね」のように暮らしの予定と家計の話をつなげられる
// ようにする（2026-08-01、利用者からの要望——家計とスケジュールをつなげたい）。
export function formatWeeklyLifeLines(weeklyLife = []) {
  const regular = weeklyLife.filter((i) => i.kind === "regular" && i.repeat?.dayOfWeek);
  if (regular.length === 0) return "  （まだ登録されていません）";
  return WEEKDAY_ORDER.map((day) => {
    const items = regular
      .filter((i) => i.repeat.dayOfWeek === day)
      .slice()
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (items.length === 0) return null;
    const line = items
      .map((i) => `${i.startTime}${i.endTime ? `〜${i.endTime}` : ""} ${i.label}${i.provider ? `（${i.provider}）` : ""}`)
      .join("／");
    return `  - ${WEEKDAY_LABEL[day]}曜：${line}`;
  })
    .filter(Boolean)
    .join("\n");
}
