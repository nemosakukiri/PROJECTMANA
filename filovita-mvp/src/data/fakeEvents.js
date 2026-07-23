export const initialEvents = [
  {
    id: "evt_1", date: "2026-07-18", dateLabel: "7月18日（土）", kind: "通院",
    tags: ["医療"], conclusion: "骨に異常なし。薬と湿布を追加して、次回は来月頭に受診。",
    todos: [{ text: "食事の記録をつけて次回持っていく", done: false }],
    nextEvent: "8月5日（水）10:00",
    related: [{ date: "6月15日", label: "通院（湿布追加）" }],
    myNote: "",
  },
  {
    id: "evt_2", date: "2026-07-16", dateLabel: "7月16日（木）", kind: "面談",
    tags: ["京都市"], conclusion: "孫の手嵐山の担当者と打ち合わせ。次回の訪問日程を調整。",
    todos: [], nextEvent: null, related: [], myNote: "",
  },
  {
    id: "evt_3", date: "2026-07-16", dateLabel: "7月16日（木）", kind: "電話",
    tags: ["京都市"], conclusion: "訪問時間の変更について、担当者に確認の電話。",
    todos: [], nextEvent: null, related: [], myNote: "",
  },
  {
    id: "evt_4", date: "2026-07-10", dateLabel: "7月10日（金）", kind: "行政窓口",
    tags: ["京都市"], conclusion: "申請書類は来週までに提出することで合意。",
    todos: [], nextEvent: null, related: [], myNote: "",
  },
];

export function eventsOnDate(events, dateStr) {
  return events.filter((e) => e.date === dateStr);
}

export const daysInMonth = 31;
export const firstWeekday = 3;

const WEEKDAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

export function formatDateLabel(dateStr) {
  const day = Number(dateStr.slice(-2));
  const weekdayIndex = (firstWeekday + (day - 1)) % 7;
  return `7月${day}日（${WEEKDAY_NAMES[weekdayIndex]}）`;
}
