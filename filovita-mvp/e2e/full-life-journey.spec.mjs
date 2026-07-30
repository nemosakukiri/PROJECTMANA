/*
 * E2E: 予約票の撮影から、後日その情報で支援を受けるまで
 *
 * 詳しいシナリオと実装状況は SCENARIO.md を参照。
 * このテストは実装されている範囲だけを、実際のUI操作(クリック・入力・
 * リロード)を通して連続実行する。localStorageへの直接書き込みで手順を
 * 飛ばすことはしない——「本当に最初から最後まで、生活の中で目的を
 * 達成できるか」を検証するのが目的のため。
 *
 * 未実装のためスキップする範囲(写真撮影・OCR・Google Calendar連携)は
 * 明示的にログへ出す。
 *
 * 実行: npm run test:e2e
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 5900;
const BASE_URL = `http://localhost:${PORT}/`;
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium";

let failed = 0;
let stepCount = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
    throw new Error(`アサーション失敗: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function step(title) {
  stepCount++;
  console.log(`\n[${stepCount}] ${title}`);
}

function gap(title) {
  console.log(`\n[skip] ${title} — 未実装のためスキップ（SCENARIO.md参照）`);
}

async function clickButtonWithText(page, exactText) {
  const clicked = await page.evaluate((text) => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === text);
    if (btn) { btn.click(); return true; }
    return false;
  }, exactText);
  if (!clicked) throw new Error(`ボタンが見つかりません: "${exactText}"`);
}

async function clickButtonContaining(page, partialText) {
  const clicked = await page.evaluate((text) => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes(text));
    if (btn) { btn.click(); return true; }
    return false;
  }, partialText);
  if (!clicked) throw new Error(`部分一致するボタンが見つかりません: "${partialText}"`);
}

async function getState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("filovita-mvp-state") || "{}"));
}

async function main() {
  console.log("=== Filovita E2E: 予約票の撮影から、後日その情報で支援を受けるまで ===");

  gap("① 予約票・チラシを撮影する（InputScreenに撮影UIが存在しない）");
  gap("② OCR・AIが写真から日時・場所・電話番号を抽出する（OCRパイプライン未実装）");

  const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: "pipe",
    detached: true, // esbuildの子プロセスごと終了させるため、プロセスグループを分ける
  });
  await new Promise((resolve, reject) => {
    let out = "";
    const onData = (d) => {
      out += d.toString();
      if (out.includes("ready in")) { vite.stdout.off("data", onData); resolve(); }
    };
    vite.stdout.on("data", onData);
    vite.stderr.on("data", (d) => (out += d.toString()));
    setTimeout(() => reject(new Error(`vite dev server起動タイムアウト: ${out}`)), 15000);
  });

  const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });

  try {
    // 実行環境にマイクが無いため、SpeechRecognitionだけをモックする。
    // ここから先(認識結果を受け取ったあとのUI・データの流れ)は本物のコード。
    // window.__speechShouldFailで失敗パターンも切り替えられるようにする
    // ——InputScreen.jsx/ShoppingChat.jsxはSpeechRecognitionApiをモジュール
    // 読み込み時に一度だけ捕まえるため、クラスの参照自体は差し替えず、
    // クラス内部の分岐で挙動を切り替える必要がある(2026-07-29に判明)。
    await page.addInitScript(() => {
      class FakeSpeechRecognition {
        start() {
          setTimeout(() => {
            if (window.__speechShouldFail) {
              if (this.onerror) this.onerror({ error: window.__speechErrorCode || "audio-capture" });
              if (this.onend) this.onend();
              return;
            }
            if (this.onresult) {
              this.onresult({
                results: [[{ transcript: "○○病院から電話があって、来月10日の通院で血液検査があるとのこと。" }]],
              });
            }
          }, 150);
        }
        stop() { if (this.onend) this.onend(); }
      }
      window.SpeechRecognition = FakeSpeechRecognition;
      window.webkitSpeechRecognition = FakeSpeechRecognition;
    });

    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.setItem("filovita-mvp-state", JSON.stringify({
        screen: "calendar", inputMode: "speak", themeId: "techo",
        selectedDate: null, selectedEventId: null, events: [], draft: null,
        tagRegistry: {}, tagToolboxes: {}, activeTagName: null, seenGuides: {},
      }));
    });
    await page.reload();
    await page.waitForTimeout(300);

    step("案内人：初めてカレンダーを開くと、案内が自動で出る");
    let bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("起きたことが、そのままここに並びます"), "カレンダーの案内が自動で表示されている");
    await clickButtonWithText(page, "わかった");
    await page.waitForTimeout(150);
    await page.reload();
    await page.waitForTimeout(300);
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(!bodyText.includes("ここがあなたの生活です"), "一度見た案内は、リロード後も自動では出てこない");
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("❔"));
      btn?.click();
    });
    await page.waitForTimeout(150);
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("起きたことが、そのままここに並びます"), "❔ボタンで、いつでも案内を呼び戻せる");
    await clickButtonWithText(page, "わかった");
    await page.waitForTimeout(150);

    step("③.5 音声入力：カレンダー画面の＋がマイクボタンになっている（inputMode=speak）");
    const fabIsMic = await page.evaluate(() => {
      const fab = [...document.querySelectorAll("button")].find((b) => b.querySelector("svg.lucide-mic"));
      return !!fab;
    });
    assert(fabIsMic, "マイクボタン(FAB)が表示されている");

    step("マイクをタップ → InputScreenが「話す」モードで開く");
    await page.evaluate(() => {
      const fab = [...document.querySelectorAll("button")].find((b) => b.querySelector("svg.lucide-mic"));
      fab?.click();
    });
    await page.waitForTimeout(200);
    const onInputSpeak = await page.evaluate(() =>
      !!document.body.textContent.includes("タップして話しはじめる") ||
      !!document.body.textContent.includes("聞いています"));
    assert(onInputSpeak, "InputScreenの「話す」タブが開いている");

    step("案内人：InputScreenも初回だけ案内が出る");
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("話しても、書いても残せます"), "入力画面の案内が自動で表示されている");
    await clickButtonWithText(page, "わかった");
    await page.waitForTimeout(150);

    step("音声認識が失敗したら、event.errorのコードごとに理由が分かる文言を出し分ける(2026-07-29利用者指摘の修正確認)");
    const speechErrorCases = [
      ["not-allowed", "マイクの使用が許可されていません。"],
      // service-not-allowedはnot-allowedとは別物(2026-07-30、利用者の
      // 実機で実際にこのコードが確認された——マイク権限が「許可」でも
      // 出ることがある、音声認識サービス自体の利用可否を示すコード)。
      // 端末の設定確認を促す文言は、実際にディクテーション設定が有効な
      // 状態でも再現し、本物のSafari.appでも再現したため誤り(2026-07-30
      // に判明)。設定確認へ誘導せず、正直に「使えない」とだけ伝える。
      ["service-not-allowed", "この端末のブラウザでは音声入力を利用できないようです。"],
      ["audio-capture", "マイクが利用できません。"],
      ["network", "音声認識サービスに接続できません。"],
      ["no-speech", "音声が聞き取れませんでした。もう一度お話しください。"],
      ["some-unknown-code", "音声入力を開始できませんでした。"],
    ];
    for (const [code, expectedMessage] of speechErrorCases) {
      await page.evaluate((c) => { window.__speechShouldFail = true; window.__speechErrorCode = c; }, code);
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "🎤");
        btn?.click();
      });
      await page.waitForTimeout(300);
      bodyText = await page.evaluate(() => document.body.textContent);
      assert(
        bodyText.includes(expectedMessage),
        `event.error="${code}"のとき「${expectedMessage}」が表示される（実際のbodyTextに含まれていない）`
      );
      assert(
        bodyText.includes(`error: ${code}`),
        `画面上に生のevent.errorコード（error: ${code}）も表示され、DevToolsを開かずに報告できる`
      );
    }
    await page.evaluate(() => { window.__speechShouldFail = false; });

    step("録音開始 → 認識結果が反映される → 停止 → 次へ");
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "🎤");
      btn?.click();
    });
    await page.waitForTimeout(400);
    let transcriptShown = await page.evaluate(() => document.body.textContent.includes("血液検査"));
    assert(transcriptShown, "音声認識の結果(血液検査を含む文)が画面に表示されている");
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "🎤");
      btn?.click();
    });
    await page.waitForTimeout(200);
    await clickButtonWithText(page, "次へ");
    await page.waitForTimeout(300);

    step("④ 確認画面：AIの下書きを確定する");
    let state = await getState(page);
    assert(state.screen === "confirm", `確認画面に遷移している（実際: ${state.screen}）`);
    await clickButtonWithText(page, "この内容で確定する");
    await page.waitForTimeout(200);
    await clickButtonWithText(page, "カレンダーへ戻る");
    await page.waitForTimeout(300);

    step("⑤ Eventがカレンダーに登録されている（Filovita内部）");
    state = await getState(page);
    assert(state.screen === "calendar", "カレンダー画面に戻っている");
    assert(state.events.length === 1, `Eventが1件作成されている（実際: ${state.events.length}件）`);
    const createdEvent = state.events[0];
    assert(createdEvent.conclusion.includes("血液検査"), "作成されたEventに音声入力の内容が反映されている");
    gap("Google Calendarとの双方向連携（次回セッション最優先事項、未実装）");

    step("今日のEventを開く");
    await page.evaluate(() => {
      const cell = [...document.querySelectorAll("button")].find((b) => b.querySelector("span")?.textContent.trim() === "18");
      cell?.click();
    });
    await page.waitForTimeout(300);
    state = await getState(page);
    assert(state.screen === "dayList", "その日の記録一覧に遷移している");
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("血液検査"));
      btn?.click();
    });
    await page.waitForTimeout(300);
    state = await getState(page);
    assert(state.screen === "detail", "Event詳細画面が開いている");

    step("案内人：タグの案内も初回だけ出る");
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("よく会う人や、よく行く場所につけます"), "タグの案内が自動で表示されている");
    await clickButtonWithText(page, "わかった");
    await page.waitForTimeout(150);

    step("⑥ AIの長期記憶：所感を書くと「所感」タグが付く");
    await page.fill("textarea[placeholder*='そのときの気持ち']", "次はお薬手帳を忘れずに持っていく。");
    await page.waitForTimeout(200);
    state = await getState(page);
    const evt = state.events.find((e) => e.id === state.selectedEventId);
    assert(evt.tags.includes("所感"), "「所感」タグが自動で付いている");

    step("「所感」タグの道具箱を開き、電話番号の参照を登録する");
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("所感") && b.textContent.includes("📑"));
      btn?.click();
    });
    await page.waitForTimeout(300);
    state = await getState(page);
    assert(state.screen === "tagToolbox", "タグの道具箱画面が開いている");

    step("案内人：道具箱の案内も初回だけ出る");
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("電話番号や地図を、タグに登録できます"), "道具箱の案内が自動で表示されている");
    await clickButtonWithText(page, "わかった");
    await page.waitForTimeout(150);

    await clickButtonContaining(page, "参照を追加");
    await page.waitForTimeout(150);
    await clickButtonContaining(page, "電話");
    await page.fill('input[placeholder*="名前"]', "○○病院");
    await page.fill('input[placeholder*="URL"]', "075-123-4567");
    await clickButtonWithText(page, "追加する");
    await page.waitForTimeout(200);

    step("登録した参照から「電話する」ボタンが正しいtel:リンクを持つ");
    const telHref = await page.evaluate(() => {
      const a = [...document.querySelectorAll("a")].find((el) => el.textContent.includes("電話する"));
      return a?.getAttribute("href");
    });
    assert(telHref === "tel:0751234567", `電話するボタンのhrefが正しい（実際: ${telHref}）`);

    step("⑦ 結論の一文にマーカーを引く");
    await clickButtonWithText(page, "戻る"); // tagToolbox -> detail
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const p = [...document.querySelectorAll("p")].find((el) => el.textContent.includes("血液検査"));
      const target = "来月10日の通院で血液検査がある";
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const idx = node.textContent.indexOf(target);
        if (idx !== -1) {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + target.length);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          p.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
          break;
        }
      }
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.title === "マーカー");
      btn?.click();
    });
    await page.waitForTimeout(200);
    state = await getState(page);
    const evtAfterMark = state.events.find((e) => e.id === state.selectedEventId);
    assert(
      (evtAfterMark.marks || []).some((m) => m.type === "marker" && m.text.includes("血液検査")),
      "マーカー(marker)が結論文に保存されている"
    );

    step("⑧ 後日の利用：ページを実際にリロードして、すべて残っていることを確認する");
    await page.reload();
    await page.waitForTimeout(400);
    state = await getState(page);
    assert(state.events.length === 1, "リロード後もEventが残っている");
    const evtAfterReload = state.events.find((e) => e.id === state.selectedEventId);
    assert(evtAfterReload.tags.includes("所感"), "リロード後も「所感」タグが残っている");
    assert((evtAfterReload.marks || []).length === 1, "リロード後もマーカーが残っている");
    const toolboxAfterReload = state.tagToolboxes[state.tagRegistry["所感"]];
    assert(toolboxAfterReload.references.length === 1, "リロード後も道具箱の参照が残っている");

    step("道具箱を開くと「マーカーされた記録」欄に、後で見つけたマーカーが一覧表示される");
    bodyText = await page.evaluate(() => document.body.textContent);
    const onDetail = bodyText.includes("血液検査");
    assert(onDetail, "リロード後もEvent詳細が正しく表示されている");
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("所感") && b.textContent.includes("📑"));
      btn?.click();
    });
    await page.waitForTimeout(300);
    const markedDigestText = await page.evaluate(() => document.body.textContent);
    assert(markedDigestText.includes("マーカーされた記録"), "「マーカーされた記録」欄が表示されている");
    assert(markedDigestText.includes("血液検査"), "マーカーした一文が道具箱に横断表示されている");

    const telHrefAfterReload = await page.evaluate(() => {
      const a = [...document.querySelectorAll("a")].find((el) => el.textContent.includes("電話する"));
      return a?.getAttribute("href");
    });
    assert(telHrefAfterReload === "tel:0751234567", "リロード後も電話するボタンが正しく機能する");

    step("案内人：設定の「はじめてガイド」から、一度見た案内をいつでも見返せる");
    await page.evaluate(() => {
      localStorage.setItem("filovita-mvp-state", JSON.stringify({
        ...JSON.parse(localStorage.getItem("filovita-mvp-state")),
        screen: "settings",
      }));
    });
    await page.reload();
    await page.waitForTimeout(300);
    await clickButtonContaining(page, "はじめてガイド");
    await page.waitForTimeout(200);
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("起きたことが、そのままここに並びます"), "はじめてガイドが最初の案内から始まる");
    for (let i = 0; i < 4; i++) {
      await clickButtonWithText(page, "次へ");
      await page.waitForTimeout(150);
    }

    step("案内人：4つの案内のあと、「はじめまして」からお互いの呼び名を交換する");
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("はじめまして"), "呼び名の交換は「はじめまして」の挨拶から始まる");
    assert(bodyText.includes("あなたは、私を何と呼びますか"), "AI自身の呼び名を尋ねている");
    assert(bodyText.includes("あなたのことは何とお呼びすればいいですか"), "利用者の呼び名も尋ねている（一方的な命名にしない）");
    await page.fill('input[placeholder="例：執事、相棒、ネモ…"]', "執事");
    await page.fill('input[placeholder="呼び方を入力（任意）"]', "ねもさん");
    await clickButtonWithText(page, "次へ");
    await page.waitForTimeout(150);
    state = await getState(page);
    assert(state.companionName === "執事" && state.userName === "ねもさん", "決めた呼び名がその場で保存されている");

    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("これで準備はできました"), "最後に、いつでも戻れることを伝える一言がある");
    await clickButtonWithText(page, "Filovitaをはじめる");
    await page.waitForTimeout(200);
    state = await getState(page);
    assert(state.screen === "settings", "ガイドを終えると設定画面に戻る");

    step("案内人：決めた呼び名は、AIが語りかける場面（確認画面）に反映される");
    await page.evaluate(() => {
      localStorage.setItem("filovita-mvp-state", JSON.stringify({
        ...JSON.parse(localStorage.getItem("filovita-mvp-state")),
        screen: "confirm",
        draft: { conclusion: { value: "血液検査の結果を聞いた" }, todos: [] },
      }));
    });
    await page.reload();
    await page.waitForTimeout(300);
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("執事が下書きを作りました"), "確認画面の文言が「AI」ではなく決めた呼び名に差し替わっている");

    step("案内人：呼び名はあとから設定画面でいつでも変更できる");
    await page.evaluate(() => {
      localStorage.setItem("filovita-mvp-state", JSON.stringify({
        ...JSON.parse(localStorage.getItem("filovita-mvp-state")),
        screen: "settings",
      }));
    });
    await page.reload();
    await page.waitForTimeout(300);
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("呼び名"), "設定画面に呼び名の項目がある");
    const companionValue = await page.evaluate(() => document.querySelector('input[placeholder="例：執事、相棒、ネモ…"]')?.value);
    assert(companionValue === "執事", "設定画面にも決めた呼び名がそのまま表示されている");

    step("買い物相談：ホーム画面に常設の固定導線がある（MVP_SPEC.md「複数周期の統合判断」）");
    await page.evaluate(() => {
      localStorage.setItem("filovita-mvp-state", JSON.stringify({
        ...JSON.parse(localStorage.getItem("filovita-mvp-state")),
        screen: "calendar",
        shoppingBudget: 20000, shoppingBalance: 12000, nextShoppingDate: "7月25日",
        recurringItems: [{ id: "rec_food", name: "食料品", amount: 6000 }, { id: "rec_tobacco", name: "タバコ", amount: 3000 }],
        itemsToAdd: [],
      }));
    });
    await page.reload();
    await page.waitForTimeout(300);
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("買い物を相談する"), "カレンダー画面に「買い物を相談する」の固定導線がある");
    await clickButtonContaining(page, "買い物を相談する");
    await page.waitForTimeout(200);
    state = await getState(page);
    assert(state.screen === "shoppingConsult", "買い物相談の画面が開く");

    step("買い物相談：Google Calendar連携を待たず、Filovita内部に「暮らしの予定」（入金・支払い・必需品補充）を持てる");
    await page.fill('input[placeholder="例：年金、お給料"]', "生活保護費");
    await page.fill('input[placeholder="例：8月15日"] >> nth=0', "8月5日");
    await page.fill('input[placeholder="金額(任意)"] >> nth=0', "80000");
    await page.click('button:has-text("追加") >> nth=0');
    await page.waitForTimeout(150);
    await page.fill('input[placeholder="例：家賃、光熱費"]', "家賃");
    await page.fill('input[placeholder="例：8月15日"] >> nth=1', "8月1日");
    await page.fill('input[placeholder="金額(任意)"] >> nth=1', "45000");
    await page.click('button:has-text("追加") >> nth=1');
    await page.waitForTimeout(150);
    await page.fill('input[placeholder="例：犬のフード"]', "米");
    await page.fill('input[placeholder="例：8月15日"] >> nth=2', "8月10日");
    await page.click('button:has-text("追加") >> nth=2');
    await page.waitForTimeout(150);
    state = await getState(page);
    assert(state.incomeSchedule.some((i) => i.label === "生活保護費" && i.date === "8月5日" && i.amount === 80000), "入金予定を追加できる");
    assert(state.paymentSchedule.some((i) => i.label === "家賃" && i.date === "8月1日" && i.amount === 45000), "支払い予定を追加できる");
    assert(state.restockSchedule.some((i) => i.label === "米" && i.date === "8月10日" && i.amount === undefined), "必需品の補充予定は金額を持たずに追加できる");

    step("買い物相談：決まって買うものの金額も、固定値ではなく自由に書き換えられる");
    await page.fill('input[type=number] >> nth=4', "9000");
    await page.waitForTimeout(150);
    state = await getState(page);
    assert(state.recurringItems.find((i) => i.name === "食料品")?.amount === 9000, "食料品の金額をその場で書き換えられる（削除して作り直す必要がない）");
    await page.fill('input[type=number] >> nth=4', "6000");
    await page.waitForTimeout(150);

    step("買い物相談：今回追加したいものを入れると、バトラーが決まって買うものを見渡して見立てを返す");
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("執事："), "決めた呼び名でバトラーが語りかけている");
    await page.fill('input[placeholder="例：コーヒー"]', "コーヒー");
    await page.fill('input[placeholder="金額"] >> nth=1', "500");
    await page.click('button:has-text("追加") >> nth=4');
    await page.waitForTimeout(200);
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("安心してお買い物できそうです"), "無理のない金額なら、安心して進めてよいという見立てを返す");

    step("買い物相談：判断は断定せず、求めれば1タップで根拠の数字にたどり着ける（隠すが、消さない）");
    await clickButtonContaining(page, "根拠を見る");
    await page.waitForTimeout(150);
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("決まって買うものの合計"), "根拠となる支出の内訳が確認できる");

    step("買い物相談：決まって買うものを圧迫する金額を追加すると、見立てが慎重な言い方に変わる");
    await page.fill('input[placeholder="例：コーヒー"]', "大きな買い物");
    await page.fill('input[placeholder="金額"] >> nth=1', "50000");
    await page.click('button:has-text("追加") >> nth=4');
    await page.waitForTimeout(200);
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("少し足りなくなるかもしれません"), "無理のある金額には、断定せず見直しを促す言い方で返す");

    step("買い物相談：入力した内容はリロード後も残っている");
    await page.reload();
    await page.waitForTimeout(300);
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("コーヒー") && bodyText.includes("大きな買い物"), "リロード後も追加したい品目が残っている");
    assert(bodyText.includes("生活保護費") && bodyText.includes("家賃") && bodyText.includes("米"), "リロード後も「暮らしの予定」（入金・支払い・必需品補充）が残っている");

    step("買い物相談：決まった選択肢だけでなく、自由に打ち込んで相談できる（MVP_SPEC.md「相談は往復である」）");
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("に自由に相談する"), "自由入力の相談欄がある");
    assert(bodyText.includes("テスト運用中"), "実データを送る前に、テスト運用中であることが画面に常に表示されている");
    await page.fill('input[placeholder="例：桃が半額だから追加したい"]', "桃が半額だったんだけど、どうしよう");
    await clickButtonWithText(page, "送る");
    await page.waitForTimeout(1000);
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("桃が半額だったんだけど"), "打ち込んだ相談内容がその場で表示される");
    // このE2E実行環境にはバックエンド(api/shopping-chat.js)が無いため、
    // 断定せず「答えられなかった」とだけ伝えて落ちる(クラッシュしない)ことを確認する
    assert(bodyText.includes("会話機能が使えないかもしれません"), "バックエンドが無い環境では、断定せず状況を伝えるだけに留める");
    state = await getState(page);
    assert(state.shoppingChatHistory.some((m) => m.role === "user" && m.content.includes("桃が半額")), "打ち込んだ相談内容は履歴として残る");

    step("買い物リスト：相談で決めた内容から、お店で見るためのリストが生成される");
    await page.evaluate(() => {
      localStorage.setItem("filovita-mvp-state", JSON.stringify({
        ...JSON.parse(localStorage.getItem("filovita-mvp-state")),
        screen: "shoppingConsult",
        itemsToAdd: [{ id: "add_peach", name: "桃", price: 500 }],
      }));
    });
    await page.reload();
    await page.waitForTimeout(300);
    await clickButtonContaining(page, "買い物リストを作る");
    await page.waitForTimeout(200);
    state = await getState(page);
    assert(state.screen === "shoppingList", "買い物リスト画面が開く");
    assert(state.shoppingListItems.length === 3, "決まって買うもの＋今回追加したいものがそのままリストになる（食料品・タバコ・桃）");
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("いつもの買い物") && bodyText.includes("今回追加"), "リストは「いつもの買い物」と「今回追加」に分かれている");

    step("買い物リスト：お店で無かったものはチェックを外すだけで見送れる");
    await page.evaluate(() => {
      const row = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("桃"));
      row?.click();
    });
    await page.waitForTimeout(150);
    state = await getState(page);
    assert(state.shoppingListItems.find((i) => i.name === "桃").checked === false, "チェックを外した桃は「見送り」として残る（削除しない）");

    step("買い物リスト：お店でひらめいたものを追加すると、その場で見立てが更新される");
    await page.fill('input[placeholder="例：ぶどう"]', "ぶどう");
    await page.fill('input[placeholder="金額"]', "400");
    await clickButtonWithText(page, "追加");
    await page.waitForTimeout(200);
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("ぶどう"), "追加したぶどうがリストに反映される");
    assert(bodyText.includes("安心してお買い物できそうです"), "桃を見送った分、ぶどうを追加しても見立ては安心できる範囲のまま");
    assert(bodyText.includes("最終見立て"), "「今日の買い物」画面に最終見立ての見出しがある");
    assert(bodyText.includes("テスト運用中の見立て機能"), "実データを送る前に、最終見立て機能もテスト運用中であることが常に表示されている");

    step("買い物リスト：お店でも、相談画面と同じチャットでバトラーに自由に相談できる（暮らし全体で会話は一つに続く）");
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("に自由に相談する"), "買い物リスト画面にも自由相談欄がある");
    assert(bodyText.includes("桃が半額だったんだけど"), "相談画面でのやり取りが、買い物リスト画面でも同じ履歴として続けて表示される");

    step("買い物リスト：マイクで音声認識した内容を、書き換えずそのまま送信できる（InputScreen.jsxと同じSpeechRecognition実装・エラーハンドリング）");
    await page.click('[data-testid="shopping-chat-mic"]');
    await page.waitForTimeout(400);
    let micValue = await page.$eval('[data-testid="shopping-chat-mic"] + input', (el) => el.value);
    assert(micValue.includes("血液検査"), "マイクボタンで音声認識の結果がチャット欄にそのまま反映される（InputScreen.jsxの話すモードと同じonresultの実装）");
    await page.click('[data-testid="shopping-chat-mic"]');
    await page.waitForTimeout(150);
    let capturedMicChatRequest = null;
    await page.route("**/api/shopping-chat", async (route) => {
      capturedMicChatRequest = JSON.parse(route.request().postData());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reply: "その通院についてはカレンダーで確認しておきますね。" }),
      });
    });
    await clickButtonWithText(page, "送る");
    await page.waitForTimeout(300);
    assert(!!capturedMicChatRequest, "マイクで入力した内容を書き換えずに「送る」を押すと、実際にAPIへリクエストが送られる");
    assert(
      capturedMicChatRequest.message.includes("血液検査"),
      `送信された内容が、書き換えていない音声認識結果そのものである（実際: ${capturedMicChatRequest?.message}）`
    );
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("血液検査"), "送信した音声入力の内容がチャット履歴に表示される");
    assert(bodyText.includes("その通院についてはカレンダーで確認しておきますね"), "AIの返答も表示される（音声入力→送信→応答まで実機相当で通ることを確認）");
    await page.unroute("**/api/shopping-chat");

    step("買い物リスト：マイクの権限が無い等で音声認識が失敗したら、静かに元へ戻さず理由を利用者に伝える(2026-07-29の監査で発覚した欠陥の修正確認)");
    await page.evaluate(() => { window.__speechShouldFail = true; window.__speechErrorCode = "not-allowed"; });
    await page.click('[data-testid="shopping-chat-mic"]');
    await page.waitForTimeout(300);
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(
      bodyText.includes("マイクの使用が許可されていません"),
      "権限拒否等でrecognition.onerrorが発火したら、握りつぶさず理由が利用者に見える形で表示される"
    );
    await page.evaluate(() => { window.__speechShouldFail = false; });

    step("買い物リスト：チャットへ実際に打ち込んだ相談は、この画面のコンテキスト（店頭でチェック中の品目）を添えてAPIへ渡る");
    await page.fill('[data-testid="shopping-chat-mic"] + input', "桃はやめてぶどうだけにしようと思う");
    let capturedListChatRequest = null;
    await page.route("**/api/shopping-chat", async (route) => {
      capturedListChatRequest = JSON.parse(route.request().postData());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reply: "ぶどうだけでも十分バランス良さそうです。" }),
      });
    });
    await clickButtonWithText(page, "送る");
    await page.waitForTimeout(300);
    assert(!!capturedListChatRequest, "送信でAPIへリクエストが送られる");
    assert(
      capturedListChatRequest.context.items.some((i) => i.name === "ぶどう"),
      "この画面から相談すると、コンテキストに店頭でチェック中の品目（ぶどう）が含まれる"
    );
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("ぶどうだけでも十分バランス良さそうです"), "AIの返答がチャットに表示される");
    await page.unroute("**/api/shopping-chat");
    state = await getState(page);
    assert(
      state.shoppingChatHistory.some((m) => m.content.includes("桃はやめてぶどうだけに")),
      "買い物リスト画面での相談も、相談画面と同じ会話履歴に保存される（暮らし全体でひとつの会話）"
    );

    step("買い物リスト：最終見立ては固定ルールのgo/remove/skipではなく、暮らしの予定を含む判断コンテキストをAIへ渡して生成する");
    let capturedVerdictRequest = null;
    await page.route("**/api/shopping-final-verdict", async (route) => {
      capturedVerdictRequest = JSON.parse(route.request().postData());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            { name: "食料品", category: "now", reason: "在庫が少なくなってきているので" },
            { name: "タバコ", category: "now", reason: "いつも通り" },
            { name: "ぶどう", category: "later", reason: "今すぐでなくても大丈夫そうなので" },
          ],
          summary: "今日は食料品とタバコだけ買って、ぶどうは来週でも良さそうです。",
          focus: "明日の生活費確保",
        }),
      });
    });
    await clickButtonContaining(page, "最終見立てを聞く");
    await page.waitForTimeout(300);
    assert(!!capturedVerdictRequest, "最終見立てボタンでAPIへリクエストが送られる");
    assert(
      capturedVerdictRequest.context.incomeSchedule.some((i) => i.label === "生活保護費"),
      "リクエストのコンテキストに入金予定が含まれている（固定ルールでなく判断材料として渡す）"
    );
    assert(
      capturedVerdictRequest.context.paymentSchedule.some((i) => i.label === "家賃"),
      "リクエストのコンテキストに支払い予定が含まれている"
    );
    assert(capturedVerdictRequest.context.nextShoppingDate, "リクエストのコンテキストに次の買い物日が含まれている");
    assert(Array.isArray(capturedVerdictRequest.history), "リクエストにこれまでの相談の会話履歴も含まれている");
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("今買う") && bodyText.includes("来週でよい"), "AIの判断が品目ごとにカテゴリ分けして表示される（固定のgo/remove/skipではない）");
    assert(bodyText.includes("今日は食料品とタバコだけ買って"), "全体を通した結論（AIが生成したsummary）も表示される");
    assert(bodyText.includes("重視したこと：明日の生活費確保"), "その判断で何を重視したか(focus)も表示される");
    await page.unroute("**/api/shopping-final-verdict");

    step("買い物リスト：最終見立ての根拠（渡したコンテキストと判断内容）が履歴として記録される");
    state = await getState(page);
    assert(Array.isArray(state.verdictHistory) && state.verdictHistory.length === 1, "最終見立てを聞くたびに履歴が1件記録される");
    const recordedVerdict = state.verdictHistory[0];
    assert(recordedVerdict.summary === "今日は食料品とタバコだけ買って、ぶどうは来週でも良さそうです。", "履歴にAIの結論(summary)が記録される");
    assert(recordedVerdict.focus === "明日の生活費確保", "履歴に重視したこと(focus)も記録される");
    assert(
      recordedVerdict.context.incomeSchedule.some((i) => i.label === "生活保護費"),
      "履歴には、その時点で実際にAIへ渡した根拠（入金予定等）のスナップショットも残る——あとから「なぜそう言ったか」を説明できるように"
    );
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("過去の見立て"), "「今日の買い物」画面に過去の見立ての履歴欄がある");

    step("買い物リスト：同じ状況で聞き直しても、AIに再度問い合わせず前回の見立てをそのまま見せる（コロコロ変わらない）");
    await clickButtonContaining(page, "最終見立てを聞く");
    await page.waitForTimeout(300);
    state = await getState(page);
    assert(state.verdictHistory?.length === 1, "状況が変わっていなければ聞き直しても履歴が増えない（AIへ再問い合わせしていない）");

    step("買い物リスト：バックエンドが無い環境では、最終見立ても断定せず状況を伝えるだけに留める（状況が変わって初めて聞き直す）");
    // 状況を変えて初めて「聞き直す」対象になる。ここでバックエンドが
    // 無ければ、キャッシュされた前回の答えを使い回さず、正直に状況を伝える
    await page.fill('input[placeholder="例：ぶどう"]', "レモン");
    await page.fill('input[placeholder="金額"]', "200");
    await clickButtonWithText(page, "追加");
    await page.waitForTimeout(150);
    await clickButtonContaining(page, "最終見立てを聞く");
    await page.waitForTimeout(500);
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("聞けませんでした"), "バックエンドが無い環境では、固定ルールで代用せず正直に状況を伝える");

    step("買い物リスト：チェックの状態も、追加した品目も、リロード後に残っている");
    await page.reload();
    await page.waitForTimeout(300);
    state = await getState(page);
    const peach = state.shoppingListItems.find((i) => i.name === "桃");
    const grape = state.shoppingListItems.find((i) => i.name === "ぶどう");
    assert(peach && peach.checked === false, "リロード後も桃のチェックは外れたまま");
    assert(grape && grape.checked === true, "リロード後もひらめいて追加したぶどうが残っている");
    assert(state.verdictHistory?.length === 1, "リロード後も最終見立ての履歴（根拠のスナップショット）が残っている");

    step("入力：話した/書いた内容は、固定の仮生成ではなく実際にAIが下書き（結論・ToDo）を作る");
    await page.evaluate(() => {
      localStorage.setItem("filovita-mvp-state", JSON.stringify({
        ...JSON.parse(localStorage.getItem("filovita-mvp-state")),
        screen: "input",
      }));
    });
    await page.reload();
    await page.waitForTimeout(300);
    await clickButtonContaining(page, "書く"); // inputModeが依然speakのままなので、書くモードへ切り替える
    let capturedDraftRequest = null;
    await page.route("**/api/generate-draft", async (route) => {
      capturedDraftRequest = JSON.parse(route.request().postData());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          conclusion: "訪問看護師さんが来て、血圧を測ってもらった。",
          todos: ["来週までに薬を薬局で受け取る"],
        }),
      });
    });
    await page.fill(
      'textarea[placeholder="話した内容、決まったことをそのまま書いてください"]',
      "えーっと、今日は訪問看護師さんが来て、あの、血圧を測ってもらって、それで来週までに薬を薬局で受け取らないといけないんだった"
    );
    await clickButtonWithText(page, "次へ");
    await page.waitForTimeout(300);
    assert(!!capturedDraftRequest, "入力内容が/api/generate-draftへ実際に送られる");
    assert(capturedDraftRequest.text.includes("訪問看護師"), "送られるテキストは入力そのまま（AIが受け取る前に加工しない）");
    state = await getState(page);
    assert(state.screen === "confirm", "AIの下書き生成後、確認画面に遷移する");
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("血圧を測ってもらった"), "確認画面には、生の入力ではなくAIが整理した結論が表示される（言い淀みが整理されている）");
    let todoInputValues = await page.$$eval("[data-testid=confirm-todos] input[type=text]", (els) => els.map((el) => el.value));
    assert(todoInputValues.some((v) => v.includes("薬局")), "AIが抜き出したToDoが確認画面に表示される");

    step("入力：AIが抜き出したToDoも、結論と同じく確認画面で修正・追加できる（バトラーが勝手に予定を決めない）");
    await page.fill('input[type=text] >> nth=0', "来月10日までに必ず薬を受け取る");
    await page.fill('input[type=text] >> nth=1', "次回の訪問日をカレンダーに書く");
    await clickButtonWithText(page, "追加");
    await page.waitForTimeout(150);
    todoInputValues = await page.$$eval("[data-testid=confirm-todos] input[type=text]", (els) => els.map((el) => el.value));
    assert(todoInputValues.includes("次回の訪問日をカレンダーに書く"), "追加したToDoがその場でリストに反映される");
    await clickButtonWithText(page, "この内容で確定する");
    await page.waitForTimeout(200);
    await clickButtonWithText(page, "カレンダーへ戻る");
    await page.waitForTimeout(300);
    state = await getState(page);
    const draftedEvent = state.events.find((e) => e.conclusion.includes("血圧を測ってもらった"));
    assert(!!draftedEvent, "AIが整理した結論でEventが作成される");
    assert(draftedEvent.todos.length === 2, `確認画面で編集・追加した内容がそのままEventに反映される（実際: ${draftedEvent.todos.length}件）`);
    assert(
      draftedEvent.todos.some((t) => t.text === "来月10日までに必ず薬を受け取る"),
      "確認画面で修正したToDoの文言が使われる"
    );
    assert(
      draftedEvent.todos.some((t) => t.text === "次回の訪問日をカレンダーに書く"),
      "確認画面で追加したToDoも反映される"
    );
    assert(
      !draftedEvent.todos.some((t) => t.text === "来週までに薬を薬局で受け取る"),
      "AIが最初に提案したToDoの文言そのままでは保存されない（利用者の修正が優先され、確認をすり抜けない）"
    );
    await page.unroute("**/api/generate-draft");

    step("入力：バックエンドが無い環境では、AIによる整理をせず入力をそのまま結論にする（断定的な代替を作らない）");
    await page.evaluate(() => {
      localStorage.setItem("filovita-mvp-state", JSON.stringify({
        ...JSON.parse(localStorage.getItem("filovita-mvp-state")),
        screen: "input",
      }));
    });
    await page.reload();
    await page.waitForTimeout(300);
    await clickButtonContaining(page, "書く");
    await page.fill(
      'textarea[placeholder="話した内容、決まったことをそのまま書いてください"]',
      "今日はゴミ出しをした"
    );
    await clickButtonWithText(page, "次へ");
    await page.waitForTimeout(300);
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("今日はゴミ出しをした"), "AIが使えない環境では、入力をそのまま結論として使う（生成せず正直に留める）");

    step("生活資料ライブラリ：写真を撮る/選ぶと、AIが資料の種類を判定してEventの下書きを作る");
    await page.evaluate(() => {
      localStorage.setItem("filovita-mvp-state", JSON.stringify({
        ...JSON.parse(localStorage.getItem("filovita-mvp-state")),
        screen: "input",
      }));
    });
    await page.reload();
    await page.waitForTimeout(300);
    await clickButtonContaining(page, "資料");
    await page.setInputFiles("#input-photo-file", {
      name: "receipt.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("fake-receipt-photo-bytes"),
    });
    await page.waitForTimeout(200);
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("この資料を読み取る"), "写真を選ぶと「読み取る」ボタンが現れる");

    let capturedDocRequest = null;
    await page.route("**/api/read-document", async (route) => {
      capturedDocRequest = JSON.parse(route.request().postData());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          docType: "receipt",
          docTypeLabel: "🧾 レシート",
          conclusion: "スーパーで食料品と日用品を購入した（合計1,280円）",
          todos: ["レシートを家計簿に転記する"],
        }),
      });
    });
    await clickButtonWithText(page, "この資料を読み取る");
    await page.waitForTimeout(300);
    assert(!!capturedDocRequest, "写真データが/api/read-documentへ実際に送られる");
    assert(capturedDocRequest.image.length > 0, "送信されるのは実際の画像データ(base64)である");
    state = await getState(page);
    assert(state.screen === "confirm", "資料を読み取った後、確認画面に遷移する");
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("食料品と日用品を購入した"), "AIが読み取った内容が確認画面の結論に反映される");
    assert(bodyText.includes("🧾 レシート として記録します"), "資料の種類が確認画面に明示される（タグとして付くことが事前に分かる）");
    let todoValues = await page.$$eval("[data-testid=confirm-todos] input[type=text]", (els) => els.map((el) => el.value));
    assert(todoValues.some((v) => v.includes("家計簿")), "資料から読み取った今後の行動もToDoとして提示される");
    await clickButtonWithText(page, "この内容で確定する");
    await page.waitForTimeout(200);
    await clickButtonWithText(page, "カレンダーへ戻る");
    await page.waitForTimeout(300);
    state = await getState(page);
    const receiptEvent = state.events.find((e) => e.conclusion.includes("食料品と日用品を購入した"));
    assert(!!receiptEvent, "資料の内容でEventが作成される");
    assert(receiptEvent.tags.includes("🧾 レシート"), "資料の種類がタグとして自動で付く（生活資料ライブラリ：必要ならタグを付ける）");
    await page.unroute("**/api/read-document");

    step("生活資料ライブラリ：写真は「入力にない事実」を作れないため、読み取れない場合は断定的な代替を作らず正直に伝える");
    await page.evaluate(() => {
      localStorage.setItem("filovita-mvp-state", JSON.stringify({
        ...JSON.parse(localStorage.getItem("filovita-mvp-state")),
        screen: "input",
      }));
    });
    await page.reload();
    await page.waitForTimeout(300);
    await clickButtonContaining(page, "資料");
    await page.setInputFiles("#input-photo-file", {
      name: "blurry.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("fake-unreadable-photo-bytes"),
    });
    await page.waitForTimeout(200);
    await clickButtonWithText(page, "この資料を読み取る");
    await page.waitForTimeout(500);
    bodyText = await page.evaluate(() => document.body.textContent);
    assert(bodyText.includes("読み取れませんでした"), "バックエンドが無い/読み取れない環境では、断定的な代替を作らず正直にエラーを伝える");
    state = await getState(page);
    assert(state.screen === "input", "読み取りに失敗した場合は入力画面に留まる（確認画面へは進まない）");

    console.log(`\n=== 完了: ${stepCount}ステップ中、失敗 ${failed}件 ===`);
  } finally {
    await browser.close();
    // vite.kill()だけだとesbuildの子プロセスが残ってnodeが終了しないことがあるため、
    // プロセスグループごと終了させる
    try { process.kill(-vite.pid, "SIGKILL"); } catch { vite.kill("SIGKILL"); }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\n=== E2Eテスト失敗 ===");
  console.error(err);
  process.exit(1);
});
