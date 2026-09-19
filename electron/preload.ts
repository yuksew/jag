import { contextBridge } from 'electron';
import { API_KEY, type SankyuApi } from './api';

// 本番ビルドでは electron-vite が package.json の version を define で埋め込む。
declare const __APP_VERSION__: string;

const api: SankyuApi = {
  version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
  platform: process.platform,
  isPackaged: process.env['NODE_ENV'] === 'production',
};

contextBridge.exposeInMainWorld(API_KEY, api);
