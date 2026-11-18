// 播放统计 + 最近播放历史
import { getStore } from './store.js';

export function recordPlay(trackId, { seconds = 0, completed = false } = {}) {
  const store = getStore('stats');
  const t = (store.data.tracks[trackId] ||= { plays: 0, seconds: 0, completed: 0, lastPlayed: 0 });
  t.plays += 1;
  t.seconds += Math.round(seconds);
  if (completed) t.completed += 1;
  t.lastPlayed = Date.now();
  store.data.history.unshift({ id: trackId, at: t.lastPlayed });
  if (store.data.history.length > 2000) store.data.history.length = 2000;
  store.scheduleSave();
  return t;
}

export function updateProgress(trackId, position) {
  const store = getStore('stats');
  // 无条目也创建:首次播放(尚未切歌/播完)也要能断点续播
  const t = (store.data.tracks[trackId] ||= { plays: 0, seconds: 0, completed: 0, lastPlayed: 0 });
  t.lastPosition = Math.floor(position);
  store.scheduleSave();
}

// 查询单曲上次播放位置(断点续播,避免全量传输)
export function getPosition(trackId) {
  const t = getStore('stats').data.tracks[trackId];
  return { lastPosition: t?.lastPosition || 0 };
}

export function allStats() {
  return getStore('stats').data;
}

export function clearHistory() {
  const store = getStore('stats');
  store.data.history = [];
  store.scheduleSave();
  return true;
}

export function resetStats() {
  const store = getStore('stats');
  store.data = { tracks: {}, history: [] };
  store.scheduleSave();
  return true;
}
