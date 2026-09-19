// 舞台（7 球フラッシュ + 拍手 1000 で解放）。ショーを開いて成立させると完走。
// ショー = 7 球のランで、showBeats 拍を落とさずに投げ切る。落としても拍手は減らず、やり直せる。
import type { RunState } from './run';
import type { SaveState } from './state';
import { isTabOpen } from './tabs';
import { TUNING } from './tuning';

export function canOpenShow(state: SaveState): boolean {
  return isTabOpen(state, 'stage') && !state.done;
}

/** ショーの準備（舞台モードに切り替える）。開始は startRun */
export function selectStage(state: SaveState): boolean {
  if (!canOpenShow(state)) return false;
  state.mode = 'stage';
  state.pattern = '7';
  return true;
}

export function isShowRun(run: RunState): boolean {
  return run.prop === 'stage';
}

/** ショーの進み具合 */
export function showProgress(run: RunState): { beats: number; need: number } {
  return { beats: run.beats, need: TUNING.stage.showBeats };
}

/** ショーが成立したか（この投げで規定拍に達した） */
export function isShowComplete(run: RunState): boolean {
  return isShowRun(run) && run.beats >= TUNING.stage.showBeats;
}
