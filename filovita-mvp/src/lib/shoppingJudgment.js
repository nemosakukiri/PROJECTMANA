/* 買い物相談の判断ロジック。断定はしない——「今ある情報での見立て」に留める。
   MVP_SPEC.md「複数周期の統合判断」に基づく最小構成：
   2週間予算・現在の残額・決まって買うもの・今回追加したいもの・次の買い物日、
   だけを材料に「今回はこれで大丈夫そうか」を返す。実際のAI推論ではなく、
   fakeGenerateDraft.js同様のルールベース（本番の判断エンジンはこの構造の上に育てる）。 */

export function sumAmounts(items) {
  return items.reduce((s, i) => s + (Number(i.amount ?? i.price) || 0), 0);
}

export function computeShoppingJudgment({ budget, balance, recurringItems, itemsToAdd }) {
  const recurringTotal = sumAmounts(recurringItems);
  const addTotal = sumAmounts(itemsToAdd);
  // 決まって買うものを先に確保したうえで、残額のうち自由に使える分
  const reserved = balance - recurringTotal;
  const remainingAfterAdd = reserved - addTotal;
  const safetyMargin = Math.max(budget * 0.1, 1000);

  let judgment;
  let message;
  if (addTotal === 0) {
    judgment = "empty";
    message = "追加したいものを入力すると、今回で大丈夫そうか一緒に見てみます。";
  } else if (remainingAfterAdd < 0) {
    judgment = "over";
    message = "このままだと、決まって買うものの分が少し足りなくなるかもしれません。次の買い物日まで見直した方が安心そうです。";
  } else if (remainingAfterAdd < safetyMargin) {
    judgment = "tight";
    message = "今回の分は追加できそうですが、次の買い物日までは少し余裕を残した方が安心です。";
  } else {
    judgment = "ok";
    message = "必要なものは整っています。今回の分を追加しても、安心してお買い物できそうです。";
  }

  return { recurringTotal, addTotal, reserved, remainingAfterAdd, safetyMargin, judgment, message };
}
