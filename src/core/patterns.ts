import type { SaveState } from './state';
import { level, type NodeId } from './tree';
import { TUNING } from './tuning';
import type { Hand } from './types';
import { otherHand } from './types';

export type PatternId = '3' | '441' | '531' | '4' | '53';

export interface Pattern {
  readonly id: PatternId;
  readonly siteswap: readonly number[];
  readonly balls: number;
  /** キャッチ倍率 */
  readonly catchMult: number;
  /** 許容幅係数 */
  readonly toleranceFactor: number;
  /** 解放に必要なツリーのノード（無ければ球数だけで解放） */
  readonly unlockNode?: NodeId;
}

export const PATTERNS: Readonly<Record<PatternId, Pattern>> = {
  '3': { id: '3', siteswap: [3], balls: 3, catchMult: 1, toleranceFactor: 1 },
  '441': { id: '441', siteswap: [4, 4, 1], balls: 3, catchMult: 1.5, toleranceFactor: 0.9, unlockNode: 'asym' },
  '531': { id: '531', siteswap: [5, 3, 1], balls: 3, catchMult: 2, toleranceFactor: 0.8, unlockNode: 'high' },
  '4': { id: '4', siteswap: [4], balls: 4, catchMult: 2.5, toleranceFactor: 0.75 },
  '53': { id: '53', siteswap: [5, 3], balls: 4, catchMult: 3.5, toleranceFactor: 0.65 },
};

/** 表示順 */
export const PATTERN_ORDER: readonly PatternId[] = ['3', '441', '531', '4', '53'];

export function patternsForBalls(balls: number): Pattern[] {
  return PATTERN_ORDER.map((id) => PATTERNS[id]).filter((p) => p.balls === balls);
}

/** 所持球数以下のパターン（一覧表示用。解放済みかは別） */
export function patternsUpTo(balls: number): Pattern[] {
  return PATTERN_ORDER.map((id) => PATTERNS[id]).filter((p) => p.balls <= balls);
}

/** k 拍目のサイトスワップ値 */
export function throwValue(p: Pattern, k: number): number {
  const v = p.siteswap[k % p.siteswap.length];
  return v ?? 0;
}

/** k 拍目に投げる手。拍ごとに交互 */
export function throwingHand(k: number): Hand {
  return k % 2 === 0 ? 0 : 1;
}

/** 奇数値は反対の手に渡る */
export function landingHand(from: Hand, value: number): Hand {
  return value % 2 === 1 ? otherHand(from) : from;
}

/** ラン開始時の球の配置。奇数球は右手（0）に 1 つ多く持つ */
export function initialHands(balls: number): Hand[] {
  const hands: Hand[] = [];
  for (let i = 0; i < balls; i++) hands.push(i % 2 === 0 ? 0 : 1);
  return hands;
}

/** 投げ 1 回のキャッチ獲得量 */
export function catchGain(p: Pattern, balls: number): number {
  return Math.round(p.catchMult * (1 + TUNING.catches.perExtraBall * (balls - TUNING.balls.start)));
}

/** パターンが解放済みか。球数が足りていて、必要ならノードを 1 段階以上持っている */
export function isPatternUnlocked(state: SaveState, id: PatternId): boolean {
  const p = PATTERNS[id];
  if (p.balls > state.balls) return false;
  return p.unlockNode === undefined || level(state, p.unlockNode) > 0;
}

/** 解放済みのパターン（表示順） */
export function unlockedPatterns(state: SaveState): PatternId[] {
  return PATTERN_ORDER.filter((id) => isPatternUnlocked(state, id));
}
