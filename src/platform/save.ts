// セーブの読み書き。Electron なら preload の API 経由でファイル、
// ブラウザ単体で開いたときは localStorage に逃がす（開発用）。
// 読み込みは必ず core の migrate を通す。
import { migrate, type SaveState } from '../core';
import { platformApi } from './api';
import { log } from './log';

export type LoadResult =
  | { kind: 'ok'; state: SaveState }
  | { kind: 'none' }
  /** 読めない、または壊れている。hasBackup なら復元を提案する */
  | { kind: 'corrupt'; hasBackup: boolean };

export interface SaveStore {
  load(): Promise<LoadResult>;
  write(state: SaveState): Promise<void>;
  restoreBackup(): Promise<LoadResult>;
  clear(): Promise<void>;
}

function parse(json: string): SaveState | null {
  try {
    return migrate(JSON.parse(json));
  } catch (e) {
    log.error(`save parse failed: ${String(e)}`);
    return null;
  }
}

function fromRead(r: { kind: 'ok'; json: string } | { kind: 'none' | 'unreadable'; hasBackup: boolean }): LoadResult {
  if (r.kind === 'ok') {
    const state = parse(r.json);
    return state ? { kind: 'ok', state } : { kind: 'corrupt', hasBackup: true };
  }
  if (r.kind === 'none') return r.hasBackup ? { kind: 'corrupt', hasBackup: true } : { kind: 'none' };
  return { kind: 'corrupt', hasBackup: r.hasBackup };
}

const LS_KEY = 'sankyu-save';

export function createSaveStore(): SaveStore {
  const api = platformApi();
  if (api) {
    return {
      load: async () => fromRead(await api.save.read()),
      write: (state) => api.save.write(JSON.stringify(state)),
      restoreBackup: async () => fromRead(await api.save.restoreBackup()),
      clear: () => api.save.clear(),
    };
  }
  log.warn('platform API is unavailable; using localStorage');
  return {
    load: () => {
      const raw = localStorage.getItem(LS_KEY);
      if (raw === null) return Promise.resolve({ kind: 'none' });
      const state = parse(raw);
      return Promise.resolve(state ? { kind: 'ok', state } : { kind: 'corrupt', hasBackup: false });
    },
    write: (state) => {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      return Promise.resolve();
    },
    restoreBackup: () => Promise.resolve({ kind: 'corrupt', hasBackup: false }),
    clear: () => {
      localStorage.removeItem(LS_KEY);
      return Promise.resolve();
    },
  };
}
