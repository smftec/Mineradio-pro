// 整机备份导出/恢复(曲库索引 + 歌单 + 统计 + 设置,不含音频文件)
import electron from 'electron';
const { dialog, app } = electron;
import { readFileSync, writeFileSync } from 'node:fs';
import { getStore, stores } from './store.js';

const SCHEMA = 1;

export async function exportBackup(parentWin) {
  const r = await dialog.showSaveDialog(parentWin, {
    title: '导出整机备份',
    defaultPath: `mineradio-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'Mineradio pro 备份', extensions: ['json'] }],
  });
  if (r.canceled || !r.filePath) return null;

  const config = { ...getStore('config').data };
  delete config.session; // 会话状态不入备份
  const payload = {
    app: 'mineradio-pro',
    schema: SCHEMA,
    exportedAt: new Date().toISOString(),
    config,
    library: stores.library.data,
    playlists: stores.playlists.data,
    stats: stores.stats.data,
  };
  writeFileSync(r.filePath, JSON.stringify(payload));
  return r.filePath;
}

// 恢复:整体替换数据并重启应用生效
export async function importBackup(parentWin) {
  const r = await dialog.showOpenDialog(parentWin, {
    title: '恢复整机备份',
    filters: [{ name: 'Mineradio pro 备份', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths.length) return { ok: false, reason: 'canceled' };

  let payload;
  try {
    payload = JSON.parse(readFileSync(r.filePaths[0], 'utf-8'));
  } catch {
    return { ok: false, reason: '文件不是有效的 JSON 备份' };
  }
  if (payload.app !== 'mineradio-pro' || !payload.schema) {
    return { ok: false, reason: '这不是 Mineradio pro 的备份文件' };
  }
  if (payload.schema > SCHEMA) {
    return { ok: false, reason: '备份来自更新版本的应用,请先升级' };
  }

  if (payload.library && payload.library.tracks) stores.library.data = payload.library;
  if (payload.playlists && payload.playlists.lists) stores.playlists.data = payload.playlists;
  if (payload.stats && payload.stats.tracks) stores.stats.data = payload.stats;
  if (payload.config) {
    // 恢复设置但保留当前更新源配置(避免意外改掉发布仓库相关状态)
    const customUrl = getStore('config').data.update?.customUrl;
    const skipped = getStore('config').data.update?.skippedVersion;
    stores.config.data = { ...payload.config };
    if (!stores.config.data.update) stores.config.data.update = {};
    if (customUrl) stores.config.data.update.customUrl = customUrl;
    if (skipped) stores.config.data.update.skippedVersion = skipped;
  }
  for (const s of Object.values(stores)) s.flushAll();

  return { ok: true, restart: true };
}

export function relaunchApp() {
  app.relaunch();
  app.exit(0);
}
