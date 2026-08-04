/* 手帳だけの道具：チェックボックス。手帳といえばこれ、という手触りを目指す。
   完了時はボールペンで引いたような、少し歪んだチェックの手描き風にする。 */
export default function PlannerCheck({ done, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 21, height: 21, borderRadius: 4, flexShrink: 0,
        border: `2px solid ${done ? "#3F5C42" : "#A8A08A"}`,
        background: done ? "#fff" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
      }}
    >
      {done && (
        <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
          <path
            d="M1.5 6.2 L5.3 10 L12.5 1.5"
            stroke="#3F5C42" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
