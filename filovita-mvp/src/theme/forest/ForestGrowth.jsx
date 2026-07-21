function svgUrl(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const SCENE_HEIGHT = 260;
const GROUND_Y = 260;

const GROUND_FADE =
  "<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>" +
  "<stop offset='0' stop-color='#DCE6D0' stop-opacity='0'/>" +
  "<stop offset='1' stop-color='#AFC29B' stop-opacity='0.65'/>" +
  "</linearGradient></defs>" +
  `<rect x='0' y='${GROUND_Y - 150}' width='420' height='150' fill='url(#g)'/>`;

function trees(list) {
  return list
    .map(
      (t) =>
        `<rect x='${t.x - 5}' y='${GROUND_Y - t.trunkH}' width='10' height='${t.trunkH}' fill='#2F6B3A' fill-opacity='${t.opacity}'/>` +
        `<circle cx='${t.x}' cy='${GROUND_Y - t.trunkH - t.canopyR * 0.7}' r='${t.canopyR}' fill='#2F6B3A' fill-opacity='${t.opacity}'/>`
    )
    .join("");
}

/* 森テーマの背景は、月の日付とともに育つ小さな物語。
   1〜2日：芽 / 3〜9日：木が2本 / 10〜19日：小道 / 20〜29日：花 / 30〜31日：小さな森の完成
   下の余白を森そのものが占めるよう、シーンの背丈を大きく取る。 */
function buildForestScene(stage) {
  let content = GROUND_FADE;

  if (stage === 0) {
    content +=
      `<line x1='210' y1='${GROUND_Y}' x2='210' y2='${GROUND_Y - 48}' stroke='#2F6B3A' stroke-opacity='0.3' stroke-width='5'/>` +
      `<path d='M210 ${GROUND_Y - 48} Q186 ${GROUND_Y - 66} 178 ${GROUND_Y - 50} Q196 ${GROUND_Y - 36} 210 ${GROUND_Y - 48} Z' fill='#2F6B3A' fill-opacity='0.28'/>` +
      `<path d='M210 ${GROUND_Y - 48} Q234 ${GROUND_Y - 66} 242 ${GROUND_Y - 50} Q224 ${GROUND_Y - 36} 210 ${GROUND_Y - 48} Z' fill='#2F6B3A' fill-opacity='0.28'/>`;
    return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 420 ${SCENE_HEIGHT}' preserveAspectRatio='xMidYMax slice'>${content}</svg>`);
  }

  const baseTrees = [
    { x: 110, trunkH: 80, canopyR: 45, opacity: 0.22 },
    { x: 300, trunkH: 66, canopyR: 35, opacity: 0.2 },
  ];
  const extraTrees =
    stage >= 4
      ? [
          { x: 50, trunkH: 52, canopyR: 28, opacity: 0.16 },
          { x: 360, trunkH: 59, canopyR: 31, opacity: 0.18 },
          { x: 210, trunkH: 88, canopyR: 48, opacity: 0.2 },
        ]
      : [];
  content += trees([...baseTrees, ...extraTrees]);

  if (stage >= 2) {
    content += `<path d='M0 ${GROUND_Y - 12} Q100 ${GROUND_Y - 32} 210 ${GROUND_Y - 18} Q320 ${GROUND_Y - 2} 420 ${GROUND_Y - 22}' stroke='#C9AE7D' stroke-opacity='0.28' stroke-width='15' fill='none' stroke-linecap='round'/>`;
  }
  if (stage >= 3) {
    content += [
      `<circle cx='150' cy='${GROUND_Y - 15}' r='5' fill='#E8837A' fill-opacity='0.3'/>`,
      `<circle cx='250' cy='${GROUND_Y - 8}' r='4.3' fill='#E8837A' fill-opacity='0.28'/>`,
      `<circle cx='190' cy='${GROUND_Y - 22}' r='3.4' fill='#E8837A' fill-opacity='0.26'/>`,
      `<circle cx='330' cy='${GROUND_Y - 10}' r='4.3' fill='#E8837A' fill-opacity='0.24'/>`,
    ].join("");
  }
  if (stage >= 4) {
    content += "<circle cx='55' cy='52' r='70' fill='#F2E7B8' fill-opacity='0.15'/>";
  }

  return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 420 ${SCENE_HEIGHT}' preserveAspectRatio='xMidYMax slice'>${content}</svg>`);
}

const FALLING_LEAVES = [
  { left: "16%", delay: "0s", size: 12, duration: "1.5s", rotate: "120deg" },
  { left: "48%", delay: "0.12s", size: 9, duration: "1.3s", rotate: "-100deg" },
  { left: "74%", delay: "0.26s", size: 11, duration: "1.7s", rotate: "150deg" },
];

/* コンポーネントテーマ専用部品：森の生育。中身の情報構造・操作順序には一切手を加えない。
   画面が切り替わる瞬間、葉が舞い落ちる——「森を移動している」という手応えのための演出。 */
export default function ForestGrowth({ stage, screen, children }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", minHeight: "100vh" }}>
      <style>{`
        @keyframes canopySway {
          0%, 100% { opacity: 0.85; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(4px); }
        }
        @keyframes leafEnter {
          0% { opacity: 0; transform: translateY(10px); filter: brightness(1.1); }
          55% { opacity: 1; }
          100% { opacity: 1; transform: translateY(0); filter: brightness(1); }
        }
        @keyframes leafFall {
          0% { opacity: 0; transform: translateY(-16px) rotate(0deg); }
          12% { opacity: 0.7; }
          100% { opacity: 0; transform: translateY(180px) rotate(var(--leaf-rotate)); }
        }
      `}</style>
      <div key={screen} style={{ animation: "leafEnter 0.45s ease-out" }}>
        {children}
      </div>
      {screen &&
        FALLING_LEAVES.map((leaf, i) => (
          <span
            key={`${screen}-${i}`}
            style={{
              position: "absolute",
              top: 0,
              left: leaf.left,
              width: leaf.size,
              height: leaf.size * 1.3,
              background: "#2F6B3A",
              opacity: 0.5,
              borderRadius: "0% 100% 0% 100%",
              pointerEvents: "none",
              "--leaf-rotate": leaf.rotate,
              animation: `leafFall ${leaf.duration} ease-in ${leaf.delay} 1`,
            }}
          />
        ))}
      {/* 木漏れ日：画面全体にかかる、揺れるやわらかな光。カレンダーそのものを森の中で見上げているように */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 190px 130px at 15% 18%, rgba(255,250,210,0.18), transparent 60%)," +
            "radial-gradient(ellipse 150px 100px at 78% 12%, rgba(255,250,210,0.14), transparent 60%)," +
            "radial-gradient(ellipse 210px 150px at 50% 55%, rgba(255,250,210,0.10), transparent 65%)," +
            "radial-gradient(ellipse 170px 120px at 88% 70%, rgba(255,250,210,0.15), transparent 60%)",
          animation: "canopySway 6s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          boxShadow: "inset 0 0 100px rgba(47,107,58,0.16)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: SCENE_HEIGHT,
          pointerEvents: "none",
          backgroundImage: buildForestScene(stage),
          backgroundRepeat: "no-repeat",
          backgroundPosition: "bottom center",
          backgroundSize: "100% 100%",
        }}
      />
    </div>
  );
}
