import { useState } from "react";
import { Plus, Mic, Trash2 } from "lucide-react";
import { eventsOnDate, formatDateLabel } from "../data/fakeEvents.js";
import ContextHeader from "../components/ContextHeader.jsx";
import SteelPanel from "../theme/industrial/SteelPanel.jsx";
import OrnateFrame from "../theme/gothic/OrnateFrame.jsx";
import BarkPanel from "../theme/forest/BarkPanel.jsx";

/* この日一回だけの予定（往診・通院など）を足すフォーム。「今週の暮らし」の
   繰り返し予定とは別物として扱う——あちらは「毎週決まっていること」、
   こちらは「この日だけ決まっていること」(2026-08-03、利用者からの実例
   ：今週土曜の整形外科。日付をクリックしても出てこなかったことで発覚
   した、単発予定の入力先が無いという欠け。docs/LIFE_MODEL.md参照)。 */
function SinglePlanForm({ tokens, date, onAdd, onDone }) {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [label, setLabel] = useState("");
  const [provider, setProvider] = useState("");

  function submit() {
    if (!label.trim()) return;
    onAdd({
      kind: "single",
      date,
      startTime: startTime || "",
      endTime: endTime || null,
      label: label.trim(),
      provider: provider.trim() || null,
      lifeAttributes: { category: null, location: null, travelLoad: null, prepLoad: null, recoveryTime: null },
    });
    onDone();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }} data-testid="single-plan-add-form">
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
          data-testid="single-plan-start-time"
          style={{ width: 100, padding: "9px 8px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
        />
        <span style={{ alignSelf: "center", color: tokens.inkFaint, fontSize: 12 }}>〜</span>
        <input
          type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
          placeholder="任意"
          data-testid="single-plan-end-time"
          style={{ width: 100, padding: "9px 8px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
        />
      </div>
      <input
        type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="内容（例：整形外科）"
        data-testid="single-plan-label"
        style={{ padding: "9px 11px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="場所（任意）"
          data-testid="single-plan-provider"
          style={{ flex: 1, padding: "9px 11px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
        />
        <button
          onClick={submit}
          data-testid="single-plan-add-button"
          style={{ padding: "9px 16px", fontSize: 12.5, borderRadius: 9, border: "none", background: tokens.ink, color: tokens.paper, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          追加
        </button>
      </div>
    </div>
  );
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
function dateToDayKey(dateStr) {
  if (!dateStr) return null;
  return DAY_KEYS[new Date(`${dateStr}T00:00:00`).getDay()];
}

/* ②その日のEvent一覧（見出しのみ）＋この日の予定（毎週決まっているもの＋
   単発）。「日付をクリックした先に予定が反映されていない」という指摘
   (2026-08-03)——単発予定を足す欄を追加しただけでは、既存の「今週の
   暮らし」の毎週の予定(BLUE・訪問看護等)がここには出てこなかった。
   両方をこの1ページにまとめて出す。毎週の予定はここでは編集・削除
   させない(「今週の暮らし」画面側の役割のまま。ここで消すと繰り返しの
   パターンごと消えてしまうため)。 */
export default function DayEventListScreen({ theme, events, date, inputMode, onOpenEvent, onBack, onNew, weeklyLife = [], onAddWeeklyLife, onRemoveWeeklyLife }) {
  const { tokens } = theme;
  const isIndustrial = theme.componentTheme === "industrial";
  const isGothic = theme.componentTheme === "gothic";
  const isForest = theme.componentTheme === "forest";
  const dayEvents = eventsOnDate(events, date);
  const label = dayEvents[0]?.dateLabel ?? (date ? formatDateLabel(date) : "");
  const [addingPlan, setAddingPlan] = useState(false);
  const dayKey = dateToDayKey(date);
  const regularPlans = weeklyLife.filter((item) => item.kind === "regular" && item.repeat?.dayOfWeek === dayKey);
  const singlePlans = weeklyLife.filter((item) => item.kind === "single" && item.date === date);
  const allPlans = [...regularPlans, ...singlePlans].sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

  return (
    <div>
      <ContextHeader theme={theme} breadcrumb="カレンダー" title={label} onBack={onBack} />
      <div style={{ padding: "10px 20px 0" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: tokens.inkSoft, marginBottom: 8 }}>この日の予定</div>
        {allPlans.length === 0 && !addingPlan && (
          <p style={{ fontSize: 12.5, color: tokens.inkFaint, marginBottom: 10 }}>まだ、この日の予定は登録されていません。</p>
        )}
        {allPlans.map((item) => (
          <div
            key={item.id}
            data-testid={item.kind === "single" ? "single-plan-item" : "regular-plan-item"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "9px 12px", border: `1px solid ${tokens.line}`, borderRadius: 10, marginBottom: 6,
            }}
          >
            <div>
              <div style={{ fontSize: 13.5, color: tokens.ink }}>
                {item.startTime}{item.endTime ? `〜${item.endTime}` : ""}　{item.label}
                {item.kind === "regular" && (
                  <span style={{ fontSize: 10.5, color: tokens.inkFaint, marginLeft: 6, border: `1px solid ${tokens.line}`, borderRadius: 999, padding: "1px 7px" }}>
                    毎週
                  </span>
                )}
              </div>
              {item.provider && (
                <div style={{ fontSize: 12, color: tokens.inkFaint, marginTop: 2 }}>{item.provider}</div>
              )}
            </div>
            {item.kind === "single" && (
              <button
                onClick={() => onRemoveWeeklyLife?.(item.id)}
                style={{ background: "none", border: "none", color: tokens.inkFaint, cursor: "pointer", padding: 2 }}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
        {addingPlan ? (
          <SinglePlanForm
            tokens={tokens} date={date}
            onAdd={(entry) => onAddWeeklyLife?.(entry)}
            onDone={() => setAddingPlan(false)}
          />
        ) : (
          <button
            onClick={() => setAddingPlan(true)}
            data-testid="single-plan-open-form"
            style={{
              background: "none", border: `1px dashed ${tokens.line}`, borderRadius: 10, color: tokens.inkSoft,
              fontSize: 12.5, padding: "8px 12px", cursor: "pointer", marginBottom: 20,
            }}
          >
            ＋ この日の予定を足す
          </button>
        )}

        <div style={{ fontSize: 12, color: tokens.inkFaint, marginBottom: 14 }}>{dayEvents.length}件の記録</div>
        {dayEvents.map((ev) =>
          isIndustrial ? (
            <SteelPanel
              key={ev.id}
              as="button"
              onClick={() => onOpenEvent(ev.id)}
              style={{ marginBottom: 10, cursor: "pointer" }}
            >
              <div style={{ fontSize: 11, color: tokens.inkFaint }}>{ev.kind}</div>
              <div style={{ fontSize: 14.5, color: tokens.ink, marginTop: 3 }}>{ev.conclusion}</div>
            </SteelPanel>
          ) : isGothic ? (
            <OrnateFrame
              key={ev.id}
              as="button"
              onClick={() => onOpenEvent(ev.id)}
              style={{ marginBottom: 12, cursor: "pointer" }}
            >
              <div style={{ fontSize: 11, color: tokens.inkFaint }}>{ev.kind}</div>
              <div style={{ fontSize: 14.5, color: tokens.ink, marginTop: 3 }}>{ev.conclusion}</div>
            </OrnateFrame>
          ) : isForest ? (
            <BarkPanel
              key={ev.id}
              as="button"
              onClick={() => onOpenEvent(ev.id)}
              style={{ marginBottom: 14, cursor: "pointer" }}
            >
              <div style={{ fontSize: 11, color: tokens.inkFaint }}>{ev.kind}</div>
              <div style={{ fontSize: 14.5, color: tokens.ink, marginTop: 3 }}>{ev.conclusion}</div>
            </BarkPanel>
          ) : (
            <button
              key={ev.id}
              onClick={() => onOpenEvent(ev.id)}
              style={{
                display: "block", width: "100%", textAlign: "left", background: tokens.card,
                border: `1px solid ${tokens.line}`, borderRadius: 12, padding: "13px 15px", marginBottom: 8, cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 11, color: tokens.inkFaint }}>{ev.kind}</div>
              <div style={{ fontSize: 14.5, color: tokens.ink, marginTop: 3 }}>{ev.conclusion}</div>
            </button>
          )
        )}
      </div>

      <button
        onClick={onNew}
        style={{
          position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 26, width: 58, height: 58,
          borderRadius: "50%",
          background: isForest
            ? "radial-gradient(circle at 40% 35%, #7C5C3B 0%, #5C4530 45%, #3A2D1E 100%)"
            : tokens.ink,
          color: tokens.paper, border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 6px 18px rgba(0,0,0,0.2)", cursor: "pointer",
        }}
      >
        {inputMode === "speak" ? <Mic size={24} /> : <Plus size={26} />}
      </button>
    </div>
  );
}
