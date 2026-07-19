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
- RESET でやり直し、HINT で現在地からの最短ルートを表示

## ディレクトリ構成

```
src/
├── game/          # ゲームロジック(純粋関数・UI非依存・テスト対象)
│   ├── types.ts   # 型定義
│   ├── rng.ts     # シード付き乱数
│   ├── maze.ts    # 迷路生成(再帰バックトラック法)
│   ├── solver.ts  # 最短経路探索(Dijkstra、ワープ・チェックポイント・2倍マス対応)
│   ├── score.ts   # スコア・ランク算出
│   └── stages.ts  # ステージ定義(par/limit はソルバーから自動算出)
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
