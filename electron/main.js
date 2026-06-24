const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// ── .env 路径（开发模式用项目根目录，打包后用 exe 同级目录）──
const envPath = app.isPackaged
  ? path.join(path.dirname(app.getPath('exe')), '.env')
  : path.join(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  // 回退到默认 dotenv 行为
  require('dotenv').config();
}

// ── 启动 Express 服务器 ──
const expressApp = require('../server');
const PORT = process.env.PORT || 3000;

let mainWindow;
let server;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    title: '互动叙事游戏 · 苏蓉蓉',
    icon: path.join(__dirname, '..', 'public', 'icon-512.png'),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  // 外部链接在默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  server = expressApp.listen(PORT, () => {
    console.log(`🎮 互动叙事游戏已启动 → http://localhost:${PORT}`);
    createWindow();
  });
});

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (server) server.close();
});
