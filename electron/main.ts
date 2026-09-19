import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { initSteam } from './steam';

const isDev = !app.isPackaged;
// App ID 取得前は Spacewar（480）で確認する（docs/STEAM.md）
const STEAM_APP_ID = 480;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    // 本番はメニューバー無し（docs/STEAM.md「品質」）
    backgroundColor: '#E9E3D6',
    fullscreen: Boolean(process.env['SteamTenfoot']),
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev,
    },
  });

  win.once('ready-to-show', () => win.show());

  if (!isDev) {
    // 本番: Ctrl+R / F5 / F12 などのリロード・devtools ショートカットを無効化
    win.webContents.on('before-input-event', (event, input) => {
      const key = input.key.toLowerCase();
      if (input.type !== 'keyDown') return;
      if ((input.control || input.meta) && (key === 'r' || key === 'i' && input.shift)) event.preventDefault();
      if (key === 'f5' || key === 'f12') event.preventDefault();
    });
  }

  // 外部リンクはアプリ内で開かない
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
  return win;
}

const steam = initSteam(STEAM_APP_ID);

void app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Steam オーバーレイは main の最後に有効化する（docs/STEAM.md）
  steam.enableOverlay();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
