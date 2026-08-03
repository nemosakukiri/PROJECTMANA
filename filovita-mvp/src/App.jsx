import { useEffect, useState } from "react";
import { themes, themeList, defaultThemeId } from "./theme/themes.js";
import { initialEvents } from "./data/fakeEvents.js";
import { initialWeeklyLife } from "./data/initialWeeklyLife.js";
import { initialEssentialCosts } from "./data/initialEssentialCosts.js";
import { generateDraft } from "./lib/generateDraft.js";
import { readDocument } from "./lib/readDocument.js";
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
import OnboardingInterviewScreen from "./screens/OnboardingInterviewScreen.jsx";
import NotebookOpen from "./components/NotebookOpen.jsx";
import ShoppingConsultScreen from "./screens/ShoppingConsultScreen.jsx";
import ShoppingListScreen from "./screens/ShoppingListScreen.jsx";
import WeeklyLifeScreen from "./screens/WeeklyLifeScreen.jsx";
import SeedsScreen from "./screens/SeedsScreen.jsx";
import { makeId } from "./theme/techo/tagToolbox.js";

// 2026-08-01、利用者から「今日8月1日なのに7月18日になっている」と指摘を受けて発覚：
// ここが固定文字列のままで、実際の今日の日付を計算していなかった。handleConfirmで
// 新しいEventの日付として直接使われるため、単なる表示の不具合ではなく、記録される
// データ自体が誤った日付になっていた。実際の日付から毎回計算するよう修正。
const WEEKDAY_LABEL = ["日", "月", "火", "水", "木", "金", "土"];
function computeTodayDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function computeTodayLabel() {
  const d = new Date();
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAY_LABEL[d.getDay()]}）`;
}
const TODAY_DATE = computeTodayDate();
const TODAY_LABEL = computeTodayLabel();

// リロード後も続きから触れるよう、初期値は一度だけlocalStorageから読む
const persisted = loadState();

export default function App() {
  // 起動アニメーション(NotebookOpen)：アプリを開くたびに再生する
  // (2026-08-03、麻奈さんから受け取ったコンポーネント)。localStorageの
  // 'filovita_visited'で初回/2回目以降の長さを自分で判定するため、
  // ここでは「まだ演出が終わっていない」ことだけを持つ。
  const [bootDone, setBootDone] = useState(false);
  const [screen, setScreen] = useState(persisted?.screen ?? "welcome");
  const [inputMode, setInputMode] = useState(persisted?.inputMode ?? "both");
  const [themeId, setThemeId] = useState(persisted?.themeId ?? defaultThemeId);
  const [selectedDate, setSelectedDate] = useState(persisted?.selectedDate ?? null);
  const [selectedEventId, setSelectedEventId] = useState(persisted?.selectedEventId ?? null);
  const [events, setEvents] = useState(persisted?.events ?? initialEvents);
  const [draft, setDraft] = useState(persisted?.draft ?? null);
  // 下書き生成中の待機状態。リロードで復元する必要はない一時的なUI状態
  const [isDrafting, setIsDrafting] = useState(false);
  // 生活資料ライブラリ：写真は「入力にない事実」を作れないため、失敗時は
  // 静かなフォールバックではなく正直にエラーを見せる（MVP_SPEC.md参照）
  const [draftError, setDraftError] = useState(null);
  // 写真から読み取った資料の種類。確定時にタグとしてEventへ付ける
  const [pendingTag, setPendingTag] = useState(null);
  const [pendingDocType, setPendingDocType] = useState(null);
  // レシートから読み取った金額。確認画面で本人が承認した場合だけ、
  // 買い物の残額(shoppingBalance)から実際に差し引く（2026-07-30、
  // 利用者からの指摘：「レシートを読んでいるのに残高が減らない」）
  const [pendingReceiptAmount, setPendingReceiptAmount] = useState(null);
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
  // 今週の暮らし：生活モデル(docs/LIFE_MODEL.md)の第一版。「カレンダー予定」
  // ではなく「この人の生活に何が組み込まれているか」を記録する場所。
  // kind: "regular"(定期・毎週) だけを今週の暮らし画面に表示する。
  // "irregular"(往診など、曜日不定)・"single"(単発)はデータの型だけ
  // 用意し、まだ入力UIは無い——「今週表に出さない」ことと「生活モデルから
  // 消す」ことは別、という利用者の指摘による。
  const [weeklyLife, setWeeklyLife] = useState(persisted?.weeklyLife ?? initialWeeklyLife);
  // 暮らしの種：予定でも家計でもない、生活の断片を置く横断レイヤー
  // （docs/LIFE_MODEL.md「暮らしの種」参照、2026-08-01の設計対話より）。
  // status:"open"以外は分類しない。textは打った言葉そのまま、
  // aiSuggestionsは将来AIが分類案を出す場所としてv1では空のまま持つ。
  const [seeds, setSeeds] = useState(persisted?.seeds ?? []);
  // 欠かせないもの：生活を維持するために絶対に守らないといけない費用を、
  // 「支出項目」ではなく「誰のためのものか（entity）」で持つ
  // （docs/LIFE_MODEL.md参照、2026-08-01）。amountは実際に確認できた
  // 金額だけを入れる——確認できるまでnullのまま、勝手な推測はしない。
  const [essentialCosts, setEssentialCosts] = useState(persisted?.essentialCosts ?? initialEssentialCosts);
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
  // 「はじめてガイド」は元々、設定画面からしか開けなかった(戻り先は常に
  // settings)。Butlerとの出会い(初回聞き取り)の④「まだよく分からない」を
  // 選んだ場合もこの画面に合流させるが、その場合の戻り先はcalendarに
  // したいため、開いた経路に応じて戻り先を切り替える(2026-08-02)。
  const [guideTourReturnScreen, setGuideTourReturnScreen] = useState("settings");

  const theme = themes[themeId] ?? themes[defaultThemeId];

  useEffect(() => {
    saveState({
      screen, inputMode, themeId, selectedDate, selectedEventId, events, draft, tagRegistry, tagToolboxes, activeTagName, seenGuides, companionName, userName,
      shoppingBudget, shoppingBalance, nextShoppingDate, incomeSchedule, paymentSchedule, restockSchedule, cwPlanNote, recurringItems, itemsToAdd, shoppingListItems, shoppingChatHistory, verdictHistory, weeklyLife, seeds, essentialCosts,
    });
  }, [
    screen, inputMode, themeId, selectedDate, selectedEventId, events, draft, tagRegistry, tagToolboxes, activeTagName, seenGuides, companionName, userName,
    shoppingBudget, shoppingBalance, nextShoppingDate, incomeSchedule, paymentSchedule, restockSchedule, cwPlanNote, recurringItems, itemsToAdd, shoppingListItems, shoppingChatHistory, verdictHistory, weeklyLife, seeds, essentialCosts,
  ]);

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  function handleDismissGuide(id) {
    setSeenGuides((prev) => ({ ...prev, [id]: true }));
  }

  async function handleSubmitInput(text) {
    setIsDrafting(true);
    setDraftError(null);
    setPendingTag(null);
    setPendingDocType(null);
    setPendingReceiptAmount(null);
    const generated = await generateDraft(text);
    setIsDrafting(false);
    setDraft(generated);
    setScreen("confirm");
  }

  async function handleSubmitPhoto(base64, mimeType) {
    setIsDrafting(true);
    setDraftError(null);
    const result = await readDocument({ base64, mimeType });
    setIsDrafting(false);
    if (result.error) {
      // 写真は「入力にない事実」を作れないため、静かなフォールバックはせず
      // 入力画面に留まって正直に伝える（generateDraftとの違い）
      setDraftError(result.error);
      return;
    }
    setPendingTag(result.docTypeLabel);
    setPendingDocType(result.docType);
    setPendingReceiptAmount(result.amount ?? null);
    setDraft(result.draft);
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

  function handleAddWeeklyLife(entry) {
    setWeeklyLife((prev) => [...prev, { id: makeId("wl"), ...entry }]);
  }

  function handleRemoveWeeklyLife(id) {
    setWeeklyLife((prev) => prev.filter((i) => i.id !== id));
  }

  // 確認画面を挟まず、その場で直接保存する（docs/LIFE_MODEL.md「暮らしの種」参照）
  function handleAddSeed(text) {
    setSeeds((prev) => [...prev, { id: makeId("seed"), text, createdAt: new Date().toISOString(), status: "open", aiSuggestions: [] }]);
  }

  function handleRemoveSeed(id) {
    setSeeds((prev) => prev.filter((s) => s.id !== id));
  }

  function handleAddEssentialCost(entry) {
    setEssentialCosts((prev) => [...prev, { id: makeId("ec"), ...entry }]);
  }

  function handleRemoveEssentialCost(id) {
    setEssentialCosts((prev) => prev.filter((c) => c.id !== id));
  }

  function handleEditEssentialCostAmount(id, amount) {
    setEssentialCosts((prev) => prev.map((c) => (c.id === id ? { ...c, amount } : c)));
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

  function handleConfirm(conclusionText, confirmedTodos = [], reflectToCwPlan = false, deductReceiptAmount = false) {
    const newEvent = {
      id: `evt_${Date.now()}`,
      date: TODAY_DATE,
      dateLabel: TODAY_LABEL,
      kind: "記録",
      // 写真から読み取った資料は、その種類をタグとして自動で付ける
      // （生活資料ライブラリ：「必要ならタグを付ける」MVP_SPEC.md参照）
      tags: pendingTag ? [pendingTag] : [],
      conclusion: conclusionText,
      // AIが抽出したToDoではなく、確認画面で利用者が確認・修正した後のものを使う
      todos: confirmedTodos.map((t) => ({ text: t.text, done: false })),
      nextEvent: null,
      related: [],
      myNote: "",
      // レシートの金額は、残額に反映するかに関わらずEventへ残す。以前は
      // pendingReceiptAmountのみに保持しており、確認時に反映を選ばないと
      // 金額そのものが消えて、後から取り戻す手段が無かった
      // (2026-07-31、実際にレシートが反映されず利用者が困った経緯を受けて追加)。
      receiptAmount: pendingDocType === "receipt" ? pendingReceiptAmount : null,
    };
    setEvents((prev) => [...prev, newEvent]);
    // 資料の内容を買い物相談の判断材料(cwPlanNote)へ反映するかどうかは、
    // 利用者が確認画面で明示的に選んだ場合のみ——AIが提案し、本人が承認して
    // 初めて長期記憶になる(2026-07-30、FILOVITA_PHILOSOPHY.md「長期記憶は
    // 勝手に保存しない」参照)。黙って書き込んだり上書きしたりはしない。
    if (reflectToCwPlan) {
      setCwPlanNote((prev) => (prev.trim() ? `${prev}\n（資料より）${conclusionText}` : conclusionText));
    }
    // レシートの金額を実際に残額から差し引くかどうかも、本人が確認画面で
    // 明示的に選んだ場合のみ——家計台帳（shoppingBalance）はButlerが
    // その場で創作していい数字ではなく、正確に保たれてこそ買い物相談が
    // 根拠のある答えを返せる(2026-07-30、利用者からの指摘：レシートも
    // 入金も読んでいるのに残高の一貫性が失われていた)。
    if (deductReceiptAmount && pendingReceiptAmount) {
      setShoppingBalance((prev) => Number(prev || 0) - pendingReceiptAmount);
    }
    // draft等はここでは消さない——ConfirmScreenは`draft`があることを条件に
    // 表示されているため、ここで消すとデータ保存と同時に画面ごと消えてしまい、
    // 「完了しました」の表示も「戻る」ボタンも見せられなくなる。片付けは
    // 実際に画面を離れるとき(handleLeaveConfirm)にまとめて行う。
  }

  // Butlerとの出会い(初回聞き取り)の結果を、本物の状態へ書き込む。
  // 聞いていないことを埋めたり、聞き取った内容を上書き確定させたりせず、
  // 実際に教えてもらった分だけを追加する(第1条・第2条と同じ考え方)。
  function handleCompleteOnboarding(result) {
    if (result.wantsTour) {
      setGuideTourReturnScreen("calendar");
      setScreen("guideTour");
      return;
    }
    if (result.budget != null) setShoppingBudget(result.budget);
    if (result.incomeSchedule?.length) {
      setIncomeSchedule((prev) => [...prev, ...result.incomeSchedule.map((e) => ({ id: makeId("income"), ...e }))]);
    }
    if (result.essentialCosts?.length) {
      setEssentialCosts((prev) => [...prev, ...result.essentialCosts]);
    }
    if (result.weeklyLife?.length) {
      setWeeklyLife((prev) => [...prev, ...result.weeklyLife]);
    }
    if (result.nextShoppingDate) setNextShoppingDate(result.nextShoppingDate);
    setScreen("calendar");
  }

  function handleLeaveConfirm() {
    setDraft(null);
    setPendingTag(null);
    setPendingDocType(null);
    setPendingReceiptAmount(null);
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
            onConnect={() => setScreen("onboardingInterview")}
            onSkip={() => setScreen("onboardingInterview")}
          />
        )}
        {screen === "onboardingInterview" && (
          <OnboardingInterviewScreen
            theme={theme}
            companionName={companionName}
            userName={userName}
            onSaveNames={(c, u) => { setCompanionName(c); setUserName(u); }}
            onAddSeed={handleAddSeed}
            onComplete={handleCompleteOnboarding}
          />
        )}
        {screen === "calendar" && (
          <CalendarScreen
            theme={theme}
            events={events}
            monthStage={monthStage}
            inputMode={inputMode}
            todayDate={TODAY_DATE}
            onOpenDate={handleOpenDate}
            onNew={() => setScreen("input")}
            onOpenSettings={() => setScreen("settings")}
            onOpenShoppingConsult={() => setScreen("shoppingConsult")}
            onOpenWeeklyLife={() => setScreen("weeklyLife")}
            onAddSeed={handleAddSeed}
            onOpenSeeds={() => setScreen("seeds")}
            seenGuides={seenGuides}
            onDismissGuide={handleDismissGuide}
          />
        )}
        {screen === "seeds" && (
          <SeedsScreen
            theme={theme}
            seeds={seeds}
            onAdd={handleAddSeed}
            onRemove={handleRemoveSeed}
            onBack={() => setScreen("calendar")}
          />
        )}
        {screen === "weeklyLife" && (
          <WeeklyLifeScreen
            theme={theme}
            weeklyLife={weeklyLife}
            onAdd={handleAddWeeklyLife}
            onRemove={handleRemoveWeeklyLife}
            onBack={() => setScreen("calendar")}
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
            weeklyLife={weeklyLife}
            essentialCosts={essentialCosts}
            onAddEssentialCost={handleAddEssentialCost}
            onRemoveEssentialCost={handleRemoveEssentialCost}
            onEditEssentialCostAmount={handleEditEssentialCostAmount}
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
            weeklyLife={weeklyLife}
            essentialCosts={essentialCosts}
            chatHistory={shoppingChatHistory}
            onAppendChatMessage={handleAppendShoppingChatMessage}
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
            onOpenGuideTour={() => { setGuideTourReturnScreen("settings"); setScreen("guideTour"); }}
            companionName={companionName}
            userName={userName}
            onChangeCompanionName={setCompanionName}
            onChangeUserName={setUserName}
          />
        )}
        {screen === "guideTour" && (
          <GuideTourScreen
            theme={theme}
            onBack={() => setScreen(guideTourReturnScreen)}
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
            weeklyLife={weeklyLife}
            onAddWeeklyLife={handleAddWeeklyLife}
            onRemoveWeeklyLife={handleRemoveWeeklyLife}
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
            onSubmitPhoto={handleSubmitPhoto}
            isDrafting={isDrafting}
            draftError={draftError}
            seenGuides={seenGuides}
            onDismissGuide={handleDismissGuide}
          />
        )}
        {screen === "confirm" && draft && (
          <ConfirmScreen theme={theme} draft={draft} companionName={companionName} pendingTag={pendingTag} docType={pendingDocType} receiptAmount={pendingReceiptAmount} onBack={() => setScreen("input")} onConfirm={handleConfirm} onDone={handleLeaveConfirm} />
        )}
    </>
  );

  if (!bootDone) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <NotebookOpen onDone={() => setBootDone(true)} />
      </div>
    );
  }

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
