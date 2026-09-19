// 路上（5 球到達で解放）。キャッチを拍手に変える。
// 路上で投げると、キャッチの代わりに拍手が入る（レートは悪い）。
// 異なるパターンを見せるほどレートが上がる。手動変換はさらに悪いレート。
import { isPatternUnlocked, PATTERN_ORDER, type PatternId } from './patterns';
import type { SaveState } from './state';
import { derived } from './tree';
import { TUNING } from './tuning';

export function isShown(state: SaveState, id: PatternId): boolean {
  return state.shown.includes(id);
}

export function shownCount(state: SaveState): number {
  return state.shown.length;
}

/** 路上で投げたときの、キャッチ 1 つあたりの拍手 */
export function applauseRate(state: SaveState): number {
  const t = TUNING.street;
  return t.baseRate * (1 + t.perShownPattern * shownCount(state)) * derived(state).applauseMult;
}

/** 手動変換の、キャッチ 1 つあたりの拍手 */
export function manualRate(state: SaveState): number {
  return applauseRate(state) * TUNING.street.manualFactor;
}

/** 手動変換 1 回で得られる拍手（manualChunk キャッチぶん） */
export function manualYield(state: SaveState): number {
  return Math.floor(TUNING.street.manualChunk * manualRate(state));
}

export function canConvert(state: SaveState): boolean {
  return state.catch >= TUNING.street.manualChunk && manualYield(state) >= 1;
}

/** キャッチ manualChunk を拍手に変える。できなければ 0 */
export function convertCatches(state: SaveState): number {
  if (!canConvert(state)) return 0;
  const gained = manualYield(state);
  state.catch -= TUNING.street.manualChunk;
  state.applause += gained;
  return gained;
}

/** 路上のランに切り替える。パターンは練習場の選択をそのまま使う */
export function selectStreet(state: SaveState): boolean {
  if (state.balls < TUNING.tabs.streetBalls) return false;
  state.mode = 'street';
  return true;
}

/** 路上で見せられるパターン（解放済みで、所持球数以下） */
export function streetPatterns(state: SaveState): PatternId[] {
  return PATTERN_ORDER.filter((id) => isPatternUnlocked(state, id));
}

/** パターンを「見せた」ことにする。初めてならボーナスの拍手を返し、既知なら 0 */
export function registerShown(state: SaveState, id: PatternId): number {
  if (isShown(state, id)) return 0;
  state.shown.push(id);
  const bonus = Math.round(derived(state).showoffBonus);
  state.applause += bonus;
  return bonus;
}
