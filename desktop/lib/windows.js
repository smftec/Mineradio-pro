// 窗口管理:主窗口 / 迷你播放器 / 桌面歌词
import electron from 'electron';
const { BrowserWindow, app } = electron;
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { getStore } from './store.js';
import { setMainWindow } from './library.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const windows = { main: null, mini: null, desktopLyrics: null };

const PRELOAD = join(__dirname, '..', 'preload.cjs');
const winOpts = {
  webPreferences: {
    preload: PRELOAD,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
    spellcheck: false,
  },
};

// dev 模式窗口图标(build/ 不进 asar,打包后用 exe 内嵌图标即可)
const DEV_ICON = app.isPackaged ? null : (() => {
  const p = join(__dirname, '..', '..', 'build', 'icon.ico');
  return existsSync(p) ? p : undefined;
})();

function forwardConsole(win) {
  if (!app.isPackaged) {
    win.webContents.on('console-message', (_e, _level, message, line, sourceId) => {
      console.log(`[renderer] ${message} (${sourceId}:${line})`);
    });
    win.webContents.on('preload-error', (_e, path, err) => {
      console.error('[preload-error]', path, err?.message);
    });
  }
  // 渲染进程崩溃自动恢复(非正常退出时重载)
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer-gone]', details.reason);
    if (details.reason !== 'clean-exit') {
      setTimeout(() => {
        if (!win.isDestroyed()) win.webContents.reload();
      }, 800);
    }
  });
}

export async function createMainWindow() {
  if (windows.main && !windows.main.isDestroyed()) {
    windows.main.show();
    return windows.main;
  }
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 1020, minHeight: 660,
    frame: false,
    backgroundColor: '#0b0d14',
    show: false,
    icon: DEV_ICON,
    title: 'Mineradio pro',
    webPreferences: { ...winOpts.webPreferences },
  });
  // 主窗经本地 HTTP 服务加载(Folia 同源 iframe 集成前提);服务未就绪时回退 loadFile
  let loaded = false;
  try {
    const { getServerOrigin } = await import('./server.js');
    const origin = getServerOrigin();
    if (origin) { await win.loadURL(origin + '/index.html'); loaded = true; }
  } catch { /* fallback below */ }
  if (!loaded) win.loadFile(join(__dirname, '..', '..', 'public', 'index.html'));
  forwardConsole(win);
  win.once('ready-to-show', () => win.show());
  win.on('maximize', () => win.webContents.send('win:maximized', true));
  win.on('unmaximize', () => win.webContents.send('win:maximized', false));
  win.on('closed', () => {
    windows.main = null;
    // 主窗关闭 = 退出整个应用(关闭可能残留的迷你/桌面歌词窗口)
    for (const w of [windows.mini, windows.desktopLyrics]) {
      if (w && !w.isDestroyed()) w.destroy();
    }
  });
  windows.main = win;
  setMainWindow(win);
  return win;
}

const MINI_FULL = { width: 440, height: 164 };
const MINI_COLLAPSED = { width: 76, height: 76 };

export function createMiniWindow() {
  if (windows.mini && !windows.mini.isDestroyed()) {
    windows.mini.show();
    return windows.mini;
  }
  const cfg = getStore('config').data;
  const collapsed = !!cfg.mini?.collapsed;
  const size = collapsed ? MINI_COLLAPSED : MINI_FULL;
  const opts = {
    width: size.width, height: size.height,
    frame: false, resizable: false,
    alwaysOnTop: !!cfg.mini?.onTop || collapsed,
    // 主窗隐藏时用户需要能从任务栏找回,不能跳过任务栏
    skipTaskbar: false,
    backgroundColor: '#101322',
    show: false,
    title: 'Mineradio pro — 迷你播放器',
    icon: DEV_ICON,
    webPreferences: { ...winOpts.webPreferences },
  };
  // 记忆上次位置
  if (cfg.mini?.x != null && cfg.mini?.y != null) {
    opts.x = cfg.mini.x;
    opts.y = cfg.mini.y;
  }
  const win = new BrowserWindow(opts);
  win.loadFile(join(__dirname, '..', '..', 'public', 'mini.html'));
  forwardConsole(win);
  win.once('ready-to-show', () => win.show());
  win.on('move', () => {
    const [x, y] = win.getPosition();
    getStore('config').data.mini.x = x;
    getStore('config').data.mini.y = y;
    getStore('config').scheduleSave();
  });
  win.on('closed', () => { windows.mini = null; });
  windows.mini = win;
  return win;
}

// 悬浮封面模式:收起为 76x76 可拖动封面,双击展开
export function setMiniCollapsed(collapsed) {
  const win = windows.mini;
  if (!win || win.isDestroyed()) return;
  const cfgStore = getStore('config');
  cfgStore.data.mini.collapsed = !!collapsed;
  cfgStore.scheduleSave();
  const keep = win.getPosition(); // 保持左上角位置
  const size = collapsed ? MINI_COLLAPSED : MINI_FULL;
  win.setMinimumSize(collapsed ? 76 : 320, collapsed ? 76 : 140);
  win.setSize(size.width, size.height);
  win.setPosition(keep[0], keep[1]);
  win.setAlwaysOnTop(!!cfgStore.data.mini.onTop || collapsed);
  win.webContents.send('mini:collapsed', !!collapsed);
}

export function createDesktopLyricsWindow() {
  if (windows.desktopLyrics && !windows.desktopLyrics.isDestroyed()) {
    windows.desktopLyrics.show();
    return windows.desktopLyrics;
  }
  const cfg = getStore('config').data.desktopLyrics;
  const win = new BrowserWindow({
    width: cfg.w, height: cfg.h,
    x: cfg.x, y: cfg.y,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    title: 'Mineradio pro — 桌面歌词',
    webPreferences: { ...winOpts.webPreferences },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(join(__dirname, '..', '..', 'public', 'lyrics.html'));
  forwardConsole(win);
  win.once('ready-to-show', () => win.show());
  const applyLock = () => {
    const locked = getStore('config').data.desktopLyrics.locked;
    win.setIgnoreMouseEvents(locked, { forward: true });
    win.webContents.send('dl:lockChanged', !!locked);
  };
  win.webContents.on('did-finish-load', applyLock);
  win.on('resize', () => {
    const [w, h] = win.getSize();
    getStore('config').data.desktopLyrics.w = w;
    getStore('config').data.desktopLyrics.h = h;
    getStore('config').scheduleSave();
  });
  win.on('move', () => {
    const [x, y] = win.getPosition();
    getStore('config').data.desktopLyrics.x = x;
    getStore('config').data.desktopLyrics.y = y;
    getStore('config').scheduleSave();
  });
  win.on('closed', () => {
    windows.desktopLyrics = null;
    getStore('config').data.desktopLyrics.visible = false;
    getStore('config').scheduleSave();
  });
  windows.desktopLyrics = win;
  return win;
}

export function closeDesktopLyricsWindow() {
  if (windows.desktopLyrics && !windows.desktopLyrics.isDestroyed()) {
    windows.desktopLyrics.close();
  }
}

export function closeMiniWindow() {
  if (windows.mini && !windows.mini.isDestroyed()) windows.mini.close();
}

app.on('quit', () => {
  for (const w of Object.values(windows)) {
    if (w && !w.isDestroyed()) w.destroy();
  }
});
