import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { ARG_PACKAGED, defaultSettings, IPC, type LogLevel } from './api';
import { log, pruneLogs } from './log';
import { clearSave, readSave, restoreBackup, writeSave } from './save';
import { normalizeSettings, readSettings, writeSettings } from './settings';
import { initSteam } from './steam';
import { readOverride, watchOverride } from './tuning';

const isDev = !app.isPackaged;
let cachedSettings = defaultSettings();
// userData は productName（三球）ではなく ASCII の固定名にする。
// Steam Auto-Cloud のパス指定と開発時／本番の一致のため。ready より前に決める
// SANKYU_USERDATA でテスト用に差し替えられる（tests/smoke.mjs）
app.setPath('userData', process.env['SANKYU_USERDATA'] ?? join(app.getPath('appData'), 'sankyu'));
// App ID 取得前は Spacewar（480）で確認する（docs/STEAM.md）
const STEAM_APP_ID = 480;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    // 本番はメニューバー無し（docs/STEAM.md「品質」）
    autoHideMenuBar: true,
    backgroundColor: '#E9E3D6',
    fullscreen: Boolean(process.env['SteamTenfoot']),
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev,
      additionalArguments: app.isPackaged ? [ARG_PACKAGED] : [],
      // 拍の基準時刻に AudioContext を使うので、操作前から音声コンテキストを動かせるようにする
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  // 閉じる前に renderer にセーブを書かせる。応答が無くても 1.5 秒で閉じる
  let flushed = false;
  win.on('close', (event) => {
    if (flushed || win.webContents.isDestroyed()) return;
    event.preventDefault();
    const done = (): void => {
      if (flushed) return;
      flushed = true;
      win.close();
    };
    ipcMain.once(IPC.flushDone, done);
    win.webContents.send(IPC.flushRequest);
    setTimeout(done, 1500);
  });

  win.once('ready-to-show', () => win.show());

  if (!isDev) {
    // 本番: Ctrl+R / F5 / F12 などのリロード・devtools ショートカットを無効化
    win.webContents.on('before-input-event', (event, input) => {
      const key = input.key.toLowerCase();
      if (input.type !== 'keyDown') return;
      if ((input.control || input.meta) && (key === 'r' || (key === 'i' && input.shift))) event.preventDefault();
      if (key === 'f5' || key === 'f12') event.preventDefault();
    });
  }

  // 外部リンクはアプリ内で開かない
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  watchOverride(win);

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
  return win;
}

function registerIpc(): void {
  ipcMain.handle(IPC.saveRead, () => readSave());
  ipcMain.handle(IPC.saveWrite, (_e, json: unknown) => {
    if (typeof json !== 'string') throw new Error('save:write expects a string');
    return writeSave(json);
  });
  ipcMain.handle(IPC.saveRestore, () => restoreBackup());
  ipcMain.handle(IPC.saveClear, () => clearSave());
  ipcMain.handle(IPC.tuningLoad, () => readOverride());
  ipcMain.handle(IPC.settingsRead, () => readSettings());
  ipcMain.on(IPC.settingsReadSync, (e) => {
    e.returnValue = cachedSettings;
  });
  ipcMain.handle(IPC.settingsWrite, async (_e, settings: unknown) => {
    if (typeof settings !== 'object' || settings === null) throw new Error('settings:write expects an object');
    cachedSettings = normalizeSettings(settings);
    await writeSettings(cachedSettings);
  });
  ipcMain.handle(IPC.windowFullscreen, (e, on: unknown) => {
    BrowserWindow.fromWebContents(e.sender)?.setFullScreen(on === true);
  });
  ipcMain.handle(IPC.windowZoom, (e, factor: unknown) => {
    const f = typeof factor === 'number' && Number.isFinite(factor) ? Math.min(2, Math.max(0.5, factor)) : 1;
    e.sender.setZoomFactor(f);
  });
  ipcMain.on(IPC.log, (_e, level: unknown, message: unknown) => {
    const lv: LogLevel = level === 'error' || level === 'warn' ? level : 'info';
    log(lv, String(message), 'renderer');
  });
}

process.on('uncaughtException', (e) => log('error', `uncaughtException: ${e.stack ?? String(e)}`));
process.on('unhandledRejection', (e) => log('error', `unhandledRejection: ${String(e)}`));

const steam = initSteam(STEAM_APP_ID);

void app.whenReady().then(async () => {
  registerIpc();
  cachedSettings = await readSettings();
  const settings = cachedSettings;
  const win = createWindow();
  if (settings.display.fullscreen) win.setFullScreen(true);
  if (settings.display.scale !== 100) win.webContents.setZoomFactor(settings.display.scale / 100);
  void pruneLogs().then((removed) => {
    if (removed.length) log('info', `pruned logs: ${removed.join(',')}`);
  });
  log('info', `start v${app.getVersion()} packaged=${String(app.isPackaged)} steam=${String(steam.available)}`);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Steam オーバーレイは main の最後に有効化する（docs/STEAM.md）
  steam.enableOverlay();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
