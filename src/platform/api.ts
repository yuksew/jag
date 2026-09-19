import type { SankyuApi } from '../../electron/api';

declare global {
  interface Window {
    sankyu?: SankyuApi;
  }
}

/** preload が公開した API。ブラウザ単体で開いたときは undefined */
export function platformApi(): SankyuApi | undefined {
  return window.sankyu;
}
