import { describe, expect, it } from 'vitest';
import { isPatternUnlocked } from './patterns';
import { applyPrestige } from './prestige';
import { createRun, startRun } from './run';
import { canSeal, hasSealAt, initialFatigue, seal, sealsBelow } from './seal';
import { fresh } from './state';
import { buy, canBuy, derived } from './tree';
import { TUNING } from './tuning';
import type { Rng } from './types';

const never: Rng = () => 0.999;

describe('封印', () => {
  it('クリーンのあるパターンだけ封印でき、球数ごとに 1 つまで。7 球は封印できない', () => {
    const s = fresh();
    expect(canSeal(s, '3')).toBe(false);
    s.patClean = { '3': 1, '441': 2, '7': 1 };
    expect(canSeal(s, '3')).toBe(true);
    expect(seal(s, '3')).toBe(true);
    expect(hasSealAt(s, 3)).toBe(true);
    expect(canSeal(s, '441')).toBe(false);
    expect(seal(s, '3')).toBe(false);
    s.balls = 7;
    expect(canSeal(s, '7')).toBe(false);
  });

  it('封印したパターンは選べなくなり、選択中なら同じ球数の別パターンに戻る', () => {
    const s = fresh();
    s.patClean = { '3': 1 };
    s.pattern = '3';
    seal(s, '3');
    expect(isPatternUnlocked(s, '3')).toBe(false);
    expect(s.pattern).toBe('441');
  });

  it('初期疲労は球数で上がり、それより少ない球数の封印で下がる', () => {
    const s = fresh();
    expect(initialFatigue(s)).toBe(0);
    s.balls = 5;
    expect(initialFatigue(s)).toBeCloseTo(0.1);
    s.sealed = ['3'];
    expect(sealsBelow(s, 5)).toBe(1);
    expect(initialFatigue(s)).toBeCloseTo(0);
    s.balls = 7;
    s.sealed = ['3', '4', '5'];
    expect(initialFatigue(s)).toBeCloseTo(0.3 - 0.3);
    s.sealed = ['3', '4', '5', '6'];
    expect(initialFatigue(s)).toBe(0); // 0 未満にならない
  });

  it('ランは初期疲労から始まる', () => {
    const s = fresh();
    s.balls = 6;
    s.pattern = '6';
    const run = createRun();
    startRun(run, s, 0, never);
    expect(run.fatigue).toBeCloseTo(TUNING.balls.initialFatigue[6]);
  });
});

describe('体得点', () => {
  it('球数を上げると 1 点入る', () => {
    const s = fresh();
    s.patClean = { '3': 1, '441': 1, '531': 1 };
    s.core = 1;
    expect(applyPrestige(s)).toBe('advanced');
    expect(s.sp).toBe(1);
  });

  it('体得ノードは基本ノードが最大で、体得点があるときだけ買える', () => {
    const s = fresh();
    s.sp = 1;
    expect(canBuy(s, 'form')).toBe(false);
    s.tree.prec = 5;
    expect(canBuy(s, 'form')).toBe(true);
    expect(buy(s, 'form')).toBe(true);
    expect(s.sp).toBe(0);
    expect(derived(s).toleranceMs).toBe(140 + 60 + TUNING.mastery.formToleranceMs);
    s.tree.read = 4;
    expect(canBuy(s, 'vision')).toBe(false); // 体得点が無い
  });

  it('各体得の効果', () => {
    const s = fresh();
    s.tree = { read: 4, vision: 1, stam: 5, core: 1, auto: 8, flow: 1, zen: 1, convert: 5, flair: 1 };
    const d = derived(s);
    expect(d.chase).toBeCloseTo(TUNING.mastery.visionChase);
    expect(d.initialFatigueRelief).toBe(TUNING.mastery.coreFatigue);
    expect(d.flowMs).toBe(TUNING.memory.flowBonusMs * TUNING.mastery.zenFlowMult);
    expect(d.applauseMult).toBeCloseTo((1 + 0.15 * 5) * TUNING.mastery.flairApplauseMult);
    s.balls = 5;
    expect(initialFatigue(s)).toBeCloseTo(0.1 - TUNING.mastery.coreFatigue);
  });
});
