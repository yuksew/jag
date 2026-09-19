import { describe, expect, it } from 'vitest';
import { fresh } from './state';
import { applauseRate, canConvert, convertCatches, manualYield, registerShown, selectStreet, streetPatterns } from './street';
import { createRun, handleInput, startRun, tick, type RunEvent } from './run';
import { TUNING } from './tuning';
import { canBuy, isBranchOpen } from './tree';
import type { Rng } from './types';

const never: Rng = () => 0.999;

function fiveBalls() {
  const s = fresh();
  s.balls = 5;
  s.pattern = '5';
  return s;
}

describe('路上: レート', () => {
  it('基本レートは悪く、見せたパターンが増えるほど上がる', () => {
    const s = fiveBalls();
    expect(applauseRate(s)).toBeCloseTo(0.02);
    s.shown = ['3', '441'];
    expect(applauseRate(s)).toBeCloseTo(0.02 * 1.6);
  });

  it('表現「変換」でレートが上がる。表現の系統は路上が開くまで買えない', () => {
    const s = fresh();
    s.catch = 10000;
    expect(isBranchOpen(s, 'expr')).toBe(false);
    expect(canBuy(s, 'convert')).toBe(false);
    s.balls = 5;
    expect(canBuy(s, 'convert')).toBe(true);
    s.tree.convert = 2;
    expect(applauseRate(s)).toBeCloseTo(0.02 * 1.3);
  });

  it('手動変換は路上より悪いレートで、100 キャッチ単位', () => {
    const s = fiveBalls();
    s.shown = ['3', '441', '531', '4', '53'];
    s.catch = 250;
    // 0.02 × 2.5 × 0.4 = 0.02/キャッチ → 100 で 2
    expect(manualYield(s)).toBe(2);
    expect(canConvert(s)).toBe(true);
    expect(convertCatches(s)).toBe(2);
    expect(s.catch).toBe(150);
    expect(s.applause).toBe(2);
  });

  it('レートが低すぎて 1 拍手にならない、またはキャッチ不足なら変換できない', () => {
    const s = fiveBalls();
    s.catch = 250;
    expect(manualYield(s)).toBe(0); // 0.02 × 0.4 × 100 = 0.8
    expect(canConvert(s)).toBe(false);
    expect(convertCatches(s)).toBe(0);
    s.shown = ['3', '441', '531', '4', '53'];
    s.catch = 99;
    expect(canConvert(s)).toBe(false);
  });
});

describe('路上: 見せる', () => {
  it('初めて見せたパターンにはボーナスの拍手。2 回目は 0', () => {
    const s = fiveBalls();
    expect(registerShown(s, '5')).toBe(10);
    expect(registerShown(s, '5')).toBe(0);
    expect(s.shown).toEqual(['5']);
    expect(s.applause).toBe(10);
    s.tree.showoff = 2;
    expect(registerShown(s, '645')).toBe(30);
  });

  it('路上で見せられるのは解放済みのパターン', () => {
    const s = fiveBalls();
    expect(streetPatterns(s)).toEqual(['3', '4', '53', '552', '5', '645', '744']);
    s.tree.asym = 1;
    expect(streetPatterns(s)).toContain('441');
  });

  it('5 球未満では路上に切り替えられない', () => {
    const s = fresh();
    expect(selectStreet(s)).toBe(false);
    s.balls = 5;
    expect(selectStreet(s)).toBe(true);
    expect(s.mode).toBe('street');
  });
});

describe('路上: ラン', () => {
  it('キャッチの代わりに拍手が入り、20 拍でそのパターンを見せたことになる', () => {
    const s = fiveBalls();
    selectStreet(s);
    const run = createRun();
    startRun(run, s, 0, never);
    expect(run.prop).toBe('street');
    expect(run.applauseRate).toBeCloseTo(0.02);
    const events: RunEvent[] = [];
    for (let i = 0; i < 25; i++) {
      const at = run.next?.at ?? 0;
      tick(run, s, at - 1, never);
      events.push(...handleInput(run, s, at, never));
    }
    // 5 カスケード: 4.5 × 2 = 9 キャッチ/拍 × 0.02 = 0.18 拍手/拍 → 25 拍で 4（端数は持ち越し）
    expect(s.catch).toBe(0);
    expect(s.totalCatches).toBe(9 * 25);
    expect(run.applause).toBe(4);
    expect(events.filter((e) => e.type === 'applause').map((e) => (e.type === 'applause' ? e.gain : 0))).toEqual([1, 1, 1, 1]);
    const shown = events.find((e) => e.type === 'shown');
    expect(shown).toMatchObject({ type: 'shown', patternId: '5', bonus: TUNING.street.newPatternBonus });
    expect(s.shown).toEqual(['5']);
    expect(s.applause).toBe(4 + TUNING.street.newPatternBonus);
  });

  it('レートはラン開始時に固定され、見せた直後のランから上がる', () => {
    const s = fiveBalls();
    selectStreet(s);
    s.shown = ['5'];
    const run = createRun();
    startRun(run, s, 0, never);
    expect(run.applauseRate).toBeCloseTo(0.02 * 1.3);
  });
});
