import type { PatternId } from './patterns';
import type { NodeId } from './tree';
import { TUNING } from './tuning';

export const SAVE_VERSION = 1 as const;

/** セーブされる状態。ここに無いものは保存しない */
export interface SaveState {
  version: typeof SAVE_VERSION;
  /** 通貨 */
  catch: number;
  clean: number;
  core: number;
  /** 記録 */
  totalCatches: number;
  bestRun: number;
  runs: number;
  /** スキルツリーの段階 */
  tree: Partial<Record<NodeId, number>>;
  balls: number;
  pattern: PatternId;
  /** パターン別のクリーン数 */
  patClean: Partial<Record<PatternId, number>>;
  /** 達成済みの節目 */
  milestones: string[];
  /** 解除済みの実績（Steam に依存しない id） */
  achievements: string[];
  recordOpen: boolean;
  done: boolean;
}

export function fresh(): SaveState {
  return {
    version: SAVE_VERSION,
    catch: 0,
    clean: 0,
    core: 0,
    totalCatches: 0,
    bestRun: 0,
    runs: 0,
    tree: {},
    balls: TUNING.balls.start,
    pattern: '3',
    patClean: {},
    milestones: [],
    achievements: [],
    recordOpen: false,
    done: false,
  };
}
