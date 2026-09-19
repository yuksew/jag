import { contextBridge, ipcRenderer } from 'electron';
import { API_KEY, ARG_PACKAGED, IPC, type LogLevel, type SankyuApi, type SaveReadResult, type Settings } from './api';

// electron-vite が package.json の version を define で埋め込む
declare const __APP_VERSION__: string;

const api: SankyuApi = {
  version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
  platform: process.platform,
  isPackaged: process.argv.includes(ARG_PACKAGED),
  save: {
    read: () => ipcRenderer.invoke(IPC.saveRead) as Promise<SaveReadResult>,
    write: (json: string) => ipcRenderer.invoke(IPC.saveWrite, json) as Promise<void>,
    restoreBackup: () => ipcRenderer.invoke(IPC.saveRestore) as Promise<SaveReadResult>,
    clear: () => ipcRenderer.invoke(IPC.saveClear) as Promise<void>,
  },
  log: (level: LogLevel, message: string) => ipcRenderer.send(IPC.log, level, message),
  settings: {
    read: () => ipcRenderer.invoke(IPC.settingsRead) as Promise<Settings>,
    readSync: () => ipcRenderer.sendSync(IPC.settingsReadSync) as Settings,
    write: (settings: Settings) => ipcRenderer.invoke(IPC.settingsWrite, settings) as Promise<void>,
  },
  window: {
    setFullscreen: (on: boolean) => ipcRenderer.invoke(IPC.windowFullscreen, on) as Promise<void>,
    setZoom: (factor: number) => ipcRenderer.invoke(IPC.windowZoom, factor) as Promise<void>,
    onFlushRequest: (cb) => {
      ipcRenderer.on(IPC.flushRequest, () => {
        void cb().finally(() => ipcRenderer.send(IPC.flushDone));
      });
    },
  },
  tuning: {
    load: () => ipcRenderer.invoke(IPC.tuningLoad) as Promise<unknown>,
    onChange: (cb) => {
      ipcRenderer.on(IPC.tuningChanged, (_e, override: unknown) => cb(override));
    },
  },
};

contextBridge.exposeInMainWorld(API_KEY, api);
