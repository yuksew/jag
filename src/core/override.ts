// 開発モードで tuning.ts の値を外部 JSON（userData/tuning.override.json）から上書きする。
// 既存のキーに同じ型の値がある場合だけ書き換える。追加・型違いは無視して報告する。
import { TUNING } from './tuning';

export interface OverrideReport {
  applied: string[];
  rejected: string[];
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function merge(target: Record<string, unknown>, source: Record<string, unknown>, path: string, report: OverrideReport): void {
  for (const [key, value] of Object.entries(source)) {
    const p = path ? `${path}.${key}` : key;
    if (!(key in target)) {
      report.rejected.push(p);
      continue;
    }
    const current = target[key];
    if (isRecord(current) && isRecord(value)) {
      merge(current, value, p, report);
    } else if (typeof current === typeof value && (typeof value === 'number' || typeof value === 'boolean')) {
      if (typeof value === 'number' && !Number.isFinite(value)) {
        report.rejected.push(p);
        continue;
      }
      target[key] = value;
      report.applied.push(p);
    } else {
      report.rejected.push(p);
    }
  }
}

/** override を target（既定は TUNING）へ適用する。target を直接書き換える */
export function applyTuningOverride(override: unknown, target: Record<string, unknown> = TUNING): OverrideReport {
  const report: OverrideReport = { applied: [], rejected: [] };
  if (!isRecord(override)) {
    report.rejected.push('(root)');
    return report;
  }
  merge(target, override, '', report);
  return report;
}

/** 現在の値のディープコピー（override のひな型や差し戻しに使う） */
export function snapshotTuning(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(TUNING)) as Record<string, unknown>;
}

/** snapshot で取った値に戻す */
export function restoreTuning(snapshot: Record<string, unknown>): void {
  applyTuningOverride(snapshot);
}
