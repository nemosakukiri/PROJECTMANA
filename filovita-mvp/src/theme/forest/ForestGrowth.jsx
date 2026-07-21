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

const JULY_HAZE_OPACITY = [0.22, 0.16, 0.08, 0.03, 0];

/* 森テーマの背景は、月の日付とともに育つ小さな物語。
   1〜2日：芽 / 3〜9日：木が2本 / 10〜19日：小道 / 20〜29日：花 / 30〜31日：小さな森の完成
   下の余白を森そのものが占めるよう、シーンの背丈を大きく取る。
   month/rareDiscoveryは「毎月同じ森」「毎日何かが起きる森」にしないための軸。
   7月固有の物語（梅雨が引いていく湿り気、水辺の気配）と、
   希少に起きる出来事（倒木）を、育ち方の軸とは別に重ねる。 */
function buildForestScene(stage, { month, rareDiscovery } = {}) {
  let content = GROUND_FADE;

  if (month === 7 && stage <= 3) {
    const hazeY = 0;
    content += `<rect x='0' y='${hazeY}' width='420' height='150' fill='#8FA6AC' fill-opacity='${JULY_HAZE_OPACITY[stage] ?? 0}'/>`;
  }

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

  if (month === 7 && stage >= 3) {
    content +=
      `<path d='M380 ${GROUND_Y} L378 ${GROUND_Y - 26}' stroke='#5C8A5A' stroke-opacity='0.35' stroke-width='2.5' stroke-linecap='round'/>` +
      `<path d='M390 ${GROUND_Y} L389 ${GROUND_Y - 22}' stroke='#5C8A5A' stroke-opacity='0.32' stroke-width='2.5' stroke-linecap='round'/>` +
      `<path d='M400 ${GROUND_Y} L403 ${GROUND_Y - 30}' stroke='#5C8A5A' stroke-opacity='0.35' stroke-width='2.5' stroke-linecap='round'/>` +
      `<ellipse cx='366' cy='${GROUND_Y - 34}' rx='6' ry='2.5' fill='#3E6E7A' fill-opacity='0.4' transform='rotate(-18 366 ${GROUND_Y - 34})'/>` +
      `<ellipse cx='372' cy='${GROUND_Y - 34}' rx='6' ry='2.5' fill='#3E6E7A' fill-opacity='0.4' transform='rotate(18 372 ${GROUND_Y - 34})'/>`;
  }

  /* 希少に起きる出来事：倒木。毎回あるわけではない——あった日は少し立ち止まる程度でいい。 */
  if (rareDiscovery && stage >= 2) {
    content +=
      `<rect x='190' y='${GROUND_Y - 26}' width='58' height='9' rx='4.5' fill='#6B4B32' fill-opacity='0.4' transform='rotate(-6 219 ${GROUND_Y - 22})'/>` +
      `<ellipse cx='236' cy='${GROUND_Y - 6}' rx='3.5' ry='4.5' fill='#B65D4A' fill-opacity='0.32'/>` +
      `<ellipse cx='242' cy='${GROUND_Y - 4}' rx='2.8' ry='3.6' fill='#B65D4A' fill-opacity='0.3'/>`;
  }

  return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 420 ${SCENE_HEIGHT}' preserveAspectRatio='xMidYMax slice'>${content}</svg>`);
}

const FALLING_LEAVES = [
  { left: "16%", delay: "0s", size: 12, duration: "1.5s", rotate: "120deg" },
  { left: "48%", delay: "0.12s", size: 9, duration: "1.3s", rotate: "-100deg" },
  { left: "74%", delay: "0.26s", size: 11, duration: "1.7s", rotate: "150deg" },
];

const JULY_FIREFLY_COUNT = [0, 0, 2, 4, 6];

/* 7月固有：蛍。梅雨が明けていくにつれ、少しずつ数が増える。
   利用者が何かをしたから増えるのではなく、月の後半になるほど夜の森が賑わうという、時間だけの変化。 */
function fireflyPositions(count) {
  return Array.from({ length: count }, (_, i) => ({
    left: `${8 + ((i * 37) % 84)}%`,
    bottom: `${18 + ((i * 53) % 90)}px`,
    delay: `${(i * 0.7) % 3}s`,
    duration: `${2.6 + (i % 3) * 0.5}s`,
  }));
}

/* 暮らしの跡：記録を書いた日だけ、その日にあたる場所に小さな跡が残る。
   森を育てているのは利用者ではなく時間。ここにあるのは「その日そこにいた」痕跡だけ。 */
function tracePositions(recordedDays) {
  return recordedDays.map((day) => ({
    day,
    left: `${6 + (Math.min(day, 31) / 31) * 88}%`,
    bottom: `${10 + ((day * 53) % 14)}px`,
  }));
}

/* コンポーネントテーマ専用部品：森の生育。中身の情報構造・操作順序には一切手を加えない。
   画面が切り替わる瞬間、葉が舞い落ちる——「森を移動している」という手応えのための演出。 */
export default function ForestGrowth({ stage, screen, month, recordedDays = [], rareDiscovery = false, children }) {
  const fireflies = month === 7 ? fireflyPositions(JULY_FIREFLY_COUNT[stage] ?? 0) : [];
  const traces = tracePositions(recordedDays);
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
        @keyframes fireflyGlow {
          0%, 100% { opacity: 0.25; transform: translateY(0); }
          50% { opacity: 0.9; transform: translateY(-6px); }
        }
        @keyframes traceGlow {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.7; }
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
          backgroundImage: buildForestScene(stage, { month, rareDiscovery }),
          backgroundRepeat: "no-repeat",
          backgroundPosition: "bottom center",
          backgroundSize: "100% 100%",
        }}
      />
      {/* 蛍：7月固有。夜の森が賑わっていく、時間だけの変化 */}
      {fireflies.map((f, i) => (
        <span
          key={`firefly-${i}`}
          style={{
            position: "absolute",
            left: f.left,
            bottom: f.bottom,
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "#E9EDA0",
            boxShadow: "0 0 5px 2px rgba(233,237,160,0.55)",
            pointerEvents: "none",
            animation: `fireflyGlow ${f.duration} ease-in-out ${f.delay} infinite`,
          }}
        />
      ))}
      {/* 暮らしの跡：記録を書いた日にだけ残る、目立たない印 */}
      {traces.map((t) => (
        <span
          key={`trace-${t.day}`}
          style={{
            position: "absolute",
            left: t.left,
            bottom: t.bottom,
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#C98A4B",
            opacity: 0.5,
            pointerEvents: "none",
            animation: "traceGlow 4s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}
