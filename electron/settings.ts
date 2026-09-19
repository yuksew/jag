// 設定ファイルの IO。userData/settings.json。壊れていれば既定値。
import { app } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { defaultSettings, type Settings } from './api';
import { log } from './log';

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** 既定値の形に沿って、同じ型の値だけ取り込む */
function merge(base: Record<string, unknown>, raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(base)) {
    const r = raw[k];
    if (isRecord(v) && isRecord(r)) out[k] = merge(v, r);
    else if (Array.isArray(v) && Array.isArray(r)) out[k] = r.filter((x) => typeof x === 'string');
    else if (typeof v === typeof r && r !== null && r !== undefined) out[k] = r;
  }
  return out;
}

/** 任意の値を Settings に整える */
export function normalizeSettings(raw: unknown): Settings {
  return merge({ ...defaultSettings() }, raw) as unknown as Settings;
}

export async function readSettings(): Promise<Settings> {
  try {
    const text = await fs.readFile(settingsPath(), 'utf8');
    return normalizeSettings(JSON.parse(text));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') log('warn', `settings unreadable: ${String(e)}`);
    return defaultSettings();
  }
}

export async function writeSettings(settings: Settings): Promise<void> {
  const p = settingsPath();
  const tmp = `${p}.tmp`;
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(tmp, JSON.stringify(normalizeSettings(settings), null, 2), 'utf8');
  await fs.rename(tmp, p);
}
