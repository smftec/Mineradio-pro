// 动态桌面壁纸:WorkerW 技术(Windows 原生 FFI)
// 原理:SendMessage(Progman, 0x052C) 触发系统生成 WorkerW 桌面层 →
//       找到无 SHELLDLL_DefView 子窗口的那个 WorkerW → SetParent(我们的可视化窗口, WorkerW)
// 参考通用实现思路(Lively Wallpaper 等开源项目的公开做法),FFI 调用全部自研。
import { BrowserWindow } from 'electron';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const require = createRequire(import.meta.url);
const koffi = require('koffi');
const user32 = koffi.load('user32.dll');

const FindWindowW = user32.func('FindWindowW', 'int', ['str16', 'str16']);
const FindWindowExW = user32.func('FindWindowExW', 'int', ['int', 'int', 'str16', 'str16']);
const SendMessageW = user32.func('SendMessageW', 'int', ['int', 'uint16', 'int', 'int']);
const kernel32 = koffi.load('kernel32.dll');
const GetLastError = kernel32.func('GetLastError', 'uint32', []);
const SetWindowPos = user32.func('SetWindowPos', 'int', ['int', 'int', 'int', 'int', 'int', 'int', 'uint32']);

let wallpaperWindow = null;
let mounted = false;

// 诊断:枚举桌面窗口树
export function diagWindows() {
  const progman = FindWindowW('Progman', null);
  const list = [{ w: progman, cls: 'Progman', defView: !!FindWindowExW(progman, 0, 'SHELLDLL_DefView', null) }];
  let h = 0;
  for (;;) {
    h = FindWindowExW(0, h, 'WorkerW', null);
    if (!h) break;
    list.push({ w: h, cls: 'WorkerW', defView: !!FindWindowExW(h, 0, 'SHELLDLL_DefView', null) });
  }
  return list;
}

// 触发系统生成 WorkerW 并返回目标句柄(挂在图标层之后的那个)
function findWorkerW() {
  const progman = FindWindowW('Progman', null);
  if (!progman) return null;
  SendMessageW(progman, 0x052C, 0, 0); // WM_SPAWN_WORKERW(部分系统需要两次)
  SendMessageW(progman, 0x052C, 0, 0);
  // 枚举:先找带 SHELLDLL_DefView 的 WorkerW,再取其后的下一个 WorkerW
  let h = 0;
  let defViewParent = null;
  for (;;) {
    h = FindWindowExW(0, h, 'WorkerW', null);
    if (!h) break;
    const dv = FindWindowExW(h, 0, 'SHELLDLL_DefView', null);
    if (dv) { defViewParent = h; continue; }
    if (defViewParent !== null) return h; // DefView 之后的第一个 WorkerW
  }
  // 兜底:任意 WorkerW(无 DefView 的)
  h = 0;
  for (;;) {
    h = FindWindowExW(0, h, 'WorkerW', null);
    if (!h) break;
    if (!FindWindowExW(h, 0, 'SHELLDLL_DefView', null)) return h;
  }
  return null;
}

function hwndOf(win) {
  // Electron 返回 8 字节指针,HWND 值本身 32 位有效
  const buf = win.getNativeWindowHandle();
  return buf.readUInt32LE(0);
}

// 创建/获取壁纸可视化窗口(全屏、无边框、跳过任务栏)
export function getWallpaperWindow() {
  if (wallpaperWindow && !wallpaperWindow.isDestroyed()) return wallpaperWindow;
  const { screen } = require('electron');
  const primary = screen.getPrimaryDisplay();
  const { width, height } = primary.size;
  wallpaperWindow = new BrowserWindow({
    x: 0, y: 0, width, height,
    frame: false, resizable: false, movable: false,
    show: false,
    skipTaskbar: true,
    backgroundColor: '#000000',
    focusable: false,
    webPreferences: {
      preload: join(__dirname, '..', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  wallpaperWindow.setIgnoreMouseEvents(true);
  wallpaperWindow.once('ready-to-show', () => { try { wallpaperWindow.showInactive(); } catch {} });
  wallpaperWindow.loadFile(join(__dirname, '..', '..', 'public', 'wallpaper.html'));
  // 静默崩溃恢复
  wallpaperWindow.webContents.on('render-process-gone', (_e, d) => {
    if (d.reason !== 'clean-exit' && wallpaperWindow && !wallpaperWindow.isDestroyed()) {
      wallpaperWindow.webContents.reload();
    }
  });
  return wallpaperWindow;
}



// 挂载动态壁纸
export async function mountWallpaper(mode) {
  const win = getWallpaperWindow();
  const workerW = findWorkerW();
  if (!workerW) return { ok: false, reason: '未找到桌面 WorkerW 层(系统不支持)' };
  win.showInactive();
  const child = hwndOf(win);
  const r = require('koffi');
  const u32 = r.load('user32.dll');
  const SetParent = u32.func('SetParent', 'int', ['int', 'int']);
  let target = workerW;
  let ok = target ? SetParent(child, target) : 0;
  if (!ok) {
    // 回退:直接挂 Progman + HWND_BOTTOM(置于图标层之下)
    target = FindWindowW('Progman', null);
    ok = target ? SetParent(child, target) : 0;
    console.error('[wallpaper] worker fallback to progman, ok:', !!ok);
  }
  if (!ok) {
    const err = GetLastError();
    console.error('[wallpaper] SetParent failed, lastError:', err, 'child:', child);
    return { ok: false, hwnd: workerW, lastError: err };
  }
  // 置于 Z 序最底(图标层之下),不移动不改变大小
  SetWindowPos(child, 1 /*HWND_BOTTOM*/, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010);
  mounted = true;
  // 通知渲染端设置可视化模式
  win.webContents.send('wallpaper:config', { mode: mode || 'nebula' });
  return { ok: true, hwnd: target };
}

// 解除壁纸(恢复桌面)
export function unmountWallpaper() {
  if (wallpaperWindow && !wallpaperWindow.isDestroyed()) {
    wallpaperWindow.destroy();
  }
  wallpaperWindow = null;
  mounted = false;
  return { ok: true };
}

export function isMounted() {
  return mounted;
}
