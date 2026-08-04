function svgUrl(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/* のっぺりしたベクターに見えすぎないよう、粒子ノイズを重ねる。
   絵の具のような質感にはならないが、フラットな塗りを少し崩せる。 */
function grainFilter(id) {
  return (
    `<filter id='${id}'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch' result='n'/>` +
    `<feColorMatrix in='n' type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0'/>` +
    `</filter>`
  );
}

function ivy(x, y, h) {
  let d = `M${x} ${y}`;
  let cx = x;
  let cy = y;
  for (let i = 0; i < h; i += 14) {
    cx += i % 28 === 0 ? 6 : -5;
    cy -= 14;
    d += ` Q${cx + 3} ${cy + 7} ${cx} ${cy}`;
  }
  return `<path d='${d}' stroke='#1E3A22' stroke-opacity='0.55' stroke-width='2.2' fill='none'/>`;
}

/* ホラーの入口：中に入る前に見る、見上げるほど大きく、怖そうに聳え立つ洋館。
   低い視点(見上げる構図)で、建物が画面のほとんどを占めるようにする。 */
export function buildMansionExterior() {
  const W = 420;
  const H = 260;

  const sky =
    "<defs>" +
    "<linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'>" +
    "<stop offset='0' stop-color='#0E0A18'/><stop offset='0.55' stop-color='#1C1528'/><stop offset='1' stop-color='#2E2438'/>" +
    "</linearGradient>" +
    "<linearGradient id='wall' x1='0' y1='0' x2='0' y2='1'>" +
    "<stop offset='0' stop-color='#241C2E'/><stop offset='1' stop-color='#0A070E'/>" +
    "</linearGradient>" +
    grainFilter("grain") +
    "</defs>" +
    `<rect x='0' y='0' width='${W}' height='${H}' fill='url(#sky)'/>`;

  // 雲に半分隠れた大きな月
  const moon =
    "<circle cx='330' cy='58' r='34' fill='#E8DFC6' fill-opacity='0.55'/>" +
    "<circle cx='330' cy='58' r='50' fill='#E8DFC6' fill-opacity='0.1'/>" +
    "<path d='M296 46 Q330 30 366 50 Q332 40 296 46 Z' fill='#1C1528' fill-opacity='0.7'/>";

  const bats =
    "<path d='M100 74 Q108 66 116 74 Q108 68 100 74' stroke='#050308' stroke-width='2.2' fill='none' stroke-opacity='0.6'/>" +
    "<path d='M140 96 Q148 88 156 96 Q148 90 140 96' stroke='#050308' stroke-width='2.2' fill='none' stroke-opacity='0.5'/>" +
    "<path d='M70 110 Q76 104 82 110 Q76 106 70 110' stroke='#050308' stroke-width='2' fill='none' stroke-opacity='0.5'/>";

  // 裸木、館の手前に大きく
  const tree =
    "<path d='M18 260 L26 120' stroke='#050308' stroke-width='8' stroke-opacity='0.7'/>" +
    "<path d='M24 150 L-6 110 M26 135 L-10 148 M25 165 L-4 190 M27 120 L54 90 M27 145 L58 128 M25 175 L52 168'" +
    " stroke='#050308' stroke-width='4' stroke-opacity='0.65' stroke-linecap='round'/>";

  // 見上げる構図：館は画面の大半を占める、いびつな複数棟のシルエット
  const mainWing =
    `<path d='M96 260 L96 118 L150 118 L150 90 L190 60 L230 90 L230 118 L300 118 L300 150 L332 150 L332 260 Z' fill='url(#wall)'/>`;

  // 左に傾いた尖塔
  const leftTower =
    "<path d='M96 118 L96 40 L120 40 L120 118 Z' fill='#150F1C'/>" +
    "<path d='M92 40 L108 -6 L124 40 Z' fill='#0A070E' transform='rotate(-4 108 40)'/>";

  // 右のずんぐりした塔＋崩れた尖り屋根
  const rightTower =
    "<path d='M300 150 L300 68 L332 68 L332 150 Z' fill='#150F1C'/>" +
    "<path d='M296 68 Q316 34 336 68 Z' fill='#0A070E'/>";

  // 屋根の裂け目・崩れ
  const roofCracks =
    "<path d='M190 60 L196 78 L186 92 L198 100' stroke='#050308' stroke-width='1.6' fill='none' stroke-opacity='0.6'/>";

  // ガーゴイル(左塔の張り出し)
  const gargoyle =
    "<path d='M92 108 Q80 108 78 118 Q84 116 88 120 Q90 112 96 112 Z' fill='#0A070E'/>" +
    "<circle cx='83' cy='115' r='1.3' fill='#E8A23A' fill-opacity='0.5'/>";

  // 窓：ほとんどは暗く落ちくぼみ、一つだけ灯りが揺れる
  const windows =
    "<rect x='170' y='150' width='18' height='26' fill='#050308' fill-opacity='0.9'/>" +
    "<rect x='240' y='150' width='18' height='26' fill='#E8A23A' fill-opacity='0.4'/>" +
    "<rect x='205' y='190' width='20' height='28' fill='#050308' fill-opacity='0.9'/>" +
    "<rect x='108' y='150' width='14' height='20' fill='#050308' fill-opacity='0.85'/>" +
    "<rect x='308' y='95' width='12' height='18' fill='#050308' fill-opacity='0.85'/>" +
    // ひび割れた窓格子
    "<line x1='170' y1='163' x2='188' y2='163' stroke='#000' stroke-opacity='0.5' stroke-width='1'/>" +
    "<line x1='179' y1='150' x2='179' y2='176' stroke='#000' stroke-opacity='0.5' stroke-width='1'/>";

  // 崩れかけた玄関アーチ(見上げた先、画面下寄りに大きく)
  const door =
    "<path d='M200 260 L200 210 Q200 186 224 186 Q248 186 248 210 L248 260 Z' fill='#050308' fill-opacity='0.92'/>" +
    "<path d='M200 210 Q224 190 248 210' stroke='#000' stroke-width='2' fill='none' stroke-opacity='0.6'/>";

  const ivyLines = ivy(100, 258, 130) + ivy(300, 258, 110) + ivy(210, 258, 60);

  // 手前の鉄柵(見上げているので、画面下でかなり大きく・近い)
  const fence =
    Array.from({ length: 9 })
      .map((_, i) => {
        const x = -10 + i * 56;
        return (
          `<line x1='${x}' y1='260' x2='${x}' y2='214' stroke='#050308' stroke-opacity='0.75' stroke-width='4'/>` +
          `<path d='M${x - 5} 214 L${x} 202 L${x + 5} 214 Z' fill='#050308' fill-opacity='0.75'/>`
        );
      })
      .join("") +
    "<line x1='0' y1='216' x2='420' y2='216' stroke='#050308' stroke-opacity='0.7' stroke-width='4'/>";

  // 層になった霧(奥・中・手前)
  const fog =
    "<defs>" +
    "<linearGradient id='fog1' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#3E3450' stop-opacity='0'/><stop offset='1' stop-color='#3E3450' stop-opacity='0.5'/></linearGradient>" +
    "<linearGradient id='fog2' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#241C30' stop-opacity='0'/><stop offset='1' stop-color='#241C30' stop-opacity='0.75'/></linearGradient>" +
    "</defs>" +
    `<rect x='0' y='150' width='${W}' height='60' fill='url(#fog1)'/>` +
    `<rect x='0' y='215' width='${W}' height='45' fill='url(#fog2)'/>`;

  const grainOverlay = `<rect x='0' y='0' width='${W}' height='${H}' filter='url(#grain)'/>`;
  const vignette =
    "<defs><radialGradient id='vig' cx='50%' cy='38%' r='75%'>" +
    "<stop offset='55%' stop-color='#000' stop-opacity='0'/><stop offset='100%' stop-color='#000' stop-opacity='0.55'/>" +
    `</radialGradient></defs><rect x='0' y='0' width='${W}' height='${H}' fill='url(#vig)'/>`;

  return svgUrl(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' preserveAspectRatio='xMidYMax slice'>` +
      sky + moon + bats + tree +
      mainWing + leftTower + rightTower + roofCracks + gargoyle + windows + door + ivyLines +
      fog + fence + grainOverlay + vignette +
      "</svg>"
  );
}
