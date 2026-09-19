// steamworks.js の薄いラッパ。Steam 不在（Steam 外起動・開発時）でもすべて no-op。
// steamworks.js の導入はマイルストーン 4。ここではインターフェースだけ固定する。
export interface SteamBridge {
  readonly available: boolean;
  activateAchievement(id: string): boolean;
  enableOverlay(): void;
}

const noop: SteamBridge = {
  available: false,
  activateAchievement: () => false,
  enableOverlay: () => undefined,
};

export function initSteam(_appId: number): SteamBridge {
  // TODO(M4): steamworks.js を動的 import し、失敗したら noop を返す
  return noop;
}
