# ADR-0005: 手作業ステージの定量指標を転用した自動生成とデイリーチャレンジ

- Status: Accepted
- Date: 2026-07-19

## Context

タスクバックログ(docs/tasks.md)に「難易度別マップの自動生成」「デイリーチャレンジ(日付シードで毎日同じマップを自動生成、全員共通)」があった。手作業ステージ(STAGE 01〜08)は ADR-0004 で定めた定量指標(×2マス全回避コストが par+1〜+6、crumble封鎖時コストが par+2以上、ワープ有無のコスト差3以内、crumbleは全CPからチェビシェフ距離2以上)によって「意味のある選択」が生まれるよう設計されている。単純にサイズやギミック数だけをランダム化しても、この「選択」が成立する保証はない(例: ×2マスが最短経路から外れた位置にランダム配置されると、迂回する理由がそもそも生まれない)。

## Decision

- ADR-0004 の定量指標をそのまま「生成 → 検証 → 合格したものだけ採用」というフィルタとして転用する(`src/game/metrics.ts` に `blockCells` / `blockedCost` / `chebyshev` を切り出し、`stages.test.ts` の設計ガードテストと `generator.ts` の両方から使う)。
- `generateStageDef(difficulty, seed)`(`src/game/generator.ts`)は `createRng(seed)` から決定的に、最大300回まで「迷路生成 → start/goal配置 → CP/warp/heavy/crumbleのランダム配置 → ソルバーで指標検証」を試行し、最初に全条件へ合格した定義を返す。上限まで合格しなければ throw する(＝プリセットが緩すぎ/厳しすぎるというシグナルとして扱う)。
- 生成効率を上げるため2つの工夫を入れている。
  - heavy/crumble の候補地から**関節点**(そのマスを取り除くと迷路が非連結になるマス、Tarjan法で列挙)を除外する。関節点に置くと「全て迂回/封鎖」の検証が必ず到達不能判定になり不合格が確定するため。
  - heavy/crumble の候補地は「ギミック無しでの最短ルート上のマス」を優先(必須ではなく優先ヒント)する。ADR-0004 の手作業ステージが「最短経路上に置く」設計だったのと同じ原理で、当選確率を上げる。
- 難易度は easy/normal/hard/extreme の4段階(`GENERATOR_PRESETS`)。パラメータ(盤面サイズ・braid確率・CP数・ワープ数・heavy数・crumble数・parの下限)は範囲指定で、サンプルシード(1〜100)で安定して合格することを `generator.test.ts` で確認している。
- デイリーチャレンジは `getDailySeed(date)` で UTC の日付を `YYYYMMDD` 形式の数値シードに変換し、`buildDailyStage(date)` が難易度 hard・id=100・label="DAILY" のステージを生成する。**UTC基準**にしているのは、プレイヤーのローカルタイムゾーンに依存すると「今日のデイリー」が人によってズレてしまうため。
- `ALL_STAGES`(`stages.ts`)は手作りステージ `STAGES` の末尾にその日のデイリーチャレンジを1つ加えたもので、UI側(`useGame.ts` / `App.tsx`)は `STAGES` の代わりにこれを参照する。
- `buildStage`(StageDef→Stage変換)は `stages.ts` から `build.ts` に切り出した。`generator.ts` が `buildStage` を使い、`stages.ts` が `generator.ts`(`buildDailyStage`)を使うため、両者が直接依存し合うと循環importになる。`build.ts` を挟むことで `stages.ts → generator.ts → build.ts` の一方向の依存関係にした。

## Consequences

- アプリのロード時(`stages.ts` のモジュール評価時)に `buildDailyStage` が実行され、最大300回の試行(迷路生成+ソルバー実行)が走る可能性がある。実測では1回あたり数msから十数ms程度で、ロード時間への影響は軽微だが、プリセットを緩めた場合など将来的に悪化する可能性はある。
- 生成される日によって難易度がブレる可能性がある(同じ hard プリセットでも par やギミック配置は日によって変わる)。これは「毎日変わる」というデイリーチャレンジの前提そのものであり許容するが、プリセットの `parMin` 等が実際の体感難易度と乖離していないかは今後プレイして調整が必要。
- 循環import自体は(関数宣言のホイスティングにより)動作するケースもあるが、生成器を単独のエントリポイントとして先に評価する経路(実際に `generator.test.ts` 追加時に発生)では `const` のTDZにより実行時エラーになることを確認した。`build.ts` への切り出しで構造的に解消したが、今後 `generator.ts` と `stages.ts` の依存関係を変更する際はこの循環に注意する必要がある。
- 300回の試行上限に達すると `generateStageDef` は例外を投げる(デイリーチャレンジの場合、その日のアプリがロードできなくなる)。`generator.test.ts` でサンプルシードの合格を継続的に検証しているが、プリセットを変更した場合は再度この検証が必要。
