import { useRef, useState } from "react";
import SteelPanel from "../theme/industrial/SteelPanel.jsx";
import OrnateFrame from "../theme/gothic/OrnateFrame.jsx";
import BarkPanel from "../theme/forest/BarkPanel.jsx";

// GitHub Pagesは静的ホスティングのみのため、この本体アプリと同じオリジンには
// api/shopping-chat.jsは存在しない。別途Vercelにデプロイしたバックエンドの
// 絶対URLに差し替える運用（詳細はMVP_SPEC.md「相談は往復である」参照）。
// 同一オリジンにAPIも同居させる場合は "/api/shopping-chat" のままでよい。
const SHOPPING_CHAT_API_URL = "/api/shopping-chat";

const SpeechRecognitionApi =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

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
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  function startListening() {
    if (!SpeechRecognitionApi) return;
    const recognition = new SpeechRecognitionApi();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (e) => {
      let combined = "";
      for (let i = 0; i < e.results.length; i++) combined += e.results[i][0].transcript;
      setDraft(combined);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setError(null);
    onAppendChatMessage("user", text);
    setSending(true);
    try {
      const response = await fetch(SHOPPING_CHAT_API_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, history: chatHistory, context }),
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
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={() => (listening ? stopListening() : startListening())}
          disabled={!SpeechRecognitionApi}
          title={SpeechRecognitionApi ? "音声入力" : "このブラウザは音声入力に対応していません"}
          data-testid="shopping-chat-mic"
          style={{
            width: 38, height: 38, flexShrink: 0, borderRadius: 9, border: `1px solid ${tokens.line}`,
            background: listening ? tokens.accent : "transparent", color: listening ? tokens.paper : tokens.inkSoft,
            fontSize: 16, cursor: SpeechRecognitionApi ? "pointer" : "default", opacity: SpeechRecognitionApi ? 1 : 0.4,
          }}
        >
          🎤
        </button>
        <input
          type="text" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder={listening ? "聞いています…" : "例：桃が半額だから追加したい"}
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
