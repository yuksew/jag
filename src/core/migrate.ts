// セーブの読み込みは必ずここを通す。旧版を順に上げて最新の SaveState にする。
import { PATTERNS, type PatternId } from './patterns';
import { fresh, SAVE_VERSION, type SaveState } from './state';
import { NODES, type NodeId } from './tree';

export class MigrateError extends Error {
  override readonly name = 'MigrateError';
}

type Raw = Record<string, unknown>;

function isRecord(x: unknown): x is Raw {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function num(x: unknown, fallback: number): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : fallback;
}

function bool(x: unknown, fallback: boolean): boolean {
  return typeof x === 'boolean' ? x : fallback;
}

function strings(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [];
}

function numberMap<K extends string>(x: unknown, keys: readonly K[]): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  if (!isRecord(x)) return out;
  for (const k of keys) {
    const v = x[k];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v;
  }
  return out;
}

const NODE_IDS = NODES.map((n) => n.id);
const PATTERN_IDS = Object.keys(PATTERNS) as PatternId[];

/** version 無し = 試作（localStorage 'sankyu-proto'）の形式 */
function fromV0(raw: Raw): SaveState {
  const s = fresh();
  s.catch = num(raw['catch'], 0);
  s.clean = num(raw['clean'], 0);
  s.core = num(raw['core'], 0);
  s.totalCatches = num(raw['totalCatches'], 0);
  s.bestRun = num(raw['bestRun'], 0);
  s.runs = num(raw['runs'], 0);
  s.tree = numberMap<NodeId>(raw['tree'], NODE_IDS);
  s.balls = num(raw['balls'], s.balls);
  const pattern = raw['pattern'];
  s.pattern = typeof pattern === 'string' && PATTERN_IDS.includes(pattern as PatternId) ? (pattern as PatternId) : '3';
  s.patClean = numberMap<PatternId>(raw['patClean'], PATTERN_IDS);
  s.milestones = strings(raw['milestones']);
  s.recordOpen = bool(raw['recordOpen'], false);
  s.done = bool(raw['done'], false);
  return s;
}

/** v1: v0 + version + achievements */
function fromV1(raw: Raw): SaveState {
  const s = fromV0(raw);
  s.achievements = strings(raw['achievements']);
  return s;
}

/**
 * 任意の JSON 値から最新の SaveState を作る。
 * 形が壊れていれば MigrateError（呼び出し側はバックアップからの復元を提案する）。
 */
export function migrate(raw: unknown): SaveState {
  if (!isRecord(raw)) throw new MigrateError('save is not an object');
  const version = num(raw['version'], 0);
  if (version > SAVE_VERSION) throw new MigrateError(`save version ${version} is newer than ${SAVE_VERSION}`);
  switch (version) {
    case 0:
      return fromV0(raw);
    case 1:
      return fromV1(raw);
    default:
      throw new MigrateError(`unknown save version ${version}`);
  }
}
