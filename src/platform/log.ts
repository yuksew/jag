// renderer のロガー。Electron なら main に送ってファイルに書く。ブラウザ単体なら console。
import type { LogLevel } from '../../electron/api';
import { platformApi } from './api';

function emit(level: LogLevel, message: string): void {
  const api = platformApi();
  if (api) api.log(level, message);
  // eslint-disable-next-line no-console -- ブラウザ単体で開いたときの逃げ道
  else console[level](message);
}

export const log = {
  info: (m: string) => emit('info', m),
  warn: (m: string) => emit('warn', m),
  error: (m: string) => emit('error', m),
};

/** 未処理例外をログに書き、ゲームは落とさない */
export function installErrorLogging(): void {
  window.addEventListener('error', (e) => log.error(`${e.message} (${e.filename}:${e.lineno})`));
  window.addEventListener('unhandledrejection', (e) => log.error(`unhandledrejection: ${String(e.reason)}`));
}
