/* コンポーネントテーマ専用部品：CRT画面。走査線と発光を重ねるが、
   中身の情報構造・操作順序には一切手を加えない（見た目だけの重ね掛け）。 */
export default function CRTScreen({ children }) {
  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes crtFlicker {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 1; }
        }
      `}</style>
      {children}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 2px, transparent 3px)",
          mixBlendMode: "multiply",
          animation: "crtFlicker 2.6s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          boxShadow: "inset 0 0 90px rgba(0,0,0,0.65), inset 0 0 24px rgba(57,255,106,0.14)",
        }}
      />
    </div>
  );
}
