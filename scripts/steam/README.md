# SteamCMD アップロード

`pnpm steam:upload -- --branch beta` で `app_build.vdf` のテンプレートから
`out/steam/app_build.<branch>.vdf` を生成し、SteamCMD に渡す。
`--dry-run` を付けると vdf の生成だけで止まる。

- App ID / Depot ID は App ID 取得まで Spacewar（480 / 481〜483）のまま
- 認証は `STEAM_USERNAME`（と必要なら `STEAM_PASSWORD`）。CI では秘匿変数に置く
- `STEAMCMD` で steamcmd のパスを指定できる
