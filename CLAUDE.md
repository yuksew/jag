# 三球（sankyu）

ジャグリングを題材にした短編インクリメンタルゲーム。Nodebuster 型の有限構造（3〜4時間で完走）。
**最終目標は Steam でのリリース**（Windows / macOS、Steam Deck 向けに Linux も）。
仕様の正は `docs/DESIGN.md`、リリース要件の正は `docs/STEAM.md`。

## 技術スタック

- Electron（最新安定版）+ Vite + TypeScript（strict）
  - Tauri は Steam オーバーレイが動かず Proton で WebView2 が無いため不採用。変更しない
- 描画は Canvas 2D。フレームワーク不使用（UI が増えたら検討）
- 音は Web Audio API（拍のクリック音、判定音）。拍のタイミング基準は AudioContext.currentTime
- Steam 連携: `steamworks.js`（main プロセスで init、renderer へは preload 経由の IPC で公開）
- ビルド／パッケージ: electron-builder
- テスト: Vitest（core）、Playwright（起動スモークのみ）
- パッケージマネージャ: pnpm

## コマンド

- `pnpm install`
- `pnpm dev` — 開発起動（Vite + Electron）
- `pnpm test` — 単体テスト
- `pnpm smoke` — 起動スモーク（`pnpm compile` の後。ヘッドレスは `xvfb-run -a`）
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint`
- `pnpm build` — 全プラットフォームのパッケージ（CI 用）
- `pnpm build:win` / `pnpm build:mac` / `pnpm build:linux`
- `pnpm steam:upload -- --branch beta` — SteamCMD で depot をアップロード（`scripts/steam/`）

## ディレクトリ

```
src/
  core/        ゲームの中核。DOM / Electron / Canvas / Audio に依存しない純粋 TS
    state.ts       セーブされる状態と初期値。version を持つ
    patterns.ts    サイトスワップ定義
    tree.ts        スキルツリー定義と派生値
    beat.ts        拍のスケジューリングと判定（clean / wobble / drop）
    run.ts         1ランの進行（投げ・落球・見せ場・通貨付与）
    milestones.ts  記録帳
    prestige.ts    球数追加の条件と適用
    achievements.ts 実績の定義と発火条件（Steam に依存しない）
    migrate.ts     セーブのバージョン移行
    tuning.ts      調整用の定数を全部ここに集める
    override.ts    開発モードで tuning を外部 JSON から上書き
    club.ts        クラブ（回転数）の解放と選択
    street.ts      路上（キャッチ→拍手の変換、見せたパターン）
    passing.ts     パッシング（相方の拍、パス割合）
    stage.ts       舞台（ショーの条件と成立 = 完走）
    seal.ts        封印（犠牲型コスト）と初期疲労
    tabs.ts        タブの解放条件
    types.ts       Rng / Hand / Verdict など共有の型
    index.ts       core の公開面（他層はここから import）
  render/      Canvas 描画。core の状態を読むだけで書き換えない
    arena.ts       練習場（球・クラブ・手・相方・拍の輪・状態文字）
  audio/       拍のクリック、判定音、音量
    clock.ts       拍の基準時刻（AudioContext.currentTime。無ければ performance.now）
    index.ts       Web Audio で合成するクリックと判定音
  ui/          タブ・ツリー・記録帳・設定画面の DOM
    pane.ts        右側のタブ（練習場・身体・記録帳・クラブ・路上・パッシング・舞台）
    settings.ts    設定画面（表示・音・入力・言語・セーブ削除）
    hud.ts / toast.ts / dialog.ts / dom.ts
  input/       キーボード／マウス／ゲームパッド（Gamepad API）を 1 つの「投げる」に束ねる。入力オフセット補正
    index.ts       キー（設定で変更可）とポインタ
    gamepad.ts     Gamepad API の poll。A = 投げる、LB / RB = タブ、B = 戻る
    calibrate.ts   拍に合わせて 8 回叩き、平均遅延を出す純粋ロジック（テストあり）
  i18n/        ja / en の文言。起動時に設定から選ぶ。切替は再読み込み
  platform/    Electron 依存（セーブファイル、設定、ウィンドウ、Steam ブリッジの renderer 側）
    steam.ts       実績・統計・Rich Presence を main に送る
  main.ts
electron/
  main.ts      main プロセス。Steam init、ウィンドウ、オーバーレイ有効化、セーブ IO
  preload.ts   contextBridge で renderer に公開する API
  api.ts       preload が公開する API の型（src/platform と共有）
  save.ts      セーブファイルの IO（一時ファイル→rename、.bak を 1 世代）
  settings.ts  設定ファイル（userData/settings.json）の IO
  log.ts       userData/logs への追記ログ。7 日で削除
  steam.ts     steamworks.js の薄いラッパ。Steam 不在（Steam 外起動・開発時）でも落ちない。core の実績 id → Steam API 名の対応表
  tuning.ts    開発モードで userData/tuning.override.json を読み、変更を renderer に流す
scripts/steam/ SteamCMD 用の app_build / depot_build vdf と upload スクリプト
.github/workflows/build.yml  main / タグで 3 OS ビルド（macOS は Secrets があれば署名・公証）
.github/workflows/steam.yml  手動実行で SteamCMD アップロード
tests/smoke.mjs Playwright による起動スモーク（`pnpm smoke`）
tests/shots.mjs 主要画面のスクリーンショット撮影（`xvfb-run -a env SHOTS_OUT=<dir> node tests/shots.mjs`）
.claude/agents/ 担当エージェント（graphics / ui / sound / art-director）。運用は docs/TEAM.md
docs/DESIGN.md 設計書
docs/STEAM.md  Steam リリース要件とチェックリスト
docs/PROMPTS.md Claude Code への指示（マイルストーンごと）
docs/PROTOTYPE_DIFF.md 試作と DESIGN.md の差分表
docs/PORT_CHECK.md 試作と移植版の挙動比較手順
docs/TUNING.md 数値調整の手順（tuning.override.json）
docs/ART.md    画像差し替えの計画
docs/CHARACTER.md 主人公（案 B）の設定・表情・パーツ分割・画像生成 AI 向けプロンプト。参考シートは docs/art/
docs/DECISIONS.md 設計判断の記録（未決事項への回答）
docs/RELEASE_CHECK.md リリース前チェックリストの確認結果
docs/TEAM.md   担当エージェントと、外に任せる作業（キービジュアル、音楽、実機テストなど）
reference/prototype.html  単一ファイルの試作。ここから移植する
```

## ルール

- `src/core` は `window` / `document` / `performance.now()` / `AudioContext` を直接参照しない。時刻は引数で受け取る
- 数値定数は `tuning.ts` に集約。関数の中に直書きしない
- 状態変更は core の関数経由。render / ui / audio は状態を読むだけ
- Steam は「あれば使う」。`steam.ts` は Steam 不在時にすべて no-op を返し、ゲーム本体は Steam の有無を知らずに動く
- 実績は core の `achievements.ts` で判定し、platform 層が Steam に転送する。core に Steam の ID を書かない
- セーブは `version` 付き。読み込みは `migrate.ts` を必ず通す。書き込みは一時ファイル→rename の原子的置換、直前世代を 1 つ残す
- renderer で `nodeIntegration` は使わない。`contextIsolation: true` + preload。steamworks.js は main プロセスにだけ置く
- 本番ビルドで devtools を開かない。`console.log` を残さない（ロガー経由）
- 文言は `i18n/` に置き、UI に直書きしない（日本語が正、英語は後追い）
- コミットは小さく。移植は「core の分離 → 描画 → UI → セーブ → 音 → 入力 → Steam」の順

## マイルストーン

1. **移植** — 試作と同じ挙動が Electron ウィンドウで動き、`beat.ts` に Vitest がある
2. **本編** — `docs/DESIGN.md` の 7 球完走まで実装。数値調整用に `tuning.ts` を外部 JSON で上書きできる開発モード
3. **リリース品質** — 設定画面、入力オフセット補正、ゲームパッド、ja/en、セーブの堅牢化、音
4. **Steam** — `docs/STEAM.md` のチェックリストを全部通す。App ID 取得前は Spacewar（480）で動作確認

## 進め方（初回）

1. `reference/prototype.html` を読み、`docs/DESIGN.md` と突き合わせて差分を列挙する
2. Electron + Vite + TypeScript のプロジェクトを初期化する（electron-builder まで含める）
3. 試作のロジックを `src/core` に分解し、`beat.ts` の判定に Vitest を書く
4. Canvas 描画と UI を移植し、試作と同じ挙動で動くところまで持っていく
5. セーブを `electron/main.ts` 経由のファイル保存に置き換える
6. ここで一度止まって構成を見せる
