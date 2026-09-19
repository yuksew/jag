import type { PatternId } from './patterns';
import type { NodeId } from './tree';
import { TUNING, type Spins } from './tuning';

export const SAVE_VERSION = 4 as const;

/** 練習の種類。練習場の球、クラブ、路上（拍手）、パッシング（相方） */
export type PracticeMode = 'ball' | 'club' | 'street' | 'passing';

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
  /** 練習の種類（練習場の球か、クラブか） */
  mode: PracticeMode;
  /** クラブの回転数 */
  spins: Spins;
  /** 回転数別のクラブのクリーン数 */
  clubClean: Partial<Record<Spins, number>>;
  /** 拍手（路上で変換） */
  applause: number;
  /** 路上で見せたパターン */
  shown: PatternId[];
  /** パッシングでのパターン別クリーン数（球数追加の条件には数えない） */
  passClean: Partial<Record<PatternId, number>>;
  /** 7 球フラッシュを達成したか */
  flash7: boolean;
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
    mode: 'ball',
    spins: 1,
    clubClean: {},
    applause: 0,
    shown: [],
    passClean: {},
    flash7: false,
    milestones: [],
    achievements: [],
    recordOpen: false,
    done: false,
  };
}
