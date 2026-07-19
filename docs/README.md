# docs

## 構成

- `adr/`: Architecture Decision Records。技術的な意思決定の記録。
- `tasks.md`: タスクバックログ。機能アイデアと実装状況の管理。

## ADR の運用

- 新しい意思決定をしたら `adr/template.md` をコピーして連番で作成する。
- 一度書いた ADR は書き換えない。決定を覆す場合は新しい ADR を作り、古い方の Status を「Superseded by ADR-XXXX」に更新する。

## タスクの運用

- 思いついたアイデアは気軽に `tasks.md` に追加する。
- 実装したらチェックを付ける(PR へのリンクは任意)。
