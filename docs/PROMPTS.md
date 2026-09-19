# Claude Code への指示

このフォルダを空のリポジトリに展開し、そのディレクトリで `claude` を起動して以下を順に渡す。
各マイルストーンの終わりで止まらせ、構成を確認してから次へ進む。

## 前提

- Node（LTS）、pnpm、Git
- Windows: Visual Studio Build Tools（ネイティブモジュール用）
- macOS: Xcode Command Line Tools
- Steam クライアントをインストールしてログイン済み（Spacewar で動作確認するため）

## 1. 移植（マイルストーン 1）

```
CLAUDE.md、docs/DESIGN.md、docs/STEAM.md を読んでから始めてください。

まず reference/prototype.html を読み、DESIGN.md との差分（実装済み／未実装／挙動が違う箇所）を
表にして見せてください。ここで一度止まります。

その後、Electron + Vite + TypeScript（strict）のプロジェクトを初期化してください。
electron-builder、Vitest、ESLint まで含め、CLAUDE.md の「コマンド」が全部動く状態にします。
renderer は contextIsolation: true + preload で、nodeIntegration は使いません。

次に、試作のロジックを src/core に分解してください。core は window / document /
performance.now() / AudioContext を直接参照せず、時刻は引数で受け取ります。
beat.ts の判定（clean / wobble / drop、疲労による許容幅の縮小、見せ場の係数、
筋記憶の自動投げ、流れのボーナス）に Vitest を書いてください。

core を分離した時点で止まって、ディレクトリ構成と各ファイルの責務を見せてください。
```

続けて:

```
Canvas 描画と UI（練習場・身体・記録帳のタブ）を移植し、試作と同じ挙動で
Electron ウィンドウで動くところまで進めてください。
セーブは localStorage ではなく electron/main.ts 経由で userData/save/ に JSON で書き、
version と migrate.ts を最初から入れてください。書き込みは一時ファイル→rename、.bak を 1 世代残す。

動いたら、試作と並べて挙動が同じことを確認する手順を書いて止まってください。
```

## 2. 本編（マイルストーン 2）

```
docs/DESIGN.md の 7 球完走まで実装してください。順番は
クラブ → 路上（拍手変換）→ パッシング → 舞台 → 封印（犠牲コスト）→ 体得点。
各タブを 1 つ実装するごとにコミットして止まり、追加した core の関数とテストを見せてください。

tuning.ts の定数を開発モードで外部 JSON（userData/tuning.override.json）から
上書きできるようにしてください。数値調整をビルドなしで回すためです。
```

## 3. リリース品質（マイルストーン 3）

```
docs/STEAM.md の「入力」「設定画面」「セーブ」「品質」の節を実装してください。
優先順位は 入力オフセット補正 → ゲームパッド → 設定画面 → i18n（ja / en）→ 音 → ログ。
拍の基準時刻は AudioContext.currentTime に移し、描画は requestAnimationFrame で追従させます。
オフセット補正は「拍に合わせて 8 回叩き、平均遅延を保存する」方式で。
```

## 4. Steam（マイルストーン 4）

```
docs/STEAM.md の「Steam 連携」「Steam Deck 対応」「ビルド／配信」を実装してください。
steamworks.js は electron/steam.ts に閉じ込め、Steam 不在時はすべて no-op を返すこと。
実績は src/core/achievements.ts で判定し、IPC で main に送って activate します。
App ID は当面 480（Spacewar）。steam_appid.txt は開発時のみで、本番ビルドから除外してください。
GitHub Actions で Windows / macOS / Linux のマトリクスビルドと、
scripts/steam/ の SteamCMD アップロードスクリプトまで作ってください。
最後に「リリース前チェックリスト」を上から順に確認し、通らない項目を列挙してください。
```

## 途中で使う指示

- 数値の感触を伝えるとき: 「3 球で拍が速すぎる。tuning.ts の基本間隔と精度の伸びを、序盤 10 分で 30 拍のクリーンが 1 回取れる程度に調整して」
- 設計判断を迫られたとき: 「DESIGN.md の未決事項に書いてある。案を 2 つ出して、それぞれの影響を core のどの関数が受けるかまで書いて」
- 脱線したとき: 「CLAUDE.md のルールに戻って。core に DOM 依存が入っていないか確認して」
