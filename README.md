# pazzle

2D迷路パズルゲーム(開発中)。

スタートからゴールを目指すシンプルな迷路をベースに、歩数スコア・チェックポイント・ワープなどのギミックを追加していく。

**公開URL**: https://panda1729.github.io/pazzle/ (mainへのマージで自動デプロイ)

## 技術スタック

- React 19 + TypeScript
- Vite(開発サーバー / ビルド)
- Vitest(ゲームロジックのユニットテスト)
- ESLint

## セットアップ・ローカル動作確認

前提: Node.js 24(LTS)。nvm を使う場合はリポジトリ直下で以下を実行。

```bash
nvm use   # .nvmrc のバージョンに切り替え(未導入なら nvm install)
```

起動手順:

```bash
npm install
npm run dev
```

ブラウザで http://localhost:5173/pazzle/ を開く(GitHub Pages のサブパス配信に合わせて base を `/pazzle/` にしているため)。

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー起動(HMR あり) |
| `npm run build` | 型チェック + プロダクションビルド(`dist/`) |
| `npm run preview` | ビルド結果のローカル確認 |
| `npm test` | ユニットテスト実行 |
| `npm run test:watch` | テストのウォッチ実行 |
| `npm run lint` | ESLint 実行 |

## 遊び方

- 矢印キー / WASD で移動(画面の D-Pad でも可)
- **PAR**(最短手数)以下でクリアすると S ランク(1000pt)
- 歩数が **LIMIT** に達すると失敗
- **CHECKPOINT** は全て通らないとゴールできない
- **W** マスに踏み込むとワープ
- **×2** マスに踏み込むと歩数カウントが2増える
- **CRUMBLE** マスは指定回数までしか踏めない。踏むたびに回数が減り、0になると穴になる
- **BOMB** マスは見えない爆弾。踏むと即失敗。爆弾に隣接するマスには隣接数の数字が常時表示されるので、マインスイーパーの要領で推理して避ける
- 行列制限ステージ(STAGE 10 など)は盤面の上端・左端に各行・各列へあと何回進入できるかが常時表示される。イラストロジックの要領で、残り回数を使い切らないよう配分を考えながら進む。0になった行・列にはそれ以上進入できない
- 一筆書きモード(STAGE 06 など)は全マスをちょうど1回ずつ踏破してゴールするとクリア。訪問済みマスには戻れず、移動できなくなると失敗
- **DAILY** は毎日変わる自動生成ステージ(UTC日付シードのため全プレイヤー共通)
- RESET でやり直し、HINT で現在地からの最短ルートを表示(一筆書きモードでは利用不可)
- **COPY LINK** で今のステージを開けるURLをコピーでき、クリア・失敗時は **COPY RESULT** / **POST X** でランク・歩数をテキストコピー/X共有できる

## ディレクトリ構成

```
src/
├── game/          # ゲームロジック(純粋関数・UI非依存・テスト対象)
│   ├── types.ts   # 型定義
│   ├── rng.ts     # シード付き乱数
│   ├── maze.ts    # 迷路生成(再帰バックトラック法)
│   ├── solver.ts  # 最短経路探索(Dijkstra、ワープ・チェックポイント・2倍マス対応)
│   ├── score.ts   # スコア・ランク算出
│   ├── metrics.ts # ステージ設計の定量指標(設計ガードテスト・自動生成の合否判定で共用)
│   ├── build.ts   # StageDef → Stage 変換(par/limit の自動算出)
│   ├── generator.ts # 難易度別ステージ自動生成・デイリーチャレンジ
│   └── stages.ts  # 手作りステージ定義 + ALL_STAGES(デイリー込み一覧)
├── hooks/
│   └── useGame.ts # ゲーム状態管理(useReducer)
├── components/    # UIコンポーネント
├── App.tsx
├── main.tsx
└── styles.css
```

## ドキュメント

- タスクバックログ: [docs/tasks.md](docs/tasks.md)
- 技術的な意思決定の記録(ADR): [docs/adr/](docs/adr/)
