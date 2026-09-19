# リリース前チェックリストの確認結果

`docs/STEAM.md` の「リリース前チェックリスト」を上から順に確認した結果。
このコンテナには Steam クライアントも Windows / macOS も無いので、実機でしか通せない項目は「未確認」として残す。

| # | 項目 | 結果 | 根拠・残作業 |
|---|---|---|---|
| 1 | Windows / macOS / Linux で新規インストールから完走までノーエラー | **一部** | Linux: Playwright で新規 userData から 7 球のショー成立（完走）まで確認。Windows / macOS: CI でパッケージは作れるが起動は未確認 |
| 2 | Steam オーバーレイが 3 OS で開く | **未確認** | `in-process-gpu` と再描画の維持は実装済み。Spacewar（480）で実機確認が要る |
| 3 | 実績が解除され、Steam クライアントに通知が出る | **未確認** | core → IPC → `achievement.activate` の経路は実装済み。Spacewar 用の対応表（ACH_WIN_ONE_GAME など）で確認する。起動時に解除済みを再送する |
| 4 | Cloud セーブが別 PC で復元される | **未確認** | Steamworks の Auto-Cloud に次を設定する: Windows `%APPDATA%/sankyu/save`（ルート WinAppDataRoaming、サブ `sankyu/save`）、macOS `MacAppSupport` + `sankyu/save`、Linux `LinuxHome` + `.config/sankyu/save` |
| 5 | Steam Deck 実機（または 1280×800 + パッドのみ）で完走できる | **未確認** | 1280×800 は既定のウィンドウサイズ。パッドは A / LB / RB / B を実装。`SteamTenfoot` で全画面。最小フォントは 12px。実機で確認する |
| 6 | Steam オフラインモードで起動・保存できる | **未確認（設計上は可）** | Steam 不在でも no-op で動くことは確認済み。オフラインモードの Steam でも同じ経路 |
| 7 | 入力オフセット補正を通した後、拍がずれない | **一部** | 補正値の計測（8 回叩いて平均）と適用（入力時刻から引く）は実装・自動確認済み。体感は実機で |
| 8 | 旧バージョンのセーブが最新で読める | **通る** | `tests/saves/` に v0（試作）〜 v6 の実セーブを保管し、`saves.test.ts` で全版の移行を確認 |
| 9 | macOS 公証済みで、初回起動に警告が出ない | **通らない** | Secrets（`MAC_CSC_LINK` / `MAC_CSC_KEY_PASSWORD` / `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`）が未設定。揃えば build.yml が署名と `notarytool` 公証を行う |
| 10 | 本番ビルドに `steam_appid.txt`、devtools、ソースマップが無い | **通る** | Linux の dir 出力で確認: `steam_appid.txt` 無し（`files` で除外、開発時は cwd にだけ書く）、`devTools: false`（packaged）、`.map` 無し。steam.yml でもアップロード前に検査する |
| 11 | ライセンス表記（Electron、steamworks.js、Steamworks SDK、フォント） | **通る** | `THIRD_PARTY_NOTICES.md` を `resources/` に同梱。フォントは同梱していない旨を記載 |

## 実機でやること（順番）

1. Windows / macOS で `pnpm build:win` / `build:mac` の出力を起動し、3 球から完走まで（#1）
2. Steam クライアントにログインした状態で dir 出力を直接起動（`steam_appid.txt` は開発時のみ書かれるので、本番出力では Steam から起動するか、確認用に手で置く）。オーバーレイ（Shift+Tab）と実績通知（#2, #3）
3. Steamworks で App ID 取得後: `electron/steam.ts` の `STEAM_APP_ID` と `scripts/steam/*.vdf` の ID を差し替え、実績・統計・Rich Presence の API 名を定義。Auto-Cloud のパスを設定（#4）
4. Steam Deck に dev ビルドを送って完走（#5）。Deck Verified の項目（ランチャー無し、パッド完結、可読性、既定解像度）を同時に見る
5. Steam をオフラインモードにして起動・保存（#6）
6. 補正後に 3 球 30 拍を体感で（#7）
7. Apple Developer ID の証明書と Team ID を Secrets に入れ、build.yml を再実行。初回起動の警告が出ないことを見る（#9）

## ストアページ（コード外）

- カプセル画像、スクリーンショット 5 枚以上、トレーラー: `docs/ART.md` の順番で M4 の最初に着手
- 説明文 ja / en、タグ（Clicker / Idler / Minimalist / Short）、年齢レーティング、Steam Direct の手続き
- リリース 2 週間以上前にストアページを公開
