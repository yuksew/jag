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

  it('4 球: 4 / 53 / 552 のクリーンとコア 1 で 5 球へ。クラブ練習中でも球の練習に戻る', () => {
    const s = fresh();
    s.balls = 4;
    s.mode = 'club';
    s.patClean = { '4': 1, '53': 1 };
    s.core = 1;
    expect(prestigeRequirement(s).ok).toBe(false);
    s.patClean['552'] = 1;
    expect(prestigeRequirement(s).isFinal).toBe(false);
    expect(applyPrestige(s)).toBe('advanced');
    expect(s.balls).toBe(5);
    expect(s.pattern).toBe('5');
    expect(s.mode).toBe('ball');
  });

  it('3 球から 7 球まで順に上がる。7 球が上限で、完走は舞台に任せる', () => {
    const s = fresh();
    const chain: Record<number, string[]> = {
      3: ['3', '441', '531'],
      4: ['4', '53', '552'],
      5: ['5', '645', '744'],
      6: ['6', '75', '756'],
    };
    for (const balls of [3, 4, 5, 6]) {
      expect(s.balls).toBe(balls);
      for (const id of chain[balls] ?? []) s.patClean[id as '3'] = 1;
      s.core = 1;
      expect(applyPrestige(s)).toBe('advanced');
      expect(s.core).toBe(0);
    }
    expect(s.balls).toBe(7);
    const r = prestigeRequirement(s);
    expect(r.nextBalls).toBeNull();
    expect(r.isFinal).toBe(true);
    expect(r.patterns.map((p) => p.id)).toEqual(['7']);
    s.patClean['7'] = 1;
    s.core = 1;
    expect(prestigeRequirement(s).ok).toBe(false);
    expect(applyPrestige(s)).toBe('blocked');
    expect(s.done).toBe(false);
    expect(s.balls).toBe(7);
  });
});
