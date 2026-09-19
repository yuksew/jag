// 拍のスケジューリングと判定。状態を持たない純粋関数だけを置く。
// 時刻はすべてミリ秒で引数に受け取り、乱数は Rng で受け取る。
import { TUNING } from './tuning';
import type { Ms, Rng, Verdict } from './types';

export interface Beat {
  /** 何拍目か（0 始まり） */
  k: number;
  /** 拍の時刻 */
  at: Ms;
  /** 筋記憶による自動投げの拍か */
  auto: boolean;
  /** この拍の投げが済んだか */
  thrown: boolean;
}

/** k 拍目の時刻。t0 はラン開始時刻で、最初の拍は 1 間隔後 */
export function beatAt(t0: Ms, intervalMs: number, k: number): Ms {
  return t0 + intervalMs * (k + 1);
}

/** 次の拍を作る。自動投げかどうかはこの時点で決まる */
export function scheduleBeat(t0: Ms, intervalMs: number, k: number, autoProb: number, rng: Rng): Beat {
  return { k, at: beatAt(t0, intervalMs, k), auto: rng() < autoProb, thrown: false };
}

/** 見せ場の開始拍 */
export function showcaseStart(cores: number): number {
  return TUNING.showcase.baseAt + TUNING.showcase.perCore * cores;
}

/** k 拍目が見せ場か */
export function inShowcase(k: number, showcaseAt: number): boolean {
  return k >= showcaseAt && k < showcaseAt + TUNING.showcase.lengthBeats;
}

/** k 拍目が見せ場の最終拍か（この拍の投げが成立すればコア +1） */
export function isShowcaseFinal(k: number, showcaseAt: number): boolean {
  return k === showcaseAt + TUNING.showcase.lengthBeats - 1;
}

export interface ToleranceInput {
  /** ツリーの許容幅 × パターン係数 */
  baseToleranceMs: number;
  /** 0〜（1 で頭打ち） */
  fatigue: number;
  /** 見せ場の拍か */
  showcase: boolean;
  /** 直前の拍が自動投げだったか */
  afterAuto: boolean;
  /** 「流れ」のボーナス（未習得なら 0） */
  flowBonusMs: number;
}

/**
 * 実効許容幅。
 * 基本 × (1 − 0.5 × min(疲労, 1)) × (見せ場なら 0.65) + (自動投げ直後なら流れ)
 */
export function effectiveTolerance(i: ToleranceInput): number {
  let t = i.baseToleranceMs;
  t *= 1 - TUNING.fatigue.toleranceShrink * Math.min(i.fatigue, 1);
  if (i.showcase) t *= TUNING.showcase.toleranceFactor;
  if (i.afterAuto) t += i.flowBonusMs;
  return t;
}

/** 誤差の絶対値と許容幅だけで決まる判定（目のスキルを掛ける前） */
export function verdictFromError(errorMs: number, toleranceMs: number): Verdict {
  const e = Math.abs(errorMs);
  if (e <= toleranceMs) return 'clean';
  if (e <= toleranceMs * TUNING.beat.wobbleFactor) return 'wobble';
  return 'drop';
}

export interface EyeSkills {
  /** wobble → clean の確率 */
  read: number;
  /** drop → wobble の確率 */
  chase: number;
}

/** 目のスキルを適用する。追い目で drop を wobble に留め、先読みで wobble を clean に立て直す */
export function applyEye(v: Verdict, eye: EyeSkills, rng: Rng): Verdict {
  let out = v;
  if (out === 'drop' && rng() < eye.chase) out = 'wobble';
  if (out === 'wobble' && rng() < eye.read) out = 'clean';
  return out;
}

/** 入力の結果。early は「早すぎて無視」（ミスにならず、拍はそのまま待つ） */
export type InputResult = Verdict | 'early';

export interface JudgeInput {
  now: Ms;
  beat: Beat;
  /** 疲労などを掛ける前の許容幅（早すぎ判定に使う） */
  baseToleranceMs: number;
  /** effectiveTolerance の結果 */
  toleranceMs: number;
  eye: EyeSkills;
  rng: Rng;
}

/** 拍より 基本許容幅 × earlyIgnoreFactor 以上早い入力は無視する */
export function isTooEarly(now: Ms, beat: Beat, baseToleranceMs: number): boolean {
  return now < beat.at - TUNING.beat.earlyIgnoreFactor * baseToleranceMs;
}

/** 1 回の入力を判定する。呼び出し側は自動拍・投げ済みの拍では呼ばない */
export function judgeInput(i: JudgeInput): InputResult {
  if (isTooEarly(i.now, i.beat, i.baseToleranceMs)) return 'early';
  return applyEye(verdictFromError(i.now - i.beat.at, i.toleranceMs), i.eye, i.rng);
}

/** 未入力を drop にする締切時刻 */
export function missDeadline(beat: Beat, baseToleranceMs: number, effectiveToleranceMs: number): Ms {
  const t = TUNING.beat.missDeadlineUsesBaseTolerance ? baseToleranceMs : effectiveToleranceMs;
  return beat.at + TUNING.beat.missFactor * t;
}

export function isMissed(now: Ms, beat: Beat, baseToleranceMs: number, effectiveToleranceMs: number): boolean {
  return !beat.thrown && !beat.auto && now > missDeadline(beat, baseToleranceMs, effectiveToleranceMs);
}

/** 自動拍の投げ時刻に達したか */
export function isAutoDue(now: Ms, beat: Beat): boolean {
  return !beat.thrown && beat.auto && now >= beat.at;
}
