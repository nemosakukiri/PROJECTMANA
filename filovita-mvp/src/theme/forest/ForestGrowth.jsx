function svgUrl(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function trees(list) {
  return list
    .map(
      (t) =>
        `<rect x='${t.x - 3}' y='${150 - t.trunkH}' width='6' height='${t.trunkH}' fill='#2F6B3A' fill-opacity='${t.opacity}'/>` +
        `<circle cx='${t.x}' cy='${150 - t.trunkH - t.canopyR * 0.7}' r='${t.canopyR}' fill='#2F6B3A' fill-opacity='${t.opacity}'/>`
    )
    .join("");
}

/* 森テーマの背景は、月の日付とともに育つ小さな物語。
   1〜2日：芽 / 3〜9日：木が2本 / 10〜19日：小道 / 20〜29日：花 / 30〜31日：小さな森の完成 */
function buildForestScene(stage) {
  let content = "";

  if (stage === 0) {
    content +=
      "<line x1='210' y1='150' x2='210' y2='122' stroke='#2F6B3A' stroke-opacity='0.3' stroke-width='3'/>" +
      "<path d='M210 122 Q196 112 192 120 Q202 128 210 122 Z' fill='#2F6B3A' fill-opacity='0.28'/>" +
      "<path d='M210 122 Q224 112 228 120 Q218 128 210 122 Z' fill='#2F6B3A' fill-opacity='0.28'/>";
    return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 420 150' preserveAspectRatio='xMidYMax slice'>${content}</svg>`);
  }

  const baseTrees = [
    { x: 110, trunkH: 46, canopyR: 26, opacity: 0.22 },
    { x: 300, trunkH: 38, canopyR: 20, opacity: 0.2 },
  ];
  const extraTrees =
    stage >= 4
      ? [
          { x: 55, trunkH: 30, canopyR: 16, opacity: 0.16 },
          { x: 355, trunkH: 34, canopyR: 18, opacity: 0.18 },
          { x: 210, trunkH: 50, canopyR: 28, opacity: 0.2 },
        ]
      : [];
  content += trees([...baseTrees, ...extraTrees]);

  if (stage >= 2) {
    content +=
      "<path d='M0 145 Q100 130 210 140 Q320 150 420 135' stroke='#C9AE7D' stroke-opacity='0.28' stroke-width='9' fill='none' stroke-linecap='round'/>";
  }
  if (stage >= 3) {
    content += [
      "<circle cx='150' cy='138' r='3' fill='#E8837A' fill-opacity='0.3'/>",
      "<circle cx='250' cy='142' r='2.5' fill='#E8837A' fill-opacity='0.28'/>",
      "<circle cx='190' cy='134' r='2' fill='#E8837A' fill-opacity='0.26'/>",
      "<circle cx='330' cy='140' r='2.5' fill='#E8837A' fill-opacity='0.24'/>",
    ].join("");
  }
  if (stage >= 4) {
    content += "<circle cx='55' cy='30' r='40' fill='#F2E7B8' fill-opacity='0.14'/>";
  }

  return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 420 150' preserveAspectRatio='xMidYMax slice'>${content}</svg>`);
}

/* コンポーネントテーマ専用部品：森の生育。中身の情報構造・操作順序には一切手を加えない。 */
export default function ForestGrowth({ stage, children }) {
  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes canopySway {
          0%, 100% { opacity: 0.85; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(4px); }
        }
      `}</style>
      {children}
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
          height: 150,
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
