// 環境音。ピンクノイズのループをフィルタと遅い LFO で揺らし、ごく小さく流す。
// street: 遠い雑踏（低域のうなり + 中域のざわめき）、stage: 観客のざわめき（中域中心、揺れが速い）。
import { LOOP_TAIL_SEC, makeNoise } from './synth';

export type AmbienceKind = 'street' | 'stage';

/** バス内での基準音量。sfx の設定はバス側で掛かるので、ここは「効果音に対してどれだけ小さいか」 */
const LEVEL = 0.05;
/** フェードイン／アウト（秒） */
const FADE_IN = 1.5;
const FADE_OUT = 1.2;

interface Layer {
  type: BiquadFilterType;
  freq: number;
  q: number;
  gain: number;
  /** カットオフを揺らす LFO（Hz と深さ） */
  lfo?: { hz: number; depth: number };
}

interface Recipe {
  layers: Layer[];
  /** 全体の音量を揺らす LFO */
  swell: { hz: number; depth: number }[];
}

const RECIPES: Record<AmbienceKind, Recipe> = {
  street: {
    layers: [
      // 遠い車の流れ: 低域のうなり。カットオフを 0.07 Hz で 250〜500 Hz に揺らす（通り過ぎる感じ）
      { type: 'lowpass', freq: 380, q: 0.7, gain: 0.7, lfo: { hz: 0.07, depth: 130 } },
      // 人の気配: 1 kHz あたりのざわめき
      { type: 'bandpass', freq: 1000, q: 0.7, gain: 0.18 },
    ],
    swell: [{ hz: 0.13, depth: 0.3 }],
  },
  stage: {
    layers: [
      // 観客のざわめき: 500 Hz 中心
      { type: 'bandpass', freq: 520, q: 0.8, gain: 0.6, lfo: { hz: 0.21, depth: 90 } },
      // ホールの空気: 1.8 kHz までの薄い層
      { type: 'lowpass', freq: 1800, q: 0.5, gain: 0.22 },
    ],
    swell: [
      { hz: 0.3, depth: 0.3 },
      { hz: 0.9, depth: 0.12 },
    ],
  },
};

interface Playing {
  kind: AmbienceKind;
  gain: GainNode;
  nodes: AudioNode[];
  sources: AudioScheduledSourceNode[];
}

export interface Ambience {
  /** 種類を切り替える。null で止める。同じ種類なら何もしない */
  set(kind: AmbienceKind | null): void;
  /** オン／オフ（オフにすると今鳴っているものも止める） */
  enable(on: boolean): void;
  readonly current: AmbienceKind | null;
}

export function createAmbience(ctx: BaseAudioContext, bus: AudioNode): Ambience {
  let pink: AudioBuffer | null = null;
  let playing: Playing | null = null;
  let enabled = true;
  let wanted: AmbienceKind | null = null;

  const stop = (p: Playing): void => {
    const now = ctx.currentTime;
    p.gain.gain.cancelScheduledValues(now);
    p.gain.gain.setValueAtTime(p.gain.gain.value, now);
    p.gain.gain.linearRampToValueAtTime(0, now + FADE_OUT);
    let pending = p.sources.length;
    const done = (): void => {
      for (const n of p.nodes) {
        try {
          n.disconnect();
        } catch {
          // 既に外れている
        }
      }
    };
    for (const s of p.sources) {
      s.onended = () => {
        if (--pending <= 0) done();
      };
      s.stop(now + FADE_OUT + 0.05);
    }
    if (pending === 0) done();
  };

  const start = (kind: AmbienceKind): Playing => {
    pink ??= makeNoise(ctx, 4, 'pink');
    const now = ctx.currentTime;
    const recipe = RECIPES[kind];
    const nodes: AudioNode[] = [];
    const sources: AudioScheduledSourceNode[] = [];
    const gain = ctx.createGain();
    nodes.push(gain);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(LEVEL, now + FADE_IN);
    gain.connect(bus);

    const src = ctx.createBufferSource();
    src.buffer = pink;
    src.loop = true;
    src.loopEnd = Math.max(0, pink.duration - LOOP_TAIL_SEC);
    nodes.push(src);
    sources.push(src);

    for (const layer of recipe.layers) {
      const f = ctx.createBiquadFilter();
      f.type = layer.type;
      f.frequency.value = layer.freq;
      f.Q.value = layer.q;
      const g = ctx.createGain();
      g.gain.value = layer.gain;
      src.connect(f);
      f.connect(g);
      g.connect(gain);
      nodes.push(f, g);
      if (layer.lfo) {
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = layer.lfo.hz;
        const depth = ctx.createGain();
        depth.gain.value = layer.lfo.depth;
        lfo.connect(depth);
        depth.connect(f.frequency);
        nodes.push(lfo, depth);
        sources.push(lfo);
      }
    }
    // 全体のうねり: LFO を gain の AudioParam に足す（LEVEL × depth の振幅）
    for (const sw of recipe.swell) {
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = sw.hz;
      // 位相をずらすために少し違う周波数のオフセットは付けず、開始時刻でばらす
      const depth = ctx.createGain();
      depth.gain.value = LEVEL * sw.depth;
      lfo.connect(depth);
      depth.connect(gain.gain);
      nodes.push(lfo, depth);
      sources.push(lfo);
    }
    for (const s of sources) s.start(now + Math.random() * 0.2);
    return { kind, gain, nodes, sources };
  };

  const sync = (): void => {
    const target = enabled ? wanted : null;
    if (playing && playing.kind === target) return;
    if (playing) {
      stop(playing);
      playing = null;
    }
    if (target) playing = start(target);
  };

  return {
    set(kind) {
      wanted = kind;
      sync();
    },
    enable(on) {
      enabled = on;
      sync();
    },
    get current() {
      return playing?.kind ?? null;
    },
  };
}
