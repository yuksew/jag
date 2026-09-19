# 数値調整（tuning.override.json）

`src/core/tuning.ts` の値を、ビルドせずに外部 JSON で上書きする。開発モード（`pnpm dev`、または
本番ビルドで環境変数 `SANKYU_DEV=1`）でだけ有効。

## 置き場所

`userData/tuning.override.json`

- Windows: `%APPDATA%\sankyu\tuning.override.json`
- macOS: `~/Library/Application Support/sankyu/tuning.override.json`
- Linux: `~/.config/sankyu/tuning.override.json`

## 書き方

`tuning.ts` と同じ形で、変えたいキーだけ書く。

```json
{
  "beat": { "baseIntervalMs": 700, "baseToleranceMs": 160 },
  "clean": { "everyBeats": { "3": 20 } },
  "showcase": { "baseAt": 30 }
}
```

- 既存のキーに同じ型（number / boolean）の値がある場合だけ書き換える
- 無いキー・型違い・NaN は無視して、ログ（`userData/logs/`）に `rejected=` として出る
- 起動時に読み、ファイルを保存し直すと即座に反映される（トーストで件数が出る）。進行中のランには次のランから効く

## 反映の確認

- 練習場タブの「1拍 〜ms ／ 許容幅 ±〜ms」の表示が変わる
- ログに `tuning override applied=beat.baseIntervalMs,...` が出る
