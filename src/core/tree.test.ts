import { describe, expect, it } from 'vitest';
import { buy, canBuy, derived, missingRequirements, nextCost } from './tree';
import { fresh } from './state';
import { unlockedPatterns } from './patterns';

describe('スキルツリー', () => {
  it('コストは段階ごとに上がる', () => {
    const s = fresh();
    expect(nextCost(s, 'prec')).toEqual({ currency: 'catch', amount: 20 });
    s.tree.prec = 1;
    expect(nextCost(s, 'prec')).toEqual({ currency: 'catch', amount: 32 });
    s.tree.prec = 5;
    expect(nextCost(s, 'prec')).toBeNull();
  });

  it('前提を満たさないと買えない', () => {
    const s = fresh();
    s.clean = 10;
    expect(missingRequirements(s, 'asym')).toEqual([{ id: 'prec', level: 3 }]);
    expect(canBuy(s, 'asym')).toBe(false);
    s.tree.prec = 3;
    expect(canBuy(s, 'asym')).toBe(true);
    expect(buy(s, 'asym')).toBe(true);
    expect(s.clean).toBe(7);
    expect(s.tree.asym).toBe(1);
    expect(buy(s, 'asym')).toBe(false); // max 1
  });

  it('通貨が足りなければ買えず、状態は変わらない', () => {
    const s = fresh();
    s.catch = 19;
    expect(buy(s, 'prec')).toBe(false);
    expect(s.catch).toBe(19);
    expect(s.tree.prec).toBeUndefined();
  });

  it('派生値', () => {
    const s = fresh();
    s.tree = { speed: 5, prec: 5, stam: 5, breath: 3, read: 4, chase: 3, auto: 8, flow: 1 };
    expect(derived(s)).toEqual({
      intervalMs: 445,
      toleranceMs: 200,
      fatigueRate: expect.closeTo(0.008, 6) as number,
      breath: expect.closeTo(0.018, 6) as number,
      read: expect.closeTo(0.6, 6) as number,
      chase: expect.closeTo(0.36, 6) as number,
      auto: expect.closeTo(0.8, 6) as number,
      flowMs: 40,
      applauseMult: 1,
      showoffBonus: 10,
      initialFatigueRelief: 0,
    });
  });

  it('パターンの解放はノードと球数で決まる', () => {
    const s = fresh();
    expect(unlockedPatterns(s)).toEqual(['3']);
    s.tree.asym = 1;
    expect(unlockedPatterns(s)).toEqual(['3', '441']);
    s.tree.high = 1;
    s.balls = 4;
    expect(unlockedPatterns(s)).toEqual(['3', '441', '531', '4', '53', '552']);
  });
});
