// preload が contextBridge で renderer に公開する API の型。
// electron/ と src/platform/ の両方から参照する唯一の接点。

export type SaveReadResult =
  | { kind: 'ok'; json: string }
  | { kind: 'none'; hasBackup: boolean }
  | { kind: 'unreadable'; hasBackup: boolean };

export type LogLevel = 'info' | 'warn' | 'error';

export interface SankyuApi {
  /** package.json の version。ゲーム内表示とビルド ID を一致させる */
  version: string;
  /** process.platform の値 */
  platform: string;
  /** 本番ビルドか（devtools 無効・メニュー無し） */
  isPackaged: boolean;
  save: {
    /** userData/save/save.json を読む。パースは renderer（migrate.ts）が行う */
    read(): Promise<SaveReadResult>;
    /** 一時ファイル → rename で原子的に置き換える。直前世代を .bak に残す */
    write(json: string): Promise<void>;
    /** .bak を save.json に戻して読み直す */
    restoreBackup(): Promise<SaveReadResult>;
    /** save.json と .bak を消す */
    clear(): Promise<void>;
  };
  log(level: LogLevel, message: string): void;
  tuning: {
    /** 開発モードなら userData/tuning.override.json の内容。無ければ null */
    load(): Promise<unknown>;
    /** ファイルが書き換わったら呼ばれる（開発モードのみ） */
    onChange(cb: (override: unknown) => void): void;
  };
}

export const API_KEY = 'sankyu' as const;

export const IPC = {
  saveRead: 'save:read',
  saveWrite: 'save:write',
  saveRestore: 'save:restore',
  saveClear: 'save:clear',
  log: 'log',
  tuningLoad: 'tuning:load',
  tuningChanged: 'tuning:changed',
} as const;

/** main が preload に渡す起動引数 */
export const ARG_PACKAGED = '--sankyu-packaged';
