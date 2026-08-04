import { Trash2 } from "lucide-react";
import ContextHeader from "../components/ContextHeader.jsx";
import SeedQuickCapture from "../components/SeedQuickCapture.jsx";
import SteelPanel from "../theme/industrial/SteelPanel.jsx";
import OrnateFrame from "../theme/gothic/OrnateFrame.jsx";
import BarkPanel from "../theme/forest/BarkPanel.jsx";

function formatSeedDate(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/* 暮らしの種——予定でもメモ帳でもない、生活カルテ直下の横断レイヤー。
   docs/LIFE_MODEL.md「暮らしの種」参照。「これは生活の種である」という
   存在だけをSeedのstatus:"open"で明確にし、それ以外は最初から分類しない。
   AIが分類案を出す仕組み（aiSuggestions）はv1では使わない——まず「消えない
   場所を作る」ことを先にやり切る、という利用者の判断による段階分け。
   置いた順（新しいものが上）にただ並べるだけで、整理は本人の仕事のまま
   残す。 */
export default function SeedsScreen({ theme, seeds, onAdd, onRemove, onBack }) {
  const { tokens } = theme;
  const isIndustrial = theme.componentTheme === "industrial";
  const isGothic = theme.componentTheme === "gothic";
  const isForest = theme.componentTheme === "forest";

  const sorted = [...seeds].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const listBody = (
    <>
      <SeedQuickCapture tokens={tokens} onAdd={onAdd} />
      {sorted.length === 0 ? (
        <p style={{ fontSize: 13, color: tokens.inkFaint }}>
          まだ、何も置かれていません。ふと気になったことを、一言だけ置いてみてください。
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map((seed) => (
            <div
              key={seed.id}
              data-testid="seed-item"
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", border: `1px solid ${tokens.line}`, borderRadius: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 13.5, color: tokens.ink }}>{seed.text}</div>
                <div style={{ fontSize: 11, color: tokens.inkFaint, marginTop: 2 }}>{formatSeedDate(seed.createdAt)}</div>
              </div>
              <button
                onClick={() => onRemove(seed.id)}
                style={{ background: "none", border: "none", color: tokens.inkFaint, cursor: "pointer", padding: 2 }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div>
      <ContextHeader theme={theme} breadcrumb="生活カルテ" title="🌱 暮らしの種" onBack={onBack} />
      <div style={{ padding: "0 20px 30px" }}>
        <p style={{ fontSize: 12.5, color: tokens.inkFaint, marginBottom: 18 }}>
          まだ予定でも、家計の話でもない、ふと気になったこと・したいことを
          置いておく場所です。分類はしなくて大丈夫です。
        </p>
        {isIndustrial ? (
          <SteelPanel>{listBody}</SteelPanel>
        ) : isGothic ? (
          <OrnateFrame>{listBody}</OrnateFrame>
        ) : isForest ? (
          <BarkPanel>{listBody}</BarkPanel>
        ) : (
          listBody
        )}
      </div>
    </div>
  );
}
