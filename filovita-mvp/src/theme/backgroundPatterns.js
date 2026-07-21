/* テーマごとの、ごく薄い背景モチーフ（5〜10%程度の濃さ）。
   主役はあくまで記録の内容。背景は世界観を支えるだけの、静かな重ね掛け。 */

function svgUrl(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const backgroundPatterns = {
  // 手帳：ノートの罫線
  techo: {
    backgroundImage: svgUrl(
      "<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><line x1='0' y1='43' x2='44' y2='43' stroke='#3F5C42' stroke-opacity='0.16' stroke-width='1.2'/></svg>"
    ),
    backgroundSize: "44px 44px",
  },
  // 絵本：やわらかく散らばる水玉
  ehon: {
    backgroundImage: svgUrl(
      "<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90'><circle cx='16' cy='22' r='3' fill='#E8837A' fill-opacity='0.09'/><circle cx='62' cy='58' r='4' fill='#E8837A' fill-opacity='0.07'/><circle cx='40' cy='76' r='2.2' fill='#E8837A' fill-opacity='0.08'/><circle cx='78' cy='18' r='2' fill='#E8837A' fill-opacity='0.06'/></svg>"
    ),
    backgroundSize: "90px 90px",
  },
  // 森：葉のシルエット
  mori: {
    backgroundImage: svgUrl(
      "<svg xmlns='http://www.w3.org/2000/svg' width='84' height='84'><path d='M14 62 C10 46 18 34 28 30 C34 42 32 58 20 66 C17 66 15 64 14 62 Z' fill='#2F6B3A' fill-opacity='0.08'/><path d='M60 20 C56 6 64 -4 72 -6 C77 4 76 18 66 26 C63 26 61 23 60 20 Z' fill='#2F6B3A' fill-opacity='0.06'/></svg>"
    ),
    backgroundSize: "84px 84px",
  },
  // ホラー：古い洋館の壁紙（ダマスク柄）。本棚・暖炉のシルエットはCrackedGlass側で追加
  horror: {
    backgroundImage: svgUrl(
      "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><path d='M50 8 C64 22 64 40 50 48 C36 40 36 22 50 8 Z M50 48 C64 56 64 74 50 88 C36 74 36 56 50 48 Z' fill='#B5324A' fill-opacity='0.07'/></svg>"
    ),
    backgroundSize: "100px 100px",
  },
  // SF：六角形グリッド
  sf: {
    backgroundImage: svgUrl(
      "<svg xmlns='http://www.w3.org/2000/svg' width='56' height='97'><polygon points='28,1 55,17 55,49 28,65 1,49 1,17' fill='none' stroke='#2FB6C4' stroke-opacity='0.09' stroke-width='1'/></svg>"
    ),
    backgroundSize: "56px 97px",
  },
  // 冒険：地図の等高線
  bouken: {
    backgroundImage: svgUrl(
      "<svg xmlns='http://www.w3.org/2000/svg' width='140' height='90'><path d='M-10 55 Q25 20 60 55 T140 55' fill='none' stroke='#C97A2B' stroke-opacity='0.08' stroke-width='1'/><path d='M-10 78 Q25 48 60 78 T140 78' fill='none' stroke='#C97A2B' stroke-opacity='0.06' stroke-width='1'/></svg>"
    ),
    backgroundSize: "140px 90px",
  },
  // サイバーパンク：基板の配線
  cyberpunk: {
    backgroundImage: svgUrl(
      "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><path d='M0 32 H24 V12 H48' fill='none' stroke='#39FF6A' stroke-opacity='0.10' stroke-width='1'/><circle cx='24' cy='12' r='2' fill='#39FF6A' fill-opacity='0.14'/><circle cx='48' cy='12' r='2' fill='#39FF6A' fill-opacity='0.14'/></svg>"
    ),
    backgroundSize: "64px 64px",
  },
};
