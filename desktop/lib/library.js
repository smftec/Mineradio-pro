// 曲库:扫描 / 监控(chokidar)/ 索引
import chokidar from 'chokidar';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, extname, basename, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { getStore } from './store.js';
import { readMetadata, initMetadata } from './metadata.js';

export const AUDIO_EXT = new Set(['.mp3', '.m4a', '.m4b', '.aac', '.flac', '.wav', '.ogg', '.oga', '.opus', '.webm', '.weba', '.aif', '.aiff', '.ape', '.dsf']);
// 识别但暂不支持解码的格式(播放时给出明确提示而非静默忽略)
export const UNSUPPORTED_EXT = new Set(['.dff']); // DFF(DIFF)暂不支持,.ape/.dsf 经转码播放

const tracks = new Map(); // id -> track
let watcher = null;
let mainWindow = null;
let scanning = false;
let scanAbort = false;

function trackIdOf(p) {
  return createHash('md5').update(p.toLowerCase()).digest('hex').slice(0, 16);
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

export function setMainWindow(w) {
  mainWindow = w;
}

function toTrack(path, meta) {
  let st = null;
  try { st = statSync(path); } catch { /* 读取失败时字段留空 */ }
  return {
    id: trackIdOf(path),
    path,
    ext: extname(path).slice(1).toLowerCase(),
    size: st?.size || 0,
    mtimeMs: st?.mtimeMs || 0,
    addedAt: Date.now(),
    folder: dirname(path),
    fileName: basename(path),
    ...meta,
  };
}

// mpro:// 协议白名单:精确匹配索引,或位于受监控的曲库文件夹内
export function isAllowedMediaPath(p) {
  if (tracks.has(trackIdOf(p))) return true;
  const folders = getStore('library').data.folders || [];
  const norm = p.toLowerCase();
  for (const f of folders) {
    const nf = f.toLowerCase().replace(/[\\/]+$/, '');
    if (norm.startsWith(nf + '\\') || norm.startsWith(nf + '/')) return true;
  }
  return false;
}

async function indexFile(path, { silent = false } = {}) {
  if (!AUDIO_EXT.has(extname(path).toLowerCase())) return false;
  try {
    const meta = await readMetadata(path);
    const track = toTrack(path, meta);
    const existing = tracks.get(track.id);
    if (existing) track.addedAt = existing.addedAt;
    tracks.set(track.id, track);
    getStore('library').data.tracks[track.id] = track;
    getStore('library').scheduleSave();
    if (!silent) send('library:updated', { track });
    return true;
  } catch {
    return false;
  }
}

function removeFile(path) {
  const id = trackIdOf(path);
  if (tracks.has(id)) {
    tracks.delete(id);
    delete getStore('library').data.tracks[id];
    getStore('library').scheduleSave();
    send('library:removed', { id, path });
  }
}

// 递归收集音频文件
function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (AUDIO_EXT.has(extname(e.name).toLowerCase())) out.push(p);
  }
}

// 扫描多个文件夹(批量导入)
export async function scanFolders(folders) {
  if (scanning) return { ok: false, reason: 'busy' };
  scanning = true;
  let added = 0;
  let unsupported = 0;
  try {
    for (const folder of folders) {
      if (!existsSync(folder)) continue;
      const files = [];
      walk(folder, files);
      // 统计暂不支持的格式(如 APE/DSD),扫描结束后提示
      for (const f of files) {
        if (UNSUPPORTED_EXT.has(extname(f).toLowerCase())) unsupported++;
      }
      const total = files.length;
      let done = 0;
      // 并发 4 解析
      const queue = [...files];
      const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
        while (queue.length) {
          const p = queue.shift();
          const isNew = !tracks.has(trackIdOf(p));
          if (await indexFile(p, { silent: true })) {
            if (isNew) added++;
          }
          done++;
          if (done % 5 === 0 || done === total) {
            send('library:scan-progress', { done, total, added, folder });
          }
        }
      });
      await Promise.all(workers);
    }
    // 扫描完成统一落盘(扫描期间的高频防抖写合并为一次)
    getStore('library').flushAll();
  } finally {
    scanning = false;
  }
  send('library:changed', { tracks: allTracks() });
  return { ok: true, added, unsupported };
}

// 启动:加载索引 + 同步缺失 + 恢复监控
export async function initLibrary() {
  initMetadata();
  const store = getStore('library');
  for (const [id, t] of Object.entries(store.data.tracks || {})) {
    if (existsSync(t.path)) tracks.set(id, t);
    else delete store.data.tracks[id];
  }
  store.scheduleSave();

  const folders = store.data.folders || [];
  if (folders.length) {
    // 后台静默同步标签变更(mtime 变化的重新解析)
    syncChangedFiles();
    startWatcher(folders);
  }
}

// 启动后后台同步标签变更(mtime 变化的重新解析),异步并发执行不阻塞启动
async function syncChangedFiles() {
  const CONC = 4;
  const pending = [];
  for (const [, t] of tracks) pending.push(t.path);
  let idx = 0;
  let changed = false;
  const workers = Array.from({ length: Math.min(CONC, pending.length) }, async () => {
    while (idx < pending.length) {
      const p = pending[idx++];
      try {
        const st = await stat(p);
        const known = tracks.get(trackIdOf(p));
        if (st.mtimeMs > (known?.mtimeMs || 0)) {
          await indexFile(p, { silent: true });
          changed = true;
        }
      } catch { /* 文件消失,由 watcher/unlink 处理 */ }
    }
  });
  await Promise.all(workers);
  if (changed) send('library:changed', { tracks: allTracks() });
}

export function startWatcher(folders) {
  stopWatcher();
  if (!folders.length) return;
  watcher = chokidar.watch(folders, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 120 },
    ignored: (p) => {
      const base = basename(p);
      return base.startsWith('.');
    },
  });
  watcher
    .on('add', (p) => indexFile(p))
    .on('change', (p) => indexFile(p))
    .on('unlink', (p) => removeFile(p))
    .on('error', (err) => console.error('[watcher]', err.message))
    .on('addDir', () => {})
    .on('unlinkDir', () => {});
}

export function stopWatcher() {
  if (watcher) {
    watcher.close().catch(() => {});
    watcher = null;
  }
}

export function addFolder(folder) {
  const store = getStore('library');
  const folders = store.data.folders || (store.data.folders = []);
  if (!folders.includes(folder)) folders.push(folder);
  store.scheduleSave();
  startWatcher(folders);
  return scanFolders([folder]);
}

export function removeFolder(folder) {
  const store = getStore('library');
  store.data.folders = (store.data.folders || []).filter((f) => f !== folder);
  store.scheduleSave();
  // 移除该文件夹下的曲目
  for (const [id, t] of [...tracks]) {
    if (t.path.startsWith(folder)) {
      tracks.delete(id);
      delete store.data.tracks[id];
    }
  }
  store.scheduleSave();
  startWatcher(store.data.folders);
  send('library:changed', { tracks: allTracks() });
}

export async function addFiles(paths) {
  let added = 0;
  for (const p of paths) {
    const isNew = !tracks.has(trackIdOf(p));
    if (await indexFile(p, { silent: true }) && isNew) added++;
  }
  send('library:changed', { tracks: allTracks() });
  return { ok: true, added, unsupported };
}

export function allTracks() {
  return [...tracks.values()];
}

export function getTrack(id) {
  return tracks.get(id) || null;
}

export function isScanning() {
  return scanning;
}
