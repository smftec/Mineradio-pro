// 软件检测与更新:electron-updater(GitHub Releases / 自定义源)
import electronUpdater from 'electron-updater';
const { autoUpdater } = electronUpdater;
import electron from 'electron';
const { app } = electron;
import { getStore } from './store.js';
import { windows } from './windows.js';

let ready = false;

function emit(type, data = {}) {
  const payload = { type, ...data };
  for (const w of Object.values(windows)) {
    if (w && !w.isDestroyed()) w.webContents.send('update:event', payload);
  }
}

function notesText(notes) {
  if (!notes) return '';
  if (typeof notes === 'string') return notes;
  if (Array.isArray(notes)) return notes.map((n) => n.note || '').join('\n');
  return String(notes);
}

function applyFeedUrl() {
  const cfg = getStore('config').data.update;
  if (cfg && cfg.customUrl) {
    autoUpdater.setFeedURL({ provider: 'generic', url: cfg.customUrl });
  }
  // 否则使用打包时生成的 app-update.yml(来自 package.json build.publish)
}

export function currentVersion() {
  return app.getVersion();
}

export async function checkForUpdates(manual = false) {
  if (!ready) return;
  if (!app.isPackaged) {
    // 开发模式下 electron-updater 不可用(dev-app-update.yml 缺失)
    if (manual) emit('dev-mode', { message: '开发模式下自动更新不可用 — 打包安装(npm run build:win)后生效。' });
    return;
  }
  try {
    applyFeedUrl();
    autoUpdater.allowPrerelease = false;
    await autoUpdater.checkForUpdates();
  } catch (e) {
    emit('error', { message: humanError(e), manual });
  }
}

export async function downloadUpdate() {
  try {
    applyFeedUrl();
    await autoUpdater.downloadUpdate();
  } catch (e) {
    emit('error', { message: humanError(e) });
  }
}

export function installUpdate() {
  try {
    autoUpdater.quitAndInstall(false, true);
  } catch (e) {
    emit('error', { message: e.message });
  }
}

function humanError(e) {
  const msg = String(e && e.message || e);
  if (msg.includes('ERR_INTERNET_DISCONNECTED') || msg.includes('ENOTFOUND') || msg.includes('net::')) {
    return '网络连接失败,请检查网络或稍后再试。';
  }
  if (msg.includes('404') || msg.includes('ENOENT') || msg.includes('invalid response')) {
    return '更新服务器上暂无可用资源(检查发布仓库配置或更新源地址)。';
  }
  return msg;
}

export function initUpdater({ autoCheckDelayMs = 10_000 } = {}) {
  autoUpdater.autoDownload = false; // 用户确认后才开始下载
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => emit('checking'));
  autoUpdater.on('update-available', (info) => {
    const skipped = getStore('config').data.update.skippedVersion;
    if (!skipped || skipped !== info.version) {
      emit('available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: notesText(info.releaseNotes),
      });
    }
  });
  autoUpdater.on('update-not-available', (info) => emit('not-available', { version: info.version }));
  autoUpdater.on('download-progress', (p) => emit('progress', {
    percent: p.percent,
    transferred: p.transferred,
    total: p.total,
    bytesPerSecond: p.bytesPerSecond,
  }));
  autoUpdater.on('update-downloaded', (info) => emit('downloaded', { version: info.version }));
  autoUpdater.on('error', (e) => emit('error', { message: humanError(e) }));

  ready = true;

  // 启动静默检查
  const cfg = getStore('config').data.update;
  if (cfg && cfg.autoCheck) {
    setTimeout(() => checkForUpdates(false), autoCheckDelayMs);
  }
}
