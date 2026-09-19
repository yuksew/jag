// 封印（犠牲型コスト）。クリーンを取ったパターンを 1 つ封印すると、
// そのパターンは以後選べず記録も更新されないが、それより多い球数のラン開始時の疲労が下がる。
import { PATTERNS, type PatternId } from './patterns';
import type { SaveState } from './state';
import { derived } from './tree';
import { ballCount, TUNING } from './tuning';

export function isSealed(state: SaveState, id: PatternId): boolean {
  return state.sealed.includes(id);
}

/** その球数で既に封印済みか（球数ごとに 1 つまで） */
export function hasSealAt(state: SaveState, balls: number): boolean {
  return state.sealed.some((id) => PATTERNS[id].balls === balls);
}

/** 封印できるか: クリーンがあり、未封印で、同じ球数に封印が無く、上限の球数ではない */
export function canSeal(state: SaveState, id: PatternId): boolean {
  const p = PATTERNS[id];
  if (isSealed(state, id) || hasSealAt(state, p.balls)) return false;
  if (p.balls >= TUNING.balls.max) return false;
  return (state.patClean[id] ?? 0) >= 1;
}

/** 封印する。選択中なら同じ球数の別パターンに戻す */
export function seal(state: SaveState, id: PatternId): boolean {
  if (!canSeal(state, id)) return false;
  state.sealed.push(id);
  if (state.pattern === id) {
    const alt = (Object.keys(PATTERNS) as PatternId[]).find((x) => PATTERNS[x].balls === state.balls && !isSealed(state, x));
    if (alt) state.pattern = alt;
  }
  return true;
}

/** 現在の球数より少ない球数で封印した数 */
export function sealsBelow(state: SaveState, balls: number): number {
  return state.sealed.filter((id) => PATTERNS[id].balls < balls).length;
}

/** ラン開始時の疲労 = 球数の基本値 − 封印 × 軽減 − 体得「芯」。0 未満にはならない */
export function initialFatigue(state: SaveState): number {
  const base = TUNING.balls.initialFatigue[ballCount(state.balls)];
  const relief = TUNING.seal.fatigueRelief * sealsBelow(state, state.balls) + derived(state).initialFatigueRelief;
  return Math.max(0, base - relief);
}
