# 同梱フォント（サブセット済み）

scripts/fonts/build.mjs で fonts.gstatic.com から TTF を取り、src/i18n の文字 + 数字・記号・かな全部で pyftsubset した woff2。
文言を足したら `node scripts/fonts/build.mjs` を再実行する（pyftsubset と curl が要る）。

| ファイル | 書体 | 用途 | @font-face |
|---|---|---|---|
| kaisei-decol-700.woff2 | Kaisei Decol Bold | 見出し・タブ・判定・完走 | "Sankyu Display" |
| alfa-slab-one-400.woff2 | Alfa Slab One | 数字（欧文スラブ） | "Sankyu Numbers" |
| zen-kaku-gothic-new-400.woff2 / -700.woff2 | Zen Kaku Gothic New | 本文 | "Sankyu Text" |

ライセンスはいずれも SIL Open Font License 1.1（OFL.txt）。THIRD_PARTY_NOTICES.md にも記載。
