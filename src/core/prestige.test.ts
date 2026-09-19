import { describe, expect, it } from 'vitest';
import { applyPrestige, prestigeRequirement } from './prestige';
import { fresh } from './state';

describe('球数追加', () => {
  it('3 球: 3 / 441 / 531 のクリーン各 1 とコア 1 が条件', () => {
    const s = fresh();
    s.patClean = { '3': 1, '441': 1 };
    s.core = 1;
    const r = prestigeRequirement(s);
    expect(r.ok).toBe(false);
    expect(r.patterns).toEqual([
      { id: '3', ok: true },
      { id: '441', ok: true },
      { id: '531', ok: false },
    ]);
    expect(applyPrestige(s)).toBe('blocked');
    s.patClean['531'] = 1;
    expect(applyPrestige(s)).toBe('advanced');
    expect(s.balls).toBe(4);
    expect(s.core).toBe(0);
    expect(s.pattern).toBe('4');
    expect(s.tree).toEqual({}); // ツリーは持ち越し
  });

  it('4 球: 4 と 53 のクリーンとコア 1 で完走（試作の終点。コアは消費しない）', () => {
    const s = fresh();
    s.balls = 4;
    s.patClean = { '4': 1, '53': 1 };
    s.core = 1;
    expect(prestigeRequirement(s).isFinal).toBe(true);
    expect(applyPrestige(s)).toBe('done');
    expect(s.done).toBe(true);
    expect(s.core).toBe(1);
    expect(applyPrestige(s)).toBe('blocked');
  });
});
