// ログ。userData/logs/YYYY-MM-DD.log に追記し、開発時は標準出力にも出す。
// 7 日で削除するローテーションは M3 で入れる。
import { app } from 'electron';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { LogLevel } from './api';

function logDir(): string {
  return join(app.getPath('userData'), 'logs');
}

let ready: Promise<void> | null = null;

export function log(level: LogLevel, message: string, source = 'main'): void {
  const line = `${new Date().toISOString()} [${level}] [${source}] ${message}\n`;
  if (!app.isPackaged) process.stderr.write(line);
  ready ??= mkdir(logDir(), { recursive: true }).then(() => undefined);
  const day = new Date().toISOString().slice(0, 10);
  void ready
    .then(() => appendFile(join(logDir(), `${day}.log`), line, 'utf8'))
    .catch(() => undefined);
}
