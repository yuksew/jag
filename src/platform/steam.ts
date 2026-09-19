// Steam ブリッジの renderer 側。実績・統計・Rich Presence を preload 経由で main に送る。
// Steam が無くても呼び出しは成立する（main 側が no-op）。
import type { SaveState } from '../core';
import { platformApi } from './api';

export function syncAchievements(state: SaveState): void {
  const api = platformApi();
  if (!api || state.achievements.length === 0) return;
  api.steam.achievements([...state.achievements]);
}

export function syncStats(state: SaveState): void {
  platformApi()?.steam.stats({ totalCatches: state.totalCatches, bestRun: state.bestRun, completeMs: state.completeMs });
}

export function setPresence(status: string | null): void {
  platformApi()?.steam.presence(status);
}
