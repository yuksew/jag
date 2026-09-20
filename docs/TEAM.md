# 担当エージェントと、外に任せる作業

「一般的なゲームの見た目・音・手触り」に近づけるために、作業を担当ごとに分ける。
コードで完結する担当は `.claude/agents/` のエージェント定義で回し、
Claude Code では品質が出ない・確認できない作業は人間かほかのツールに任せる。

## Claude Code のエージェント（`.claude/agents/`）

| 名前 | 担当 | 触るファイル | 呼び方 |
|---|---|---|---|
| `graphics` | Canvas の絵と演出（ジャグラー、球・クラブの陰影、背景、軌跡、パーティクル） | `src/render/**`、`src/assets/**` | `@graphics 見せ場のスポットライトを強くして` |
| `ui` | DOM / CSS / アイコン / メーター / トースト / 設定画面 | `src/style.css`、`index.html`、`src/ui/**`、文言の追加 | `@ui 身体タブのカードを 1280×800 で 2 列に` |
| `sound` | Web Audio で合成するクリック・判定音・ジングル・環境音 | `src/audio/**` | `@sound drop の音を重く` |
| `art-director` | スクリーンショットを見て、画面ごとの差と優先順位を出す。コードは触らない | なし | `@art-director /tmp/sankyu-shots の 10 枚をレビューして` |

運用のルール:

- 担当ファイルを重ねない。3 つを同時に走らせられる
- 各担当は `pnpm typecheck && pnpm lint && pnpm test && pnpm compile` と `tests/shots.mjs` のスクリーンショットで自分の変更を確認する
- コミットは統合役（このセッション）が行い、`main` に push するとビルドが走る
- 数値調整（拍の間隔や許容幅）は担当外。`docs/TUNING.md` の手順で人間が触る

## Claude Code では難しいので外に任せる作業

| 作業 | なぜ難しいか | 任せ先の案 | 受け渡し |
|---|---|---|---|
| キービジュアル、ストアのカプセル画像、ジャグラーのキャラクターデザイン | 絵柄の統一と「絵としての魅力」は生成では品質が安定しない。Steam の第一印象を決める | イラストレーターに発注（Skeb / Coconala / ArtStation）、または画像生成（Midjourney、Stable Diffusion、Adobe Firefly）を「イラストレーター」として使う。キャラクターは `docs/CHARACTER.md` の設定とプロンプトで方向出し | `docs/ART.md` の一覧とサイズ。納品は SVG またはフルカラー PNG（2 倍解像度）。`src/assets/game/` に置けば `graphics` が組み込む |
| 球・クラブ・手・背景の最終仕上げ | `graphics` が作る SVG は「それらしい」止まり。質感と統一感は人の手が要る | 同上のイラストレーター、またはピクセルアート／ベクター専門のデザイナー | 同上 |
| UI アイコン一式（通貨 4、タブ 7、系統 5、鍵） | 単色アイコンは `ui` が作れるが、太さ・角の統一と可読性の詰めは専門領域 | アイコンデザイナー、または既存アイコン集（Lucide、Tabler、Phosphor: MIT）から選んで揃える | `src/ui/icons.ts` にインライン SVG（currentColor）。ライセンス表記を `THIRD_PARTY_NOTICES.md` に |
| BGM（練習場、路上、舞台、完走） | Web Audio の合成では「曲」にならない。無音でも成立する設計だが、ストア動画と完走の場面には要る | 作曲家に発注（BOOTH / Coconala / Fiverr）、または音楽生成（Suno、Udio）で仮曲 → 商用ライセンス確認 | OGG / MP3 を `src/assets/audio/` に。`sound` が再生と音量、設定のオン／オフを組み込む |
| 効果音の最終版（拍手、観客、クラブの木の音） | 合成音は軽くて調整しやすいが、本物の質感は録音に勝てない | 効果音ライブラリ（Freesound: CC 表記、Sonniss GDC Bundle、Zapsplat）から選ぶ | 同上。合成音はフォールバックとして残す |
| 実機テスト（Windows / macOS / Steam Deck / ゲームパッド / Steam オーバーレイ / 実績通知 / Cloud） | このコンテナには Steam も Windows / macOS も実機も無い | 自分の PC と Steam Deck。`docs/RELEASE_CHECK.md` の「実機でやること」の順で | 落ちた項目をそのまま Claude Code に渡す。ログは `userData/sankyu/logs/` |
| プレイテストと数値調整（3〜4 時間で完走するか、3 球 30 分の目安） | 手触りは実際に投げないと分からない。テレメトリ無しの方針なので、感想と `save.json` が頼り | 自分 + 数人のテスター。`docs/TUNING.md` の override で場で調整 | 感想と各人の `save.json`（`totalCatches` / `runs` / `playMs` / 到達球数）を渡す |
| 英語文言の校正 | `en.ts` は直訳寄り。ジャグリング用語（siteswap、cascade、fountain）の慣用と、短い UI 文の自然さ | 英語ネイティブでジャグリングを知っている人（IJA / r/juggling）に読んでもらう | `src/i18n/en.ts` を直接直してもらう。形は `ja.ts` と同じ |
| ストアページの文章・タグ・年齢レーティング・Steam Direct の手続き | Steamworks の画面操作と、法務・税務の入力 | 自分で行う。文章の下書きは Claude Code に頼める | ストア説明文 ja / en の下書きを `docs/STORE.md` に |
| トレーラー | 動画編集と音楽の同期 | 動画編集（DaVinci Resolve、CapCut）。素材の録画は `tests/shots.mjs` を拡張して Playwright で 60fps 録画できる | 30〜60 秒。BGM 完成後 |
| アクセシビリティ確認（色覚、リデュースモーション、文字サイズ） | 色覚シミュレーションと実際の見え方は目視が要る | 色覚シミュレータ（Sim Daltonism、Chrome DevTools の Rendering → Emulate vision deficiencies）で確認 | 指摘を `ui` / `graphics` に渡す |

## 進め方

1. まず `graphics` / `ui` / `sound` で「コードで届く範囲」を上げる（このセッションで実施）
2. `art-director` にスクリーンショットをレビューさせ、残る差を「コードで直せる」「素材が要る」に分ける
3. 素材が要るものは上の表の任せ先へ。`docs/ART.md` のサイズと形式で受け取る
4. 素材が入ったら `graphics` / `ui` / `sound` に組み込みを頼む。フォールバック（素材無しでも動く）は残す
