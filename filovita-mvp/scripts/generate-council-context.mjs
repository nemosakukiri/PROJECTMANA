/* 開発用「AI会議室」（v1）が読む「プロジェクトの記憶」を生成するスクリプト。
   docs/FILOVITA_PHILOSOPHY.md・LIFE_MODEL.md・MVP_SPEC.md・最新のWORKLOGを
   1つの文字列として束ね、api/_lib/councilContext.jsに書き出す。

   Vercelのサーバーレス関数は、実行時に任意のファイルを安定して読めるとは
   限らないため（バンドル対象になるファイルの決まり方に依存する）、ここで
   静的な文字列として焼き込む方式にした——ドキュメントを大きく更新したら、
   `node scripts/generate-council-context.mjs` を再実行して焼き直すこと。

   実行: node scripts/generate-council-context.mjs */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");
const filovitaRoot = path.join(__dirname, "..");

function readDoc(p) {
  return readFileSync(p, "utf-8");
}

const philosophy = readDoc(path.join(repoRoot, "docs", "FILOVITA_PHILOSOPHY.md"));
const lifeModel = readDoc(path.join(filovitaRoot, "docs", "LIFE_MODEL.md"));
const mvpSpec = readDoc(path.join(filovitaRoot, "docs", "MVP_SPEC.md"));

const worklogDir = path.join(repoRoot, "docs", "WORKLOG");
const latestWorklogFile = readdirSync(worklogDir)
  .filter((f) => f.endsWith(".md"))
  .sort()
  .at(-1);
const latestWorklog = readDoc(path.join(worklogDir, latestWorklogFile));

const context = `# Filovitaプロジェクトの記憶（AI会議室が読む共通資料）

これはFilovitaというアプリの開発プロジェクトです。あなたはこの資料を読んだ上で、
これから提示される議題について意見を述べます。

## 家計相談の憲法・設計哲学（docs/FILOVITA_PHILOSOPHY.md）

${philosophy}

## 生活カルテ・生活モデル（filovita-mvp/docs/LIFE_MODEL.md）

${lifeModel}

## MVP仕様書（filovita-mvp/docs/MVP_SPEC.md）

${mvpSpec}

## 直近の作業記録（docs/WORKLOG/${latestWorklogFile}）

${latestWorklog}
`;

const outPath = path.join(__dirname, "..", "api", "_lib", "councilContext.js");
writeFileSync(
  outPath,
  `/* 自動生成ファイル。scripts/generate-council-context.mjsで焼き直す。手で編集しない。 */\n\nexport const COUNCIL_CONTEXT = ${JSON.stringify(context)};\n`
);
console.log(`書き出し完了: ${outPath}（${context.length}文字）`);
