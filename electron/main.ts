import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { ARG_PACKAGED, IPC, type LogLevel } from './api';
import { log } from './log';
import { clearSave, readSave, restoreBackup, writeSave } from './save';
import { initSteam } from './steam';
import { readOverride, watchOverride } from './tuning';

const isDev = !app.isPackaged;
// userData は productName（三球）ではなく ASCII の固定名にする。
// Steam Auto-Cloud のパス指定と開発時／本番の一致のため。ready より前に決める
app.setPath('userData', join(app.getPath('appData'), 'sankyu'));
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
    },
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
  ipcMain.on(IPC.log, (_e, level: unknown, message: unknown) => {
    const lv: LogLevel = level === 'error' || level === 'warn' ? level : 'info';
    log(lv, String(message), 'renderer');
  });
}

process.on('uncaughtException', (e) => log('error', `uncaughtException: ${e.stack ?? String(e)}`));
process.on('unhandledRejection', (e) => log('error', `unhandledRejection: ${String(e)}`));

const steam = initSteam(STEAM_APP_ID);

void app.whenReady().then(() => {
  registerIpc();
  createWindow();
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
