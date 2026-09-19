// クラブ（4 球到達で解放）。回転数（1〜3）で別の難度曲線を持つ練習。
import type { SaveState } from './state';
import { TUNING, type Spins } from './tuning';

export const SPINS: readonly Spins[] = [1, 2, 3];

export function clubCleans(state: SaveState, spins: Spins): number {
  return state.clubClean[spins] ?? 0;
}

/** 1 回転は最初から。n 回転は (n−1) 回転のクリーンが unlockCleans 以上で解放 */
export function isSpinUnlocked(state: SaveState, spins: Spins): boolean {
  if (spins === 1) return true;
  return clubCleans(state, (spins - 1) as Spins) >= TUNING.club.unlockCleans;
}

export function unlockedSpins(state: SaveState): Spins[] {
  return SPINS.filter((s) => isSpinUnlocked(state, s));
}

/** クラブ練習に切り替える。解放されていない回転数なら false */
export function selectClub(state: SaveState, spins: Spins): boolean {
  if (!isSpinUnlocked(state, spins)) return false;
  state.mode = 'club';
  state.spins = spins;
  return true;
}
