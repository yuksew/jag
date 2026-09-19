import { describe, expect, it } from 'vitest';
import { createRun, endRun, handleInput, startRun, tick, toleranceAt, type RunEvent } from './run';
import { fresh } from './state';
import { TUNING } from './tuning';
import type { Rng } from './types';

const never: Rng = () => 0.999;
const always: Rng = () => 0;

/** 拍にぴったり合わせて n 回投げる（自動投げ無し） */
function throwClean(run: ReturnType<typeof createRun>, state: ReturnType<typeof fresh>, n: number): RunEvent[] {
  const events: RunEvent[] = [];
  for (let i = 0; i < n; i++) {
    const at = run.next?.at ?? 0;
    events.push(...tick(run, state, at - 1, never));
    events.push(...handleInput(run, state, at, never));
  }
  return events;
}

describe('ランの開始', () => {
  it('ツリーとパターンから間隔と許容幅を固定し、最初の拍を予約する', () => {
    const state = fresh();
    state.tree.speed = 2;
    state.tree.prec = 1;
    state.pattern = '531';
    const run = createRun();
    expect(startRun(run, state, 1000, never)).toBe(true);
    expect(run.intervalMs).toBe(620 - 70);
    expect(run.baseToleranceMs).toBeCloseTo((140 + 12) * 0.8);
    expect(run.next).toEqual({ k: 0, at: 1000 + 550, auto: false, thrown: false });
    expect(run.balls).toHaveLength(3);
    expect(run.hands).toEqual([[0, 2], [1]]);
  });

  it('進行中・完走済みは開始できない', () => {
    const state = fresh();
    const run = createRun();
    startRun(run, state, 0, never);
    expect(startRun(run, state, 0, never)).toBe(false);
    const done = fresh();
    done.done = true;
    expect(startRun(createRun(), done, 0, never)).toBe(false);
  });
});

describe('投げと通貨', () => {
  it('clean の投げでキャッチが増え、ノーミスが伸びる', () => {
    const state = fresh();
    const run = createRun();
    startRun(run, state, 0, never);
    const events = throwClean(run, state, 3);
    expect(events.filter((e) => e.type === 'throw')).toHaveLength(3);
    expect(state.catch).toBe(3);
    expect(state.totalCatches).toBe(3);
    expect(run.streak).toBe(3);
    expect(run.beats).toBe(3);
  });

  it('キャッチ倍率はパターン係数 × (1 + 0.5 × (球数 − 3))', () => {
    const state = fresh();
    state.balls = 4;
    state.pattern = '53';
    const run = createRun();
    startRun(run, state, 0, never);
    throwClean(run, state, 1);
    expect(state.catch).toBe(Math.round(3.5 * 1.5));
  });

  it('wobble でノーミスが途切れる', () => {
    const state = fresh();
    const run = createRun();
    startRun(run, state, 0, never);
    throwClean(run, state, 2);
    const at = run.next?.at ?? 0;
    const events = handleInput(run, state, at + 200, never);
    expect(events[0]).toMatchObject({ type: 'throw', grade: 'wobble' });
    expect(run.streak).toBe(0);
    expect(run.on).toBe(true);
  });

  it('30 拍ノーミスごとにクリーン +1（パターン別に記録）', () => {
    const state = fresh();
    const run = createRun();
    startRun(run, state, 0, never);
    const events = throwClean(run, state, 60);
    const cleans = events.filter((e) => e.type === 'clean');
    expect(cleans).toHaveLength(2);
    expect(state.clean).toBe(2);
    expect(state.patClean['3']).toBe(2);
  });

  it('見せ場の最終拍を投げ切るとコア +1（1 ランに 1 回）', () => {
    const state = fresh();
    const run = createRun();
    startRun(run, state, 0, never);
    expect(run.showcaseAt).toBe(40);
    const events = throwClean(run, state, 45);
    expect(events.filter((e) => e.type === 'showcase-cleared')).toHaveLength(1);
    expect(state.core).toBe(1);
    throwClean(run, state, 10);
    expect(state.core).toBe(1);
  });

  it('見せ場の開始拍はラン開始時のコア数で決まる', () => {
    const state = fresh();
    state.core = 2;
    const run = createRun();
    startRun(run, state, 0, never);
    expect(run.showcaseAt).toBe(70);
  });
});

describe('疲労', () => {
  it('投げごとに増え、許容幅を縮める', () => {
    const state = fresh();
    const run = createRun();
    startRun(run, state, 0, never);
    throwClean(run, state, 10);
    expect(run.fatigue).toBeCloseTo(0.2);
    expect(toleranceAt(run, run.k)).toBeCloseTo(140 * (1 - 0.5 * 0.2));
  });

  it('持久で増加が抑えられ、呼吸で wobble 以外の投げごとに回復する', () => {
    const state = fresh();
    state.tree.stam = 5;
    state.tree.breath = 1;
    const run = createRun();
    startRun(run, state, 0, never);
    throwClean(run, state, 1);
    expect(run.fatigue).toBeCloseTo(0.02 * (1 - 0.6) - 0.006);
    // wobble では回復しない
    const at = run.next?.at ?? 0;
    handleInput(run, state, at + 200, never);
    expect(run.fatigue).toBeCloseTo(0.02 * 0.4 * 2 - 0.006);
  });

  it('呼吸の回復は 0 で止まる（マイナスにならない）', () => {
    const state = fresh();
    state.tree.stam = 5;
    state.tree.breath = 3;
    const run = createRun();
    startRun(run, state, 0, never);
    throwClean(run, state, 5);
    expect(run.fatigue).toBe(0);
  });
});

describe('筋記憶（自動投げ）と流れ', () => {
  it('自動拍は入力を無視し、拍の時刻に達すると勝手に投げる', () => {
    const state = fresh();
    state.tree.auto = 8;
    const run = createRun();
    startRun(run, state, 0, always); // 80% → 常に自動
    expect(run.next?.auto).toBe(true);
    const at = run.next?.at ?? 0;
    expect(handleInput(run, state, at, always)).toEqual([]);
    expect(tick(run, state, at - 1, always)).toEqual([]);
    const events = tick(run, state, at, always);
    expect(events[0]).toMatchObject({ type: 'throw', grade: 'auto', k: 0 });
    expect(run.streak).toBe(1);
    expect(run.lastAuto).toBe(true);
  });

  it('自動投げの直後の拍は流れで許容幅 +40ms', () => {
    const state = fresh();
    state.tree.auto = 8;
    state.tree.flow = 1;
    const run = createRun();
    startRun(run, state, 0, always);
    tick(run, state, run.next?.at ?? 0, always);
    expect(toleranceAt(run, run.k)).toBeCloseTo(140 * (1 - 0.5 * 0.02) + 40);
  });

  it('流れ未習得なら自動投げ直後でもボーナスは無い', () => {
    const state = fresh();
    state.tree.auto = 8;
    const run = createRun();
    startRun(run, state, 0, always);
    tick(run, state, run.next?.at ?? 0, always);
    expect(toleranceAt(run, run.k)).toBeCloseTo(140 * (1 - 0.5 * 0.02));
  });
});

describe('落球とラン終了', () => {
  it('大きく外した入力で落球し、記録と節目が更新される', () => {
    const state = fresh();
    const run = createRun();
    startRun(run, state, 0, never);
    throwClean(run, state, 25);
    const at = run.next?.at ?? 0;
    const events = handleInput(run, state, at + 500, never);
    expect(run.on).toBe(false);
    expect(events.map((e) => e.type)).toEqual(['drop', 'run-end', 'milestone']);
    expect(state.runs).toBe(1);
    expect(state.bestRun).toBe(25);
    expect(state.milestones).toContain('r20');
    expect(state.catch).toBe(25 + 20);
  });

  it('締切まで未入力なら tick で落球する', () => {
    const state = fresh();
    const run = createRun();
    startRun(run, state, 0, never);
    const at = run.next?.at ?? 0;
    expect(tick(run, state, at + 280, never)).toEqual([]);
    const events = tick(run, state, at + 281, never);
    expect(events[0]).toEqual({ type: 'drop' });
    expect(run.on).toBe(false);
  });

  it('早すぎる入力は無視され、ランは続く', () => {
    const state = fresh();
    const run = createRun();
    startRun(run, state, 0, never);
    const at = run.next?.at ?? 0;
    expect(handleInput(run, state, at - 400, never)).toEqual([{ type: 'early' }]);
    expect(run.on).toBe(true);
    expect(run.next?.thrown).toBe(false);
  });

  it('通算 100 キャッチに達した後のラン終了で記録帳が開く', () => {
    const state = fresh();
    const run = createRun();
    startRun(run, state, 0, never);
    throwClean(run, state, 100);
    expect(state.recordOpen).toBe(false);
    const events = endRun(run, state);
    expect(state.recordOpen).toBe(true);
    expect(events.some((e) => e.type === 'record-open')).toBe(true);
  });
});

describe('球の受け渡し', () => {
  it('奇数のサイトスワップは反対の手に、偶数は同じ手に着地する', () => {
    const state = fresh();
    state.pattern = '441';
    const run = createRun();
    startRun(run, state, 0, never);
    throwClean(run, state, 1); // 右手から 4 → 右手へ
    const first = run.balls[0]?.flight;
    expect(first).toMatchObject({ from: 0, to: 0 });
    throwClean(run, state, 2); // 左 4 → 左、右 1 → 左
    const third = run.balls[2]?.flight;
    expect(third).toMatchObject({ from: 0, to: 1 });
    const land = (first?.t0 ?? 0) + (first?.durationMs ?? 0);
    tick(run, state, land, never);
    expect(run.balls[0]?.flight).toBeNull();
    expect(run.hands[0]).toContain(0);
  });

  it('見せ場では高度が ×1.3', () => {
    const state = fresh();
    const run = createRun();
    startRun(run, state, 0, never);
    throwClean(run, state, 40);
    const beforeShowcase = run.balls.find((b) => b.flight)?.flight?.height ?? 0;
    throwClean(run, state, 1);
    const inShowcase = run.balls.map((b) => b.flight?.height ?? 0);
    expect(Math.max(...inShowcase)).toBeCloseTo(beforeShowcase * TUNING.showcase.heightFactor);
  });
});
