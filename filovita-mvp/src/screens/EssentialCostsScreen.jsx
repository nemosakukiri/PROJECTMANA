import { useState } from "react";
import { Trash2 } from "lucide-react";
import ContextHeader from "../components/ContextHeader.jsx";
import SteelPanel from "../theme/industrial/SteelPanel.jsx";
import OrnateFrame from "../theme/gothic/OrnateFrame.jsx";
import BarkPanel from "../theme/forest/BarkPanel.jsx";

function AddForm({ tokens, onAdd }) {
  const [entity, setEntity] = useState("");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    if (!entity.trim() || !label.trim()) return;
    onAdd({ entity: entity.trim(), label: label.trim(), amount: null, cadence: null, note: note.trim() });
    setEntity("");
    setLabel("");
    setNote("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 22 }} data-testid="essential-cost-add-form">
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text" value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="誰のためか（例：ネモ）"
          data-testid="essential-cost-entity"
          style={{ flex: 1, padding: "9px 11px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
        />
        <input
          type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="何か（例：薬）"
          data-testid="essential-cost-label"
          style={{ flex: 1, padding: "9px 11px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
        />
      </div>
      <input
        type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="メモ（任意）"
        data-testid="essential-cost-note"
        style={{ padding: "9px 11px", fontSize: 13, borderRadius: 9, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
      />
      <button
        onClick={submit}
        data-testid="essential-cost-add-button"
        style={{ padding: "9px 16px", fontSize: 12.5, borderRadius: 9, border: "none", background: tokens.ink, color: tokens.paper, cursor: "pointer", alignSelf: "flex-start" }}
      >
        追加
      </button>
    </div>
  );
}

/* 欠かせないもの（essentialCosts）——生活を維持するために絶対に守らないと
   いけない費用を、支出項目ではなく「誰のためのものか」で持つ場所
   （docs/LIFE_MODEL.md参照、2026-08-01。ネモの薬を買えなかった実際の
   危機を踏まえた設計対話から生まれた）。

   金額(amount)は、実際に確認できたものだけを入れる——確認できるまでは
   空欄のまま表示する。ここで金額を推測して埋めることは、家計相談の
   憲法・第9条が禁じている「事実を作る」行為そのものになるため、UIの
   どこにも「だいたいこれくらい」を入力させる導線は作らない。 */
export default function EssentialCostsScreen({ theme, essentialCosts, onAdd, onRemove, onEditAmount, onBack }) {
  const { tokens } = theme;
  const isIndustrial = theme.componentTheme === "industrial";
  const isGothic = theme.componentTheme === "gothic";
  const isForest = theme.componentTheme === "forest";

  const entities = [...new Set(essentialCosts.map((c) => c.entity))];

  const listBody = (
    <>
      {entities.length === 0 ? (
        <p style={{ fontSize: 13, color: tokens.inkFaint, marginBottom: 20 }}>
          まだ、欠かせないものは登録されていません。
        </p>
      ) : (
        entities.map((entity) => (
          <div key={entity} style={{ marginBottom: 18 }} data-testid={`essential-cost-entity-${entity}`}>
            <div style={{ fontSize: 12, fontWeight: 700, color: tokens.inkSoft, marginBottom: 6 }}>{entity}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {essentialCosts
                .filter((c) => c.entity === entity)
                .map((cost) => (
                  <div
                    key={cost.id}
                    data-testid="essential-cost-item"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "9px 12px", border: `1px solid ${tokens.line}`, borderRadius: 10,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, color: tokens.ink }}>{cost.label}</div>
                      {cost.note && <div style={{ fontSize: 12, color: tokens.inkFaint, marginTop: 2 }}>{cost.note}</div>}
                      <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11.5, color: tokens.inkFaint }}>金額：</span>
                        <input
                          type="number"
                          value={cost.amount ?? ""}
                          placeholder="未確認"
                          onChange={(e) => onEditAmount(cost.id, e.target.value === "" ? null : Number(e.target.value))}
                          style={{ width: 90, padding: "5px 7px", fontSize: 12.5, borderRadius: 7, border: `1px solid ${tokens.line}`, fontFamily: "inherit" }}
                        />
                        {cost.amount == null && (
                          <span style={{ fontSize: 11, color: tokens.inkFaint }}>（金額はまだ確認できていません）</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onRemove(cost.id)}
                      style={{ background: "none", border: "none", color: tokens.inkFaint, cursor: "pointer", padding: 2 }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ))
      )}
      <AddForm tokens={tokens} onAdd={onAdd} />
    </>
  );

  return (
    <div>
      <ContextHeader theme={theme} breadcrumb="生活カルテ" title="欠かせないもの" onBack={onBack} />
      <div style={{ padding: "0 20px 30px" }}>
        <p style={{ fontSize: 12.5, color: tokens.inkFaint, marginBottom: 18 }}>
          生活を守るために欠かせない費用です。誰のためのものかで持ちます。
          金額は、確認できたものだけ入れれば大丈夫です。
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
