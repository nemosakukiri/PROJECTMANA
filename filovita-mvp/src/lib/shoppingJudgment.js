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

/* 「今日の買い物」画面の最終見立て。相談の過程で出す暫定的な見立てとは違い、
   利用者が「結局このまま買っていいの？」に迷わず答えられる、断定的な結論を返す。
   go：この内容で行っていい／remove：これを外せば行ける／skip：今日は見送るべき。 */
export function computeFinalVerdict({ budget, balance, recurringItems, itemsToAdd }) {
  const recurringTotal = sumAmounts(recurringItems);
  const addTotal = sumAmounts(itemsToAdd);
  const reserved = balance - recurringTotal;
  const remainingAfterAdd = reserved - addTotal;
  const safetyMargin = Math.max(budget * 0.1, 1000);

  if (recurringItems.length === 0 && itemsToAdd.length === 0) {
    return { tone: "empty", message: "まだ何も選ばれていません。買うものを選ぶと、最終的な見立てをお伝えします。" };
  }

  if (reserved < 0) {
    return { tone: "skip", message: "決まって買うものだけで予算を超えてしまいそうです。今日は見送りがおすすめです。" };
  }

  if (remainingAfterAdd < 0) {
    // 今回追加したいものの中で最も金額が大きいものを外せば収まるかを見立てる
    const priciest = [...itemsToAdd].sort(
      (a, b) => (Number(b.amount ?? b.price) || 0) - (Number(a.amount ?? a.price) || 0)
    )[0];
    return {
      tone: "remove",
      message: priciest ? `今回は${priciest.name}を外した方が安心です。` : "今回はいくつか見送った方が安心です。",
    };
  }

  if (remainingAfterAdd < safetyMargin) {
    return { tone: "go", message: "この内容で買い物へ行って大丈夫そうです。ただ、次回までは少し余裕をみておくと安心です。" };
  }

  return { tone: "go", message: "この内容で買い物へ行って大丈夫そうです。" };
}
