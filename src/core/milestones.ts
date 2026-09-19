import type { SaveState } from './state';
import type { CurrencyKey } from './types';

export interface Milestone {
  readonly id: string;
  readonly test: (s: SaveState) => boolean;
  readonly give: Partial<Record<CurrencyKey, number>>;
}

export const MILESTONES: readonly Milestone[] = [
  { id: 'c100', test: (s) => s.totalCatches >= 100, give: { catch: 30 } },
  { id: 'c500', test: (s) => s.totalCatches >= 500, give: { clean: 2 } },
  { id: 'c2000', test: (s) => s.totalCatches >= 2000, give: { core: 1 } },
  { id: 'r20', test: (s) => s.bestRun >= 20, give: { catch: 20 } },
  { id: 'r40', test: (s) => s.bestRun >= 40, give: { clean: 1 } },
  { id: 'r80', test: (s) => s.bestRun >= 80, give: { core: 1 } },
];

export function isMilestoneDone(state: SaveState, id: string): boolean {
  return state.milestones.includes(id);
}

/** 未達の節目を判定し、達成したものに報酬を付与する。付与した節目を返す */
export function checkMilestones(state: SaveState): Milestone[] {
  const granted: Milestone[] = [];
  for (const m of MILESTONES) {
    if (isMilestoneDone(state, m.id) || !m.test(state)) continue;
    state.milestones.push(m.id);
    for (const [k, v] of Object.entries(m.give) as [CurrencyKey, number][]) state[k] += v;
    granted.push(m);
  }
  return granted;
}
