// 歌单 CRUD
import { randomUUID } from 'node:crypto';
import { getStore } from './store.js';

export function listPlaylists() {
  return getStore('playlists').data.lists || [];
}

export function createPlaylist(name, trackIds = []) {
  const store = getStore('playlists');
  const list = { id: randomUUID().slice(0, 8), name, trackIds, createdAt: Date.now() };
  (store.data.lists = store.data.lists || []).push(list);
  store.scheduleSave();
  return list;
}

export function renamePlaylist(id, name) {
  const list = getStore('playlists').data.lists.find((l) => l.id === id);
  if (list) { list.name = name; getStore('playlists').scheduleSave(); }
  return list || null;
}

export function removePlaylist(id) {
  const store = getStore('playlists');
  store.data.lists = (store.data.lists || []).filter((l) => l.id !== id);
  store.scheduleSave();
  return true;
}

export function addToPlaylist(id, trackIds) {
  const list = getStore('playlists').data.lists.find((l) => l.id === id);
  if (!list) return null;
  for (const tid of trackIds) if (!list.trackIds.includes(tid)) list.trackIds.push(tid);
  getStore('playlists').scheduleSave();
  return list;
}

export function removeFromPlaylist(id, trackId) {
  const list = getStore('playlists').data.lists.find((l) => l.id === id);
  if (!list) return null;
  list.trackIds = list.trackIds.filter((t) => t !== trackId);
  getStore('playlists').scheduleSave();
  return list;
}

export function reorderPlaylist(id, trackIds) {
  const list = getStore('playlists').data.lists.find((l) => l.id === id);
  if (!list) return null;
  list.trackIds = trackIds;
  getStore('playlists').scheduleSave();
  return list;
}
