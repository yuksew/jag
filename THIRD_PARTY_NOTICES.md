# Third-party notices / ライセンス表記

三球（sankyu）は次のソフトウェアを含む、または利用しています。

| ソフトウェア | ライセンス | 備考 |
|---|---|---|
| Electron | MIT | パッケージ内の `LICENSE.electron.txt` |
| Chromium とその依存 | 各種 | パッケージ内の `LICENSES.chromium.html` |
| Node.js | MIT | Electron に同梱 |
| steamworks.js | MIT | https://github.com/ceifa/steamworks.js |
| Steamworks SDK（steam_api） | Valve Corporation の Steamworks SDK Access Agreement に基づく | `steamworks.js/dist/` に同梱される再配布可能バイナリ。「Steam」「Steamworks」は Valve Corporation の商標です |
| electron-vite / Vite / TypeScript ほか開発時依存 | MIT 等 | 配布物には含まれない |

## フォント（同梱）

次のフォントを SIL Open Font License 1.1 のもとでサブセット化して同梱しています（`src/assets/fonts/`。ライセンス本文は同じ場所の `OFL.txt`）。
改変版（サブセット。文言に出る文字 + 数字・記号・かな）のため、ファミリー名は "Sankyu Display" / "Sankyu Numbers" / "Sankyu Text" に付け替えています。元のフォント名は表示や配布名に使いません。

| フォント | 著作権 | ライセンス | 用途 | 同梱名 |
|---|---|---|---|---|
| Kaisei Decol (Bold) | Copyright 2020 The Kaisei Project Authors (https://github.com/Font-Kai/Kaisei) | OFL 1.1 | 見出し・タブ・判定・完走 | Sankyu Display |
| Alfa Slab One | Copyright 2016 The Alfa Slab One Project Authors (http://www.jmsole.cl \| info@jmsole.cl), Reserved Font Name "Alfa Slab" | OFL 1.1 | 数字（欧文スラブ） | Sankyu Numbers |
| Zen Kaku Gothic New (Regular / Bold) | Copyright 2022 The Zen Kaku Gothic Project Authors (https://github.com/googlefonts/zen-kakugothic) | OFL 1.1 | 本文 | Sankyu Text |

取得とサブセット化の手順は `scripts/fonts/build.mjs`（fonts.gstatic.com から TTF を取り、`pyftsubset --flavor=woff2`）。
同梱フォントが読めない環境ではシステムのフォント（Hiragino、Noto Sans JP、Yu Gothic UI など）にフォールバックします。

画像・音声の素材は現時点で同梱していません（音は Web Audio で合成）。素材を追加したときはここに追記します。
