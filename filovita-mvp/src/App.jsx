import { useEffect, useState } from "react";
import { themes, themeList, defaultThemeId } from "./theme/themes.js";
import { initialEvents } from "./data/fakeEvents.js";
import { generateDraftFake } from "./lib/fakeGenerateDraft.js";
import { loadState, saveState } from "./lib/persistence.js";
import CRTScreen from "./theme/industrial/CRTScreen.jsx";
import CrackedGlass from "./theme/gothic/CrackedGlass.jsx";
import ForestGrowth from "./theme/forest/ForestGrowth.jsx";
import AdventureJourney from "./theme/adventure/AdventureJourney.jsx";
import { getDayOfMonth, getMonthStage } from "./theme/worldEngine.js";

import WelcomeScreen from "./screens/WelcomeScreen.jsx";
import InputModeScreen from "./screens/InputModeScreen.jsx";
import ThemeSelectScreen from "./screens/ThemeSelectScreen.jsx";
import CalendarConnectScreen from "./screens/CalendarConnectScreen.jsx";
import SettingsScreen from "./screens/SettingsScreen.jsx";
import CalendarScreen from "./screens/CalendarScreen.jsx";
import DayEventListScreen from "./screens/DayEventListScreen.jsx";
import EventDetailScreen from "./screens/EventDetailScreen.jsx";
import InputScreen from "./screens/InputScreen.jsx";
import ConfirmScreen from "./screens/ConfirmScreen.jsx";

const TODAY_DATE = "2026-07-18";
const TODAY_LABEL = "7月18日（土）";

// リロード後も続きから触れるよう、初期値は一度だけlocalStorageから読む
const persisted = loadState();

export default function App() {
  const [screen, setScreen] = useState(persisted?.screen ?? "welcome");
  const [inputMode, setInputMode] = useState(persisted?.inputMode ?? "both");
  const [themeId, setThemeId] = useState(persisted?.themeId ?? defaultThemeId);
  const [selectedDate, setSelectedDate] = useState(persisted?.selectedDate ?? null);
  const [selectedEventId, setSelectedEventId] = useState(persisted?.selectedEventId ?? null);
  const [events, setEvents] = useState(persisted?.events ?? initialEvents);
  const [draft, setDraft] = useState(persisted?.draft ?? null);
  // 確認用のプレビュー。実際の日付を書き換えず、見た目だけ試せる（保存はしない）
  const [stagePreview, setStagePreview] = useState(null);

  const theme = themes[themeId] ?? themes[defaultThemeId];

  useEffect(() => {
    saveState({ screen, inputMode, themeId, selectedDate, selectedEventId, events, draft });
  }, [screen, inputMode, themeId, selectedDate, selectedEventId, events, draft]);

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  function handleSubmitInput(text) {
    setDraft(generateDraftFake(text));
    setScreen("confirm");
  }

  function handleConfirm(conclusionText) {
    const newEvent = {
      id: `evt_${Date.now()}`,
      date: TODAY_DATE,
      dateLabel: TODAY_LABEL,
      kind: "記録",
      tags: [],
      conclusion: conclusionText,
      todos: (draft?.todos ?? []).map((t) => ({ text: t.text, done: false })),
      nextEvent: null,
      related: [],
      myNote: "",
    };
    setEvents((prev) => [...prev, newEvent]);
    setDraft(null);
    setScreen("calendar");
  }

  const isIndustrial = theme.componentTheme === "industrial";
  const isGothic = theme.componentTheme === "gothic";
  const isForest = theme.componentTheme === "forest";
  const isAdventure = theme.componentTheme === "adventure";
  const monthStage = stagePreview ?? getMonthStage(getDayOfMonth(TODAY_DATE));
  const recordedDays = [...new Set(
    events.filter((e) => e.date?.startsWith(TODAY_DATE.slice(0, 7))).map((e) => getDayOfMonth(e.date))
  )];

  const screenContent = (
    <>
        {screen === "welcome" && (
          <WelcomeScreen theme={theme} onNext={() => setScreen("inputMode")} />
        )}
        {screen === "inputMode" && (
          <InputModeScreen theme={theme} onSelect={(mode) => { setInputMode(mode); setScreen("themeSelect"); }} />
        )}
        {screen === "themeSelect" && (
          <ThemeSelectScreen themeList={themeList} onSelect={(id) => { setThemeId(id); setScreen("calendarConnect"); }} />
        )}
        {screen === "calendarConnect" && (
          <CalendarConnectScreen
            theme={theme}
            onConnect={() => setScreen("calendar")}
            onSkip={() => setScreen("calendar")}
          />
        )}
        {screen === "calendar" && (
          <CalendarScreen
            theme={theme}
            events={events}
            monthStage={monthStage}
            onOpenDate={(d) => { setSelectedDate(d); setScreen("dayList"); }}
            onNew={() => setScreen("input")}
            onOpenSettings={() => setScreen("settings")}
          />
        )}
        {screen === "settings" && (
          <SettingsScreen
            theme={theme}
            themeList={themeList}
            themeId={themeId}
            onChangeTheme={setThemeId}
            currentMode={inputMode}
            onChangeMode={setInputMode}
            stagePreview={stagePreview}
            onChangeStagePreview={setStagePreview}
            onBack={() => setScreen("calendar")}
          />
        )}
        {screen === "dayList" && (
          <DayEventListScreen
            theme={theme}
            events={events}
            date={selectedDate}
            onOpenEvent={(id) => { setSelectedEventId(id); setScreen("detail"); }}
            onBack={() => setScreen("calendar")}
            onNew={() => setScreen("input")}
          />
        )}
        {screen === "detail" && selectedEvent && (
          <EventDetailScreen
            theme={theme}
            event={selectedEvent}
            onBack={() => setScreen("dayList")}
            onUpdateNote={(v) => setEvents(events.map((e) => {
              if (e.id !== selectedEventId) return e;
              const hasImpression = v.trim().length > 0;
              const tagsWithoutImpression = e.tags.filter((t) => t !== "所感");
              return {
                ...e,
                myNote: v,
                tags: hasImpression ? [...tagsWithoutImpression, "所感"] : tagsWithoutImpression,
              };
            }))}
            onToggleTodo={(i) => setEvents(events.map((e) => e.id === selectedEventId ? { ...e, todos: e.todos.map((t, ti) => ti === i ? { ...t, done: !t.done } : t) } : e))}
            onAddTodo={(text) => setEvents(events.map((e) => e.id === selectedEventId ? { ...e, todos: [...e.todos, { text, done: false }] } : e))}
          />
        )}
        {screen === "input" && (
          <InputScreen
            theme={theme}
            mode={inputMode}
            onBack={() => setScreen("calendar")}
            onSubmit={handleSubmitInput}
          />
        )}
        {screen === "confirm" && draft && (
          <ConfirmScreen theme={theme} draft={draft} onBack={() => setScreen("input")} onConfirm={handleConfirm} />
        )}
    </>
  );

  return (
    <div style={{ minHeight: "100vh", background: theme.tokens.paper, display: "flex", justifyContent: "center", fontFamily: "'Zen Kaku Gothic New','Hiragino Kaku Gothic ProN',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Noto+Sans+JP:wght@500;700&display=swap');
        * { box-sizing: border-box; }
      `}</style>
      <div
        style={{
          width: "100%", maxWidth: 440, minHeight: "100vh", paddingBottom: 100, position: "relative",
          backgroundColor: theme.tokens.paper,
          backgroundImage: theme.tokens.backgroundImage,
          backgroundSize: theme.tokens.backgroundSize,
          backgroundRepeat: "repeat",
        }}
      >
        {isIndustrial ? (
          <CRTScreen>{screenContent}</CRTScreen>
        ) : isGothic ? (
          <CrackedGlass stage={monthStage}>{screenContent}</CrackedGlass>
        ) : isForest ? (
          <ForestGrowth stage={monthStage} screen={screen} date={TODAY_DATE} recordedDays={recordedDays}>{screenContent}</ForestGrowth>
        ) : isAdventure ? (
          <AdventureJourney stage={monthStage}>{screenContent}</AdventureJourney>
        ) : (
          screenContent
        )}
      </div>
    </div>
  );
}
