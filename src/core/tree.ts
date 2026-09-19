import type { SaveState } from './state';
import { TUNING } from './tuning';
import type { CurrencyKey } from './types';

export type NodeId =
  | 'prec' | 'speed' | 'asym' | 'high'
  | 'read' | 'chase'
  | 'stam' | 'breath'
  | 'auto' | 'flow'
  | 'convert' | 'showoff'
  | 'form' | 'vision' | 'core' | 'zen' | 'flair';

/** 体得ノード（体得点専用。系統ごとに 1 つ） */
export const MASTERY_NODES: readonly NodeId[] = ['form', 'vision', 'core', 'zen', 'flair'];

/** 手 / 目 / 体幹 / 記憶 / 表現（表現は路上解放後に見える） */
export type Branch = 'hand' | 'eye' | 'trunk' | 'memory' | 'expr';

export const BRANCHES: readonly Branch[] = ['hand', 'eye', 'trunk', 'memory', 'expr'];

/** 表現の系統は路上が開くまで見えない */
export function isBranchOpen(state: SaveState, branch: Branch): boolean {
  return branch !== 'expr' || state.balls >= TUNING.tabs.streetBalls;
}

export interface Cost {
  currency: CurrencyKey;
  amount: number;
}

export interface TreeNode {
  readonly id: NodeId;
  readonly branch: Branch;
  readonly max: number;
  /** 前提ノードとその段階 */
  readonly req?: Partial<Record<NodeId, number>>;
  /** 現在の段階 level から次の段階へ上げるコスト */
  readonly cost: (level: number) => Cost;
}

const geometric =
  (currency: CurrencyKey, base: number, ratio: number) =>
  (level: number): Cost => ({ currency, amount: Math.round(base * ratio ** level) });

// コスト曲線はノード固有なので tuning.ts ではなくここに置く
export const NODES: readonly TreeNode[] = [
  { id: 'prec', branch: 'hand', max: 5, cost: geometric('catch', 20, 1.6) },
  { id: 'speed', branch: 'hand', max: 5, cost: geometric('catch', 40, 1.7) },
  { id: 'asym', branch: 'hand', max: 1, req: { prec: 3 }, cost: () => ({ currency: 'clean', amount: 3 }) },
  { id: 'high', branch: 'hand', max: 1, req: { speed: 2, asym: 1 }, cost: () => ({ currency: 'clean', amount: 5 }) },
  { id: 'read', branch: 'eye', max: 4, cost: geometric('catch', 60, 1.8) },
  { id: 'chase', branch: 'eye', max: 3, req: { read: 2 }, cost: (l) => ({ currency: 'clean', amount: 2 + l }) },
  { id: 'stam', branch: 'trunk', max: 5, cost: geometric('catch', 30, 1.7) },
  { id: 'breath', branch: 'trunk', max: 3, req: { stam: 2 }, cost: (l) => ({ currency: 'clean', amount: 1 + l }) },
  { id: 'auto', branch: 'memory', max: 8, cost: geometric('catch', 80, 1.6) },
  { id: 'flow', branch: 'memory', max: 1, req: { auto: 4 }, cost: () => ({ currency: 'core', amount: 1 }) },
  { id: 'convert', branch: 'expr', max: 5, cost: geometric('catch', 100, 1.7) },
  { id: 'showoff', branch: 'expr', max: 3, req: { convert: 2 }, cost: (l) => ({ currency: 'clean', amount: 2 + l }) },
  // 体得: 基本ノードを最大まで上げると開く。体得点 1
  { id: 'form', branch: 'hand', max: 1, req: { prec: 5 }, cost: () => ({ currency: 'sp', amount: 1 }) },
  { id: 'vision', branch: 'eye', max: 1, req: { read: 4 }, cost: () => ({ currency: 'sp', amount: 1 }) },
  { id: 'core', branch: 'trunk', max: 1, req: { stam: 5 }, cost: () => ({ currency: 'sp', amount: 1 }) },
  { id: 'zen', branch: 'memory', max: 1, req: { auto: 8 }, cost: () => ({ currency: 'sp', amount: 1 }) },
  { id: 'flair', branch: 'expr', max: 1, req: { convert: 5 }, cost: () => ({ currency: 'sp', amount: 1 }) },
];

export function isMasteryNode(id: NodeId): boolean {
  return MASTERY_NODES.includes(id);
}

export function node(id: NodeId): TreeNode {
  const n = NODES.find((x) => x.id === id);
  if (!n) throw new Error(`unknown node: ${id}`);
  return n;
}

export function nodesIn(branch: Branch): TreeNode[] {
  return NODES.filter((n) => n.branch === branch);
}

export function level(state: SaveState, id: NodeId): number {
  return state.tree[id] ?? 0;
}

export function isMaxed(state: SaveState, id: NodeId): boolean {
  return level(state, id) >= node(id).max;
}

/** 次の段階のコスト。習得済みなら null */
export function nextCost(state: SaveState, id: NodeId): Cost | null {
  const n = node(id);
  const l = level(state, id);
  return l >= n.max ? null : n.cost(l);
}

/** 足りていない前提 */
export function missingRequirements(state: SaveState, id: NodeId): { id: NodeId; level: number }[] {
  const n = node(id);
  if (!n.req) return [];
  return (Object.entries(n.req) as [NodeId, number][])
    .filter(([reqId, reqLevel]) => level(state, reqId) < reqLevel)
    .map(([reqId, reqLevel]) => ({ id: reqId, level: reqLevel }));
}

export function requirementsMet(state: SaveState, id: NodeId): boolean {
  return missingRequirements(state, id).length === 0;
}

export function canAfford(state: SaveState, cost: Cost): boolean {
  return state[cost.currency] >= cost.amount;
}

export function canBuy(state: SaveState, id: NodeId): boolean {
  const cost = nextCost(state, id);
  return cost !== null && isBranchOpen(state, node(id).branch) && requirementsMet(state, id) && canAfford(state, cost);
}

/** 段階を 1 つ上げる。買えなければ false で何もしない */
export function buy(state: SaveState, id: NodeId): boolean {
  if (!canBuy(state, id)) return false;
  const cost = nextCost(state, id);
  if (!cost) return false;
  state[cost.currency] -= cost.amount;
  state.tree[id] = level(state, id) + 1;
  return true;
}

/** ツリーから導かれる値。ラン開始時に固定する */
export interface Derived {
  /** 拍の間隔 */
  intervalMs: number;
  /** 許容幅の基本（パターン係数を掛ける前） */
  toleranceMs: number;
  /** 投げごとの疲労増加 */
  fatigueRate: number;
  /** wobble 以外の投げごとの疲労回復 */
  breath: number;
  /** wobble → clean の確率 */
  read: number;
  /** drop → wobble の確率 */
  chase: number;
  /** 自動投げの割合 */
  auto: number;
  /** 自動投げ直後の許容幅ボーナス */
  flowMs: number;
  /** 拍手レートの倍率（表現: 変換） */
  applauseMult: number;
  /** 新パターンを見せたときの拍手ボーナス（表現: 見せ方） */
  showoffBonus: number;
  /** ラン開始時の疲労の軽減（体得「芯」） */
  initialFatigueRelief: number;
}

export function derived(state: SaveState): Derived {
  const t = TUNING;
  const has = (id: NodeId) => level(state, id) > 0;
  return {
    intervalMs: t.beat.baseIntervalMs - t.beat.speedStepMs * level(state, 'speed'),
    toleranceMs: t.beat.baseToleranceMs + t.beat.precisionStepMs * level(state, 'prec') + (has('form') ? t.mastery.formToleranceMs : 0),
    fatigueRate: t.fatigue.perBeat * (1 - t.fatigue.staminaStep * level(state, 'stam')),
    breath: t.fatigue.breathStep * level(state, 'breath'),
    read: t.eye.readStep * level(state, 'read'),
    chase: t.eye.chaseStep * level(state, 'chase') + (has('vision') ? t.mastery.visionChase : 0),
    auto: t.memory.autoStep * level(state, 'auto'),
    flowMs: has('flow') ? t.memory.flowBonusMs * (has('zen') ? t.mastery.zenFlowMult : 1) : 0,
    applauseMult: (1 + t.expr.convertStep * level(state, 'convert')) * (has('flair') ? t.mastery.flairApplauseMult : 1),
    showoffBonus: t.street.newPatternBonus + t.expr.showoffStep * level(state, 'showoff'),
    initialFatigueRelief: has('core') ? t.mastery.coreFatigue : 0,
  };
}
