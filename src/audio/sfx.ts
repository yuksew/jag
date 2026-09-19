// 効果音のレシピ。拍のクリック、判定音、ジングル。数値（周波数・長さ・音量）はここに集める。
// 各関数は 1 ボイスを確保して鳴らす。時刻 at は AudioContext の秒。
import type { Synth, Voice } from './synth';

// ---- 音量の基準（sfx バス内での相対値。設定の sfx / master はバス側で掛かる） ----
const LEVEL = {
  click: 0.35,
  clickAccent: 0.5,
  clickShowcase: 0.3,
  judge: 0.3,
  soft: 0.16,
  jingle: 0.28,
  fanfare: 0.3,
  clap: 0.12,
} as const;

/** 平均律の周波数。A4 = 440 */
const NOTE = {
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  Fs5: 739.99,
  G5: 783.99,
  A5: 880,
  B5: 987.77,
  C6: 1046.5,
  Cs6: 1108.73,
  D6: 1174.66,
  E6: 1318.51,
  Fs6: 1479.98,
  G6: 1567.98,
  A6: 1760,
  B6: 1975.53,
  Cs7: 2217.46,
  E7: 2637.02,
} as const;

// ---- 拍のクリック ----

/**
 * ウッドブロック。ノイズの一撃（バンドパス）に、20 ms でピッチが落ちる正弦波を重ねる。
 * accent（4 拍目）は高く・強く。
 */
export function woodblock(s: Synth, bus: AudioNode, at: number, accent: boolean): void {
  const dur = accent ? 0.07 : 0.055;
  const v = s.voice(bus, at + dur + 0.1);
  const peak = accent ? LEVEL.clickAccent : LEVEL.click;
  const body = accent ? 1180 : 900;
  // 木の「コッ」: 短いノイズをバンドパスで細くする
  s.burst(v, at, peak * 0.9, 0.02, { type: 'bandpass', freq: accent ? 2600 : 1900, q: 6 });
  // 胴鳴り: ピッチが下がる正弦波
  s.tone(v, 'sine', body * 1.5, at, peak, dur, { attack: 0.002, glide: { to: body, dur: 0.02 } });
  // 上に薄く倍音
  s.tone(v, 'triangle', body * 3.01, at, peak * 0.15, dur * 0.5, { attack: 0.001 });
}

/**
 * 見せ場のクリック。金属的に: 非整数倍の 3 部分音（1 : 2.76 : 5.4、鐘の比）と高いノイズ。
 */
export function metalClick(s: Synth, bus: AudioNode, at: number, accent: boolean): void {
  const dur = accent ? 0.14 : 0.1;
  const v = s.voice(bus, at + dur + 0.1);
  const peak = accent ? LEVEL.clickShowcase * 1.4 : LEVEL.clickShowcase;
  const f0 = accent ? 1400 : 1050;
  s.tone(v, 'sine', f0, at, peak, dur, { attack: 0.001 });
  s.tone(v, 'sine', f0 * 2.76, at, peak * 0.55, dur * 0.8, { attack: 0.001 });
  s.tone(v, 'sine', f0 * 5.4, at, peak * 0.3, dur * 0.5, { attack: 0.001 });
  s.burst(v, at, peak * 0.5, 0.015, { type: 'highpass', freq: 5000, q: 1 });
}

// ---- 判定音 ----

/** clean: きらめき。基音と 2・3・6 倍音を短く重ね、上ほど早く消える */
export function sparkle(s: Synth, bus: AudioNode, at: number): void {
  const v = s.voice(bus, at + 0.3);
  const f = NOTE.E6;
  const p = LEVEL.judge;
  s.tone(v, 'sine', f, at, p, 0.14);
  s.tone(v, 'sine', f * 2, at + 0.005, p * 0.45, 0.1);
  s.tone(v, 'sine', f * 3, at + 0.01, p * 0.25, 0.08);
  s.tone(v, 'sine', f * 6, at + 0.012, p * 0.1, 0.05);
}

/** wobble: 濁った揺れ。三角波 2 本を 14 Hz ずらしてうねらせ、少し落ちる */
export function wobble(s: Synth, bus: AudioNode, at: number): void {
  const v = s.voice(bus, at + 0.35);
  const p = LEVEL.judge * 0.8;
  s.tone(v, 'triangle', 440, at, p, 0.2, { attack: 0.006, glide: { to: 400, dur: 0.2 } });
  s.tone(v, 'triangle', 454, at, p, 0.2, { attack: 0.006, glide: { to: 412, dur: 0.2 } });
  s.tone(v, 'sine', 220, at, p * 0.4, 0.16, { attack: 0.006 });
}

/** drop: 落下（鋸波のピッチが 0.22 秒で 4 オクターブ落ちる）と、床の音（ローパスしたノイズ + 60 Hz の重み） */
export function drop(s: Synth, bus: AudioNode, at: number): void {
  const v = s.voice(bus, at + 0.7);
  const p = LEVEL.judge;
  const fall = s.filter(v, 'lowpass', 1800, 0.7, at, { to: 300, dur: 0.22 });
  fall.connect(v.out);
  s.tone(v, 'sawtooth', 520, at, p * 0.7, 0.24, { attack: 0.004, glide: { to: 36, dur: 0.22 }, target: fall });
  const land = at + 0.2;
  s.burst(v, land, p * 1.1, 0.16, { type: 'lowpass', freq: 260, q: 0.8 }, { attack: 0.003 });
  s.tone(v, 'sine', 90, land, p * 0.9, 0.2, { attack: 0.003, glide: { to: 45, dur: 0.12 } });
  // 床の「カッ」（小さな高域の粒）
  s.burst(v, land, p * 0.25, 0.03, { type: 'bandpass', freq: 3200, q: 3 });
}

/** early: 空振り。バンドパスを 3 kHz → 500 Hz に 80 ms で流す短いノイズ */
export function whiff(s: Synth, bus: AudioNode, at: number): void {
  const v = s.voice(bus, at + 0.25);
  s.burst(
    v,
    at,
    LEVEL.judge * 0.55,
    0.09,
    { type: 'bandpass', freq: 3000, q: 1.2, glide: { to: 500, dur: 0.08 } },
    { attack: 0.01 },
  );
}

/** auto / partner: 柔らかい正弦波。auto は E5、partner は少し低い C5。立ち上がり 10 ms */
export function soft(s: Synth, bus: AudioNode, at: number, partner: boolean): void {
  const v = s.voice(bus, at + 0.25);
  const f = partner ? NOTE.C5 : NOTE.E5;
  s.tone(v, 'sine', f, at, LEVEL.soft, 0.12, { attack: 0.01 });
  s.tone(v, 'sine', f * 2, at, LEVEL.soft * 0.2, 0.08, { attack: 0.01 });
}

// ---- ジングル ----

/** 1 音を「きらめき」で鳴らす共通部（ジングル用）。基音 + 2 倍音（弱） */
function bell(s: Synth, v: Voice, f: number, at: number, peak: number, dur: number, wave: 'sine' | 'triangle' = 'sine'): void {
  s.tone(v, wave, f, at, peak, dur, { attack: 0.004 });
  s.tone(v, 'sine', f * 2, at, peak * 0.3, dur * 0.6, { attack: 0.004 });
}

/** clean-bonus: A5 → C#6 → E6 の上行。1 音 90 ms、最後だけ長め */
export function cleanBonus(s: Synth, bus: AudioNode, at: number): void {
  const v = s.voice(bus, at + 0.6);
  const p = LEVEL.jingle;
  bell(s, v, NOTE.A5, at, p, 0.12);
  bell(s, v, NOTE.Cs6, at + 0.09, p, 0.12);
  bell(s, v, NOTE.E6, at + 0.18, p, 0.3);
}

/** showcase: 光る和音。A(add9) を 12 ms ずつ遅らせて積み、高域のシマー（ノイズ）を添える */
export function showcaseChord(s: Synth, bus: AudioNode, at: number): void {
  const v = s.voice(bus, at + 1.2);
  const p = LEVEL.jingle * 0.7;
  const notes = [NOTE.E5, NOTE.A5, NOTE.Cs6, NOTE.E6, NOTE.B6];
  notes.forEach((f, i) => bell(s, v, f, at + i * 0.012, p * (1 - i * 0.1), 0.9, i < 2 ? 'triangle' : 'sine'));
  s.burst(v, at, p * 0.25, 0.7, { type: 'bandpass', freq: 7000, q: 1.5 }, { attack: 0.03 });
}

/** record-open: 記録帳。紙をめくる「フッ」（ローパスのノイズ）に C6 → G6 の 2 音 */
export function recordOpen(s: Synth, bus: AudioNode, at: number): void {
  const v = s.voice(bus, at + 0.7);
  const p = LEVEL.jingle;
  s.burst(v, at, p * 0.5, 0.12, { type: 'lowpass', freq: 2400, q: 0.5, glide: { to: 600, dur: 0.1 } }, { attack: 0.02 });
  bell(s, v, NOTE.C6, at + 0.06, p * 0.9, 0.18, 'triangle');
  bell(s, v, NOTE.G6, at + 0.2, p, 0.4);
}

/** prestige: 球数が増えた。C5 E5 G5 C6 を 70 ms 刻みで駆け上がり、C6 + E6 を 0.5 秒伸ばす */
export function prestige(s: Synth, bus: AudioNode, at: number): void {
  const v = s.voice(bus, at + 1.2);
  const p = LEVEL.jingle;
  const run = [NOTE.C5, NOTE.E5, NOTE.G5];
  run.forEach((f, i) => bell(s, v, f, at + i * 0.07, p * 0.8, 0.14, 'triangle'));
  const top = at + 0.21;
  bell(s, v, NOTE.C6, top, p, 0.7);
  bell(s, v, NOTE.E6, top + 0.02, p * 0.7, 0.7);
  bell(s, v, NOTE.G6, top + 0.04, p * 0.4, 0.6);
  s.burst(v, top, p * 0.2, 0.5, { type: 'bandpass', freq: 6000, q: 1.5 }, { attack: 0.05 });
}

/** show-complete: 完走のファンファーレ（1.5 秒）。D → A → 高い A の 3 和音と、後半に盛り上がる拍手 */
export function showComplete(s: Synth, bus: AudioNode, at: number): void {
  const v = s.voice(bus, at + 2.0);
  const p = LEVEL.fanfare;
  const chord = (fs: number[], t: number, dur: number, peak: number): void => {
    fs.forEach((f, i) => bell(s, v, f, t + i * 0.01, peak * (1 - i * 0.12), dur, 'triangle'));
  };
  chord([NOTE.D5, NOTE.Fs5, NOTE.A5], at, 0.34, p * 0.8);
  chord([NOTE.E5, NOTE.A5, NOTE.Cs6], at + 0.32, 0.36, p * 0.9);
  chord([NOTE.A5, NOTE.Cs6, NOTE.E6, NOTE.A6], at + 0.64, 0.86, p);
  // 拍手: 30 粒をばら撒く。0.5 秒から始まり 1.5 秒で収まる
  for (let i = 0; i < 30; i++) {
    const t = at + 0.5 + Math.random() * 0.9;
    clap(s, v, t, LEVEL.clap * (0.6 + Math.random() * 0.6));
  }
}

/** shown: 路上で新しいパターンを見せた。拍手のパラパラ（16 粒 / 0.6 秒）と小さな合図の 1 音 */
export function applause(s: Synth, bus: AudioNode, at: number): void {
  const v = s.voice(bus, at + 1.0);
  bell(s, v, NOTE.A6, at, LEVEL.jingle * 0.5, 0.2);
  for (let i = 0; i < 16; i++) {
    const t = at + 0.05 + Math.random() * 0.55;
    clap(s, v, t, LEVEL.clap * (0.5 + Math.random() * 0.7));
  }
}

/** 拍手 1 粒: 15〜25 ms のノイズを 1.5〜3 kHz のバンドパスで */
function clap(s: Synth, v: Voice, at: number, peak: number): void {
  const freq = 1500 + Math.random() * 1500;
  s.burst(v, at, peak, 0.015 + Math.random() * 0.01, { type: 'bandpass', freq, q: 1.2 }, { attack: 0.001 });
}
