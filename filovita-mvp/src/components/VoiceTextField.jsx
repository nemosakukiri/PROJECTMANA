import { useRef, useState } from "react";
import { isAudioRecordingSupported, startRecording, blobToBase64, describeRecordingError } from "../lib/audioRecording.js";
import { transcribeVoice } from "../lib/transcribeVoice.js";

/* 一問一答の聞き取り画面（OnboardingInterviewScreen）向けの、1行分の
   短い答えを書く/話すどちらでも入力できる部品。InputScreen.jsx にある
   録音→サーバー文字起こしの仕組み（audioRecording.js/transcribeVoice.js）
   と同じ方式を、1行入力用に小さくまとめたもの。
   聞き取った内容はそのままvalueに入るだけで、確定はしない——利用者が
   読み返して「次へ」を押すまでは、この場の下書きに過ぎない。 */
export default function VoiceTextField({ theme, value, onChange, placeholder, testId }) {
  const { tokens } = theme;
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const recorderRef = useRef(null);

  async function handleMic() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
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
      onChange(value.trim() ? `${value} ${result.transcript}` : result.transcript);
    } catch (err) {
      setRecording(false);
      setVoiceError(describeRecordingError(err));
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          data-testid={testId}
          style={{
            flex: 1, padding: "10px 12px", fontSize: 14, borderRadius: 10,
            border: `1px solid ${tokens.line}`, fontFamily: "inherit", boxSizing: "border-box",
          }}
        />
        {isAudioRecordingSupported && (
          <button
            type="button"
            onClick={handleMic}
            disabled={transcribing}
            data-testid={testId ? `${testId}-mic` : undefined}
            style={{
              flexShrink: 0, width: 38, height: 38, borderRadius: "50%", border: "none",
              background: recording ? tokens.accent : tokens.ink, color: tokens.paper, fontSize: 15,
              cursor: transcribing ? "default" : "pointer", opacity: transcribing ? 0.6 : 1,
            }}
          >
            🎤
          </button>
        )}
      </div>
      {transcribing && <p style={{ fontSize: 11.5, color: tokens.inkFaint, margin: "4px 0 0" }}>聞き取っています…</p>}
      {voiceError && <p style={{ fontSize: 11.5, color: "#a3432a", margin: "4px 0 0" }}>{voiceError}</p>}
    </div>
  );
}
