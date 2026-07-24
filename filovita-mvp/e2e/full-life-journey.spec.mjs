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
    await page.addInitScript(() => {
      class FakeSpeechRecognition {
        start() {
          setTimeout(() => {
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
        tagRegistry: {}, tagToolboxes: {}, activeTagName: null,
      }));
    });
    await page.reload();
    await page.waitForTimeout(300);

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
    const bodyText = await page.evaluate(() => document.body.textContent);
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
