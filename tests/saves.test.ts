// 各版のセーブ（tests/saves/）が最新で読めることを確認する。
// 版を上げるたびに、その版の実セーブを tests/saves/ に 1 つ足す（docs/STEAM.md「旧バージョンのセーブが最新で読める」）。
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fresh, migrate, SAVE_VERSION } from '../src/core';

const dir = join(__dirname, 'saves');
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();

describe('保管したセーブの移行', () => {
  it('v0 〜 現在の各版が揃っている', () => {
    const versions = files.map((f) => Number(/^v(\d+)/.exec(f)?.[1] ?? -1));
    for (let v = 0; v <= SAVE_VERSION; v++) expect(versions).toContain(v);
  });

  for (const f of files) {
    it(`${f} が最新の形になる`, () => {
      const raw = JSON.parse(readFileSync(join(dir, f), 'utf8')) as unknown;
      const s = migrate(raw);
      expect(s.version).toBe(SAVE_VERSION);
      // 最新の全キーがあり、余計なキーが無い
      expect(Object.keys(s).sort()).toEqual(Object.keys(fresh()).sort());
      expect(s.balls).toBeGreaterThanOrEqual(3);
      expect(s.balls).toBeLessThanOrEqual(7);
    });
  }
});
