// preload が contextBridge で renderer に公開する API の型。
// electron/ と src/platform/ の両方から参照する唯一の接点。
export interface SankyuApi {
  /** package.json の version。ゲーム内表示とビルド ID を一致させる */
  version: string;
  /** process.platform の値 */
  platform: string;
  /** 本番ビルドか（devtools 無効・メニュー無し） */
  isPackaged: boolean;
}

export const API_KEY = 'sankyu' as const;
