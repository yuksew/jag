import { afterEach, describe, expect, it } from 'vitest';
import { applyTuningOverride, restoreTuning, snapshotTuning } from './override';
import { TUNING } from './tuning';

const original = snapshotTuning();
afterEach(() => restoreTuning(original));

describe('tuning の上書き', () => {
  it('既存のキーに同じ型の値があれば書き換える', () => {
    const r = applyTuningOverride({ beat: { baseIntervalMs: 500, missDeadlineUsesBaseTolerance: false }, clean: { everyBeats: { 3: 10 } } });
    expect(r.applied).toEqual(['beat.baseIntervalMs', 'beat.missDeadlineUsesBaseTolerance', 'clean.everyBeats.3']);
    expect(r.rejected).toEqual([]);
    expect(TUNING.beat.baseIntervalMs).toBe(500);
    expect(TUNING.beat.missDeadlineUsesBaseTolerance).toBe(false);
    expect(TUNING.clean.everyBeats[3]).toBe(10);
    expect(TUNING.clean.everyBeats[4]).toBe(30);
  });

  it('無いキー、型違い、NaN は無視して報告する', () => {
    const r = applyTuningOverride({ beat: { nope: 1, baseIntervalMs: 'fast' }, fatigue: 5, showcase: { baseAt: Number.NaN } });
    expect(r.applied).toEqual([]);
    expect(r.rejected).toEqual(['beat.nope', 'beat.baseIntervalMs', 'fatigue', 'showcase.baseAt']);
    expect(TUNING.beat.baseIntervalMs).toBe(620);
  });

  it('オブジェクト以外は丸ごと拒否', () => {
    expect(applyTuningOverride(null).rejected).toEqual(['(root)']);
    expect(applyTuningOverride([1]).rejected).toEqual(['(root)']);
  });

  it('snapshot で元に戻せる', () => {
    applyTuningOverride({ beat: { baseIntervalMs: 100 } });
    restoreTuning(original);
    expect(TUNING.beat.baseIntervalMs).toBe(620);
  });
});
