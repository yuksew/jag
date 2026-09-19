// パッシング（6 球到達で解放）。相方（自動）と投げ合い、自分の投げの半分が自動化される。
// 奇数拍は相方の投げで、入力は要らず必ず成立する。偶数拍は通常の判定。
// サイトスワップの奇数値は相方への「パス」、偶数値は自分への投げ。
import { isPatternUnlocked, PATTERN_ORDER, type PatternId } from './patterns';
import type { SaveState } from './state';
import { TUNING } from './tuning';

export function selectPassing(state: SaveState, id: PatternId): boolean {
  if (state.balls < TUNING.tabs.passingBalls) return false;
  if (!isPatternUnlocked(state, id)) return false;
  state.mode = 'passing';
  state.pattern = id;
  return true;
}

/** パッシングで使えるパターン（解放済み） */
export function passingPatterns(state: SaveState): PatternId[] {
  return PATTERN_ORDER.filter((id) => isPatternUnlocked(state, id));
}

export function passCleans(state: SaveState, id: PatternId): number {
  return state.passClean[id] ?? 0;
}

/** パターンの何割が相方へのパスか（奇数値の割合） */
export function passRatio(siteswap: readonly number[]): number {
  if (siteswap.length === 0) return 0;
  return siteswap.filter((v) => v % 2 === 1).length / siteswap.length;
}
