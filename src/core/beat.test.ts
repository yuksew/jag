import { describe, expect, it } from 'vitest';
import {
  applyEye,
  beatAt,
  effectiveTolerance,
  inShowcase,
  isAutoDue,
  isMissed,
  isShowcaseFinal,
  judgeInput,
  missDeadline,
  scheduleBeat,
  showcaseStart,
  verdictFromError,
  type Beat,
} from './beat';
import { TUNING } from './tuning';
import type { Rng } from './types';

/** 決められた値を順に返す乱数。足りなくなったら最後の値を繰り返す */
const seq = (...values: number[]): Rng => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)] ?? 0;
};
const never: Rng = () => 0.999; // どの確率判定も失敗する
const always: Rng = () => 0; // どの確率判定も成功する

const beat = (at: number, extra: Partial<Beat> = {}): Beat => ({ k: 0, at, auto: false, thrown: false, ...extra });
const noEye = { read: 0, chase: 0 };

describe('拍のスケジューリング', () => {
  it('k 拍目は開始から (k+1) 間隔後', () => {
    expect(beatAt(1000, 620, 0)).toBe(1620);
    expect(beatAt(1000, 620, 4)).toBe(1000 + 620 * 5);
  });

  it('自動投げは確率で決まり、拍を作った時点で固定される', () => {
    expect(scheduleBeat(0, 620, 0, 0.5, seq(0.49)).auto).toBe(true);
    expect(scheduleBeat(0, 620, 0, 0.5, seq(0.5)).auto).toBe(false);
    expect(scheduleBeat(0, 620, 0, 0, always).auto).toBe(false);
    expect(scheduleBeat(0, 620, 3, 0.8, seq(0.79))).toEqual({ k: 3, at: 620 * 4, auto: true, thrown: false });
  });
});

describe('判定（clean / wobble / drop）', () => {
  const tol = 140;

  it('誤差 ≤ 許容幅 なら clean', () => {
    expect(verdictFromError(0, tol)).toBe('clean');
    expect(verdictFromError(140, tol)).toBe('clean');
    expect(verdictFromError(-140, tol)).toBe('clean');
  });

  it('誤差 ≤ 許容幅×2 なら wobble', () => {
    expect(verdictFromError(141, tol)).toBe('wobble');
    expect(verdictFromError(280, tol)).toBe('wobble');
    expect(verdictFromError(-280, tol)).toBe('wobble');
  });

  it('それ以上は drop', () => {
    expect(verdictFromError(281, tol)).toBe('drop');
    expect(verdictFromError(-1000, tol)).toBe('drop');
  });

  it('judgeInput は拍の時刻との差で判定する', () => {
    const b = beat(2000);
    const base = { beat: b, baseToleranceMs: tol, toleranceMs: tol, eye: noEye, rng: never };
    expect(judgeInput({ ...base, now: 2000 + 100 })).toBe('clean');
    expect(judgeInput({ ...base, now: 2000 - 200 })).toBe('wobble');
    expect(judgeInput({ ...base, now: 2000 + 300 })).toBe('drop');
  });

  it('拍より 基本許容幅×2 以上早い入力は early（無視）で、drop にならない', () => {
    const b = beat(2000);
    const base = { beat: b, baseToleranceMs: tol, toleranceMs: tol, eye: noEye, rng: never };
    expect(judgeInput({ ...base, now: 2000 - 281 })).toBe('early');
    // ちょうど −2×基本許容幅 は early ではなく通常の判定に入る
    expect(judgeInput({ ...base, now: 2000 - 280 })).toBe('wobble');
  });

  it('早すぎ判定は疲労で狭まった実効許容幅ではなく基本許容幅を使う', () => {
    const b = beat(2000);
    // 実効 70ms だが、基本 140ms の 2 倍 = 280ms 手前までは判定に入る
    const r = judgeInput({ now: 2000 - 250, beat: b, baseToleranceMs: tol, toleranceMs: 70, eye: noEye, rng: never });
    expect(r).toBe('drop');
  });
});

describe('目のスキル', () => {
  it('先読み: wobble を確率で clean に立て直す', () => {
    expect(applyEye('wobble', { read: 0.3, chase: 0 }, seq(0.29))).toBe('clean');
    expect(applyEye('wobble', { read: 0.3, chase: 0 }, seq(0.3))).toBe('wobble');
  });

  it('追い目: drop を確率で wobble に留める', () => {
    expect(applyEye('drop', { read: 0, chase: 0.24 }, seq(0.23))).toBe('wobble');
    expect(applyEye('drop', { read: 0, chase: 0.24 }, seq(0.24))).toBe('drop');
  });

  it('追い目で留めた wobble にはさらに先読みの抽選が入る（試作準拠）', () => {
    // 1 回目の乱数で追い目成功、2 回目で先読み成功
    expect(applyEye('drop', { read: 0.5, chase: 0.5 }, seq(0.1, 0.1))).toBe('clean');
    expect(applyEye('drop', { read: 0.5, chase: 0.5 }, seq(0.1, 0.9))).toBe('wobble');
  });

  it('clean には何もしない', () => {
    expect(applyEye('clean', { read: 1, chase: 1 }, always)).toBe('clean');
  });
});

describe('許容幅', () => {
  const base = { baseToleranceMs: 140, fatigue: 0, showcase: false, afterAuto: false, flowBonusMs: 0 };

  it('疲労 0 では基本値のまま', () => {
    expect(effectiveTolerance(base)).toBe(140);
  });

  it('疲労で線形に縮み、疲労 1 で半分になる', () => {
    expect(effectiveTolerance({ ...base, fatigue: 0.5 })).toBeCloseTo(140 * 0.75);
    expect(effectiveTolerance({ ...base, fatigue: 1 })).toBeCloseTo(70);
  });

  it('疲労は 1 で頭打ち（それ以上は縮まない）', () => {
    expect(effectiveTolerance({ ...base, fatigue: 3 })).toBeCloseTo(70);
  });

  it('見せ場では ×0.65', () => {
    expect(effectiveTolerance({ ...base, showcase: true })).toBeCloseTo(140 * TUNING.showcase.toleranceFactor);
    expect(effectiveTolerance({ ...base, showcase: true })).toBeCloseTo(91);
  });

  it('疲労と見せ場は掛け算で重なる', () => {
    expect(effectiveTolerance({ ...base, fatigue: 1, showcase: true })).toBeCloseTo(140 * 0.5 * 0.65);
  });

  it('流れ: 自動投げ直後は縮めた後に +40ms', () => {
    expect(effectiveTolerance({ ...base, afterAuto: true, flowBonusMs: 40 })).toBe(180);
    expect(effectiveTolerance({ ...base, fatigue: 1, afterAuto: true, flowBonusMs: 40 })).toBeCloseTo(70 + 40);
  });

  it('流れ未習得（ボーナス 0）や自動投げ直後でなければ加算しない', () => {
    expect(effectiveTolerance({ ...base, afterAuto: true, flowBonusMs: 0 })).toBe(140);
    expect(effectiveTolerance({ ...base, afterAuto: false, flowBonusMs: 40 })).toBe(140);
  });
});

describe('見せ場', () => {
  it('開始拍は 40 + 15 × コア', () => {
    expect(showcaseStart(0)).toBe(40);
    expect(showcaseStart(1)).toBe(55);
    expect(showcaseStart(3)).toBe(85);
  });

  it('開始拍から 5 拍だけ有効', () => {
    expect(inShowcase(39, 40)).toBe(false);
    expect(inShowcase(40, 40)).toBe(true);
    expect(inShowcase(44, 40)).toBe(true);
    expect(inShowcase(45, 40)).toBe(false);
  });

  it('最終拍は開始 + 4', () => {
    expect(isShowcaseFinal(44, 40)).toBe(true);
    expect(isShowcaseFinal(43, 40)).toBe(false);
    expect(isShowcaseFinal(45, 40)).toBe(false);
  });
});

describe('自動投げと未入力', () => {
  it('自動拍は拍の時刻に達したら投げる', () => {
    const b = beat(1000, { auto: true });
    expect(isAutoDue(999, b)).toBe(false);
    expect(isAutoDue(1000, b)).toBe(true);
    expect(isAutoDue(1000, { ...b, thrown: true })).toBe(false);
    expect(isAutoDue(5000, beat(1000))).toBe(false);
  });

  it('未入力の締切は拍 + 基本許容幅×2（疲労を反映しない、試作準拠）', () => {
    const b = beat(1000);
    expect(missDeadline(b, 140, 70)).toBe(1280);
    expect(isMissed(1280, b, 140, 70)).toBe(false);
    expect(isMissed(1281, b, 140, 70)).toBe(true);
  });

  it('自動拍と投げ済みの拍は未入力にならない', () => {
    expect(isMissed(9999, beat(1000, { auto: true }), 140, 140)).toBe(false);
    expect(isMissed(9999, beat(1000, { thrown: true }), 140, 140)).toBe(false);
  });
});
