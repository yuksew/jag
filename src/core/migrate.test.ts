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

  it('v1 → v2: クラブ・拍手・フラッシュの既定値が入る', () => {
    const s = migrate({ version: 1, catch: 5, balls: 4, pattern: '53' });
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.mode).toBe('ball');
    expect(s.spins).toBe(1);
    expect(s.clubClean).toEqual({});
    expect(s.applause).toBe(0);
    expect(s.flash7).toBe(false);
  });

  it('v2 のクラブの記録を読む', () => {
    const s = migrate({ version: 2, mode: 'club', spins: 2, clubClean: { '1': 3, '2': 1, '9': 4 }, applause: 12 });
    expect(s.mode).toBe('club');
    expect(s.spins).toBe(2);
    expect(s.clubClean).toEqual({ 1: 3, 2: 1 });
    expect(s.applause).toBe(12);
  });

  it('v3: 路上で見せたパターン（不正な id は捨てる）', () => {
    const s = migrate({ version: 3, mode: 'street', shown: ['5', 'bogus', '441'] });
    expect(s.mode).toBe('street');
    expect(s.shown).toEqual(['5', '441']);
    expect(migrate({ version: 2, mode: 'street' }).mode).toBe('street');
  });

  it('v4: パッシングのクリーン', () => {
    const s = migrate({ version: 4, mode: 'passing', passClean: { '75': 2, 'x': 1 } });
    expect(s.mode).toBe('passing');
    expect(s.passClean).toEqual({ '75': 2 });
    expect(migrate({ version: 3 }).passClean).toEqual({});
  });

  it('v5: 体得点と封印', () => {
    const s = migrate({ version: 5, sp: 2, sealed: ['3', 'nope'] });
    expect(s.sp).toBe(2);
    expect(s.sealed).toEqual(['3']);
    const old = migrate({ version: 4 });
    expect(old.sp).toBe(0);
    expect(old.sealed).toEqual([]);
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
