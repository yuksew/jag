// preload が contextBridge で renderer に公開する API の型。
// electron/ と src/platform/ の両方から参照する唯一の接点。

export type SaveReadResult =
  | { kind: 'ok'; json: string }
  | { kind: 'none'; hasBackup: boolean }
  | { kind: 'unreadable'; hasBackup: boolean };

export type LogLevel = 'info' | 'warn' | 'error';

export type Lang = 'ja' | 'en';

/** 設定（セーブとは別ファイル。userData/settings.json） */
export interface Settings {
  version: 1;
  display: {
    fullscreen: boolean;
    /** 100 / 125 / 150 */
    scale: number;
    reduceMotion: boolean;
  };
  sound: {
    /** 0〜1 */
    master: number;
    sfx: number;
    /** 拍のクリック音のオン／オフ */
    click: boolean;
  };
  input: {
    /** 入力オフセット補正（ms）。入力時刻からこの値を引く */
    offsetMs: number;
    /** 「投げる」のキー（KeyboardEvent.code） */
    throwKeys: string[];
  };
  lang: Lang;
}

export function defaultSettings(): Settings {
  return {
    version: 1,
    display: { fullscreen: false, scale: 100, reduceMotion: false },
    sound: { master: 0.8, sfx: 0.8, click: true },
    input: { offsetMs: 0, throwKeys: ['Space', 'Enter'] },
    lang: 'ja',
  };
}

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
  settings: {
    read(): Promise<Settings>;
    /** 起動直後の言語決定用。main のキャッシュを同期で返す */
    readSync(): Settings;
    write(settings: Settings): Promise<void>;
  };
  window: {
    setFullscreen(on: boolean): Promise<void>;
    setZoom(factor: number): Promise<void>;
    /** 終了前に main から「保存してから閉じる」を求められたときの応答を登録する */
    onFlushRequest(cb: () => Promise<void>): void;
  };
  steam: {
    info(): Promise<{ available: boolean; appId: number; onDeck: boolean }>;
    /** 解除済みの実績 id（core の id）をまとめて送る。未同期分の再送も同じ */
    achievements(ids: string[]): void;
    stats(stats: { totalCatches: number; bestRun: number; completeMs: number }): void;
    presence(status: string | null): void;
  };
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
  settingsRead: 'settings:read',
  settingsReadSync: 'settings:read-sync',
  settingsWrite: 'settings:write',
  windowFullscreen: 'window:fullscreen',
  windowZoom: 'window:zoom',
  steamInfo: 'steam:info',
  steamAchievements: 'steam:achievements',
  steamStats: 'steam:stats',
  steamPresence: 'steam:presence',
  flushRequest: 'app:flush-request',
  flushDone: 'app:flush-done',
} as const;

/** main が preload に渡す起動引数 */
export const ARG_PACKAGED = '--sankyu-packaged';
