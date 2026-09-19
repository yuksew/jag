// steamworks.js の薄いラッパ。Steam 不在（Steam 外起動・開発時・SDK 不在）でもすべて no-op。
// ゲーム本体は Steam の有無を知らない。core の実績 id → Steam の API 名の対応表はここに置く。
import { app, BrowserWindow } from 'electron';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type * as Steamworks from 'steamworks.js';
import { log } from './log';

export interface SteamStats {
  totalCatches: number;
  bestRun: number;
  /** 完走までの遊んだ時間（ms）。未完走なら 0 */
  completeMs: number;
}

export interface SteamBridge {
  readonly available: boolean;
  readonly appId: number;
  readonly onDeck: boolean;
  /** core の実績 id を Steam に送る。送れた（または送済み）なら true */
  activateAchievement(coreId: string): boolean;
  setStats(stats: SteamStats): void;
  setRichPresence(status: string | null): void;
  /** app ready より前に呼ぶ（コマンドラインスイッチを足す） */
  enableOverlay(): void;
}

/** 本番の App ID 用の対応表（Steamworks で同じ API 名を定義する） */
const ACHIEVEMENTS: Record<string, string> = {
  first_clean: 'FIRST_CLEAN',
  first_core: 'FIRST_CORE',
  run_40: 'RUN_40',
  run_80: 'RUN_80',
  four_balls: 'FOUR_BALLS',
  catch_2000: 'CATCH_2000',
  first_applause: 'FIRST_APPLAUSE',
  street_all: 'STREET_ALL',
  passing_clean: 'PASSING_CLEAN',
  flash7: 'FLASH7',
  sealed: 'SEALED',
  mastery: 'MASTERY',
  complete: 'COMPLETE',
};
const STATS: Record<keyof SteamStats, string> = {
  totalCatches: 'total_catches',
  bestRun: 'best_run',
  completeMs: 'complete_ms',
};

/** App ID 取得前の Spacewar（480）での動作確認用。Spacewar に実在する実績と統計に寄せる */
const SPACEWAR_APP_ID = 480;
const SPACEWAR_ACHIEVEMENTS: Record<string, string> = {
  first_clean: 'ACH_WIN_ONE_GAME',
  run_40: 'ACH_TRAVEL_FAR_SINGLE',
  catch_2000: 'ACH_TRAVEL_FAR_ACCUM',
  complete: 'ACH_WIN_100_GAMES',
};
const SPACEWAR_STATS: Partial<Record<keyof SteamStats, string>> = {
  totalCatches: 'NumGames',
  bestRun: 'NumWins',
};

type Client = ReturnType<typeof Steamworks.init>;

const noop = (appId: number): SteamBridge => ({
  available: false,
  appId,
  onDeck: Boolean(process.env['SteamDeck']),
  activateAchievement: () => false,
  setStats: () => undefined,
  setRichPresence: () => undefined,
  enableOverlay: () => undefined,
});

/** 開発時だけ、Steam クライアントが App ID を見つけられるように steam_appid.txt を置く */
function writeAppIdFile(appId: number): void {
  if (app.isPackaged) return;
  try {
    writeFileSync(join(process.cwd(), 'steam_appid.txt'), `${appId}\n`);
  } catch (e) {
    log('warn', `steam_appid.txt write failed: ${String(e)}`);
  }
}

export function initSteam(appId: number): SteamBridge {
  writeAppIdFile(appId);
  let sw: typeof Steamworks;
  try {
    // ネイティブモジュール。無い環境（SDK 未同梱、未対応 OS）では require 自体が失敗する
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sw = require('steamworks.js') as typeof Steamworks;
  } catch (e) {
    log('info', `steam: module unavailable (${String(e).split('\n')[0] ?? ''})`);
    return noop(appId);
  }

  // 本番のみ: Steam 外から起動されたら Steam 経由で再起動する
  if (app.isPackaged) {
    try {
      if (sw.restartAppIfNecessary(appId)) {
        log('info', 'steam: restarting through Steam');
        app.quit();
        return noop(appId);
      }
    } catch (e) {
      log('warn', `steam: restartAppIfNecessary failed: ${String(e)}`);
    }
  }

  let client: Client;
  try {
    client = sw.init(appId);
  } catch (e) {
    log('info', `steam: init failed, running without Steam (${String(e).split('\n')[0] ?? ''})`);
    return noop(appId);
  }

  const spacewar = appId === SPACEWAR_APP_ID;
  const achievementName = (coreId: string): string | undefined =>
    spacewar ? SPACEWAR_ACHIEVEMENTS[coreId] : ACHIEVEMENTS[coreId];
  const statName = (key: keyof SteamStats): string | undefined => (spacewar ? SPACEWAR_STATS[key] : STATS[key]);
  const activated = new Set<string>();
  let onDeck: boolean;
  try {
    onDeck = client.utils.isSteamRunningOnSteamDeck();
  } catch {
    onDeck = false;
  }
  log('info', `steam: ready appId=${appId} user=${safe(() => client.localplayer.getName())} deck=${String(onDeck)}`);

  return {
    available: true,
    appId,
    onDeck,
    activateAchievement(coreId) {
      const name = achievementName(coreId);
      if (!name) return false;
      if (activated.has(name)) return true;
      try {
        if (client.achievement.isActivated(name) || client.achievement.activate(name)) {
          activated.add(name);
          log('info', `steam: achievement ${name}`);
          return true;
        }
      } catch (e) {
        log('warn', `steam: achievement ${name} failed: ${String(e)}`);
      }
      return false;
    },
    setStats(stats) {
      try {
        let changed = false;
        for (const key of Object.keys(stats) as (keyof SteamStats)[]) {
          const name = statName(key);
          if (!name) continue;
          const value = Math.round(stats[key]);
          if (client.stats.getInt(name) === value) continue;
          if (client.stats.setInt(name, value)) changed = true;
        }
        if (changed) client.stats.store();
      } catch (e) {
        log('warn', `steam: stats failed: ${String(e)}`);
      }
    },
    setRichPresence(status) {
      try {
        client.localplayer.setRichPresence('status', status);
      } catch (e) {
        log('warn', `steam: rich presence failed: ${String(e)}`);
      }
    },
    enableOverlay() {
      // steamworks.js の electronEnableSteamOverlay 相当。disable-direct-composition は
      // ゴースト窓の報告があるので付けない（docs/STEAM.md）
      app.commandLine.appendSwitch('in-process-gpu');
      const attach = (win: BrowserWindow): void => {
        const timer = setInterval(() => {
          if (win.isDestroyed()) clearInterval(timer);
          else if (!win.webContents.isPainting()) win.webContents.invalidate();
        }, 1000 / 60);
      };
      BrowserWindow.getAllWindows().forEach(attach);
      app.on('browser-window-created', (_e, win) => attach(win));
    },
  };
}

function safe(fn: () => string): string {
  try {
    return fn();
  } catch {
    return '?';
  }
}
