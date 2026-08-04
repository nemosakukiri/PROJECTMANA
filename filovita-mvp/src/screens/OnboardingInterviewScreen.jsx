import { useState } from "react";
import ContextHeader from "../components/ContextHeader.jsx";
import VoiceTextField from "../components/VoiceTextField.jsx";
import SeedQuickCapture from "../components/SeedQuickCapture.jsx";

/* Butlerとの出会い（初回起動時、自動で始まる）。

   2026-08-02、麻奈さんとの設計対話より：
   「初めましてと質問をしていくのはバトラーの仕事」「いらっしゃいませは
   機能じゃない、役割」——設定ウィザードのような姿ではなく、Butlerが
   迎え、少しずつ暮らしを教えてもらう一続きの会話として作る。

   さらに：「一発話一目的」（1つの発話で1つのことだけを扱う）、
   「主に何を使いたいかから質問が分かれていく」「音声で答える人も
   念頭に置く」という要望をすべて満たす形にする。

   はじめまして → 呼び名の交換 → 「少しずつ教えてください」 →
   目的をたずねる（①買い物・お金／②予定・リズム／③暮らしの種／
   ④まだ分からない） → 選んだ目的に沿って一問一答 → お礼。

   ここで聞いたことは、教えてもらった事実としてそのままApp.jsxの
   本物の状態（budget/incomeSchedule/essentialCosts/weeklyLife等）に
   書き込む——第1条・第2条（事実を作らない）と同じ考え方で、聞いて
   いないことを埋めたり、聞き取った数字を黙って確定させたりしない。 */

const PURPOSES = [
  { id: "shopping", label: "買い物・お金のやりくりを助けてほしい" },
  { id: "schedule", label: "予定・暮らしのリズムを整理したい" },
  { id: "seeds", label: "ちょっと思ったことを気軽に残したい" },
  { id: "unsure", label: "まだよく分からない、色々見てみたい" },
];

function buildStepQueue(selections) {
  const steps = [];
  if (selections.includes("shopping")) {
    steps.push({ type: "budget" });
    steps.push({ type: "income" });
    steps.push({ type: "essential" });
  }
  if (selections.includes("schedule")) {
    steps.push({ type: "weeklyLife" });
    steps.push({ type: "nextShoppingDate" });
  }
  if (selections.includes("seeds")) {
    steps.push({ type: "seedsIntro" });
  }
  return steps;
}

function extractYen(text) {
  const cleaned = String(text || "").replace(/,/g, "");
  const man = cleaned.match(/(\d+)\s*万/);
  if (man) return String(Number(man[1]) * 10000);
  const plain = cleaned.match(/(\d{3,})/);
  return plain ? plain[1] : "";
}

const WEEKDAYS = [
  { key: "mon", label: "月" }, { key: "tue", label: "火" }, { key: "wed", label: "水" },
  { key: "thu", label: "木" }, { key: "fri", label: "金" }, { key: "sat", label: "土" }, { key: "sun", label: "日" },
];

function bubbleTextStyle(tokens) {
  return { fontSize: 15, color: tokens.ink, lineHeight: 1.9, margin: "0 0 24px", whiteSpace: "pre-line" };
}
function primaryButtonStyle(tokens, disabled) {
  return {
    padding: "11px 24px", fontSize: 13.5, borderRadius: 999, border: "none",
    background: disabled ? tokens.line : tokens.ink, color: tokens.paper,
    cursor: disabled ? "default" : "pointer",
  };
}
function ghostButtonStyle(tokens) {
  return {
    padding: "11px 20px", fontSize: 13.5, borderRadius: 999,
    border: `1px solid ${tokens.line}`, background: "none", color: tokens.inkSoft, cursor: "pointer",
  };
}
function fieldLabelStyle(tokens) {
  return { fontSize: 12, color: tokens.inkFaint, margin: "0 0 6px", textAlign: "left" };
}

export default function OnboardingInterviewScreen({ theme, companionName, userName, onSaveNames, onAddSeed, onComplete }) {
  const { tokens } = theme;
  const [phase, setPhase] = useState("greeting"); // greeting -> naming -> purpose -> steps -> done
  const [companionInput, setCompanionInput] = useState(companionName ?? "");
  const [userInput, setUserInput] = useState(userName ?? "");
  const [selections, setSelections] = useState([]);
  const [stepQueue, setStepQueue] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [collected, setCollected] = useState({
    budget: null, incomeSchedule: [], essentialCosts: [], weeklyLife: [], nextShoppingDate: null,
  });

  function togglePurpose(id) {
    if (id === "seeds" || id === "unsure") {
      setSelections((prev) => (prev.includes(id) ? [] : [id]));
      return;
    }
    setSelections((prev) => {
      const withoutExclusive = prev.filter((p) => p !== "seeds" && p !== "unsure");
      return withoutExclusive.includes(id) ? withoutExclusive.filter((p) => p !== id) : [...withoutExclusive, id];
    });
  }

  function handlePurposeNext() {
    if (selections.includes("unsure")) {
      onComplete({ wantsTour: true });
      return;
    }
    const queue = buildStepQueue(selections);
    setStepQueue(queue);
    setStepIndex(0);
    setPhase("steps");
  }

  function mergeStepResult(prev, step, result) {
    switch (step.type) {
      case "budget":
        return { ...prev, budget: result.budget };
      case "income":
        return { ...prev, incomeSchedule: [...prev.incomeSchedule, ...result.entries] };
      case "essential":
        return { ...prev, essentialCosts: [...prev.essentialCosts, ...result.entries] };
      case "weeklyLife":
        return { ...prev, weeklyLife: [...prev.weeklyLife, ...result.entries] };
      case "nextShoppingDate":
        return { ...prev, nextShoppingDate: result.value || prev.nextShoppingDate };
      default:
        return prev;
    }
  }

  function handleStepNext(result) {
    setCollected((prev) => mergeStepResult(prev, stepQueue[stepIndex], result));
    if (stepIndex + 1 < stepQueue.length) {
      setStepIndex((i) => i + 1);
    } else {
      setPhase("done");
    }
  }

  function handleFinish() {
    onComplete({ ...collected, wantsTour: false });
  }

  return (
    <div>
      <ContextHeader theme={theme} breadcrumb="はじめに" title="Butlerとの出会い" />
      <div style={{ padding: "20px 20px 0", textAlign: "center" }}>
        {phase === "greeting" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 18 }}>🌱</div>
            <p style={bubbleTextStyle(tokens)}>
              {"はじめまして。\n\n私はあなたのButlerです。\n\nあなたの暮らしと、お金のやりくりを一緒に見て、管理のお手伝いをします。\n\nそのために、まずあなたの暮らしを少しずつ教えていただきたいです。"}
            </p>
            <button onClick={() => setPhase("naming")} style={primaryButtonStyle(tokens, false)}>次へ</button>
          </>
        )}

        {phase === "naming" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 18 }}>🌱</div>
            <p style={bubbleTextStyle(tokens)}>{"まずは、お互いの呼び方を決めませんか。\n\nあなたは、私を何と呼びますか？"}</p>
            <input
              type="text" value={companionInput} onChange={(e) => setCompanionInput(e.target.value)}
              placeholder="例：執事、相棒、ネモ…" data-testid="onboarding-companion-name"
              style={{ width: "100%", padding: "11px 13px", fontSize: 14, borderRadius: 10, border: `1px solid ${tokens.line}`, marginBottom: 22, boxSizing: "border-box", textAlign: "center" }}
            />
            <p style={bubbleTextStyle(tokens)}>{"では、あなたのことは何とお呼びすればいいですか？"}</p>
            <input
              type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)}
              placeholder="呼び方を入力（任意）" data-testid="onboarding-user-name"
              style={{ width: "100%", padding: "11px 13px", fontSize: 14, borderRadius: 10, border: `1px solid ${tokens.line}`, marginBottom: 6, boxSizing: "border-box", textAlign: "center" }}
            />
            <p style={{ fontSize: 12, color: tokens.inkFaint, margin: "0 0 26px" }}>あとから、いつでも変更できます。</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                onClick={() => { onSaveNames?.("", ""); setPhase("purpose"); }}
                style={ghostButtonStyle(tokens)}
              >
                あとで決める
              </button>
              <button
                onClick={() => { onSaveNames?.(companionInput.trim(), userInput.trim()); setPhase("purpose"); }}
                style={primaryButtonStyle(tokens, false)}
              >
                次へ
              </button>
            </div>
          </>
        )}

        {phase === "purpose" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 18 }}>🌱</div>
            <p style={bubbleTextStyle(tokens)}>
              {"まず、何のお手伝いをしましょうか？"}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
              {PURPOSES.map((p) => {
                const active = selections.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePurpose(p.id)}
                    data-testid={`onboarding-purpose-${p.id}`}
                    style={{
                      padding: "12px 16px", fontSize: 14, borderRadius: 12, textAlign: "left", cursor: "pointer",
                      border: `1.5px solid ${active ? tokens.ink : tokens.line}`,
                      background: active ? tokens.ink : "transparent",
                      color: active ? tokens.paper : tokens.ink,
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={handlePurposeNext}
              disabled={selections.length === 0}
              data-testid="onboarding-purpose-next"
              style={primaryButtonStyle(tokens, selections.length === 0)}
            >
              次へ
            </button>
          </>
        )}

        {phase === "steps" && (
          <>
            <div style={{ fontSize: 11, color: tokens.inkFaint, marginBottom: 10 }}>
              {stepIndex + 1} / {stepQueue.length}
            </div>
            <StepBody
              key={stepIndex}
              step={stepQueue[stepIndex]}
              theme={theme}
              onAddSeed={onAddSeed}
              onNext={handleStepNext}
            />
          </>
        )}

        {phase === "done" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 18 }}>🌱</div>
            <p style={bubbleTextStyle(tokens)}>
              {"ありがとうございました。\n\n今教えていただいたことは、いつでも設定や各画面から直せます。\n\n少しずつ、あなたのペースで使ってください。"}
            </p>
            <button onClick={handleFinish} data-testid="onboarding-finish" style={primaryButtonStyle(tokens, false)}>
              Filovitaをはじめる
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StepBody({ step, theme, onAddSeed, onNext }) {
  if (step.type === "budget") return <BudgetStep theme={theme} onNext={onNext} />;
  if (step.type === "income") return <IncomeStep theme={theme} onNext={onNext} />;
  if (step.type === "essential") return <EssentialStep theme={theme} onNext={onNext} />;
  if (step.type === "weeklyLife") return <WeeklyLifeStep theme={theme} onNext={onNext} />;
  if (step.type === "nextShoppingDate") return <NextShoppingDateStep theme={theme} onNext={onNext} />;
  if (step.type === "seedsIntro") return <SeedsIntroStep theme={theme} onAddSeed={onAddSeed} onNext={onNext} />;
  return null;
}

function BudgetStep({ theme, onNext }) {
  const { tokens } = theme;
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");

  function handleTextChange(v) {
    setText(v);
    const guess = extractYen(v);
    if (guess) setAmount(guess);
  }

  return (
    <>
      <div style={{ fontSize: 40, marginBottom: 18 }}>🌱</div>
      <p style={bubbleTextStyle(tokens)}>{"2週間の予算はどれくらいですか？\n\n（だいたいで大丈夫です）"}</p>
      <div style={{ textAlign: "left", marginBottom: 18 }}>
        <p style={fieldLabelStyle(tokens)}>話す・書く（例：3万円くらい）</p>
        <VoiceTextField theme={theme} value={text} onChange={handleTextChange} placeholder="例：3万円くらい" testId="onboarding-budget-text" />
      </div>
      <div style={{ textAlign: "left", marginBottom: 26 }}>
        <p style={fieldLabelStyle(tokens)}>金額（聞き取った内容から入れています。違っていたら直してください）</p>
        <input
          type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="金額" data-testid="onboarding-budget-amount"
          style={{ width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 10, border: `1px solid ${tokens.line}`, boxSizing: "border-box" }}
        />
      </div>
      <button
        onClick={() => onNext({ budget: amount ? Number(amount) : null })}
        data-testid="onboarding-budget-next"
        style={primaryButtonStyle(tokens, false)}
      >
        次へ
      </button>
    </>
  );
}

function IncomeStep({ theme, onNext }) {
  const { tokens } = theme;
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [entries, setEntries] = useState([]);

  function addEntry() {
    if (!label.trim()) return;
    setEntries((prev) => [...prev, { label: label.trim(), date: date.trim() || "未定", amount: amount ? Number(amount) : null }]);
    setLabel(""); setDate(""); setAmount("");
  }

  return (
    <>
      <div style={{ fontSize: 40, marginBottom: 18 }}>🌱</div>
      <p style={bubbleTextStyle(tokens)}>{"入金予定はありますか？\n\n（年金・給付・お給料など。無ければそのまま次へ進んでください）"}</p>
      <div style={{ textAlign: "left", marginBottom: 10 }}>
        <p style={fieldLabelStyle(tokens)}>名前（例：年金）</p>
        <VoiceTextField theme={theme} value={label} onChange={setLabel} placeholder="例：年金" testId="onboarding-income-label" />
      </div>
      <div style={{ textAlign: "left", marginBottom: 10 }}>
        <p style={fieldLabelStyle(tokens)}>だいたいの日にち（例：毎月15日）</p>
        <VoiceTextField theme={theme} value={date} onChange={setDate} placeholder="例：毎月15日" testId="onboarding-income-date" />
      </div>
      <div style={{ textAlign: "left", marginBottom: 16 }}>
        <p style={fieldLabelStyle(tokens)}>金額（分かれば。分からなければ空のままで大丈夫です）</p>
        <input
          type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="金額（任意）" data-testid="onboarding-income-amount"
          style={{ width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 10, border: `1px solid ${tokens.line}`, boxSizing: "border-box" }}
        />
      </div>
      <button onClick={addEntry} data-testid="onboarding-income-add" style={ghostButtonStyle(tokens)}>これを追加する</button>

      {entries.length > 0 && (
        <div style={{ textAlign: "left", margin: "16px 0", fontSize: 13, color: tokens.inkSoft }}>
          {entries.map((e, i) => (
            <div key={i} style={{ padding: "6px 0", borderTop: `1px solid ${tokens.line}` }}>
              ・{e.label}：{e.date}{e.amount != null ? `（¥${e.amount.toLocaleString()}）` : ""}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button onClick={() => onNext({ entries })} data-testid="onboarding-income-next" style={primaryButtonStyle(tokens, false)}>
          次へ
        </button>
      </div>
    </>
  );
}

function EssentialStep({ theme, onNext }) {
  const { tokens } = theme;
  const [entity, setEntity] = useState("");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [entries, setEntries] = useState([]);

  function addEntry() {
    if (!entity.trim() || !label.trim()) return;
    setEntries((prev) => [...prev, {
      id: `ec_${Date.now()}_${prev.length}`, entity: entity.trim(), label: label.trim(),
      amount: amount ? Number(amount) : null, cadence: null, note: "",
    }]);
    setEntity(""); setLabel(""); setAmount("");
  }

  return (
    <>
      <div style={{ fontSize: 40, marginBottom: 18 }}>🌱</div>
      <p style={bubbleTextStyle(tokens)}>{"欠かせない支出はありますか？\n\n（誰のための、何の費用か教えてください。無ければそのまま次へ進んでください）"}</p>
      <div style={{ textAlign: "left", marginBottom: 10 }}>
        <p style={fieldLabelStyle(tokens)}>誰のためのものですか（例：ネモ）</p>
        <VoiceTextField theme={theme} value={entity} onChange={setEntity} placeholder="例：ネモ" testId="onboarding-essential-entity" />
      </div>
      <div style={{ textAlign: "left", marginBottom: 10 }}>
        <p style={fieldLabelStyle(tokens)}>何の費用ですか（例：薬）</p>
        <VoiceTextField theme={theme} value={label} onChange={setLabel} placeholder="例：薬" testId="onboarding-essential-label" />
      </div>
      <div style={{ textAlign: "left", marginBottom: 16 }}>
        <p style={fieldLabelStyle(tokens)}>金額（分かれば。分からなければ空のままで大丈夫です）</p>
        <input
          type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="金額（任意）" data-testid="onboarding-essential-amount"
          style={{ width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 10, border: `1px solid ${tokens.line}`, boxSizing: "border-box" }}
        />
      </div>
      <button onClick={addEntry} data-testid="onboarding-essential-add" style={ghostButtonStyle(tokens)}>これを追加する</button>

      {entries.length > 0 && (
        <div style={{ textAlign: "left", margin: "16px 0", fontSize: 13, color: tokens.inkSoft }}>
          {entries.map((e, i) => (
            <div key={i} style={{ padding: "6px 0", borderTop: `1px solid ${tokens.line}` }}>
              ・{e.entity}：{e.label}{e.amount != null ? `（¥${e.amount.toLocaleString()}）` : "（金額未確認）"}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button onClick={() => onNext({ entries })} data-testid="onboarding-essential-next" style={primaryButtonStyle(tokens, false)}>
          次へ
        </button>
      </div>
    </>
  );
}

function WeeklyLifeStep({ theme, onNext }) {
  const { tokens } = theme;
  const [dayOfWeek, setDayOfWeek] = useState("mon");
  const [label, setLabel] = useState("");
  const [startTime, setStartTime] = useState("");
  const [entries, setEntries] = useState([]);

  function addEntry() {
    if (!label.trim()) return;
    setEntries((prev) => [...prev, {
      id: `wl_${Date.now()}_${prev.length}`, kind: "regular",
      repeat: { type: "weekly", dayOfWeek }, label: label.trim(),
      startTime: startTime || "", endTime: null, provider: null,
    }]);
    setLabel(""); setStartTime("");
  }

  return (
    <>
      <div style={{ fontSize: 40, marginBottom: 18 }}>🌱</div>
      <p style={bubbleTextStyle(tokens)}>{"今週、決まって入っている予定はありますか？\n\n（曜日ごとに教えてください。無ければそのまま次へ進んでください）"}</p>
      <div style={{ textAlign: "left", marginBottom: 10 }}>
        <p style={fieldLabelStyle(tokens)}>曜日</p>
        <select
          value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} data-testid="onboarding-weekly-day"
          style={{ width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 10, border: `1px solid ${tokens.line}`, boxSizing: "border-box" }}
        >
          {WEEKDAYS.map((d) => <option key={d.key} value={d.key}>{d.label}曜</option>)}
        </select>
      </div>
      <div style={{ textAlign: "left", marginBottom: 10 }}>
        <p style={fieldLabelStyle(tokens)}>何がありますか（例：デイサービス）</p>
        <VoiceTextField theme={theme} value={label} onChange={setLabel} placeholder="例：デイサービス" testId="onboarding-weekly-label" />
      </div>
      <div style={{ textAlign: "left", marginBottom: 16 }}>
        <p style={fieldLabelStyle(tokens)}>時間（分かれば）</p>
        <input
          type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} data-testid="onboarding-weekly-time"
          style={{ width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 10, border: `1px solid ${tokens.line}`, boxSizing: "border-box" }}
        />
      </div>
      <button onClick={addEntry} data-testid="onboarding-weekly-add" style={ghostButtonStyle(tokens)}>これを追加する</button>

      {entries.length > 0 && (
        <div style={{ textAlign: "left", margin: "16px 0", fontSize: 13, color: tokens.inkSoft }}>
          {entries.map((e, i) => (
            <div key={i} style={{ padding: "6px 0", borderTop: `1px solid ${tokens.line}` }}>
              ・{WEEKDAYS.find((d) => d.key === e.repeat.dayOfWeek)?.label}曜：{e.startTime && `${e.startTime} `}{e.label}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button onClick={() => onNext({ entries })} data-testid="onboarding-weekly-next" style={primaryButtonStyle(tokens, false)}>
          次へ
        </button>
      </div>
    </>
  );
}

function NextShoppingDateStep({ theme, onNext }) {
  const { tokens } = theme;
  const [value, setValue] = useState("");
  return (
    <>
      <div style={{ fontSize: 40, marginBottom: 18 }}>🌱</div>
      <p style={bubbleTextStyle(tokens)}>{"次の買い物は、だいたいいつ頃の予定ですか？"}</p>
      <div style={{ textAlign: "left", marginBottom: 26 }}>
        <VoiceTextField theme={theme} value={value} onChange={setValue} placeholder="例：来週の金曜日" testId="onboarding-next-shopping-date" />
      </div>
      <button onClick={() => onNext({ value: value.trim() })} data-testid="onboarding-next-shopping-date-next" style={primaryButtonStyle(tokens, false)}>
        次へ
      </button>
    </>
  );
}

function SeedsIntroStep({ theme, onAddSeed, onNext }) {
  const { tokens } = theme;
  return (
    <>
      <div style={{ fontSize: 40, marginBottom: 18 }}>🌱</div>
      <p style={bubbleTextStyle(tokens)}>
        {"「暮らしの種」は、分類しなくていい場所です。\n\n見たい映画、行ってみたいお店——ふと思ったことを、そのまま残せます。\n\nよければ、いま一つ試してみませんか（あとで消してもいいですし、そのままでも大丈夫です）。"}
      </p>
      <div style={{ textAlign: "left", marginBottom: 26 }}>
        <SeedQuickCapture tokens={tokens} onAdd={onAddSeed} />
      </div>
      <button onClick={() => onNext({})} data-testid="onboarding-seeds-next" style={primaryButtonStyle(tokens, false)}>
        次へ
      </button>
    </>
  );
}
