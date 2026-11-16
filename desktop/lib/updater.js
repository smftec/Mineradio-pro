// 软件检测与更新:electron-updater(GitHub Releases / 自定义源 / 国内镜像回退)
import electronUpdater from 'electron-updater';
const { autoUpdater } = electronUpdater;
import electron from 'electron';
const { app } = electron;
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getStore } from './store.js';
import { windows } from './windows.js';

let ready = false;

// 国内镜像(代理 GitHub Releases 资产,含 latest.yml)
const MIRRORS = ['https://ghfast.top/', 'https://gh-proxy.com/', 'https://gh.llkk.cc/'];

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

// 剥离 release notes 中的 HTML 标签(UI 以纯文本呈现)
function stripHtml(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function applyFeedUrl() {
  const cfg = getStore('config').data.update;
  if (cfg && cfg.customUrl) {
    autoUpdater.setFeedURL({ provider: 'generic', url: cfg.customUrl });
  }
  // 否则使用打包时生成的 app-update.yml(来自 package.json build.publish)
}

function getPublishInfo() {
  try {
    const pkg = JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf-8'));
    const pub = pkg.build?.publish || {};
    return { owner: pub.owner || 'smftec', repo: pub.repo || 'Mineradio-pro' };
  } catch {
    return { owner: 'smftec', repo: 'Mineradio-pro' };
  }
}

// 镜像下的 generic feed(GitHub 的 latest/download 恒指向最新 Release 资产)
function mirrorFeedUrl(mirror) {
  const { owner, repo } = getPublishInfo();
  return `${mirror}https://github.com/${owner}/${repo}/releases/latest/download/`;
}

export function currentVersion() {
  return app.getVersion();
}

export async function checkForUpdates(manual = false) {
  if (!ready) return;
  if (!app.isPackaged) {
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

// 下载:直连失败自动轮换国内镜像(auto);也尊重用户指定的镜像/自定义源
let mirrorFallbackActive = false;
export async function downloadUpdate() {
  mirrorFallbackActive = true;
  try {
    return await downloadUpdateInner();
  } finally {
    mirrorFallbackActive = false;
  }
}

async function downloadUpdateInner() {
  const cfg = getStore('config').data.update || {};
  if (cfg.customUrl) {
    // 自定义源:直接按其下载
    try {
      applyFeedUrl();
      await downloadOnce();
      return;
    } catch (e) {
      emit('error', { message: humanError(e) });
      return;
    }
  }

  const candidates = [];
  if (cfg.mirror === 'off') candidates.push(null); // 仅直连
  else if (cfg.mirror && cfg.mirror !== 'auto' && cfg.mirror !== 'direct') {
    candidates.push(cfg.mirror); // 指定镜像优先
    candidates.push(null); // 回退直连
  } else {
    // auto:记住上次成功的镜像优先,其后直连 + 其余镜像
    if (cfg.preferredMirror) candidates.push(cfg.preferredMirror);
    candidates.push(null, ...MIRRORS.filter((m) => m !== cfg.preferredMirror));
  }

  for (const mirror of candidates) {
    try {
      if (mirror) {
        autoUpdater.setFeedURL({ provider: 'generic', url: mirrorFeedUrl(mirror) });
        emit('progress-hint', { message: `正在通过镜像 ${new URL(mirror).hostname} 下载…` });
      } else {
        applyFeedUrl(); // 直连(GitHub)
        emit('progress-hint', { message: '正在直连 GitHub 下载…' });
      }
      await downloadOnce();
      if (mirror) {
        cfg.preferredMirror = mirror;
        getStore('config').scheduleSave();
      }
      return; // 成功
    } catch (e) {
      console.error('[updater] download failed via', mirror || 'direct', e.message);
    }
  }
  emit('error', { message: '下载失败:直连与镜像均不可达,请检查网络后重试,或在设置中使用自定义更新源。' });
}

// 单次下载,以 Promise 等待完成或失败
function downloadOnce() {
  return new Promise((resolve, reject) => {
    let settled = false;
    const onDone = () => { if (!settled) { settled = true; cleanup(); resolve(); } };
    const onErr = (e) => { if (!settled) { settled = true; cleanup(); reject(new Error(e.message || 'download error')); } };
    const cleanup = () => {
      autoUpdater.removeListener('update-downloaded', onDone);
      autoUpdater.removeListener('error', onErr);
    };
    autoUpdater.on('update-downloaded', onDone);
    autoUpdater.on('error', onErr);
    autoUpdater.downloadUpdate().catch((e) => onErr(e));
  });
}

export function installUpdate() {
  try {
    // 静默安装 + 安装后自动重启,避免用户走安装向导
    autoUpdater.quitAndInstall(true, true);
  } catch (e) {
    emit('error', { message: e.message });
  }
}

function humanError(e) {
  const msg = String(e && e.message || e);
  if (msg.includes('ERR_INTERNET_DISCONNECTED') || msg.includes('ENOTFOUND') || msg.includes('net::') || msg.includes('timeout')) {
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
        releaseNotes: stripHtml(notesText(info.releaseNotes)),
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
  autoUpdater.on('error', (e) => {
    // 镜像轮换期间的单次失败由 downloadOnce 消化,不上报 UI
    if (mirrorFallbackActive) {
      console.error('[updater] candidate failed:', e.message);
      return;
    }
    emit('error', { message: humanError(e) });
  });

  ready = true;

  // 启动静默检查
  const cfg = getStore('config').data.update;
  if (cfg && cfg.autoCheck) {
    setTimeout(() => checkForUpdates(false), autoCheckDelayMs);
  }
}
