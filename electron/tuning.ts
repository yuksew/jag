// 開発モードで userData/tuning.override.json を読み、変更を renderer に流す。
// 本番（packaged）では何もしない。SANKYU_DEV=1 で本番ビルドでも有効にできる。
import { app, type BrowserWindow } from 'electron';
import { watch, type FSWatcher } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { IPC } from './api';
import { log } from './log';

export const OVERRIDE_FILE = 'tuning.override.json';

export function tuningOverrideEnabled(): boolean {
  return !app.isPackaged || process.env['SANKYU_DEV'] === '1';
}

export function overridePath(): string {
  return join(app.getPath('userData'), OVERRIDE_FILE);
}

/** 読めなければ null。JSON として壊れていればログに書いて null */
export async function readOverride(): Promise<unknown> {
  if (!tuningOverrideEnabled()) return null;
  try {
    const text = await readFile(overridePath(), 'utf8');
    return JSON.parse(text) as unknown;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') log('warn', `tuning override unreadable: ${String(e)}`);
    return null;
  }
}

let watcher: FSWatcher | null = null;

/** ファイルの変更を監視して renderer に送る。ディレクトリを監視するのでファイルが後から作られても拾う */
export function watchOverride(win: BrowserWindow): void {
  if (!tuningOverrideEnabled() || watcher) return;
  let timer: NodeJS.Timeout | null = null;
  try {
    watcher = watch(app.getPath('userData'), (_event, name) => {
      if (name !== OVERRIDE_FILE) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void readOverride().then((o) => {
          if (!win.isDestroyed()) win.webContents.send(IPC.tuningChanged, o);
        });
      }, 150);
    });
    win.on('closed', () => {
      watcher?.close();
      watcher = null;
    });
  } catch (e) {
    log('warn', `tuning override watch failed: ${String(e)}`);
  }
}
