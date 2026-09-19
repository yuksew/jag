// タブの解放条件（docs/DESIGN.md「タブの展開順」）
import type { SaveState } from './state';
import { TUNING } from './tuning';

export type TabId = 'practice' | 'body' | 'record' | 'club' | 'street' | 'passing' | 'stage';

export const TAB_ORDER: readonly TabId[] = ['practice', 'body', 'record', 'club', 'street', 'passing', 'stage'];

export function isTabOpen(state: SaveState, tab: TabId): boolean {
  const t = TUNING.tabs;
  switch (tab) {
    case 'practice':
    case 'body':
      return true;
    case 'record':
      return state.recordOpen;
    case 'club':
      return state.balls >= t.clubBalls;
    case 'street':
      return state.balls >= t.streetBalls;
    case 'passing':
      return state.balls >= t.passingBalls;
    case 'stage':
      return state.balls >= t.stageBalls && state.flash7 && state.applause >= t.stageApplause;
  }
}

export function openTabs(state: SaveState): TabId[] {
  return TAB_ORDER.filter((id) => isTabOpen(state, id));
}

/** 解放済みのタブと、その次に開くタブ 1 つ（鍵付きで見せる） */
export function visibleTabs(state: SaveState): { id: TabId; open: boolean }[] {
  const out: { id: TabId; open: boolean }[] = [];
  let lockedShown = false;
  for (const id of TAB_ORDER) {
    const open = isTabOpen(state, id);
    if (open) out.push({ id, open });
    else if (!lockedShown) {
      out.push({ id, open });
      lockedShown = true;
    }
  }
  return out;
}
