function svgUrl(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const START_FLAG =
  "<circle cx='34' cy='128' r='4' fill='#C97A2B' fill-opacity='0.32'/>" +
  "<line x1='34' y1='128' x2='34' y2='100' stroke='#C97A2B' stroke-opacity='0.3' stroke-width='2'/>" +
  "<path d='M34 100 L56 106 L34 114 Z' fill='#C97A2B' fill-opacity='0.3'/>";

function trail(d) {
  return `<path d='${d}' stroke='#C97A2B' stroke-opacity='0.26' stroke-width='3' fill='none' stroke-dasharray='7 7' stroke-linecap='round'/>`;
}

function mountain(x, scale = 1) {
  const w = 46 * scale;
  const h = 42 * scale;
  return `<path d='M${x - w / 2} 150 L${x} ${150 - h} L${x + w / 2} 150 Z' fill='#8A6E44' fill-opacity='0.2'/>`;
}

function compass(x, y) {
  return (
    `<circle cx='${x}' cy='${y}' r='14' fill='none' stroke='#C97A2B' stroke-opacity='0.28' stroke-width='1.5'/>` +
    `<line x1='${x}' y1='${y - 14}' x2='${x}' y2='${y + 14}' stroke='#C97A2B' stroke-opacity='0.24' stroke-width='1'/>` +
    `<line x1='${x - 14}' y1='${y}' x2='${x + 14}' y2='${y}' stroke='#C97A2B' stroke-opacity='0.24' stroke-width='1'/>`
  );
}

function chest(x) {
  return (
    `<rect x='${x - 14}' y='118' width='28' height='18' rx='2' fill='#C97A2B' fill-opacity='0.3'/>` +
    `<rect x='${x - 14}' y='112' width='28' height='9' rx='3' fill='#C97A2B' fill-opacity='0.34'/>`
  );
}

/* 冒険テーマの背景は、月の日付とともに進む旅の地図。
   1〜2日：出発地点 / 3〜9日：小道がのびる / 10〜19日：山が見える
   20〜29日：コンパスが現れる / 30〜31日：宝箱にたどり着く */
function buildAdventureScene(stage) {
  let content = START_FLAG;

  if (stage >= 1) content += trail("M34 128 Q90 118 150 126");
  if (stage >= 2) {
    content += trail("M150 126 Q210 134 260 122");
    content += mountain(210, 0.9);
  }
  if (stage >= 3) {
    content += trail("M260 122 Q310 112 340 124");
    content += compass(300, 60);
  }
  if (stage >= 4) {
    content += trail("M340 124 Q365 132 385 122");
    content += "<circle cx='385' cy='118' r='30' fill='#F2E3C6' fill-opacity='0.16'/>";
    content += chest(385);
  }

  return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 420 150' preserveAspectRatio='xMidYMax slice'>${content}</svg>`);
}

/* コンポーネントテーマ専用部品：旅の地図。中身の情報構造・操作順序には一切手を加えない。 */
export default function AdventureJourney({ stage, children }) {
  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {children}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 150,
          pointerEvents: "none",
          backgroundImage: buildAdventureScene(stage),
          backgroundRepeat: "no-repeat",
          backgroundPosition: "bottom center",
          backgroundSize: "100% 100%",
        }}
      />
    </div>
  );
}
