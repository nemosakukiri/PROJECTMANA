import { Plus } from "lucide-react";
import { eventsOnDate } from "../data/fakeEvents.js";
import ContextHeader from "../components/ContextHeader.jsx";
import SteelPanel from "../theme/industrial/SteelPanel.jsx";
import OrnateFrame from "../theme/gothic/OrnateFrame.jsx";
import BarkPanel from "../theme/forest/BarkPanel.jsx";

/* ②その日のEvent一覧（見出しのみ） */
export default function DayEventListScreen({ theme, events, date, onOpenEvent, onBack, onNew }) {
  const { tokens } = theme;
  const isIndustrial = theme.componentTheme === "industrial";
  const isGothic = theme.componentTheme === "gothic";
  const isForest = theme.componentTheme === "forest";
  const dayEvents = eventsOnDate(events, date);
  const label = dayEvents[0]?.dateLabel ?? "";

  return (
    <div>
      <ContextHeader theme={theme} breadcrumb="カレンダー" title={label} onBack={onBack} />
      <div style={{ padding: "10px 20px 0" }}>
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
        <Plus size={26} />
      </button>
    </div>
  );
}
