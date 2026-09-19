# Steam リリース要件

Steam でリリースできる品質の定義と、そこまでのチェックリスト。
サイズ・仕様が変わりやすい項目は Steamworks ドキュメント（partner.steamgames.com/doc）を正とし、
ここには「何が必要か」だけを書く。

## 対象プラットフォーム

| 対象 | 成果物 | 備考 |
|---|---|---|
| Windows 10/11 x64 | electron-builder の dir 出力を depot に | インストーラは不要。Steam が展開する |
| macOS 12+ | universal（x64 + arm64）.app | 署名 + 公証（notarize）。Steam 経由でも Gatekeeper は動く |
| Linux x64 | dir 出力 | Steam Deck 向け。Proton ではなくネイティブ Linux 版を出す |

Electron の Linux ビルドがあるので、Steam Deck は Proton に頼らない。

## Steam 連携（steamworks.js）

- main プロセスで `init(appId)`。失敗しても（Steam 外起動、開発時）ゲームは動く
- `restartAppIfNecessary` は本番のみ
- `electronEnableSteamOverlay()` を main.js の末尾で呼ぶ。`disable-direct-composition` はゴースト窓の報告があるので、必要になるまで付けない
- Steamworks SDK の `redistributable_bin` からプラットフォームごとの `steam_api` ライブラリをビルドのルートに同梱する
- `steam_appid.txt` は開発時のみ。本番ビルドに含めない
- 実績: core の `achievements.ts` が発火 → IPC → `client.achievement.activate`。起動時に未同期分を再送
- 統計: 通算キャッチ、最長拍、完走時間を Steam Stats に。リーダーボードは初版では持たない
- Steam Cloud: Auto-Cloud（Steamworks 設定側でセーブディレクトリを指定）。API での手動同期はしない
- Rich Presence: 「3球 練習中」「見せ場」程度。初版で必須ではない
- スクリーンショット: Steam の F12 に任せる。Canvas のため撮れない場合は `screenshots.hook` で自前キャプチャ

App ID 取得前は Spacewar（480）で実績・オーバーレイ・Cloud の動作を確認する。

## Steam Deck 対応

- 既定の解像度 1280×800 で全 UI が読める（最小フォント 12px 相当）
- `SteamTenfoot` 環境変数がある場合は起動時に全画面
- ゲームパッド: Gamepad API。「投げる」= A ボタン（南）、タブ切り替え = LB/RB、決定/戻り = A/B。Steam Input のテンプレートを設定
- 初回起動でキーボード／マウス／パッドのどれで操作するかを聞かない。どれでも動く
- Deck Verified チェック項目（起動時のランチャー無し、パッド完結、テキスト可読性、既定解像度）を満たす

## 入力（拍ゲームとして必須）

- キーボード（Space / Enter）、マウス／タッチ、ゲームパッドを 1 つの「投げる」に束ねる
- **入力オフセット補正**: 設定画面にキャリブレーション（拍に合わせて 8 回叩き、平均遅延をオフセットとして保存）。表示遅延と入力遅延を分けない
- 拍の基準時刻は `AudioContext.currentTime`。描画は `requestAnimationFrame` で追従
- キー割り当て変更（最低限「投げる」だけ）

## 設定画面

- 表示: 全画面／ウィンドウ、解像度スケール（100/125/150%）、リデュースモーション
- 音: マスター、効果音、拍のクリック音のオン／オフ
- 入力: オフセット補正、キー割り当て
- 言語: ja / en
- セーブ: 削除（確認 2 段階）

## セーブ

- 保存先: `app.getPath('userData')/save/`。Steam Auto-Cloud はこのディレクトリを指す
- 形式: JSON、`version` 必須。読み込みは `migrate.ts` で旧版を順に上げる
- 書き込みは一時ファイル→rename。直前世代を `.bak` として 1 つ残す
- 破損時はエラー画面ではなく「前回のバックアップから復元しますか」を出す
- 自動保存: ラン終了時、アップグレード購入時、タブ切り替え時、終了時
- Steam 外でも（オフラインでも）完全に遊べる

## 品質

- 60fps 維持。7 球 + 見せ場でも描画 4ms 以内（Chromium の Performance で確認）
- 起動から練習場まで 3 秒以内
- ウィンドウのリサイズ、最小化、モニタ切替でランが壊れない（最小化中は自動で一時停止）
- 未処理例外はログに書き、ゲームを落とさない。ログは `userData/logs/`、7 日で削除
- テレメトリなし。外部通信なし（Steam SDK を除く）
- 本番で devtools 無効、メニューバー無し、Ctrl+R 無効

## ビルド／配信

- GitHub Actions で 3 OS マトリクスビルド。タグ push でパッケージ生成
- macOS: Apple Developer ID で署名、`notarytool` で公証。CI に証明書を秘匿変数で置く
- SteamCMD: `scripts/steam/app_build.vdf` と depot ごとの vdf。`pnpm steam:upload -- --branch <name>`
- ブランチ: `dev`（自分用）→ `beta`（テスター、パスワード付き）→ `default`
- バージョンは `package.json` の semver を一元管理。ゲーム内とビルド ID に同じ値を出す

## ストアページ（コード外だが同時進行）

- キャプセル画像各サイズ、スクリーンショット 5 枚以上、トレーラー（Steam は必須ではないが有った方が良い）
- 説明文 ja / en。ジャンルタグに Clicker / Idler / Minimalist / Short
- 年齢レーティング質問票、税務・銀行情報（Steam Direct）
- リリース 2 週間以上前にストアページを公開してウィッシュリストを集める

## リリース前チェックリスト

- [ ] Windows / macOS / Linux で新規インストールから完走までノーエラー
- [ ] Steam オーバーレイが 3 OS で開く
- [ ] 実績が解除され、Steam クライアントに通知が出る
- [ ] Cloud セーブが別 PC で復元される
- [ ] Steam Deck 実機（または 1280×800 + パッドのみ）で完走できる
- [ ] Steam オフラインモードで起動・保存できる
- [ ] 入力オフセット補正を通した後、拍がずれない
- [ ] 旧バージョンのセーブが最新で読める（テスト用に各版のセーブを保管）
- [ ] macOS 公証済みで、初回起動に警告が出ない
- [ ] 本番ビルドに `steam_appid.txt`、devtools、ソースマップが無い
- [ ] ライセンス表記（Electron、steamworks.js、Steamworks SDK、フォント）
