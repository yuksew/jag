// 設定の読み書きと、表示設定の反映。Electron が無ければ localStorage。
import { defaultSettings, type Settings } from '../../electron/api';
import { platformApi } from './api';
import { log } from './log';

const LS_KEY = 'sankyu-settings';

export function loadSettingsSync(): Settings {
  const api = platformApi();
  if (api) {
    try {
      return api.settings.readSync();
    } catch (e) {
      log.warn(`settings readSync failed: ${String(e)}`);
      return defaultSettings();
    }
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? { ...defaultSettings(), ...(JSON.parse(raw) as Partial<Settings>) } : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const api = platformApi();
  if (api) {
    await api.settings.write(settings);
    return;
  }
  localStorage.setItem(LS_KEY, JSON.stringify(settings));
}

/** 表示設定を反映する（全画面、拡大率、リデュースモーション） */
export async function applyDisplay(settings: Settings): Promise<void> {
  document.documentElement.classList.toggle('reduce-motion', settings.display.reduceMotion);
  const api = platformApi();
  if (!api) return;
  await api.window.setFullscreen(settings.display.fullscreen);
  await api.window.setZoom(settings.display.scale / 100);
}
