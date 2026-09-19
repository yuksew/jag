import { describe, expect, it } from 'vitest';
import { migrate, MigrateError } from './migrate';
import { fresh, SAVE_VERSION } from './state';

describe('セーブの移行', () => {
  it('試作（version 無し）の localStorage 形式を読める', () => {
    const proto = {
      catch: 12,
      clean: 3,
      core: 1,
      totalCatches: 340,
      bestRun: 41,
      runs: 9,
      tree: { prec: 2, asym: 1, bogus: 3 },
      balls: 3,
      pattern: '441',
      patClean: { '3': 2, '441': 1 },
      milestones: ['c100', 'r20', 'r40'],
      recordOpen: true,
      done: false,
    };
    const s = migrate(proto);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.tree).toEqual({ prec: 2, asym: 1 });
    expect(s.pattern).toBe('441');
    expect(s.patClean).toEqual({ '3': 2, '441': 1 });
    expect(s.achievements).toEqual([]);
    expect(s.totalCatches).toBe(340);
  });

  it('最新版はそのまま通る', () => {
    const s = fresh();
    s.achievements = ['first_clean'];
    expect(migrate(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('壊れた値は初期値で埋める', () => {
    const s = migrate({ version: 1, catch: 'a lot', pattern: '999', tree: null });
    expect(s.catch).toBe(0);
    expect(s.pattern).toBe('3');
    expect(s.tree).toEqual({});
  });

  it('オブジェクトでない・未来の版は MigrateError', () => {
    expect(() => migrate(null)).toThrow(MigrateError);
    expect(() => migrate('{}')).toThrow(MigrateError);
    expect(() => migrate({ version: 99 })).toThrow(MigrateError);
  });
});
