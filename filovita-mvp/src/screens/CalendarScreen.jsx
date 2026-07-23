import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { eventsOnDate, daysInMonth, firstWeekday } from "../data/fakeEvents.js";
import SteelPanel from "../theme/industrial/SteelPanel.jsx";
import WarnLamp from "../theme/industrial/WarnLamp.jsx";
import OrnateFrame from "../theme/gothic/OrnateFrame.jsx";
import CandleFlicker from "../theme/gothic/CandleFlicker.jsx";
import BarkPanel from "../theme/forest/BarkPanel.jsx";
import { seasonLabels } from "../theme/forest/seasonLabels.js";
import { moodLabels } from "../theme/gothic/moodLabels.js";
import { buildStoryScene, getHiddenSpot, storyTraces, SCENE_HEIGHT as STORY_SCENE_HEIGHT } from "../theme/storybook/storyScene.js";
import { storyLabels } from "../theme/storybook/storyLabels.js";
import { getMonthStage } from "../theme/worldEngine.js";

const FOREST_DAY_TINT = [0.04, 0.07, 0.1, 0.14, 0.18];
const FOREST_DOT_OPACITY = [0.25, 0.4, 0.55, 0.7, 0.85];

/* ①カレンダー（中心画面） */
export default function CalendarScreen({ theme, events, monthStage, onOpenDate, onNew, onOpenSettings }) {
  const { tokens, labels } = theme;
  const isIndustrial = theme.componentTheme === "industrial";
  const isGothic = theme.componentTheme === "gothic";
  const isForest = theme.componentTheme === "forest";
  const isStorybook = theme.componentTheme === "storybook";
  const [showContinuation, setShowContinuation] = useState(false);
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const totalOpenTodos = events.reduce((s, e) => s + e.todos.filter((t) => !t.done).length, 0);
  const nextEvt = events.find((e) => e.nextEvent)?.nextEvent;

  const julyRecordedDays = isStorybook
    ? [...new Set(events.filter((e) => e.date?.startsWith("2026-07")).map((e) => Number(e.date.slice(-2))))]
    : [];
  const hiddenSpot = isStorybook ? getHiddenSpot("2026-07-18") : null;
  const pageTraces = isStorybook ? storyTraces(julyRecordedDays) : [];

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
      {/* 絵本の見開き：上＝絵、下＝文字。カレンダーは"文字"の側にそのままの大きさで置く */}
      {isStorybook && (
        <div
          style={{
            position: "relative", height: 176, margin: "0 14px", marginTop: 14,
            borderRadius: "16px 16px 0 0", overflow: "hidden",
            backgroundImage: buildStoryScene(monthStage, { hiddenSpot }),
            backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
          }}
        >
          {pageTraces.map((t) => (
            <span
              key={`page-trace-${t.day}`}
              style={{
                position: "absolute", left: t.left, bottom: t.bottom, width: 6, height: 6,
                borderRadius: "50%", background: "#E8837A", opacity: 0.55, pointerEvents: "none",
              }}
            />
          ))}
        </div>
      )}
      <div
        style={isStorybook ? {
          margin: "0 14px 14px", background: tokens.card, border: `1px solid ${tokens.line}`,
          borderTop: "none", borderRadius: "0 0 16px 16px", boxShadow: "0 3px 10px rgba(74,46,42,0.1)",
        } : undefined}
      >
      <div style={{ padding: "24px 20px 6px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", color: tokens.inkFaint }}>Filovita</div>
          <h1 style={{ fontFamily: tokens.headingFont, fontSize: 22, fontWeight: 700, margin: "4px 0 0", color: tokens.ink }}>
            {labels.calendarHeading}
          </h1>
          {isForest && (
            <p style={{ fontSize: 11.5, color: tokens.inkFaint, margin: "3px 0 0" }}>
              {seasonLabels[monthStage]}
            </p>
          )}
          {isGothic && (
            <p style={{ fontSize: 11.5, color: tokens.inkFaint, margin: "3px 0 0" }}>
              {moodLabels[monthStage]}
            </p>
          )}
          {isStorybook && (
            <p style={{ fontSize: 11.5, color: tokens.inkFaint, margin: "3px 0 0", fontStyle: "italic" }}>
              {storyLabels[monthStage]}
            </p>
          )}
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
        ) : isForest ? (
          <BarkPanel style={{ fontSize: 13, color: tokens.inkSoft, marginBottom: 16 }}>
            {continuationContent}
          </BarkPanel>
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
            const dayStage = isForest ? getMonthStage(d) : null;
            return (
              <button
                key={i}
                onClick={() => onOpenDate(dateStr)}
                style={{
                  position: "relative",
                  aspectRatio: "1", border: isToday ? `1.5px solid ${tokens.ink}` : "1px solid transparent",
                  borderRadius: 10,
                  background: dayEvents.length > 0
                    ? tokens.card
                    : isForest
                      ? `rgba(47,107,58,${FOREST_DAY_TINT[dayStage]})`
                      : "transparent",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", fontSize: 12.5, color: tokens.ink, padding: 0,
                }}
              >
                {isForest && (
                  <span
                    style={{
                      position: "absolute", top: 3, right: 4, width: 5, height: 5, borderRadius: "50%",
                      background: "#2F6B3A", opacity: FOREST_DOT_OPACITY[dayStage],
                    }}
                  />
                )}
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
        <Plus size={26} />
      </button>
    </div>
  );
}
