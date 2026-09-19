// 実績の定義と発火条件。Steam の ID は書かない（platform 層が対応表を持つ）。
import type { SaveState } from './state';
import { TUNING } from './tuning';

export interface Achievement {
  readonly id: string;
  readonly test: (s: SaveState) => boolean;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first_clean', test: (s) => Object.values(s.patClean).reduce((a, b) => a + b, 0) >= 1 },
  // コアは消費されるので「持っている」以外に「使った痕跡」も見る
  { id: 'first_core', test: (s) => s.core >= 1 || s.balls > TUNING.balls.start || (s.tree.flow ?? 0) > 0 },
  { id: 'run_40', test: (s) => s.bestRun >= 40 },
  { id: 'run_80', test: (s) => s.bestRun >= 80 },
  { id: 'four_balls', test: (s) => s.balls >= 4 },
  { id: 'catch_2000', test: (s) => s.totalCatches >= 2000 },
  { id: 'complete', test: (s) => s.done },
];

/** 未解除の実績を判定し、新しく解除したものの id を返す */
export function checkAchievements(state: SaveState): string[] {
  const unlocked: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements.includes(a.id) || !a.test(state)) continue;
    state.achievements.push(a.id);
    unlocked.push(a.id);
  }
  return unlocked;
}
