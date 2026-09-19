import type { SaveState } from './state';
import { level, type NodeId } from './tree';
import { ballCount, TUNING, type Spins } from './tuning';
import type { Hand } from './types';
import { otherHand } from './types';

export type PatternId = '3' | '441' | '531' | '4' | '53' | '552' | '5' | '645' | '744' | '6' | '75' | '756' | '7';
/** クラブ練習の疑似パターン id（回転数ごと） */
export type ClubId = `club${Spins}`;
export type PropPatternId = PatternId | ClubId;

export interface Pattern {
  readonly id: PropPatternId;
  readonly siteswap: readonly number[];
  readonly balls: number;
  /** キャッチ倍率 */
  readonly catchMult: number;
  /** 許容幅係数 */
  readonly toleranceFactor: number;
  /** 高度係数（クラブの回転数で上がる） */
  readonly heightFactor: number;
  /** 解放に必要なツリーのノード（無ければ球数だけで解放） */
  readonly unlockNode?: NodeId;
}

/** 球のパターン（クラブの疑似パターンを含まない） */
export interface BallPattern extends Pattern {
  readonly id: PatternId;
}

const ball = (id: PatternId, siteswap: number[], balls: number, catchMult: number, toleranceFactor: number, unlockNode?: NodeId): BallPattern =>
  unlockNode ? { id, siteswap, balls, catchMult, toleranceFactor, heightFactor: 1, unlockNode } : { id, siteswap, balls, catchMult, toleranceFactor, heightFactor: 1 };

// 倍率 / 許容幅係数。3・4 球は試作準拠、5 球以降は同じ傾きで延長（未調整）
export const PATTERNS: Readonly<Record<PatternId, BallPattern>> = {
  '3': ball('3', [3], 3, 1, 1),
  '441': ball('441', [4, 4, 1], 3, 1.5, 0.9, 'asym'),
  '531': ball('531', [5, 3, 1], 3, 2, 0.8, 'high'),
  '4': ball('4', [4], 4, 2.5, 0.75),
  '53': ball('53', [5, 3], 4, 3.5, 0.65),
  '552': ball('552', [5, 5, 2], 4, 4, 0.6),
  '5': ball('5', [5], 5, 4.5, 0.6),
  '645': ball('645', [6, 4, 5], 5, 5.5, 0.55),
  '744': ball('744', [7, 4, 4], 5, 6.5, 0.5),
  '6': ball('6', [6], 6, 7, 0.5),
  '75': ball('75', [7, 5], 6, 8.5, 0.45),
  '756': ball('756', [7, 5, 6], 6, 10, 0.4),
  '7': ball('7', [7], 7, 12, 0.4),
};

/** 表示順 */
export const PATTERN_ORDER: readonly PatternId[] = ['3', '441', '531', '4', '53', '552', '5', '645', '744', '6', '75', '756', '7'];

export function patternsForBalls(balls: number): BallPattern[] {
  return PATTERN_ORDER.map((id) => PATTERNS[id]).filter((p) => p.balls === balls);
}

/** 所持球数以下のパターン（一覧表示用。解放済みかは別） */
export function patternsUpTo(balls: number): BallPattern[] {
  return PATTERN_ORDER.map((id) => PATTERNS[id]).filter((p) => p.balls <= balls);
}

/** クラブ練習のパターン。球数ぶんのクラブでカスケード／ファウンテン、回転数で難度が変わる */
export function clubPattern(balls: number, spins: Spins): Pattern {
  return {
    id: `club${spins}`,
    siteswap: [balls],
    balls,
    catchMult: TUNING.club.catchMult[spins],
    toleranceFactor: TUNING.club.toleranceFactor[spins],
    heightFactor: TUNING.club.heightFactor[spins],
  };
}

export function isClubId(id: PropPatternId): id is ClubId {
  return id.startsWith('club');
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

/** パターンが解放済みか。球数が足りていて、必要ならノードを 1 段階以上持ち、封印されていない */
export function isPatternUnlocked(state: SaveState, id: PatternId): boolean {
  const p = PATTERNS[id];
  if (p.balls > state.balls) return false;
  if (state.sealed.includes(id)) return false;
  return p.unlockNode === undefined || level(state, p.unlockNode) > 0;
}

/** 解放済みのパターン（表示順） */
export function unlockedPatterns(state: SaveState): PatternId[] {
  return PATTERN_ORDER.filter((id) => isPatternUnlocked(state, id));
}

/** 球数による許容幅係数・クリーン間隔・高度係数 */
export function ballEffects(balls: number): { toleranceFactor: number; cleanEvery: number; heightFactor: number } {
  const n = ballCount(balls);
  return {
    toleranceFactor: TUNING.balls.toleranceFactor[n],
    cleanEvery: TUNING.clean.everyBeats[n],
    heightFactor: TUNING.balls.heightFactor[n],
  };
}
