import { describe, expect, it } from 'vitest';
import { isSpinUnlocked, selectClub, unlockedSpins } from './club';
import { ballEffects, catchGain, clubPattern } from './patterns';
import { createRun, handleInput, startRun, tick, toleranceAt } from './run';
import { fresh } from './state';
import { TUNING } from './tuning';
import type { Rng } from './types';

const never: Rng = () => 0.999;

describe('クラブ: 回転数', () => {
  it('1 回転は最初から。2 回転は 1 回転のクリーン 3、3 回転は 2 回転のクリーン 3 で解放', () => {
    const s = fresh();
    expect(unlockedSpins(s)).toEqual([1]);
    expect(selectClub(s, 2)).toBe(false);
    s.clubClean = { 1: 3 };
    expect(isSpinUnlocked(s, 2)).toBe(true);
    expect(isSpinUnlocked(s, 3)).toBe(false);
    s.clubClean = { 1: 3, 2: 3 };
    expect(unlockedSpins(s)).toEqual([1, 2, 3]);
    expect(selectClub(s, 3)).toBe(true);
    expect(s.mode).toBe('club');
    expect(s.spins).toBe(3);
  });

  it('回転数が上がると許容幅が狭まり、キャッチと高度が増える', () => {
    const p1 = clubPattern(4, 1);
    const p3 = clubPattern(4, 3);
    expect(p1.siteswap).toEqual([4]);
    expect(p3.toleranceFactor).toBeLessThan(p1.toleranceFactor);
    expect(p3.catchMult).toBeGreaterThan(p1.catchMult);
    expect(p3.heightFactor).toBeGreaterThan(p1.heightFactor);
    expect(catchGain(p3, 4)).toBe(Math.round(3.2 * 1.5));
  });
});

describe('クラブ: ラン', () => {
  it('クラブ練習のクリーンは回転数別に記録され、球のパターンには入らない', () => {
    const s = fresh();
    s.balls = 4;
    selectClub(s, 1);
    const run = createRun();
    startRun(run, s, 0, never);
    expect(run.prop).toBe('club');
    expect(run.pattern.id).toBe('club1');
    expect(run.balls).toHaveLength(4);
    expect(run.baseToleranceMs).toBeCloseTo(140 * TUNING.club.toleranceFactor[1] * TUNING.balls.toleranceFactor[4]);
    for (let i = 0; i < 30; i++) {
      const at = run.next?.at ?? 0;
      tick(run, s, at - 1, never);
      const events = handleInput(run, s, at, never);
      if (i === 29) expect(events.at(-1)).toMatchObject({ type: 'clean', prop: 'club', spins: 1, patternId: 'club1', count: 1 });
    }
    expect(s.clubClean).toEqual({ 1: 1 });
    expect(s.patClean).toEqual({});
    expect(s.clean).toBe(1);
  });

  it('3 回転は 1 回転より許容幅が狭い', () => {
    const s = fresh();
    s.balls = 4;
    s.clubClean = { 1: 3, 2: 3 };
    const r1 = createRun();
    selectClub(s, 1);
    startRun(r1, s, 0, never);
    const r3 = createRun();
    selectClub(s, 3);
    startRun(r3, s, 0, never);
    expect(toleranceAt(r3, 0)).toBeLessThan(toleranceAt(r1, 0));
  });
});

describe('球数ごとの効果', () => {
  it('球が増えると許容幅係数が下がり、クリーン間隔が縮み、高度が上がる', () => {
    const e3 = ballEffects(3);
    const e7 = ballEffects(7);
    expect(e3).toEqual({ toleranceFactor: 1, cleanEvery: 30, heightFactor: 1 });
    expect(e7.toleranceFactor).toBeLessThan(e3.toleranceFactor);
    expect(e7.cleanEvery).toBeLessThan(e3.cleanEvery);
    expect(e7.heightFactor).toBeGreaterThan(e3.heightFactor);
    expect(ballEffects(99)).toEqual(e7);
  });

  it('7 球ではクリーン間隔が短くなり、ランに反映される', () => {
    const s = fresh();
    s.balls = 7;
    s.pattern = '7';
    const run = createRun();
    startRun(run, s, 0, never);
    expect(run.cleanEvery).toBe(TUNING.clean.everyBeats[7]);
    expect(run.balls).toHaveLength(7);
  });

  it('7 球すべてが空中になると 7 球フラッシュ', () => {
    const s = fresh();
    s.balls = 7;
    s.pattern = '7';
    const run = createRun();
    startRun(run, s, 0, never);
    let flashed = false;
    for (let i = 0; i < 7; i++) {
      const at = run.next?.at ?? 0;
      tick(run, s, at - 1, never);
      const events = handleInput(run, s, at, never);
      if (events.some((e) => e.type === 'flash7')) flashed = true;
    }
    expect(flashed).toBe(true);
    expect(s.flash7).toBe(true);
  });
});
