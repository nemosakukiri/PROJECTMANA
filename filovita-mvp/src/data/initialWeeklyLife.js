/* 2026-08-01、利用者との生活モデル設計対話で実際に集まった、定期的な
   訪問・通院の初期データ。個人の担当者名は含めない（利用者の意向）。
   事業所名は利用者の希望で記録している。docs/LIFE_MODEL.md参照。 */

function regular(id, dayOfWeek, startTime, endTime, label, provider) {
  return {
    id,
    kind: "regular",
    repeat: { type: "weekly", dayOfWeek },
    date: null,
    startTime,
    endTime: endTime || null,
    label,
    provider: provider || null,
    lifeAttributes: { category: null, location: null, travelLoad: null, prepLoad: null, recoveryTime: null },
  };
}

export const initialWeeklyLife = [
  regular("wl_1", "mon", "10:00", "13:00", "身体介護＋家事援助", "BLUE"),
  regular("wl_2", "mon", "18:00", "19:00", "移動介助＋身体介護", "BLUE"),
  regular("wl_3", "tue", "10:00", "13:00", "身体介護＋家事援助", "BLUE"),
  regular("wl_4", "tue", "19:00", "20:00", "移動介助＋身体介護", "BLUE"),
  regular("wl_5", "fri", "11:00", "14:00", "身体介護＋家事援助", "BLUE"),
  regular("wl_6", "fri", "18:00", "19:00", "移動介助＋身体介護", "BLUE"),
  regular("wl_7", "sat", "11:00", "14:00", "身体介護＋家事援助", "BLUE"),
  regular("wl_8", "sat", "18:00", "19:00", "移動介助＋身体介護", "BLUE"),
  regular("wl_9", "wed", "10:30", null, "訪問看護", "アミケア訪問看護ステーション"),
  regular("wl_10", "wed", "15:30", "18:30", "訪問支援", "優河ケアステーション"),
  regular("wl_11", "thu", "10:30", "12:30", "カウンセリング（10:30迎え）", null),
  regular("wl_12", "thu", "16:30", null, "訪問支援", "ケアサポートりんく"),
  regular("wl_13", "mon", "12:45", null, "鍼灸（訪問）", null),
  regular("wl_14", "tue", "11:30", null, "鍼灸（訪問）", null),
  regular("wl_15", "wed", "15:00", null, "鍼灸（訪問）", null),
  regular("wl_16", "thu", "14:30", null, "鍼灸（訪問）", null),
  regular("wl_17", "fri", "10:30", null, "鍼灸（訪問）", null),
  regular("wl_18", "thu", "12:30", null, "帰りにマクドナルド（ドライブスルー）", null),
];
