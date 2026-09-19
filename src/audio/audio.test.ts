// AudioContext のモックで、全 kind の sfx と scheduleClick が例外を出さず、
// 生きているボイスが上限を超えず、終わったノードが disconnect されることを確かめる。
import { describe, expect, it } from 'vitest';
import { createAudio, type SfxKind } from './index';
import { MAX_VOICES } from './synth';

// ---- 最小のモック ----

class MockParam {
  value = 0;
  constructor(v = 0) {
    this.value = v;
  }
  setValueAtTime(v: number): this {
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number): this {
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number): this {
    if (v <= 0) throw new Error('exponentialRamp to non-positive value');
    this.value = v;
    return this;
  }
  setTargetAtTime(v: number): this {
    this.value = v;
    return this;
  }
  cancelScheduledValues(): this {
    return this;
  }
}

class MockNode {
  connected = new Set<MockNode | MockParam>();
  constructor(readonly ctx: MockContext) {
    ctx.nodes.push(this);
  }
  connect(target: MockNode | MockParam): MockNode | MockParam {
    this.connected.add(target);
    return target;
  }
  disconnect(): void {
    this.connected.clear();
  }
}

class MockGain extends MockNode {
  gain = new MockParam(1);
}

class MockFilter extends MockNode {
  type = 'lowpass';
  frequency = new MockParam(350);
  Q = new MockParam(1);
}

class MockSource extends MockNode {
  onended: (() => void) | null = null;
  started: number | null = null;
  stopped: number | null = null;
  start(at = 0): void {
    if (this.started !== null) throw new Error('start called twice');
    this.started = at;
    this.ctx.starts.push(at);
  }
  stop(at = 0): void {
    if (this.started === null) throw new Error('stop before start');
    this.stopped = at;
  }
}

class MockOsc extends MockSource {
  type = 'sine';
  frequency = new MockParam(440);
  detune = new MockParam(0);
}

class MockBufferSource extends MockSource {
  buffer: MockBuffer | null = null;
  loop = false;
  loopEnd = 0;
}

class MockBuffer {
  readonly duration: number;
  private data: Float32Array;
  constructor(length: number, rate: number) {
    this.data = new Float32Array(length);
    this.duration = length / rate;
  }
  getChannelData(): Float32Array {
    return this.data;
  }
}

class MockContext {
  currentTime = 10;
  sampleRate = 48000;
  state = 'running';
  nodes: MockNode[] = [];
  starts: number[] = [];
  destination = new MockNode(this);
  createGain(): MockGain {
    return new MockGain(this);
  }
  createOscillator(): MockOsc {
    return new MockOsc(this);
  }
  createBiquadFilter(): MockFilter {
    return new MockFilter(this);
  }
  createBufferSource(): MockBufferSource {
    return new MockBufferSource(this);
  }
  createBuffer(_ch: number, length: number, rate: number): MockBuffer {
    return new MockBuffer(length, rate);
  }
  /** 止まった音源の ended を全部発火させる */
  endAll(): void {
    for (const n of this.nodes) {
      if (n instanceof MockSource && n.stopped !== null && n.onended) {
        const cb = n.onended;
        n.onended = null;
        cb();
      }
    }
  }
  connectedCount(): number {
    return this.nodes.filter((n) => n.connected.size > 0).length;
  }
}

const KINDS: SfxKind[] = [
  'clean',
  'wobble',
  'auto',
  'partner',
  'drop',
  'early',
  'clean-bonus',
  'showcase',
  'record-open',
  'prestige',
  'show-complete',
  'shown',
];

const SOUND = { master: 0.8, sfx: 0.8, click: true };

function make(): { ctx: MockContext; audio: ReturnType<typeof createAudio> } {
  const ctx = new MockContext();
  const audio = createAudio(ctx as unknown as AudioContext, SOUND);
  return { ctx, audio };
}

describe('audio', () => {
  it('AudioContext が無ければ全部 no-op', () => {
    const audio = createAudio(null, SOUND);
    for (const k of KINDS) audio.sfx(k);
    audio.scheduleClick(0, true, true);
    audio.setAmbience('street');
    audio.setSettings({ ...SOUND, master: 0 });
    expect(audio.stats().voices).toBe(0);
  });

  it('全 kind の sfx を 50 回ずつ鳴らしても例外が出ず、ボイスは上限を超えない', () => {
    const { ctx, audio } = make();
    for (const k of KINDS) {
      for (let i = 0; i < 50; i++) {
        audio.sfx(k);
        expect(audio.stats().voices).toBeLessThanOrEqual(MAX_VOICES);
      }
    }
    expect(audio.stats().voices).toBe(MAX_VOICES);
    // 奪われたボイスはフェード後の保証時刻で解放される
    ctx.currentTime += 5;
    audio.sfx('clean');
    expect(audio.stats().voices).toBe(1);
    ctx.endAll();
    expect(audio.stats().voices).toBe(0);
    // 残っているのはバス（master / sfx / click / ambience）だけ
    expect(ctx.connectedCount()).toBeLessThanOrEqual(4);
  });

  it('scheduleClick は拍の時刻に予約し、過去なら即時。見せ場・アクセントも鳴る', () => {
    const { ctx, audio } = make();
    for (let i = 0; i < 50; i++) {
      audio.scheduleClick((ctx.currentTime + 0.5) * 1000, i % 4 === 0, i % 8 < 4);
      expect(audio.stats().voices).toBeLessThanOrEqual(MAX_VOICES);
    }
    expect(ctx.starts.every((t) => Math.abs(t - (ctx.currentTime + 0.5)) < 1e-9)).toBe(true);
    ctx.starts.length = 0;
    audio.scheduleClick((ctx.currentTime - 1) * 1000, false);
    expect(ctx.starts.every((t) => t === ctx.currentTime)).toBe(true);
    ctx.endAll();
    expect(audio.stats().voices).toBe(0);
  });

  it('クリックをオフにするとノードを作らない', () => {
    const { ctx, audio } = make();
    audio.setSettings({ ...SOUND, click: false });
    const before = ctx.nodes.length;
    audio.scheduleClick((ctx.currentTime + 1) * 1000, true);
    expect(ctx.nodes.length).toBe(before);
  });

  it('環境音は切り替え・停止・オフで後片付けされる', () => {
    const { ctx, audio } = make();
    audio.setAmbience('street');
    const after = ctx.connectedCount();
    expect(after).toBeGreaterThan(4);
    audio.setAmbience('street'); // 同じなら何もしない
    expect(ctx.connectedCount()).toBe(after);
    audio.setAmbience('stage');
    ctx.currentTime += 2;
    ctx.endAll();
    audio.setAmbience(null);
    ctx.currentTime += 2;
    ctx.endAll();
    expect(ctx.connectedCount()).toBeLessThanOrEqual(4);
    audio.setAmbienceEnabled(false);
    audio.setAmbience('stage');
    expect(ctx.connectedCount()).toBeLessThanOrEqual(4);
    audio.setAmbienceEnabled(true);
    expect(ctx.connectedCount()).toBeGreaterThan(4);
  });

  it('同時に 20 回鳴らしても、終われば全部外れる', () => {
    const { ctx, audio } = make();
    for (let i = 0; i < 20; i++) {
      audio.sfx('drop');
      audio.scheduleClick(ctx.currentTime * 1000, false);
    }
    expect(audio.stats().voices).toBeLessThanOrEqual(MAX_VOICES);
    ctx.currentTime += 3;
    ctx.endAll();
    expect(audio.stats().voices).toBe(0);
    expect(ctx.connectedCount()).toBeLessThanOrEqual(4);
  });
});
