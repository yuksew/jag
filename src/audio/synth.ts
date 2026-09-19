// 合成の土台。ノイズバッファ、エンベロープ、ボイス（1 回の効果音を成すノード群）の寿命管理。
// 素材ファイルは使わず、Oscillator / Gain / BiquadFilter / ノイズバッファだけで音を作る。

/** 同時に鳴らせるボイス（効果音 1 回 = 1 ボイス）の上限。超えたら一番古いものをフェードして奪う */
export const MAX_VOICES = 16;
/** exponentialRamp は 0 に落とせないので、この値を「無音」とする */
const SILENT = 0.0001;
/** ボイスを奪うときのフェード時間（秒） */
const STEAL_FADE = 0.012;
/** makeNoise が継ぎ目消しに使う末尾の長さ（秒）。ループ再生は loopEnd = duration − これ で回す */
export const LOOP_TAIL_SEC = 0.05;

export type Wave = OscillatorType;

export interface Voice {
  /** ボイスの出口。ここに繋いだものがバスへ出る */
  readonly out: GainNode;
  /** ノードを登録する。ボイス終了時にまとめて disconnect する */
  track<T extends AudioNode>(node: T): T;
  /** 音源を登録して start / stop する。すべての音源が ended になるとボイスを解放する */
  play<T extends AudioScheduledSourceNode>(src: T, at: number, stop: number): T;
}

interface Slot extends Voice {
  nodes: AudioNode[];
  pending: number;
  until: number;
  done: boolean;
}

export interface Glide {
  /** 到達周波数 */
  to: number;
  /** 到達までの秒数 */
  dur: number;
  /** 指数（既定）か線形か */
  linear?: boolean;
}

export class Synth {
  /** 白色ノイズ（2 秒）。短いバースト用 */
  readonly white: AudioBuffer;
  private active: Slot[] = [];
  private dying: Slot[] = [];

  constructor(
    readonly ctx: BaseAudioContext,
    private readonly limit = MAX_VOICES,
  ) {
    this.white = makeNoise(ctx, 2, 'white');
  }

  /** 生きているボイス数（奪われてフェード中のものは含まない） */
  get voices(): number {
    return this.active.length;
  }

  /**
   * ボイスを確保する。until は「この時刻を過ぎたら必ず終わっている」保証時刻（秒）。
   * ended が来なかった場合の保険として、until を過ぎたボイスは次の確保時に解放する。
   */
  voice(bus: AudioNode, until: number): Voice {
    const now = this.ctx.currentTime;
    this.sweep(now);
    if (this.active.length >= this.limit) {
      const oldest = this.active.shift();
      if (oldest) this.steal(oldest, now);
    }
    const out = this.ctx.createGain();
    out.connect(bus);
    const slot: Slot = {
      out,
      nodes: [out],
      pending: 0,
      until,
      done: false,
      track: (node) => {
        slot.nodes.push(node);
        return node;
      },
      play: (src, at, stop) => {
        slot.nodes.push(src);
        slot.pending++;
        src.onended = () => {
          slot.pending--;
          if (slot.pending <= 0) this.release(slot);
        };
        src.start(at);
        src.stop(stop);
        return src;
      },
    };
    this.active.push(slot);
    return slot;
  }

  /** 保証時刻を過ぎたボイスを解放する */
  sweep(now: number): void {
    for (const list of [this.active, this.dying]) {
      for (const slot of list.slice()) if (slot.until <= now) this.release(slot);
    }
  }

  /** すべてのボイスを即座に解放する（AudioContext を捨てるときなど） */
  releaseAll(): void {
    for (const slot of [...this.active, ...this.dying]) this.release(slot);
  }

  private steal(slot: Slot, now: number): void {
    const g = slot.out.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + STEAL_FADE);
    slot.until = Math.min(slot.until, now + STEAL_FADE * 2);
    this.dying.push(slot);
    // 時計が止まっている（suspended）間に溜まらないよう、フェード待ちも上限で切る
    while (this.dying.length > this.limit) {
      const gone = this.dying[0];
      if (!gone) break;
      this.release(gone);
    }
  }

  private release(slot: Slot): void {
    if (slot.done) return;
    slot.done = true;
    for (const n of slot.nodes) {
      try {
        n.disconnect();
      } catch {
        // 既に外れている
      }
    }
    this.active = this.active.filter((s) => s !== slot);
    this.dying = this.dying.filter((s) => s !== slot);
  }

  // ---- 部品 ----

  /**
   * エンベロープ付きの Gain を作って v.out（または target）に繋ぐ。
   * 0 → peak を attack 秒で立ち上げ、hold 秒保ってから at+dur で無音になる。
   */
  env(v: Voice, at: number, peak: number, attack: number, dur: number, hold = 0, target?: AudioNode): GainNode {
    const g = v.track(this.ctx.createGain());
    const p = Math.max(peak, SILENT);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(p, at + attack);
    if (hold > 0) g.gain.setValueAtTime(p, at + attack + hold);
    g.gain.exponentialRampToValueAtTime(SILENT, at + dur);
    g.connect(target ?? v.out);
    return g;
  }

  /** オシレータ。glide を渡すと周波数を滑らせる。stop は at からの秒数ではなく絶対時刻 */
  osc(v: Voice, type: Wave, freq: number, at: number, stop: number, glide?: Glide, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (detune !== 0) o.detune.setValueAtTime(detune, at);
    if (glide) {
      if (glide.linear) o.frequency.linearRampToValueAtTime(glide.to, at + glide.dur);
      else o.frequency.exponentialRampToValueAtTime(Math.max(glide.to, 1), at + glide.dur);
    }
    return v.play(o, at, stop);
  }

  /** ノイズ源。buffer 省略時は白色ノイズ */
  noise(v: Voice, at: number, stop: number, buffer: AudioBuffer = this.white, loop = false): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = loop;
    return v.play(s, at, stop);
  }

  /** フィルタ。glide を渡すとカットオフを滑らせる */
  filter(v: Voice, type: BiquadFilterType, freq: number, q: number, at?: number, glide?: Glide): BiquadFilterNode {
    const f = v.track(this.ctx.createBiquadFilter());
    f.type = type;
    f.Q.value = q;
    if (at === undefined) {
      f.frequency.value = freq;
    } else {
      f.frequency.setValueAtTime(freq, at);
      if (glide) {
        if (glide.linear) f.frequency.linearRampToValueAtTime(glide.to, at + glide.dur);
        else f.frequency.exponentialRampToValueAtTime(Math.max(glide.to, 1), at + glide.dur);
      }
    }
    return f;
  }

  /**
   * 1 音（オシレータ → エンベロープ → 出口）。短い音の大半はこれで足りる。
   * 戻り値はエンベロープの Gain。
   */
  tone(
    v: Voice,
    type: Wave,
    freq: number,
    at: number,
    peak: number,
    dur: number,
    opts: { attack?: number; hold?: number; glide?: Glide; detune?: number; target?: AudioNode } = {},
  ): GainNode {
    const g = this.env(v, at, peak, opts.attack ?? 0.004, dur, opts.hold ?? 0, opts.target);
    this.osc(v, type, freq, at, at + dur + 0.02, opts.glide, opts.detune ?? 0).connect(g);
    return g;
  }

  /**
   * ノイズの一撃（ノイズ → フィルタ → エンベロープ → 出口）。
   * 打楽器のアタック、床の音、空振り、拍手の粒に使う。
   */
  burst(
    v: Voice,
    at: number,
    peak: number,
    dur: number,
    filter: { type: BiquadFilterType; freq: number; q: number; glide?: Glide },
    opts: { attack?: number; hold?: number; buffer?: AudioBuffer; target?: AudioNode } = {},
  ): GainNode {
    const g = this.env(v, at, peak, opts.attack ?? 0.002, dur, opts.hold ?? 0, opts.target);
    const f = this.filter(v, filter.type, filter.freq, filter.q, at, filter.glide);
    f.connect(g);
    this.noise(v, at, at + dur + 0.02, opts.buffer).connect(f);
    return g;
  }
}

/**
 * ノイズバッファを作る。white は一様乱数、pink は Paul Kellet の近似（低域寄りで環境音向き）。
 * ループ用に末尾を先頭へクロスフェードしておく。
 */
export function makeNoise(ctx: BaseAudioContext, seconds: number, kind: 'white' | 'pink'): AudioBuffer {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (kind === 'white') {
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  } else {
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  // ループの継ぎ目を消す。末尾 fade 区間を先頭に混ぜ、再生側は loopEnd を duration − LOOP_TAIL_SEC にする
  // （先頭が末尾の続きになるので、n − fade で折り返せば連続する）
  const fade = Math.min(Math.floor(ctx.sampleRate * LOOP_TAIL_SEC), Math.floor(n / 2));
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    const head = d[i] ?? 0;
    const tail = d[n - fade + i] ?? 0;
    d[i] = head * t + tail * (1 - t);
  }
  return buf;
}
