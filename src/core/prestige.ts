// 球数追加（プレステージ）。条件と適用。
import type { PatternId } from './patterns';
import { patternsForBalls } from './patterns';
import type { SaveState } from './state';
import { TUNING } from './tuning';

export interface PrestigeRequirement {
  /** 次の球数。上限に達していれば null */
  nextBalls: number | null;
  /** 現在の球数の各パターンでクリーン 1 以上 */
  patterns: { id: PatternId; ok: boolean }[];
  coreOk: boolean;
  ok: boolean;
  /** 上限（7 球）に達している。完走は舞台でショーを開く（stage.ts） */
  isFinal: boolean;
}

export function prestigeRequirement(state: SaveState): PrestigeRequirement {
  const nextBalls = state.balls < TUNING.balls.max ? state.balls + 1 : null;
  const patterns = patternsForBalls(state.balls).map((p) => ({ id: p.id, ok: (state.patClean[p.id] ?? 0) >= 1 }));
  const coreOk = state.core >= TUNING.balls.prestigeCoreCost;
  const isFinal = nextBalls === null || patternsForBalls(nextBalls).length === 0;
  return { nextBalls, patterns, coreOk, ok: !isFinal && patterns.every((x) => x.ok) && coreOk, isFinal };
}

export type PrestigeResult = 'advanced' | 'blocked';

/**
 * 球数を 1 つ増やす。上限は 7 球で、完走は舞台のショー（stage.ts）。
 * ツリーはリセットしない。
 */
export function applyPrestige(state: SaveState): PrestigeResult {
  if (state.done) return 'blocked';
  const r = prestigeRequirement(state);
  if (!r.ok || r.nextBalls === null) return 'blocked';
  const first = patternsForBalls(r.nextBalls)[0];
  if (!first) return 'blocked';
  state.core -= TUNING.balls.prestigeCoreCost;
  state.balls = r.nextBalls;
  state.pattern = first.id;
  state.mode = 'ball';
  return 'advanced';
}
