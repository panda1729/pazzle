# ADR-0003: GitHub Pages で公開する

- Status: Accepted
- Date: 2026-07-19

## Context

ブラウザゲームとして無料で公開したい。アプリは静的サイト(ADR-0001)なのでサーバーは不要。候補は GitHub Pages / Cloudflare Pages / Netlify / Render など。Heroku は無料枠が廃止済みで対象外。

制約: GitHub Pages は無料プランでは public リポジトリでのみ使える。

## Decision

- リポジトリを **public に変更**し、**GitHub Pages** で公開する。
  - URL: https://panda1729.github.io/pazzle/
- デプロイは GitHub Actions(`.github/workflows/deploy.yml`)で行い、main への push で自動的にテスト → ビルド → 公開する。
- Vite の `base` を `/pazzle/` に設定する(Pages がサブパス配信のため)。
- あわせて PR 用の CI(`.github/workflows/ci.yml`)で lint・テスト・ビルドを検証する。

Cloudflare Pages / Netlify は外部サービスとのアカウント連携が必要になるため、リポジトリと同じ GitHub 内で完結する Pages を選んだ。

## Consequences

- ソースコードが公開される。秘密情報(APIキー等)は今後もリポジトリに置けない。
- main にマージすれば自動で本番反映される。公開を止めたい場合はリポジトリ設定から Pages を無効化する。
- 独自ドメインや SSR が必要になったら、その時点で移行先を検討する(ADR を追加)。
