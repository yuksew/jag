import { describe, expect, it } from 'vitest';
import { passingPatterns, passRatio, selectPassing } from './passing';
import { createRun, handleInput, isPartnerNext, startRun, tick, toleranceAt, type RunEvent } from './run';
import { fresh } from './state';
import type { Rng } from './types';

const never: Rng = () => 0.999;

function sixBalls() {
  const s = fresh();
  s.balls = 6;
  s.pattern = '75';
  return s;
}

/** 偶数拍は自分が拍に合わせて投げ、奇数拍は相方に任せる */
function play(run: ReturnType<typeof createRun>, s: ReturnType<typeof fresh>, beats: number): RunEvent[] {
  const events: RunEvent[] = [];
  for (let i = 0; i < beats; i++) {
    const at = run.next?.at ?? 0;
    events.push(...tick(run, s, at - 1, never));
    if (isPartnerNext(run)) events.push(...tick(run, s, at, never));
    else events.push(...handleInput(run, s, at, never));
  }
  return events;
}

describe('パッシング: 選択', () => {
  it('6 球未満、または未解放のパターンでは切り替えられない', () => {
    const s = fresh();
    expect(selectPassing(s, '3')).toBe(false);
    s.balls = 6;
    expect(selectPassing(s, '441')).toBe(false);
    expect(selectPassing(s, '75')).toBe(true);
    expect(s.mode).toBe('passing');
    expect(s.pattern).toBe('75');
    expect(passingPatterns(s)).toContain('756');
  });

  it('奇数値がパスになる割合', () => {
    expect(passRatio([7, 5])).toBe(1);
    expect(passRatio([6])).toBe(0);
    expect(passRatio([7, 5, 6])).toBeCloseTo(2 / 3);
  });
});

describe('パッシング: ラン', () => {
  it('奇数拍は相方の投げで、入力なしで成立する', () => {
    const s = sixBalls();
    selectPassing(s, '75');
    const run = createRun();
    startRun(run, s, 0, never);
    expect(run.prop).toBe('passing');
    expect(isPartnerNext(run)).toBe(false);
    const at0 = run.next?.at ?? 0;
    handleInput(run, s, at0, never);
    expect(isPartnerNext(run)).toBe(true);
    expect(run.next?.auto).toBe(true);
    // 相方の拍では入力が無視される
    expect(handleInput(run, s, run.next?.at ?? 0, never)).toEqual([]);
    const events = tick(run, s, run.next?.at ?? 0, never);
    expect(events[0]).toMatchObject({ type: 'throw', grade: 'partner', k: 1 });
    expect(run.streak).toBe(2);
  });

  it('相方の投げでは疲労が増えず、流れのボーナスも付かない', () => {
    const s = sixBalls();
    s.tree.flow = 1;
    selectPassing(s, '75');
    const run = createRun();
    startRun(run, s, 0, never);
    const initial = run.fatigue; // 6 球の初期疲労
    play(run, s, 2);
    expect(run.fatigue).toBeCloseTo(initial + 0.02); // 自分の 1 投ぶんだけ
    expect(run.lastAuto).toBe(false);
    expect(toleranceAt(run, run.k)).toBeCloseTo(run.baseToleranceMs * (1 - 0.5 * (initial + 0.02)));
  });

  it('クリーンはパッシングの記録に入り、球数追加の条件には数えない', () => {
    const s = sixBalls();
    selectPassing(s, '75');
    const run = createRun();
    startRun(run, s, 0, never);
    const events = play(run, s, 24);
    expect(events.filter((e) => e.type === 'clean')).toHaveLength(1);
    expect(s.passClean).toEqual({ '75': 1 });
    expect(s.patClean).toEqual({});
    expect(s.clean).toBe(1);
  });

  it('自分の拍を外せば落球する', () => {
    const s = sixBalls();
    selectPassing(s, '75');
    const run = createRun();
    startRun(run, s, 0, never);
    play(run, s, 2);
    const at = run.next?.at ?? 0;
    const events = handleInput(run, s, at + 500, never);
    expect(events[0]).toEqual({ type: 'drop' });
    expect(run.on).toBe(false);
  });
});
