import { useRef, useState } from "react";
import SteelPanel from "../theme/industrial/SteelPanel.jsx";
import OrnateFrame from "../theme/gothic/OrnateFrame.jsx";
import BarkPanel from "../theme/forest/BarkPanel.jsx";
import { isAudioRecordingSupported, startRecording, blobToBase64, describeRecordingError } from "../lib/audioRecording.js";
import { transcribeVoice } from "../lib/transcribeVoice.js";
import { loadState } from "../lib/persistence.js";

// GitHub Pagesは静的ホスティングのみのため、この本体アプリと同じオリジンには
// api/shopping-chat.jsは存在しない。別途Vercelにデプロイしたバックエンドの
// 絶対URLに差し替える運用（詳細はMVP_SPEC.md「相談は往復である」参照）。
// 同一オリジンにAPIも同居させる場合は "/api/shopping-chat" のままでよい。
const SHOPPING_CHAT_API_URL = "/api/shopping-chat";

/* 自由入力の相談窓口。決まった選択肢の判定ではなく、実際にAIへ渡して
   考えて返す(api/shopping-chat.js)。MVP_SPEC.md「相談は往復である：
   診断ではなく会話」の実装——バックエンドが無い環境（GitHub Pages等）
   では失敗するので、その場合は断定せず状況を伝えるだけに留める。
   相談画面（暮らしの予定を組み立てる場）と買い物リスト画面（店頭）の
   両方から使う共通部品。音声入力はテキスト欄を埋めるだけに留め、
   送信は必ず利用者が「送る」を押してから——AIに渡す前に必ず読み返せる。
   他の画面（CalendarScreen.jsxの続き表示、EventDetailScreen.jsxのタグ等）
   と同じ規約で、componentThemeごとに専用の枠（森=BarkPanel、ホラー=
   OrnateFrame、cyberpunk=SteelPanel）へ差し替える。手帳・絵本・SF・旅は
   他画面と同様、専用部品を持たないため汎用の枠のままにする。 */
export default function ShoppingChat({ theme, speaker, chatHistory, onAppendChatMessage, context }) {
  const { tokens } = theme;
  const isIndustrial = theme.componentTheme === "industrial";
  const isGothic = theme.componentTheme === "gothic";
  const isForest = theme.componentTheme === "forest";
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const recorderRef = useRef(null);

  // ブラウザ内蔵の音声認識（SpeechRecognition）ではなく、録音してサーバー側で
  // 文字起こしする方式（2026-07-30切り替え、InputScreen.jsxと同じ実装。
  // audioRecording.js参照——iOS Safariの音声認識実装が信頼できないと
  // 実機検証で判明したため）。
  async function handleStartRecording() {
    if (!isAudioRecordingSupported) return;
    setVoiceError(null);
    try {
      const { recorder, stopped } = await startRecording();
      recorderRef.current = recorder;
      setRecording(true);
      const blob = await stopped;
      setTranscribing(true);
      const base64 = await blobToBase64(blob);
      const result = await transcribeVoice({ base64, mimeType: blob.type });
      setTranscribing(false);
      if (result.error) {
        setVoiceError(result.error);
        return;
      }
      setDraft((prev) => (prev.trim() ? `${prev} ${result.transcript}` : result.transcript));
    } catch (err) {
      setRecording(false);
      setVoiceError(describeRecordingError(err));
    }
  }

  function handleStopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setError(null);
    onAppendChatMessage("user", text);
    setSending(true);
    // 画面には最新の残額(6,422円)が正しく表示・保存されているのに、
    // チャットへ送られる`context`には古い値(2,153円)が残っていた実例が
    // 2026-08-01に発覚した。原因（別タブ・端末側のキャッシュ等）を
    // 問わず、送信の瞬間に必ず本当の最新値を見るよう、propsの`context`を
    // 信用せず送信直前にlocalStorageから直接読み直す。台帳（家計に
    // 関わる項目）だけを上書きし、店頭の品目チェック状態などこの画面
    // 固有のものはpropsのままにする。
    const latest = loadState() || {};
    const freshContext = {
      ...context,
      budget: latest.shoppingBudget ?? context.budget,
      balance: latest.shoppingBalance ?? context.balance,
      nextShoppingDate: latest.nextShoppingDate ?? context.nextShoppingDate,
      cwPlanNote: latest.cwPlanNote ?? context.cwPlanNote,
      incomeSchedule: latest.incomeSchedule ?? context.incomeSchedule,
      paymentSchedule: latest.paymentSchedule ?? context.paymentSchedule,
      restockSchedule: latest.restockSchedule ?? context.restockSchedule,
    };
    try {
      const response = await fetch(SHOPPING_CHAT_API_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, history: chatHistory, context: freshContext }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.reply) {
        // サーバーから具体的な理由が返ってきていれば、それをそのまま伝える
        // （例：レート制限なら「少し待てば直る」と分かる文言）。断定せず、
        // 起きたことをそのまま伝えるのがFilovitaの方針。
        setError(data?.error || "今は相談に答えられませんでした。この環境ではまだ会話機能が使えないかもしれません。");
        return;
      }
      onAppendChatMessage("assistant", data.reply);
    } catch {
      // fetch自体が失敗＝バックエンドに届いていない（ローカル開発環境やGitHub Pagesなど）
      setError("今は相談に答えられませんでした。この環境ではまだ会話機能が使えないかもしれません。");
    } finally {
      setSending(false);
    }
  }

  const chatBody = (
    <>
      {/* MVP_SPEC.md「相談は往復である」：開発・テスト中は無料枠のAIを使うため、
          実データを送る前に必ず分かるよう常時表示する。本番運用に切り替えたら外す。 */}
      <div
        style={{
          fontSize: 11, color: tokens.inkFaint, background: tokens.card,
          border: `1px dashed ${tokens.line}`, borderRadius: 8, padding: "6px 10px", marginBottom: 10,
        }}
        data-testid="shopping-chat-test-notice"
      >
        🧪 現在はテスト運用中の会話機能です
      </div>
      {chatHistory.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {chatHistory.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%",
                padding: "8px 12px", borderRadius: 12, fontSize: 13, lineHeight: 1.6,
                background: m.role === "user" ? tokens.ink : (tokens.accentBg || tokens.card),
                color: m.role === "user" ? tokens.paper : tokens.ink,
                border: m.role === "user" ? "none" : `1px solid ${tokens.line}`,
              }}
              data-testid={`shopping-chat-${m.role}`}
            >
              {m.role === "assistant" ? `${speaker}：${m.content}` : m.content}
            </div>
          ))}
        </div>
      )}
      {sending && <p style={{ fontSize: 12, color: tokens.inkFaint, marginBottom: 8 }}>{speaker}が考えています…</p>}
      {error && <p style={{ fontSize: 12, color: "#a3432a", marginBottom: 8 }} data-testid="shopping-chat-error">{error}</p>}
      {voiceError && <p style={{ fontSize: 12, color: "#a3432a", marginBottom: 8 }} data-testid="shopping-chat-voice-error">{voiceError}</p>}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={() => (recording ? handleStopRecording() : handleStartRecording())}
          disabled={!isAudioRecordingSupported || transcribing}
          title={isAudioRecordingSupported ? "音声入力" : "この端末では音声入力に対応していません"}
          data-testid="shopping-chat-mic"
          style={{
            width: 38, height: 38, flexShrink: 0, borderRadius: 9, border: `1px solid ${tokens.line}`,
            background: recording ? tokens.accent : "transparent", color: recording ? tokens.paper : tokens.inkSoft,
            fontSize: 16, cursor: isAudioRecordingSupported && !transcribing ? "pointer" : "default",
            opacity: isAudioRecordingSupported ? (transcribing ? 0.6 : 1) : 0.4,
          }}
        >
          🎤
        </button>
        <input
          type="text" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder={transcribing ? "バトラーが聞き取っています…" : recording ? "録音しています…" : "例：桃が半額だから追加したい"}
          style={{ flex: 1, padding: "9px 11px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
        />
        <button
          onClick={send} disabled={sending}
          style={{ padding: "9px 16px", fontSize: 12.5, borderRadius: 9, border: "none", background: tokens.ink, color: tokens.paper, cursor: "pointer", opacity: sending ? 0.6 : 1 }}
        >
          送る
        </button>
      </div>
    </>
  );

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", color: tokens.inkFaint, marginBottom: 10 }}>
        {speaker}に自由に相談する
      </div>
      {isIndustrial ? (
        <SteelPanel>{chatBody}</SteelPanel>
      ) : isGothic ? (
        <OrnateFrame>{chatBody}</OrnateFrame>
      ) : isForest ? (
        <BarkPanel>{chatBody}</BarkPanel>
      ) : (
        chatBody
      )}
    </div>
  );
}
