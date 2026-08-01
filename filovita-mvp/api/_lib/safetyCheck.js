/* Butlerの発言の独立確認（docs/FILOVITA_PHILOSOPHY.md「家計相談の9条」
   第9条参照、2026-08-01の設計対話より）。

   発言を作った側の自己申告（例："containsInference"のような自己評価
   フラグ）には頼らない——推論している本人が「推論していません」と
   思い込むことがあるため、というのが利用者の指摘。かわりに、発言を
   作ったのとは別の独立したAI呼び出しが、渡された事実（台帳・会話履歴）
   だけを見て、その発言が本当に事実だけから導けるかを判定する。

   利用者の最終判断：この確認は「危ない言い回しの時だけ」ではなく、
   Butlerのすべての実質的な発言に対して行う（コストより安全性を優先する
   という明示的な判断）。判定に落ちた発言は、断定を弱めた言い換えに
   差し替えてから利用者に見せる。

   これはButlerを疑うための仕組みではなく、Butlerという役割——生活を
   預かる者としての責任——を守るための仕組み（利用者の言葉）。人間の
   執事が大切な約束や支払いを確認するのは能力が低いからではなく責任感が
   あるからで、この確認も同じ。「できるだけ答える」ではなく「生活に
   関わることは、確認した上で答える」——この違いこそがFilovitaの
   信頼の理由になる、というのが利用者の位置づけ。 */

import { callAI } from "./ai.js";

const VERIFY_SYSTEM_PROMPT = `あなたは、生活記録アプリ「Filovita」のバトラーが書いた発言案を検証する、
独立した安全確認の役目です。これはButlerを疑うためではなく、Butlerという
役割——生活を預かる者としての責任——を守るための確認です。人間の執事が
大切な約束や支払いを、能力が低いからではなく責任感があるから確認するのと
同じです。発言を書いた本人の自己申告は一切信用せず、渡された事実（現在の
生活の状況・これまでの会話）と発言案だけを見て、あなた自身で独立に
判定してください。

次のいずれかに当てはまる場合、その発言は安全ではありません：
1. 事実を作っていないか（渡された事実にない内容を、あったかのように
   話していないか）。
2. 記録されていないことを断定していないか（「きっと」「おそらく」
   「結果的には」「〜だったはずです」「どのみち」「だから」「結局」の
   ような、事実の言い換えではなく解釈・推測・因果関係を断定として
   話していないか）。
3. 結果論で利用者の経験を書き換えていないか（あとから振り返って
   「どうせ〜だった」のように、その時の利用者の経験や選択を、結果を
   知った今の視点で塗り替えていないか）。
4. 生活上の判断を、根拠なく誘導していないか（利用者がどう行動すべきかを、
   十分な根拠なしに示唆していないか）。
5. 利用者がこの発言を信じてそのまま行動したとして、本当にその根拠は
   十分か（発言の根拠が、渡された会話履歴・現在の生活の状況の中に
   実際に存在するか）。

一つでも当てはまれば安全ではないと判定してください。安全でない場合は、
断定を外した言い換え（例：「そこまでは断定できません」「〜かもしれま
せんが、確認が必要です」）を作ってください。元の発言の意味や、事実として
確認できている部分（残額の数字等）は勝手に変えず、断定の強さだけを
弱めてください。問題がなければ、発言案をそのままrevisedReplyに入れて
安全と判定してください。

必ず次のJSON形式だけを出力してください。説明文・前置き・コードブロックの
装飾（\`\`\`など）は一切付けないでください。

{"safe": true|false, "reason": "判定理由を一言で", "revisedReply": "safeがtrueなら発言案そのまま、falseなら断定を弱めた言い換え"}`;

const FALLBACK_REPLY =
  "今は安全確認をしながらお答えすることができませんでした。少し時間をおいてから、もう一度お試しください。";

function parseVerification(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.safe !== "boolean" || typeof parsed.revisedReply !== "string" || !parsed.revisedReply.trim()) {
      return null;
    }
    return { safe: parsed.safe, reason: typeof parsed.reason === "string" ? parsed.reason : "", revisedReply: parsed.revisedReply };
  } catch {
    return null;
  }
}

/**
 * draftReply（Butlerが作った発言案）を、それを作ったのとは独立した
 * AI呼び出しで検証する。factsBlockは家計相談の「現在の生活の状況」
 * ブロック（buildContextBlockの出力）、historyTextはこれまでの会話の
 * 読みやすいテキスト。
 *
 * 検証そのものが失敗した場合（AI呼び出しエラー、JSON解析失敗）は、
 * 「確認できなければ通さない」という側に倒す——チェックリストを完了
 * できないなら離陸しない、という第9条の原則をそのまま適用する。
 */
export async function verifyReply({ draftReply, factsBlock, historyText }) {
  const userMessage = `現在の生活の状況：
${factsBlock}

これまでの会話：
${historyText || "（なし）"}

検証する発言案：
${draftReply}`;

  const result = await callAI({
    systemPrompt: VERIFY_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 800,
    thinkingLevel: "low",
    temperature: 0.1,
  });

  if (result.error) {
    console.error("safetyCheck.verifyReply: 検証呼び出し自体が失敗:", result.error);
    return { safe: false, reason: "安全確認ができませんでした", revisedReply: FALLBACK_REPLY, verified: false };
  }

  const parsed = parseVerification(result.reply);
  if (!parsed) {
    console.error("safetyCheck.verifyReply: 検証結果のJSON解析に失敗:", result.reply);
    return { safe: false, reason: "安全確認の結果を読み取れませんでした", revisedReply: FALLBACK_REPLY, verified: false };
  }
  return { ...parsed, verified: true };
}

const VERIFY_VERDICT_SYSTEM_PROMPT = `あなたは、生活記録アプリ「Filovita」のバトラーが出した買い物の最終見立てを
検証する、独立した安全確認の役目です。これはButlerを疑うためではなく、
Butlerという役割——生活を預かる者としての責任——を守るための確認です。
見立てを作った本人の自己申告は一切信用せず、渡された事実と見立て案だけを
見て、あなた自身で独立に判定してください。

見立て案は、品目ごとの分類(category)・理由(reason)と、全体のまとめ
(summary)・重視したこと(focus)から成ります。分類(category)自体は
そのまま維持してください——分類を判定し直すのはあなたの役目では
ありません。確認するのは、理由・summary・focusの文章です。

次のいずれかに当てはまる文章は安全ではありません：
1. 事実を作っていないか（渡された事実にない内容を、あったかのように
   話していないか）。
2. 記録されていないことを断定していないか（「きっと」「おそらく」
   「結果的には」「〜だったはずです」「どのみち」「だから」「結局」の
   ような、事実の言い換えではなく解釈・推測・因果関係を断定として
   話していないか）。
3. 結果論で利用者の経験を書き換えていないか。
4. 生活上の判断を、根拠なく誘導していないか。
5. 利用者がこの文章を信じてそのまま行動したとして、本当にその根拠は
   十分か（文章の根拠が、渡された会話履歴・現在の生活の状況の中に
   実際に存在するか）。

安全でない文章があれば、断定を弱めた言い換えに直してください（分類・
品目名は変えない）。すべて問題なければ、元の見立てをそのまま
revisedVerdictに入れて安全と判定してください。

必ず次のJSON形式だけを出力してください。説明文・前置き・コードブロックの
装飾（\`\`\`など）は一切付けないでください。

{"safe": true|false, "reason": "判定理由を一言で", "revisedVerdict": {"items": [{"name": "品目名", "category": "now|later|priority|skip", "reason": "理由"}], "summary": "全体のまとめ", "focus": "重視したこと"}}`;

function parseVerdictVerification(text, fallbackVerdict) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    const rv = parsed.revisedVerdict;
    if (typeof parsed.safe !== "boolean" || !rv || !Array.isArray(rv.items) || rv.items.length !== fallbackVerdict.items.length) {
      return null;
    }
    return { safe: parsed.safe, reason: typeof parsed.reason === "string" ? parsed.reason : "", revisedVerdict: rv };
  } catch {
    return null;
  }
}

/**
 * shopping-final-verdict.jsの見立て(verdict: {items, summary, focus})を、
 * それを作ったのとは独立したAI呼び出しで検証する。verifyReplyと同じ
 * 第9条の原則を、品目ごとの構造化された見立てに適用したもの。
 * 検証自体が失敗した場合も、確認できない側に倒し、断定を含む可能性の
 * ある元の見立てをそのまま通さない。
 */
export async function verifyVerdict({ verdict, factsBlock, historyText }) {
  const userMessage = `現在の生活の状況：
${factsBlock}

これまでの会話：
${historyText || "（なし）"}

検証する見立て案：
${JSON.stringify({ items: verdict.items, summary: verdict.summary, focus: verdict.focus })}`;

  const result = await callAI({
    systemPrompt: VERIFY_VERDICT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 2000,
    thinkingLevel: "low",
    temperature: 0.1,
  });

  const fallbackVerdict = {
    items: verdict.items.map((i) => ({ name: i.name, category: i.category, reason: "安全確認ができなかったため、理由の表示を控えます。" })),
    summary: FALLBACK_REPLY,
    focus: "",
  };

  if (result.error) {
    console.error("safetyCheck.verifyVerdict: 検証呼び出し自体が失敗:", result.error);
    return { safe: false, reason: "安全確認ができませんでした", revisedVerdict: fallbackVerdict, verified: false };
  }

  const parsed = parseVerdictVerification(result.reply, verdict);
  if (!parsed) {
    console.error("safetyCheck.verifyVerdict: 検証結果のJSON解析に失敗:", result.reply);
    return { safe: false, reason: "安全確認の結果を読み取れませんでした", revisedVerdict: fallbackVerdict, verified: false };
  }
  return { ...parsed, verified: true };
}
