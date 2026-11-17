// IPC 路由:所有 invoke/send 通道集中注册
import electron from 'electron';
const { ipcMain, dialog, app, shell, BrowserWindow } = electron;
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getStore, stores } from './store.js';
import * as library from './library.js';
import { getLyrics } from './lyrics.js';
import * as playlists from './playlists.js';
import * as stats from './stats.js';
import { mediaUrl } from './protocol.js';
import { mountWallpaper, unmountWallpaper, isMounted, diagWindows } from './wallpaper.js';
import * as updater from './updater.js';
import { applyMediaKeys } from './shortcuts.js';
import * as translation from './translation.js';
import { detectFfmpeg, resetFfmpegCache } from './audio/transcode.js';
import { writeFileSync } from 'node:fs';
import * as backup from './backup.js';
import {
  createMainWindow, createMiniWindow, closeMiniWindow,
  createDesktopLyricsWindow, closeDesktopLyricsWindow, windows, setMiniCollapsed,
} from './windows.js';

// 读取打包配置中的发布仓库信息(打包后 package.json 在 asar 内,fs 可直接读)
function getPublishInfo() {
  try {
    const pkg = JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf-8'));
    const pub = pkg.build?.publish || {};
    return { owner: pub.owner || 'your-github-name', repo: pub.repo || 'Mineradio-pro' };
  } catch {
    return { owner: 'your-github-name', repo: 'Mineradio-pro' };
  }
}

function broadcast(channel, payload) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(channel, payload);
  }
}

function broadcastExcept(sender, channel, payload) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed() && w.webContents !== sender) w.webContents.send(channel, payload);
  }
}

export function registerIpc() {
  // ---- 应用 / 窗口 ----
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    packaged: app.isPackaged,
  }));
  ipcMain.on('win:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
  ipcMain.on('win:maximize', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (!w) return;
    w.isMaximized() ? w.unmaximize() : w.maximize();
  });
  ipcMain.on('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());

  ipcMain.on('mini:open', () => {
    const main = windows.main;
    const bounds = main && !main.isDestroyed() ? main.getBounds() : null;
    createMiniWindow();
    if (bounds && main && !main.isDestroyed()) main.hide();
  });
  ipcMain.on('mini:close', () => {
    closeMiniWindow();
    const main = windows.main;
    if (main && !main.isDestroyed()) main.show();
  });
  ipcMain.on('mini:setOnTop', (_e, onTop) => {
    getStore('config').data.mini.onTop = !!onTop;
    getStore('config').scheduleSave();
    if (windows.mini && !windows.mini.isDestroyed()) windows.mini.setAlwaysOnTop(!!onTop);
  });
  ipcMain.on('mini:restore', () => {
    closeMiniWindow();
    createMainWindow();
  });
  ipcMain.on('mini:collapse', () => setMiniCollapsed(true));
  ipcMain.on('mini:expand', () => setMiniCollapsed(false));

  // ---- 曲库 ----
  ipcMain.handle('lib:pickFolder', async () => {
    const r = await dialog.showOpenDialog(windows.main, { properties: ['openDirectory'], title: '选择音乐文件夹' });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('lib:pickFiles', async () => {
    const r = await dialog.showOpenDialog(windows.main, {
      properties: ['openFile', 'multiSelections'],
      title: '选择音乐文件',
    });
    return r.canceled ? [] : r.filePaths;
  });
  ipcMain.handle('lib:addFolder', async (_e, folder) => {
    if (!folder) return { ok: false };
    const r = await library.addFolder(folder);
    return { ok: true, ...r };
  });
  ipcMain.handle('lib:addFiles', async (_e, paths) => library.addFiles(paths || []));
  ipcMain.handle('lib:getAll', () => library.allTracks());
  ipcMain.handle('lib:getFolders', () => getStore('library').data.folders || []);
  ipcMain.handle('lib:removeFolder', (_e, folder) => library.removeFolder(folder));
  ipcMain.handle('lib:rescan', async () => {
    const folders = getStore('library').data.folders || [];
    return library.scanFolders(folders);
  });
  ipcMain.handle('lib:isScanning', () => library.isScanning());
  ipcMain.handle('lib:reveal', (_e, filePath) => {
    if (typeof filePath === 'string' && filePath) shell.showItemInFolder(filePath);
    return true;
  });

  // ---- 播放 / 歌词 ----
  ipcMain.handle('lyrics:get', (_e, trackId) => getLyrics(library.getTrack(trackId)));
  ipcMain.handle('media:url', (_e, filePath) => mediaUrl(filePath));
  // 迷你播放器 / 桌面歌词窗口:取当前曲目信息
  ipcMain.handle('player:getState', () => lastPlayerState);
  ipcMain.on('player:state', (e, state) => {
    lastPlayerState = state;
    broadcastExcept(e.sender, 'player:state', state);
  });
  ipcMain.on('player:tick', (e, tick) => {
    broadcastExcept(e.sender, 'player:tick', tick);
  });
  ipcMain.on('player:spec', (e, bins) => {
    broadcastExcept(e.sender, 'player:spec', bins);
  });
  ipcMain.handle('wallpaper:mount', (_e, mode) => mountWallpaper(mode));
  ipcMain.handle('wallpaper:unmount', () => unmountWallpaper());
  ipcMain.handle('wallpaper:isMounted', () => isMounted());
  ipcMain.handle('wallpaper:diag', () => diagWindows());
  ipcMain.on('player:command', (e, cmd, arg) => {
    broadcastExcept(e.sender, 'player:command', { cmd, arg });
  });

  // ---- 歌单 ----
  ipcMain.handle('pl:list', () => playlists.listPlaylists());
  ipcMain.handle('pl:create', (_e, name, trackIds) => playlists.createPlaylist(name, trackIds));
  ipcMain.handle('pl:rename', (_e, id, name) => playlists.renamePlaylist(id, name));
  ipcMain.handle('pl:remove', (_e, id) => playlists.removePlaylist(id));
  ipcMain.handle('pl:addTracks', (_e, id, trackIds) => playlists.addToPlaylist(id, trackIds));
  ipcMain.handle('pl:removeTrack', (_e, id, trackId) => playlists.removeFromPlaylist(id, trackId));
  ipcMain.handle('pl:reorder', (_e, id, trackIds) => playlists.reorderPlaylist(id, trackIds));

  // ---- 统计 / 续播 ----
  ipcMain.handle('stats:record', (_e, trackId, info) => stats.recordPlay(trackId, info || {}));
  ipcMain.handle('stats:progress', (_e, trackId, pos) => stats.updateProgress(trackId, pos));
  ipcMain.handle('stats:position', (_e, trackId) => stats.getPosition(trackId));
  ipcMain.handle('stats:all', () => stats.allStats());
  ipcMain.handle('stats:clearHistory', () => stats.clearHistory());
  ipcMain.handle('stats:reset', () => stats.resetStats());

  // ---- 设置 ----
  ipcMain.handle('config:get', () => getStore('config').data);
  ipcMain.handle('config:set', (_e, patch) => {
    const cfg = getStore('config').data;
    deepAssign(cfg, patch);
    getStore('config').scheduleSave();
    return cfg;
  });
  ipcMain.handle('app:setLoginItem', (_e, openAtLogin) => {
    try {
      app.setLoginItemSettings({ openAtLogin: !!openAtLogin, path: process.execPath });
      return app.getLoginItemSettings().openAtLogin;
    } catch {
      return false;
    }
  });
  ipcMain.handle('app:getLoginItem', () => {
    try {
      return app.getLoginItemSettings().openAtLogin;
    } catch {
      return false;
    }
  });

  // ---- 收藏 ----
  ipcMain.handle('fav:toggle', (_e, trackId) => {
    const cfg = getStore('config').data;
    cfg.favorites ||= [];
    const i = cfg.favorites.indexOf(trackId);
    if (i >= 0) cfg.favorites.splice(i, 1);
    else cfg.favorites.push(trackId);
    getStore('config').scheduleSave();
    return { fav: i < 0, favorites: cfg.favorites };
  });

  // ---- 全局快捷键 ----
  ipcMain.handle('shortcuts:setMediaKeys', (_e, on) => {
    getStore('config').data.shortcuts.mediaKeys = !!on;
    getStore('config').scheduleSave();
    applyMediaKeys(!!on);
    return true;
  });

  // ---- 备份 / 恢复 ----
  ipcMain.handle('export:saveVideo', (_e, base64, filename) => {
    try {
      const safe = String(filename).replace(/[\\/:*?"<>|]/g, '_');
      const dir = app.getPath('downloads');
      const path = join(dir, safe);
      writeFileSync(path, Buffer.from(base64, 'base64'));
      return { ok: true, path };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  });
  ipcMain.handle('app:checkFfmpeg', () => {
    resetFfmpegCache();
    const path = detectFfmpeg();
    return { found: !!path, path: path || '' };
  });
  ipcMain.handle('translation:getConfig', () => translation.getConfig());
  ipcMain.handle('translation:set', (_e, patch) => translation.setConfig(patch || {}));
  ipcMain.handle('translation:test', () => translation.testTranslation());
  ipcMain.handle('translation:translate', (_e, lines, targetLang) => translation.translateLines(lines || [], targetLang));
  ipcMain.handle('backup:export', async () => backup.exportBackup(windows.main));
  ipcMain.handle('backup:import', async () => backup.importBackup(windows.main));
  ipcMain.handle('backup:relaunch', () => backup.relaunchApp());

  // ---- 桌面歌词 ----
  ipcMain.on('dl:show', () => {
    getStore('config').data.desktopLyrics.visible = true;
    getStore('config').scheduleSave();
    createDesktopLyricsWindow();
  });
  ipcMain.on('dl:hide', () => closeDesktopLyricsWindow());
  ipcMain.on('dl:lock', (_e, locked) => {
    getStore('config').data.desktopLyrics.locked = !!locked;
    getStore('config').scheduleSave();
    const w = windows.desktopLyrics;
    if (w && !w.isDestroyed()) {
      w.setIgnoreMouseEvents(!!locked, { forward: true });
      w.webContents.send('dl:lockChanged', !!locked);
    }
  });
  ipcMain.on('dl:config', (_e, patch) => {
    Object.assign(getStore('config').data.desktopLyrics, patch);
    getStore('config').scheduleSave();
    broadcast('dl:configChanged', getStore('config').data.desktopLyrics);
  });

  // ---- 更新 ----
  ipcMain.handle('update:check', () => updater.checkForUpdates(true));
  ipcMain.handle('update:download', () => updater.downloadUpdate());
  ipcMain.handle('update:install', () => updater.installUpdate());
  ipcMain.handle('update:skip', (_e, version) => {
    getStore('config').data.update.skippedVersion = version;
    getStore('config').scheduleSave();
  });
  ipcMain.handle('update:openReleases', () => {
    const pub = getPublishInfo();
    shell.openExternal(`https://github.com/${pub.owner}/${pub.repo}/releases`);
  });
}

let lastPlayerState = { trackId: null, playing: false, position: 0, duration: 0, queue: [], index: -1 };

function deepAssign(target, patch) {
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof target[k] === 'object' && target[k] !== null) {
      deepAssign(target[k], v);
    } else {
      target[k] = v;
    }
  }
}
