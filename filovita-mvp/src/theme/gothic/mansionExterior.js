function svgUrl(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/* ホラーの入口：中に入る前に見る、古く怖そうな洋館の外観。
   CrackedGlassの室内(暖炉・本棚・窓)とは別の場面——「この家に足を踏み入れる」前の一枚。 */
export function buildMansionExterior() {
  const sky =
    "<defs><linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'>" +
    "<stop offset='0' stop-color='#1A1428'/><stop offset='1' stop-color='#2E2438'/>" +
    "</linearGradient></defs><rect x='0' y='0' width='420' height='220' fill='url(#sky)'/>";

  const moon = "<circle cx='340' cy='46' r='26' fill='#E8DFC6' fill-opacity='0.5'/><circle cx='340' cy='46' r='38' fill='#E8DFC6' fill-opacity='0.08'/>";

  const bats =
    "<path d='M120 60 Q126 54 132 60 Q126 56 120 60' stroke='#0D0A16' stroke-width='2' fill='none' stroke-opacity='0.5'/>" +
    "<path d='M150 78 Q156 72 162 78 Q156 74 150 78' stroke='#0D0A16' stroke-width='2' fill='none' stroke-opacity='0.45'/>";

  const tree =
    "<path d='M40 220 L44 140' stroke='#0D0A16' stroke-width='5' stroke-opacity='0.55'/>" +
    "<path d='M44 150 L20 120 M44 160 L14 150 M44 145 L66 118 M44 168 L70 150' stroke='#0D0A16' stroke-width='3' stroke-opacity='0.5' stroke-linecap='round'/>";

  // 母屋
  const house =
    "<rect x='150' y='110' width='150' height='110' fill='#0D0A16' fill-opacity='0.7'/>" +
    "<path d='M150 110 L225 62 L300 110 Z' fill='#0D0A16' fill-opacity='0.75'/>";
  // 塔
  const tower =
    "<rect x='268' y='70' width='36' height='150' fill='#0D0A16' fill-opacity='0.72'/>" +
    "<path d='M264 70 L286 38 L308 70 Z' fill='#0D0A16' fill-opacity='0.78'/>";

  const windows =
    "<rect x='175' y='140' width='16' height='22' fill='#E8A23A' fill-opacity='0.4'/>" +
    "<rect x='245' y='140' width='16' height='22' fill='#5A6E8A' fill-opacity='0.2'/>" +
    "<rect x='210' y='170' width='18' height='24' fill='#5A6E8A' fill-opacity='0.18'/>" +
    "<rect x='280' y='100' width='12' height='16' fill='#E8A23A' fill-opacity='0.35'/>";

  const fence =
    Array.from({ length: 14 })
      .map((_, i) => `<line x1='${10 + i * 28}' y1='220' x2='${10 + i * 28}' y2='196' stroke='#0D0A16' stroke-opacity='0.5' stroke-width='2.5'/>`)
      .join("") + "<line x1='0' y1='198' x2='420' y2='198' stroke='#0D0A16' stroke-opacity='0.45' stroke-width='2'/>";

  const fog =
    "<defs><linearGradient id='fog' x1='0' y1='0' x2='0' y2='1'>" +
    "<stop offset='0' stop-color='#3E3450' stop-opacity='0'/><stop offset='1' stop-color='#3E3450' stop-opacity='0.55'/>" +
    "</linearGradient></defs><rect x='0' y='170' width='420' height='50' fill='url(#fog)'/>";

  return svgUrl(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 420 220' preserveAspectRatio='xMidYMax slice'>${sky}${moon}${bats}${tree}${tower}${house}${windows}${fog}${fence}</svg>`
  );
}
