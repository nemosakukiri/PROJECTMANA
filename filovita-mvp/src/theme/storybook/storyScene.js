import { rareMoment, traceLayout } from "../worldEngine.js";

function svgUrl(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const SCENE_HEIGHT = 190;
const GROUND_Y = 190;

/* Time Philosophy：絵本にとって時間はページをめくること。
   世界が育つのでも、感じ方が変わるのでもなく、物語そのものが先に進む。
   1〜2日：とびらをめくったところ / 3〜9日：麦畑の道 / 10〜19日：夏まつり(いちばん賑やかな見開き)
   20〜29日：長い影の帰り道 / 30〜31日：おうちに灯りがともる */

/* 旅人の立ち位置。SVG(背景画像)の中にはもう描かない——
   背景画像として読み込まれるSVGは、セキュリティ上の理由で外部の画像(<image>)を読み込めないため、
   実イラストはCalendarScreen側で通常の<img>としてこの座標に重ねる。 */
const TRAVELER_X = [185, 230, 210, 250, 230];

export function getTravelerPosition(stage) {
  return { leftPercent: (TRAVELER_X[stage] / 420) * 100 };
}

function wheatRow(y) {
  let s = "";
  for (let x = 20; x < 400; x += 26) {
    s += `<line x1='${x}' y1='${y}' x2='${x}' y2='${y - 22}' stroke='#D6B65C' stroke-opacity='0.4' stroke-width='2.5' stroke-linecap='round'/>`;
  }
  return s;
}

function lantern(x, y) {
  return (
    `<line x1='${x}' y1='0' x2='${x}' y2='${y}' stroke='#B08A5A' stroke-opacity='0.3' stroke-width='1.2'/>` +
    `<ellipse cx='${x}' cy='${y}' rx='7' ry='9' fill='#E8A23A' fill-opacity='0.4'/>`
  );
}

/* Rare Moments：ページのどこかに、小さな生き物が隠れている。説明はしない。 */
function hiddenCreature(x, y) {
  return `<circle cx='${x}' cy='${y}' r='3' fill='#5C9A5E' fill-opacity='0.4'/><circle cx='${x - 1.5}' cy='${y - 1}' r='0.8' fill='#2A3B1F' fill-opacity='0.5'/>`;
}

export function buildStoryScene(stage, { hiddenSpot } = {}) {
  let content = `<rect x='0' y='0' width='420' height='${SCENE_HEIGHT}' fill='#FBEEE0'/>`;

  if (stage === 0) {
    content +=
      `<rect x='150' y='40' width='70' height='110' rx='4' fill='#E8C9A8' fill-opacity='0.35'/>` +
      `<rect x='150' y='40' width='4' height='110' fill='#B08A5A' fill-opacity='0.4'/>`;
  } else if (stage === 1) {
    content += wheatRow(GROUND_Y - 6);
  } else if (stage === 2) {
    content +=
      [70, 130, 190, 250, 310, 370].map((x) => lantern(x, 26)).join("") +
      wheatRow(GROUND_Y - 6);
  } else if (stage === 3) {
    content +=
      "<rect x='0' y='0' width='420' height='" + SCENE_HEIGHT + "' fill='#E8A23A' fill-opacity='0.14'/>" +
      `<ellipse cx='260' cy='${GROUND_Y - 2}' rx='30' ry='4' fill='#4A2E2A' fill-opacity='0.14'/>`;
  } else {
    content +=
      `<rect x='260' y='60' width='90' height='90' fill='#B08A5A' fill-opacity='0.28'/>` +
      `<path d='M255 60 L305 24 L355 60 Z' fill='#8A5A3E' fill-opacity='0.32'/>` +
      `<rect x='290' y='90' width='20' height='24' fill='#F2E3C6' fill-opacity='0.5'/>`;
  }

  if (hiddenSpot) content += hiddenCreature(hiddenSpot.x, hiddenSpot.y);

  return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 420 ${SCENE_HEIGHT}' preserveAspectRatio='xMidYMax slice'>${content}</svg>`);
}

const HIDDEN_SPOTS = [
  { x: 40, y: 50 },
  { x: 380, y: 70 },
  { x: 340, y: 150 },
  { x: 60, y: 140 },
];

export function getHiddenSpot(dateStr) {
  if (!rareMoment(dateStr, "hiddenCreature", 0.18)) return null;
  return HIDDEN_SPOTS[Number(dateStr.slice(-2)) % HIDDEN_SPOTS.length];
}

/* User Traces：記録した日のページに残る、小さな押し花のようなシール */
export function storyTraces(recordedDays) {
  return traceLayout(recordedDays, { bottomBase: 6, bottomJitter: 10, leftMargin: 8 });
}
