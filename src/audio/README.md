# src/audio — 音の設計

素材ファイル無し。すべて Web Audio の合成（Oscillator / Gain / BiquadFilter / ノイズバッファ）。

- `clock.ts` 拍の基準時計（触らない）
- `index.ts` 公開面 `createAudio(ctx, settings)`。バス（sfx / click / ambience → master）と音量
- `synth.ts` 部品と寿命管理。ボイス（効果音 1 回分のノード群）は上限 16、超えたら一番古いものを 12 ms でフェードして奪う。音源の `ended` で全ノードを `disconnect`、来なければ保証時刻で回収
- `sfx.ts` レシピ（周波数・長さ・音量はここ）
- `ambience.ts` 環境音のループ

音量は `LEVEL`（sfx.ts）× 設定 sfx（バス）× 設定 master。クリックは `click` がオフならノードを作らない。

## どの音がどの状況か

| kind / 呼び出し | 状況（main.ts） | 音 |
|---|---|---|
| `scheduleClick(at, accent)` | 毎拍。4 拍目が accent | ウッドブロック。バンドパス（1.9 kHz、accent 2.6 kHz、Q 6）のノイズ 20 ms + 正弦波 1350→900 Hz（accent 1770→1180）を 20 ms で落とし 55〜70 ms 減衰 |
| `scheduleClick(at, accent, true)` | 見せ場の拍 | 金属。非整数倍の 3 部分音 1 : 2.76 : 5.4（f0 1050 Hz、accent 1400）100〜140 ms + 5 kHz 以上のノイズ 15 ms |
| `clean` | 投げが clean | きらめき。E6（1319 Hz）+ 2・3・6 倍音、140 / 100 / 80 / 50 ms |
| `wobble` | 投げが wobble | 濁った揺れ。三角波 440 と 454 Hz（14 Hz のうねり）を 200 ms で 1 割下げる + 220 Hz |
| `auto` / `partner` | 筋記憶の自動投げ / 相方の投げ | 柔らかい正弦波 E5（659 Hz）/ C5（523 Hz）、立ち上がり 10 ms、120 ms |
| `drop` | 落球 | 落下: 鋸波 520→36 Hz を 220 ms で（ローパス 1.8 k→300 Hz）。床: 200 ms 後にノイズ（ローパス 260 Hz）160 ms + 正弦波 90→45 Hz + 3.2 kHz の小さな粒 |
| `early` | 空振り | バンドパスを 3 kHz→500 Hz に 80 ms で流すノイズ、90 ms |
| `clean-bonus` | クリーン +1 | A5 → C#6 → E6 の上行、90 ms 刻み、最後 300 ms |
| `showcase` | 見せ場を抜けた | A(add9) の 5 音（E5 A5 C#6 E6 B6）を 12 ms ずつ遅らせて 900 ms + 7 kHz のシマー 700 ms |
| `record-open` | 記録帳が開いた | 紙の「フッ」（ローパス 2.4 k→600 Hz、120 ms）+ C6 → G6 |
| `prestige` | 球数が増えた | C5 E5 G5 を 70 ms 刻みで駆け上がり、C6 + E6 + G6 を 700 ms + 6 kHz のシマー |
| `show-complete` | ショー成立（完走） | 1.5 秒。D → A/E → A（高い A6 まで）の 3 和音（三角波）+ 0.5 秒から拍手 30 粒 |
| `shown` | 路上で新パターンを見せた | A6 の合図 + 拍手 16 粒 / 0.6 秒 |
| `setAmbience('street')` | 路上のラン中 | ピンクノイズ → ローパス 380 Hz（0.07 Hz の LFO で ±130 Hz）+ バンドパス 1 kHz。0.13 Hz でうねる。音量 0.05 |
| `setAmbience('stage')` | 舞台のラン中 | ピンクノイズ → バンドパス 520 Hz（0.21 Hz で ±90 Hz）+ ローパス 1.8 kHz。0.3 Hz と 0.9 Hz でうねる |

「拍手 1 粒」は 15〜25 ms のノイズを 1.5〜3 kHz（ランダム）のバンドパス Q 1.2 に通したもの。

## 素材の作り方（共通の型）

- **1 音** `tone`: オシレータ → エンベロープ（0 → peak を attack 秒、hold、at+dur で無音へ指数減衰）→ ボイスの出口。`glide` で周波数を指数（または線形）で滑らせる
- **ノイズの一撃** `burst`: ノイズバッファ → フィルタ（`glide` でカットオフを滑らせる）→ エンベロープ
- **鐘** `bell`（ジングル用）: 基音 + 2 倍音（0.3 倍、0.6 倍の長さ）
- 減衰は `exponentialRampToValueAtTime(0.0001)`（0 には落とせない）
- 音の「硬さ」は attack で決める。打楽器 1〜2 ms、判定音 4〜6 ms、柔らかい音 10 ms、シマー 30〜50 ms
- 環境音は 4 秒のピンクノイズ（Paul Kellet 近似）をループ。末尾 50 ms を先頭にクロスフェードし、`loopEnd = duration − 0.05` で回す

## 契約

- `scheduleClick(atMs, …)` は `atMs / 1000` に予約する。`ctx.currentTime` より過去なら即時
- `setSettings` は master / sfx / click をバスに反映（20 ms の時定数でなめらかに）
- `AudioContext` が無ければ全メソッド no-op。`state` が running でない間（再開待ち）は予約せず捨てる（再開時にまとめて鳴るのを防ぐ）
- 環境音のオン／オフは設定に無いので `setAmbienceEnabled`（既定オン）。設定項目にするなら `Settings['sound']` を増やしてここに繋ぐ
