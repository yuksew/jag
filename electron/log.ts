// ログ。userData/logs/YYYY-MM-DD.log に追記し、開発時は標準出力にも出す。
// 起動時に 7 日より古いログを消す。
import { app } from 'electron';
import { appendFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { LogLevel } from './api';

function logDir(): string {
  return join(app.getPath('userData'), 'logs');
}

const KEEP_DAYS = 7;

let ready: Promise<void> | null = null;

/** 7 日より古い日付名のログを削除する */
export async function pruneLogs(now = new Date()): Promise<string[]> {
  const dir = logDir();
  await mkdir(dir, { recursive: true });
  const cutoff = new Date(now.getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const removed: string[] = [];
  for (const name of await readdir(dir)) {
    const m = /^(\d{4}-\d{2}-\d{2})\.log$/.exec(name);
    if (m && m[1] && m[1] < cutoff) {
      await rm(join(dir, name), { force: true });
      removed.push(name);
    }
  }
  return removed;
}

export function log(level: LogLevel, message: string, source = 'main'): void {
  const line = `${new Date().toISOString()} [${level}] [${source}] ${message}\n`;
  if (!app.isPackaged) process.stderr.write(line);
  ready ??= mkdir(logDir(), { recursive: true }).then(() => undefined);
  const day = new Date().toISOString().slice(0, 10);
  void ready
    .then(() => appendFile(join(logDir(), `${day}.log`), line, 'utf8'))
    .catch(() => undefined);
}
