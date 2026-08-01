import { useState } from "react";
import { Trash2 } from "lucide-react";
import ContextHeader from "../components/ContextHeader.jsx";
import SteelPanel from "../theme/industrial/SteelPanel.jsx";
import OrnateFrame from "../theme/gothic/OrnateFrame.jsx";
import BarkPanel from "../theme/forest/BarkPanel.jsx";

const WEEKDAYS = [
  { key: "mon", label: "月" },
  { key: "tue", label: "火" },
  { key: "wed", label: "水" },
  { key: "thu", label: "木" },
  { key: "fri", label: "金" },
  { key: "sat", label: "土" },
  { key: "sun", label: "日" },
];

/* 選んだ曜日に足すためのフォーム。曜日はすでにセルの選択で決まっているため、
   ここでは聞かない（2026-08-01、利用者からの要望：日付を押した先で
   その場に足せる方が分かりやすい）。 */
function AddForm({ tokens, dayOfWeek, onAdd }) {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [label, setLabel] = useState("");
  const [provider, setProvider] = useState("");

  function submit() {
    if (!startTime || !label.trim()) return;
    onAdd({
      kind: "regular",
      repeat: { type: "weekly", dayOfWeek },
      date: null,
      startTime,
      endTime: endTime || null,
      label: label.trim(),
      provider: provider.trim() || null,
      lifeAttributes: { category: null, location: null, travelLoad: null, prepLoad: null, recoveryTime: null },
    });
    setStartTime("");
    setEndTime("");
    setLabel("");
    setProvider("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }} data-testid="weekly-life-add-form">
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
          data-testid="weekly-life-start-time"
          style={{ width: 100, padding: "9px 8px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
        />
        <span style={{ alignSelf: "center", color: tokens.inkFaint, fontSize: 12 }}>〜</span>
        <input
          type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
          placeholder="任意"
          data-testid="weekly-life-end-time"
          style={{ width: 100, padding: "9px 8px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
        />
      </div>
      <input
        type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="内容（例：身体介護＋家事援助）"
        data-testid="weekly-life-label"
        style={{ padding: "9px 11px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="事業所名（任意）"
          data-testid="weekly-life-provider"
          style={{ flex: 1, padding: "9px 11px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
        />
        <button
          onClick={submit}
          data-testid="weekly-life-add-button"
          style={{ padding: "9px 16px", fontSize: 12.5, borderRadius: 9, border: "none", background: tokens.ink, color: tokens.paper, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          追加
        </button>
      </div>
    </div>
  );
}

/* ⑫今週の暮らし——「カレンダー予定」ではなく、この人の生活に何が
   組み込まれているかを最初に記録する場所として設計した(2026-08-01、
   利用者との生活モデル設計対話より)。定期予定（毎週）だけをここに
   表示する。不定期予定（往診等、曜日不定・次回日時がその都度分かる
   もの）や単発予定は、種類が違うため、あえてここには出さない——ただし
   「今週表に出さない」ことと「生活モデルから消す」ことは別であり、
   データとしては`kind: "irregular"` / `"single"`で保持し続ける想定
   （docs/LIFE_MODEL.md「未着手」参照、まだ入力UIは無い）。

   生活属性（種別・移動負荷・準備負荷・回復時間）は、データの箱だけを
   用意し、値は空のまま第一版では扱わない——Butlerが予定の生活への影響を
   読めるようにする第二版で使う。個人の担当者名は記録しない（利用者の
   意向）。事業所名は記録してよい。

   曜日は、カレンダー画面の「日付を押すとその日が開く」操作と同じ形に
   揃えた（2026-08-01、利用者からの要望：見慣れた操作の方が分かりやすい・
   足しやすい）。7曜日を横一列に並べ、押した曜日だけその場に展開する。 */
export default function WeeklyLifeScreen({ theme, weeklyLife, onAdd, onRemove, onBack }) {
  const { tokens } = theme;
  const isIndustrial = theme.componentTheme === "industrial";
  const isGothic = theme.componentTheme === "gothic";
  const isForest = theme.componentTheme === "forest";
  const [selectedDay, setSelectedDay] = useState(null);

  const regularItems = weeklyLife.filter((item) => item.kind === "regular");

  const byDay = WEEKDAYS.map((d) => ({
    ...d,
    items: regularItems
      .filter((item) => item.repeat?.dayOfWeek === d.key)
      .slice()
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));
  const selected = byDay.find((d) => d.key === selectedDay) ?? null;

  const listBody = (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
        {byDay.map((d) => {
          const isSelected = d.key === selectedDay;
          return (
            <button
              key={d.key}
              onClick={() => setSelectedDay(isSelected ? null : d.key)}
              data-testid={`weekly-life-day-toggle-${d.key}`}
              style={{
                position: "relative",
                aspectRatio: "1",
                border: isSelected ? `2px solid ${tokens.ink}` : `1px solid ${tokens.line}`,
                borderRadius: 10,
                background: isSelected ? tokens.accent : d.items.length > 0 ? tokens.card : "transparent",
                color: isSelected ? tokens.paper : tokens.ink,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0,
              }}
            >
              {d.label}
              {d.items.length > 0 && (
                <span
                  style={{
                    position: "absolute", bottom: 5, width: 4, height: 4, borderRadius: "50%",
                    background: isSelected ? tokens.paper : tokens.accent,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {selected ? (
        <div style={{ marginTop: 16 }} data-testid={`weekly-life-day-${selected.key}`}>
          <div style={{ fontSize: 12, fontWeight: 700, color: tokens.inkSoft, marginBottom: 8 }}>{selected.label}曜日</div>
          {selected.items.length === 0 ? (
            <p style={{ fontSize: 12.5, color: tokens.inkFaint }}>まだ、決まった予定は登録されていません。</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {selected.items.map((item) => (
                <div
                  key={item.id}
                  data-testid="weekly-life-item"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "9px 12px", border: `1px solid ${tokens.line}`, borderRadius: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13.5, color: tokens.ink }}>
                      {item.startTime}{item.endTime ? `〜${item.endTime}` : ""}　{item.label}
                    </div>
                    {item.provider && (
                      <div style={{ fontSize: 12, color: tokens.inkFaint, marginTop: 2 }}>{item.provider}</div>
                    )}
                  </div>
                  <button
                    onClick={() => onRemove(item.id)}
                    style={{ background: "none", border: "none", color: tokens.inkFaint, cursor: "pointer", padding: 2 }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <AddForm tokens={tokens} dayOfWeek={selected.key} onAdd={onAdd} />
        </div>
      ) : (
        <p style={{ fontSize: 12.5, color: tokens.inkFaint, marginTop: 14 }}>
          曜日を選ぶと、その日の予定が見られます。
        </p>
      )}
    </>
  );

  return (
    <div>
      <ContextHeader theme={theme} breadcrumb="生活モデル" title="今週の暮らし" onBack={onBack} />
      <div style={{ padding: "0 20px 30px" }}>
        <p style={{ fontSize: 12.5, color: tokens.inkFaint, marginBottom: 18 }}>
          毎週決まって入っている予定です。曜日を押すと、その日の予定を見たり
          足したりできます。
        </p>
        {isIndustrial ? (
          <SteelPanel>{listBody}</SteelPanel>
        ) : isGothic ? (
          <OrnateFrame>{listBody}</OrnateFrame>
        ) : isForest ? (
          <BarkPanel>{listBody}</BarkPanel>
        ) : (
          listBody
        )}
      </div>
    </div>
  );
}
