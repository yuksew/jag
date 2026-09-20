# キャラクター「サーカスの新人」（案 B）— 引き継ぎ資料

ジャグラーの主人公。現状は `src/render/character.ts` の手続き描画（Canvas）で、表情と所作は `src/render/pose.ts` が
毎フレーム作る。この資料は、画像生成 AI またはイラストレーターに「イラストレーター」として絵を任せるときに渡すもの。
参考シート: `docs/art/character-b-reference.png`（全身・表情 6 種・パッシングの 2 人）。

案 A「街角の名人」と案 C「現代のジャグラー」もコードに残してある（`document.documentElement.dataset.character = 'a' | 'c'`）。
既定は B。

## キャラクター設定

| 項目 | 内容 |
|---|---|
| 名前（仮） | なし。UI にも出さない |
| 人物像 | サーカスに入ったばかりの新人。元気で、表情が大きく動く。失敗しても立ち直りが早い |
| 頭身 | 3 頭身。頭は横に広い円、頬が張る。肩幅は頭の半径 × 0.9 |
| 髪 | オレンジのくるくる髪（丸い房が 8 つほど）。テーマ（ライト／ダーク）で色相は変えない |
| 顔 | 大きな目（白目・瞳・ハイライト・まつ毛）、弧の眉、幅広の口（開くと歯）、そばかす |
| 衣装 | コーラル／白の横縞シャツ（袖も縞）、サスペンダー + 金具、蝶ネクタイ、紺の半ズボン、縞の靴下、丸い靴 |
| 相方（パッシング） | 同じ骨格。おだんご 2 つの黒髪、空色の縞シャツ、サスペンダー、褐色の肌 |
| 色 | ゲームの配色（暖色のアイボリー地、コーラル `#D85A40`、空色 `#3C8FA5`、琥珀 `#B8791E`、墨 `#22343A`）から外れない。ダークテーマ（背景 `#22343A`）でも埋もれない明度 |

## 表情（8 枚 + まばたき）

| 状態 | 目 | 眉 | 口 | 備考 |
|---|---|---|---|---|
| 待機 | 開き 1.0 | 水平 | 薄い微笑 | 視線は正面 |
| ラン中（集中） | 0.82 | やや下げ | 一文字 | 視線は一番高い球を追う（プログラムで動かすので瞳は別レイヤー） |
| clean 直後 | 1.0 | 上がる | 口角 0.9、少し開く | 頬に赤み |
| wobble 直後 | 片目 0.45 | 片眉 +0.32 | への字 | 汗 1 滴 |
| 見せ場 | 0.66 | 吊り上がる | 一文字 | きりっと |
| drop 直後 | 1.4（見開き） | +0.4 | O の口 | 驚き |
| drop 後 | 半眼 | 困り眉 | への字 | 視線は下。がっかり |
| ショー成立 | 笑い目の弧 | 上がる | 歯の見える笑い | 頬に赤み |
| まばたき | 閉じ | 水平 | 待機と同じ | 1 枚 |

## 所作（アニメーションのコマ）

| 所作 | コマ | 備考 |
|---|---|---|
| 呼吸（待機） | 4 | 胴が上下、腕は肘が追従 |
| 投げ | 3 | 拍の 170ms 前から手が沈み、拍で上がる |
| キャッチ | 2 | 手が沈んで握る（開／閉） |
| 跳ね | 3 | clean やボーナスで小さく跳ねる。着地で髪の毛先とサスペンダーが遅れて揺れる |
| wobble | – | 上体と首が傾く（プログラムで回転させるので個別コマは不要） |
| drop | – | 肩が上がり（驚き）、その後は肩が落ちてうなだれる（胴が縮む） |
| 見せ場 | – | 背筋が伸びる（胴を伸ばす） |
| お辞儀 | 3 | 路上で拍手が入ると 1 秒 |

## パーツ分割と納品形式

手と腕はプログラムで動かすので、次のレイヤーに分けて納品する。

1. 頭（髪込み、顔なし）
2. 顔パーツ: 目 L / R（白目・瞳・ハイライトを分ける）、眉 L / R、口（表情ごと）
3. 胴（衣装。サスペンダー・蝶ネクタイ込み）
4. 上腕 L / R
5. 前腕 + 手 L / R（開／閉の 2 種）
6. 脚 + 靴
7. 相方: 同じ分割で衣装・髪・肌色違い

- 正面向き（練習場）と 3/4 向き（パッシング。左右は反転で可）
- 2 倍解像度の PNG（透過）か SVG。原点は「足の接地点の中央」。頭の半径を 1 として各パーツの相対位置を添える
- ライト／ダーク兼用: 輪郭は暗褐色、衣装は中明度、白は真っ白にしない（`#FBF6EA` 程度）
- 置き場所は `src/assets/game/character-b/`。組み込みは `graphics` エージェント（`docs/ART.md` の受け皿）。素材が無くても手続き描画にフォールバックする

## 画像生成 AI 向けプロンプト

参考シート（`docs/art/character-b-reference.png`）を画像参照として添え、下のプロンプトで方向を出す。
生成結果はそのままゲームに入れず、パーツ分割と表情差分が要るので、
「キャラクターシート（正面・3/4・表情一覧）」を作らせてから、人の手で分割するか、
分割向きのプロンプト（背景透過、単一パーツ）で個別に出す。

### 英語（Midjourney / Stable Diffusion / Firefly 共通）

```
Character sheet of a cheerful young circus juggler, chibi 3-head-tall proportions, round face with big expressive eyes and freckles,
curly orange hair, coral-and-white striped long-sleeve shirt, navy suspenders with brass clips, small bow tie, navy shorts,
striped socks, round shoes. Warm minimalist game art, clean shapes, soft shading, thin dark-brown outlines, flat ivory background.
Front view full body, three-quarter view, and a row of six facial expressions: calm, focused, delighted, uneasy with a sweat drop,
surprised with an O-shaped mouth, disappointed. Consistent character, no text, no watermark.
--ar 16:9 --style raw
```

相方:

```
Same style and proportions as the reference. A friendly juggling partner: dark skin, black hair in two buns, sky-blue-and-white striped
shirt, navy suspenders, navy shorts. Front and three-quarter view, calm and focused expressions. Flat ivory background, no text.
```

### 日本語（画像参照に対応するサービス向け）

```
参考画像のキャラクターを元に、明るいサーカスの新人ジャグラーのキャラクターシート。3 頭身、丸い顔、大きな目、そばかす、
オレンジのくるくる髪、コーラルと白の横縞シャツ、紺のサスペンダー、蝶ネクタイ、紺の半ズボン、縞の靴下、丸い靴。
暖色のミニマルなゲームの絵柄、はっきりした形、柔らかい陰影、細い暗褐色の輪郭、アイボリーの無地背景。
正面の全身、3/4 の全身、表情 6 種（穏やか・集中・喜び・不安と汗・驚きの O の口・がっかり）を一列に。
文字と透かしは入れない。
```

### 出力の確認項目

- 3 頭身、丸い顔、縞シャツ、サスペンダー、オレンジ髪が揃っているか（1 つでも欠けると別人に見える）
- ダーク背景に置いても輪郭と衣装が読めるか（生成後に `#22343A` の上で確認）
- 表情 6 種が同じ顔に見えるか（目の大きさ・位置が揃っているか）
- ゲームの配色から外れていないか（彩度が高すぎる場合は下げる）

## 今後の流れ

1. この資料と参考シートで画像生成 AI に方向出し → 気に入ったものを「基準画」に決める
2. 基準画を元にパーツ分割と表情差分を作る（生成 AI なら単一パーツ・透過背景で出し直す。人なら分割納品）
3. `src/assets/game/character-b/` に置き、`graphics` に組み込みを頼む。`pose.ts` の表情・所作のパラメータはそのまま使う
4. 手続き描画はフォールバックとして残す
