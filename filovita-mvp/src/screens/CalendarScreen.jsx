import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { eventsOnDate, daysInMonth, firstWeekday } from "../data/fakeEvents.js";
import SteelPanel from "../theme/industrial/SteelPanel.jsx";
import WarnLamp from "../theme/industrial/WarnLamp.jsx";
import OrnateFrame from "../theme/gothic/OrnateFrame.jsx";
import CandleFlicker from "../theme/gothic/CandleFlicker.jsx";

/* ①カレンダー（中心画面） */
export default function CalendarScreen({ theme, events, onOpenDate, onNew, onOpenSettings }) {
  const { tokens, labels } = theme;
  const isIndustrial = theme.componentTheme === "industrial";
  const isGothic = theme.componentTheme === "gothic";
  const [showContinuation, setShowContinuation] = useState(false);
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const totalOpenTodos = events.reduce((s, e) => s + e.todos.filter((t) => !t.done).length, 0);
  const nextEvt = events.find((e) => e.nextEvent)?.nextEvent;

  const continuationContent = (
    <>
      {totalOpenTodos > 0 ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          {isIndustrial && <WarnLamp active />}
          {isGothic && <CandleFlicker active />}
          {labels.todoRemainingLabel} <strong style={{ color: tokens.accent }}>{totalOpenTodos}件</strong>
        </span>
      ) : (
        <span>{labels.todoNoneLabel}</span>
      )}
      {nextEvt && <><span style={{ color: tokens.line }}> ・ </span><span>{labels.nextLabel} <strong>{nextEvt}</strong></span></>}
    </>
  );

  return (
    <div>
      <div style={{ padding: "24px 20px 6px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", color: tokens.inkFaint }}>Filovita</div>
          <h1 style={{ fontFamily: tokens.headingFont, fontSize: 22, fontWeight: 700, margin: "4px 0 0", color: tokens.ink }}>
            {labels.calendarHeading}
          </h1>
        </div>
        <button
          onClick={onOpenSettings}
          style={{ background: "none", border: "none", color: tokens.inkFaint, cursor: "pointer", padding: 6, marginTop: 2 }}
        >
          <Settings size={19} />
        </button>
      </div>

      <div style={{ padding: "14px 20px 0" }}>
        {/* 今日の続き：数字を並べたままにせず、聞かれたら答える形にする */}
        {!showContinuation ? (
          <button
            onClick={() => setShowContinuation(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
              padding: "6px 2px", marginBottom: 16, fontSize: 12.5, color: tokens.inkFaint, cursor: "pointer",
            }}
          >
            {labels.continuationCta} ›
          </button>
        ) : isIndustrial ? (
          <SteelPanel style={{ fontSize: 13, color: tokens.inkSoft, marginBottom: 16 }}>
            {continuationContent}
          </SteelPanel>
        ) : isGothic ? (
          <OrnateFrame style={{ fontSize: 13, color: tokens.inkSoft, marginBottom: 16 }}>
            {continuationContent}
          </OrnateFrame>
        ) : (
          <div style={{
            fontSize: 13, color: tokens.inkSoft, padding: "11px 14px", background: tokens.card,
            border: `1px solid ${tokens.line}`, borderRadius: 12, marginBottom: 16,
          }}>
            {continuationContent}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button style={{ background: "none", border: "none", color: tokens.inkFaint, cursor: "pointer" }}><ChevronLeft size={17} /></button>
          <span style={{ fontFamily: tokens.headingFont, fontSize: 15, fontWeight: 700, color: tokens.ink }}>2026年7月</span>
          <button style={{ background: "none", border: "none", color: tokens.inkFaint, cursor: "pointer" }}><ChevronRight size={17} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", fontSize: 11, color: tokens.inkFaint, textAlign: "center", marginBottom: 4 }}>
          {["日", "月", "火", "水", "木", "金", "土"].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const dateStr = `2026-07-${String(d).padStart(2, "0")}`;
            const dayEvents = eventsOnDate(events, dateStr);
            const isToday = d === 18;
            return (
              <button
                key={i}
                onClick={() => dayEvents.length > 0 && onOpenDate(dateStr)}
                style={{
                  aspectRatio: "1", border: isToday ? `1.5px solid ${tokens.ink}` : "1px solid transparent",
                  borderRadius: 10, background: dayEvents.length > 0 ? tokens.card : "transparent",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  cursor: dayEvents.length > 0 ? "pointer" : "default", fontSize: 12.5, color: tokens.ink, padding: 0,
                }}
              >
                <span>{d}</span>
                {dayEvents.length > 0 && (
                  <span style={{ fontSize: 8.5, color: tokens.inkFaint, marginTop: 1 }}>
                    {"・".repeat(Math.min(dayEvents.length, 3))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={onNew}
        style={{
          position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 26, width: 58, height: 58,
          borderRadius: "50%", background: tokens.ink, color: tokens.paper, border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 6px 18px rgba(0,0,0,0.2)", cursor: "pointer",
        }}
      >
        <Plus size={26} />
      </button>
    </div>
  );
}
