import { useEffect, useState } from "react";
import { themes, themeList, defaultThemeId } from "./theme/themes.js";
import { initialEvents } from "./data/fakeEvents.js";
import { generateDraft } from "./lib/generateDraft.js";
import { loadState, saveState } from "./lib/persistence.js";
import CRTScreen from "./theme/industrial/CRTScreen.jsx";
import CrackedGlass from "./theme/gothic/CrackedGlass.jsx";
import ForestGrowth from "./theme/forest/ForestGrowth.jsx";
import StarWindow from "./theme/sf/StarWindow.jsx";
import JournalMap from "./theme/travel/JournalMap.jsx";
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
import TagToolboxScreen from "./screens/TagToolboxScreen.jsx";
import GuideTourScreen from "./screens/GuideTourScreen.jsx";
import ShoppingConsultScreen from "./screens/ShoppingConsultScreen.jsx";
import ShoppingListScreen from "./screens/ShoppingListScreen.jsx";
import { makeId } from "./theme/techo/tagToolbox.js";

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
  // 下書き生成中の待機状態。リロードで復元する必要はない一時的なUI状態
  const [isDrafting, setIsDrafting] = useState(false);
  // 手帳だけの情報層：タグの道具箱。タグ名ではなくtagIdで紐付ける
  // （表示名を変えても道具箱との紐付けが切れないように）
  const [tagRegistry, setTagRegistry] = useState(persisted?.tagRegistry ?? {});
  const [tagToolboxes, setTagToolboxes] = useState(persisted?.tagToolboxes ?? {});
  const [activeTagName, setActiveTagName] = useState(persisted?.activeTagName ?? null);
  // 案内人：一度見た案内は自動では出さない。呼べば「はじめてガイド」からいつでも戻る
  const [seenGuides, setSeenGuides] = useState(persisted?.seenGuides ?? {});
  // お互いの呼び名。「設定」ではなく「はじめまして」の一部として交換する
  const [companionName, setCompanionName] = useState(persisted?.companionName ?? "");
  const [userName, setUserName] = useState(persisted?.userName ?? "");
  // 買い物相談：家計簿ではなく、複数周期を見渡した判断支援（MVP_SPEC.md「複数周期の統合判断」）
  const [shoppingBudget, setShoppingBudget] = useState(persisted?.shoppingBudget ?? 20000);
  const [shoppingBalance, setShoppingBalance] = useState(persisted?.shoppingBalance ?? 8500);
  const [nextShoppingDate, setNextShoppingDate] = useState(persisted?.nextShoppingDate ?? "7月25日");
  // 「暮らしの予定」：Google Calendar連携を待たず、Filovita内部で時間軸を持つ
  // （MVP_SPEC.md「まずFilovita内に暮らしの予定を持つ」）。判定AIではなく
  // バトラーとして、いつ・何を優先するかまで一緒に考えるための材料。
  const [incomeSchedule, setIncomeSchedule] = useState(persisted?.incomeSchedule ?? []);
  const [paymentSchedule, setPaymentSchedule] = useState(persisted?.paymentSchedule ?? []);
  const [restockSchedule, setRestockSchedule] = useState(persisted?.restockSchedule ?? []);
  const [cwPlanNote, setCwPlanNote] = useState(persisted?.cwPlanNote ?? "");
  const [recurringItems, setRecurringItems] = useState(persisted?.recurringItems ?? [
    { id: "rec_food", name: "食料品", amount: 6000 },
    { id: "rec_tobacco", name: "タバコ", amount: 3000 },
  ]);
  const [itemsToAdd, setItemsToAdd] = useState(persisted?.itemsToAdd ?? []);
  // 買い物リスト：相談で決めた内容のスナップショット。店頭ではチェックのON/OFFと
  // その場のひらめき追加だけで完結する（考える→買う、を地続きにする）
  const [shoppingListItems, setShoppingListItems] = useState(persisted?.shoppingListItems ?? []);
  // 買い物相談の自由な会話履歴（api/shopping-chat.js経由。MVP_SPEC.md「相談は往復である」）
  const [shoppingChatHistory, setShoppingChatHistory] = useState(persisted?.shoppingChatHistory ?? []);
  // 最終見立ての履歴：判断の根拠（渡した事実一式）と、その時バトラーが
  // 何を重視したか(focus)を、あとから説明できるよう残しておく。
  // 画面からは隠すが、内部からは消さない（FILOVITA_PHILOSOPHY.md参照）
  const [verdictHistory, setVerdictHistory] = useState(persisted?.verdictHistory ?? []);
  // 確認用のプレビュー。実際の日付を書き換えず、見た目だけ試せる（保存はしない）
  const [stagePreview, setStagePreview] = useState(null);

  const theme = themes[themeId] ?? themes[defaultThemeId];

  useEffect(() => {
    saveState({
      screen, inputMode, themeId, selectedDate, selectedEventId, events, draft, tagRegistry, tagToolboxes, activeTagName, seenGuides, companionName, userName,
      shoppingBudget, shoppingBalance, nextShoppingDate, incomeSchedule, paymentSchedule, restockSchedule, cwPlanNote, recurringItems, itemsToAdd, shoppingListItems, shoppingChatHistory, verdictHistory,
    });
  }, [
    screen, inputMode, themeId, selectedDate, selectedEventId, events, draft, tagRegistry, tagToolboxes, activeTagName, seenGuides, companionName, userName,
    shoppingBudget, shoppingBalance, nextShoppingDate, incomeSchedule, paymentSchedule, restockSchedule, cwPlanNote, recurringItems, itemsToAdd, shoppingListItems, shoppingChatHistory, verdictHistory,
  ]);

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  function handleDismissGuide(id) {
    setSeenGuides((prev) => ({ ...prev, [id]: true }));
  }

  async function handleSubmitInput(text) {
    setIsDrafting(true);
    const generated = await generateDraft(text);
    setIsDrafting(false);
    setDraft(generated);
    setScreen("confirm");
  }

  function handleOpenDate(d) {
    setSelectedDate(d);
    setScreen("dayList");
  }

  function handleToggleTag(tag) {
    setEvents(events.map((e) => e.id !== selectedEventId ? e : {
      ...e,
      tags: e.tags.includes(tag) ? e.tags.filter((t) => t !== tag) : [...e.tags, tag],
    }));
  }

  function handleAddMark(type, text) {
    setEvents(events.map((e) => e.id !== selectedEventId ? e : {
      ...e,
      marks: [...(e.marks || []), { id: makeId("mark"), type, text }],
    }));
  }

  function handleRemoveMark(markId) {
    setEvents(events.map((e) => e.id !== selectedEventId ? e : {
      ...e,
      marks: (e.marks || []).filter((m) => m.id !== markId),
    }));
  }

  function handleOpenTagToolbox(tagName) {
    if (!tagRegistry[tagName]) {
      const tagId = makeId("tag");
      setTagRegistry((prev) => ({ ...prev, [tagName]: tagId }));
      setTagToolboxes((prev) => ({ ...prev, [tagId]: { tagId, tagName, references: [] } }));
    }
    setActiveTagName(tagName);
    setScreen("tagToolbox");
  }

  function handleAddReference(ref) {
    const tagId = tagRegistry[activeTagName];
    setTagToolboxes((prev) => ({
      ...prev,
      [tagId]: { ...prev[tagId], references: [...prev[tagId].references, { id: makeId("ref"), ...ref }] },
    }));
  }

  function handleUpdateReference(refId, patch) {
    const tagId = tagRegistry[activeTagName];
    setTagToolboxes((prev) => ({
      ...prev,
      [tagId]: { ...prev[tagId], references: prev[tagId].references.map((r) => r.id === refId ? { ...r, ...patch } : r) },
    }));
  }

  function handleDeleteReference(refId) {
    const tagId = tagRegistry[activeTagName];
    setTagToolboxes((prev) => ({
      ...prev,
      [tagId]: { ...prev[tagId], references: prev[tagId].references.filter((r) => r.id !== refId) },
    }));
  }

  function handleAddIncomeSchedule(entry) {
    setIncomeSchedule((prev) => [...prev, { id: makeId("income"), ...entry }]);
  }

  function handleRemoveIncomeSchedule(id) {
    setIncomeSchedule((prev) => prev.filter((i) => i.id !== id));
  }

  function handleAddPaymentSchedule(entry) {
    setPaymentSchedule((prev) => [...prev, { id: makeId("payment"), ...entry }]);
  }

  function handleRemovePaymentSchedule(id) {
    setPaymentSchedule((prev) => prev.filter((i) => i.id !== id));
  }

  function handleAddRestockSchedule(entry) {
    setRestockSchedule((prev) => [...prev, { id: makeId("restock"), ...entry }]);
  }

  function handleRemoveRestockSchedule(id) {
    setRestockSchedule((prev) => prev.filter((i) => i.id !== id));
  }

  function handleAddRecurringItem(item) {
    setRecurringItems((prev) => [...prev, { id: makeId("rec"), ...item }]);
  }

  function handleRemoveRecurringItem(id) {
    setRecurringItems((prev) => prev.filter((i) => i.id !== id));
  }

  function handleEditRecurringItemAmount(id, amount) {
    setRecurringItems((prev) => prev.map((i) => i.id === id ? { ...i, amount } : i));
  }

  function handleAddItemToAdd(item) {
    setItemsToAdd((prev) => [...prev, { id: makeId("add"), ...item }]);
  }

  function handleRemoveItemToAdd(id) {
    setItemsToAdd((prev) => prev.filter((i) => i.id !== id));
  }

  function handleEditItemToAddPrice(id, price) {
    setItemsToAdd((prev) => prev.map((i) => i.id === id ? { ...i, price } : i));
  }

  function handleGenerateShoppingList() {
    const usual = recurringItems.map((i) => ({ id: makeId("list"), name: i.name, amount: i.amount, section: "usual", checked: true }));
    const add = itemsToAdd.map((i) => ({ id: makeId("list"), name: i.name, amount: i.price, section: "add", checked: true }));
    setShoppingListItems([...usual, ...add]);
    setScreen("shoppingList");
  }

  function handleToggleShoppingListItem(id) {
    setShoppingListItems((prev) => prev.map((i) => i.id === id ? { ...i, checked: !i.checked } : i));
  }

  function handleAddShoppingListItem(item) {
    setShoppingListItems((prev) => [...prev, { id: makeId("list"), section: "add", checked: true, ...item }]);
  }

  function handleAppendShoppingChatMessage(role, content) {
    setShoppingChatHistory((prev) => [...prev, { role, content }]);
  }

  function handleRecordVerdict(entry) {
    setVerdictHistory((prev) => [...prev, { id: makeId("verdict"), ...entry }]);
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
  const isOrbit = theme.componentTheme === "orbit";
  const isJournal = theme.componentTheme === "journal";
  const monthStage = stagePreview ?? getMonthStage(getDayOfMonth(TODAY_DATE));
  const recordedDays = [...new Set(
    events.filter((e) => e.date?.startsWith(TODAY_DATE.slice(0, 7))).map((e) => getDayOfMonth(e.date))
  )];
  // 暫定的な確認用の挙動：日別の画面(記録一覧・記録詳細)を見ている間、
  // その日の時点の世界を表示する——1日と31日を見比べられるように。
  // 本番では「世界は常に今日を表す」に戻す想定（本番前に要検討）。
  const viewingDay = (screen === "dayList" || screen === "detail") && selectedDate;
  const effectiveDate = viewingDay ? selectedDate : TODAY_DATE;
  const effectiveStage = viewingDay ? getMonthStage(getDayOfMonth(selectedDate)) : monthStage;

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
            inputMode={inputMode}
            onOpenDate={handleOpenDate}
            onNew={() => setScreen("input")}
            onOpenSettings={() => setScreen("settings")}
            onOpenShoppingConsult={() => setScreen("shoppingConsult")}
            seenGuides={seenGuides}
            onDismissGuide={handleDismissGuide}
          />
        )}
        {screen === "shoppingConsult" && (
          <ShoppingConsultScreen
            theme={theme}
            companionName={companionName}
            budget={shoppingBudget}
            balance={shoppingBalance}
            nextShoppingDate={nextShoppingDate}
            cwPlanNote={cwPlanNote}
            onChangeCwPlanNote={setCwPlanNote}
            incomeSchedule={incomeSchedule}
            onAddIncomeSchedule={handleAddIncomeSchedule}
            onRemoveIncomeSchedule={handleRemoveIncomeSchedule}
            paymentSchedule={paymentSchedule}
            onAddPaymentSchedule={handleAddPaymentSchedule}
            onRemovePaymentSchedule={handleRemovePaymentSchedule}
            restockSchedule={restockSchedule}
            onAddRestockSchedule={handleAddRestockSchedule}
            onRemoveRestockSchedule={handleRemoveRestockSchedule}
            recurringItems={recurringItems}
            itemsToAdd={itemsToAdd}
            onChangeBudget={setShoppingBudget}
            onChangeBalance={setShoppingBalance}
            onChangeNextShoppingDate={setNextShoppingDate}
            onAddRecurringItem={handleAddRecurringItem}
            onRemoveRecurringItem={handleRemoveRecurringItem}
            onEditRecurringItemAmount={handleEditRecurringItemAmount}
            onAddItemToAdd={handleAddItemToAdd}
            onRemoveItemToAdd={handleRemoveItemToAdd}
            onEditItemToAddPrice={handleEditItemToAddPrice}
            onGenerateList={handleGenerateShoppingList}
            chatHistory={shoppingChatHistory}
            onAppendChatMessage={handleAppendShoppingChatMessage}
            onBack={() => setScreen("calendar")}
          />
        )}
        {screen === "shoppingList" && (
          <ShoppingListScreen
            theme={theme}
            companionName={companionName}
            budget={shoppingBudget}
            balance={shoppingBalance}
            nextShoppingDate={nextShoppingDate}
            cwPlanNote={cwPlanNote}
            incomeSchedule={incomeSchedule}
            paymentSchedule={paymentSchedule}
            restockSchedule={restockSchedule}
            chatHistory={shoppingChatHistory}
            items={shoppingListItems}
            onToggleItem={handleToggleShoppingListItem}
            onAddItem={handleAddShoppingListItem}
            verdictHistory={verdictHistory}
            onVerdictRecorded={handleRecordVerdict}
            onBack={() => setScreen("shoppingConsult")}
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
            onOpenGuideTour={() => setScreen("guideTour")}
            companionName={companionName}
            userName={userName}
            onChangeCompanionName={setCompanionName}
            onChangeUserName={setUserName}
          />
        )}
        {screen === "guideTour" && (
          <GuideTourScreen
            theme={theme}
            onBack={() => setScreen("settings")}
            companionName={companionName}
            userName={userName}
            onSaveNames={(c, u) => { setCompanionName(c); setUserName(u); }}
          />
        )}
        {screen === "dayList" && (
          <DayEventListScreen
            theme={theme}
            events={events}
            date={selectedDate}
            inputMode={inputMode}
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
            onToggleTag={handleToggleTag}
            onOpenDate={handleOpenDate}
            onOpenTagToolbox={handleOpenTagToolbox}
            onAddMark={handleAddMark}
            onRemoveMark={handleRemoveMark}
            seenGuides={seenGuides}
            onDismissGuide={handleDismissGuide}
          />
        )}
        {screen === "tagToolbox" && activeTagName && (
          <TagToolboxScreen
            theme={theme}
            tagName={activeTagName}
            events={events}
            seenGuides={seenGuides}
            onDismissGuide={handleDismissGuide}
            references={tagToolboxes[tagRegistry[activeTagName]]?.references ?? []}
            onBack={() => setScreen("detail")}
            onAddReference={handleAddReference}
            onUpdateReference={handleUpdateReference}
            onDeleteReference={handleDeleteReference}
          />
        )}
        {screen === "input" && (
          <InputScreen
            theme={theme}
            mode={inputMode}
            onBack={() => setScreen("calendar")}
            onSubmit={handleSubmitInput}
            isDrafting={isDrafting}
            seenGuides={seenGuides}
            onDismissGuide={handleDismissGuide}
          />
        )}
        {screen === "confirm" && draft && (
          <ConfirmScreen theme={theme} draft={draft} companionName={companionName} onBack={() => setScreen("input")} onConfirm={handleConfirm} />
        )}
    </>
  );

  return (
    <div style={{ minHeight: "100vh", background: theme.tokens.paper, display: "flex", justifyContent: "center", fontFamily: "'Zen Kaku Gothic New','Hiragino Kaku Gothic ProN',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Noto+Sans+JP:wght@500;700&family=Klee+One:wght@400;600&display=swap');
        * { box-sizing: border-box; }
      `}</style>
      <div
        style={{
          width: "100%", maxWidth: 440, minHeight: "100vh", position: "relative",
          backgroundColor: theme.tokens.paper,
          // 森・ホラー・SFは実写/実イラストの背景が画面全体を覆うので、
          // ボタン用の余白は不要（背景に重ねればよい）。他のテーマはFABの下に
          // コンテンツが隠れないよう、引き続き余白を確保する。
          ...(isForest || isGothic || isOrbit || isJournal ? {} : { paddingBottom: 100 }),
          // 森・ホラー・SF・旅は実写/実イラストの背景そのものが世界を表すので、
          // タイル状の壁紙模様は重ねない（二重に見える原因になるため）
          ...(isForest || isGothic || isOrbit || isJournal ? {} : {
            backgroundImage: theme.tokens.backgroundImage,
            backgroundSize: theme.tokens.backgroundSize,
            backgroundRepeat: "repeat",
          }),
        }}
      >
        {isIndustrial ? (
          <CRTScreen date={effectiveDate} recordedDays={recordedDays}>{screenContent}</CRTScreen>
        ) : isGothic ? (
          <CrackedGlass stage={effectiveStage} date={effectiveDate} recordedDays={recordedDays}>{screenContent}</CrackedGlass>
        ) : isForest ? (
          <ForestGrowth stage={effectiveStage} screen={screen} date={effectiveDate} recordedDays={recordedDays}>{screenContent}</ForestGrowth>
        ) : isOrbit ? (
          <StarWindow stage={effectiveStage} date={effectiveDate} recordedDays={recordedDays}>{screenContent}</StarWindow>
        ) : isJournal ? (
          <JournalMap date={effectiveDate} recordedDays={recordedDays}>{screenContent}</JournalMap>
        ) : (
          screenContent
        )}
      </div>
    </div>
  );
}
