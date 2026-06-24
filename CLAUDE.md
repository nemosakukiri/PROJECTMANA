# CLAUDE.md — PROJECT MANA 運用ルール

## 基本原則

**ユーザーは技術的な手作業を一切しない。**

APIキー・アクセス権はすべて渡してある。  
「コードを貼り付けてください」「ボタンを押してください」は原則禁止。  
できないことがあれば、作業を始める前に明示する。

---

## GAS（Google Apps Script）に関するルール

### GASの構造（必ず把握してから触る）

GASプロジェクトID：`1E81FSnKqj3FYn1qXYswU5PrHo9q4ARBHCR4FuZWtI8fAC19RNKikNE1L`

現在のファイル構成：
- `コード.gs` — メインロジック（gas_main.gs と対応）
- `survey_receiver.gs` — データ配信API。**doGet はここが正式**
- `feedback_receiver.gs` — フィードバック受信。doGet あり（status: ok を返すのみ）
- `citizen voice receiver.gs` — 市民の声受信。doGet あり（status: ok を返すのみ）
- `karte_generator.gs`
- `exploration_tags.gs`
- `Index.html`

### doGet に関するルール（2026-06-24 事故より）

- **doGet は `survey_receiver.gs` のものが正式。触らない。**
- `コード.gs`（gas_main.gs）に doGet を追加してはならない。
- GASプロジェクトに同名関数が複数存在すると実行エラーになる。
- GASを変更する前に必ず `download_file_content` で現在の全ファイルを確認する。

### GAS変更の手順

1. `mcp__Google_Drive__download_file_content` でプロジェクト全体を取得
2. 変更対象ファイルの現在の内容を確認
3. 既存の関数名と衝突しないか確認
4. **変更はユーザーに依頼せず、可能な手段を探す**
5. どうしてもユーザー操作が必要な場合は：
   - 1操作に絞る
   - 何をどこで押すか画面上の位置まで具体的に伝える
   - 「これだけ」と明示する

### Google Drive MCP の制限

- `download_file_content` — 読み取り可
- `create_file` — 新規作成のみ（既存ファイルの更新不可）
- GASファイルの直接更新ツールは現時点で存在しない

---

## Vercel に関するルール

- 本番環境（projectmana.vercel.app）は `main` ブランチから自動デプロイ
- 開発ブランチの変更は `main` にマージしてから push する
- push 後は Vercel の deployment が完了するまで待ってから確認する

---

## セッション間の申し送りルール

- 毎回 `docs/WORKLOG/YYYY-MM-DD.md` を作成する
- 事故・失敗は必ず記録する（隠さない）
- 「できる」と申し送った内容が次セッションで再現できるか確認してから作業開始
- GASの状態（どのファイルに何があるか）はセッション開始時に必ず `download_file_content` で確認

---

## 2026-06-24 事故の記録

### 何が起きたか

1. `コード.gs` に `doGet` 関数を追記した
2. すでに `survey_receiver.gs` に doGet が存在していた
3. GASプロジェクトに同名関数が複数になり、実行エラー（403）が発生
4. 観測DB（410件）が表示されなくなった
5. 復旧のためにユーザーに複数回の手作業を依頼してしまった

### 根本原因

- GASプロジェクト全体の構造を確認せずに関数を追加した
- 「doGetがない」と判断したのはGitHubのgas_main.gsだけを見たから
- 実際のGASプロジェクトには複数のファイルがある

### 再発防止

- GAS変更前は必ず全ファイルを `download_file_content` で確認する
- 同名関数がないか必ず検索してから追加する
- doGet は `survey_receiver.gs` のものを正式とし、他のファイルには書かない
