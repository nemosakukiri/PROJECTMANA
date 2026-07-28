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
