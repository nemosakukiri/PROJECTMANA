/* 画面ごとの「❔ この画面の説明」。全部読み返す必要はなく、困った場所だけ見られる */
export default function GuideHelpButton({ theme, label = "この画面の説明", onClick }) {
  const { tokens } = theme;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
        color: tokens.inkFaint, fontSize: label ? 11.5 : 16, cursor: "pointer", padding: 4,
      }}
    >
      ❔{label && ` ${label}`}
    </button>
  );
}
