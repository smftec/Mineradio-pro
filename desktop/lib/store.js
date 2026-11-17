// 通用 JSON 持久化:防抖写入,退出时 flush
import electron from 'electron';
const { app } = electron;
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function deepMerge(defaults, src) {
  if (!src || typeof src !== 'object') return structuredClone(defaults);
  const out = Array.isArray(defaults) ? [...src] : { ...defaults };
  for (const k of Object.keys(defaults)) {
    if (typeof defaults[k] === 'object' && defaults[k] !== null && !Array.isArray(defaults[k])) {
      out[k] = deepMerge(defaults[k], src[k]);
    } else if (src && k in src) {
      out[k] = src[k];
    }
  }
  return out;
}

class Store {
  constructor(name, defaults = {}) {
    this.name = name;
    this.defaults = defaults;
    this.data = structuredClone(defaults);
    this.dir = join(app.getPath('userData'));
    this.file = join(this.dir, name);
    this._timer = null;
    this._dirty = false;
  }

  load() {
    try {
      if (existsSync(this.file)) {
        this.data = deepMerge(this.defaults, JSON.parse(readFileSync(this.file, 'utf-8')));
      }
    } catch (e) {
      console.error(`[store] load ${this.name} failed:`, e.message);
      this.data = structuredClone(this.defaults);
    }
  }

  save() {
    try {
      mkdirSync(this.dir, { recursive: true });
      writeFileSync(this.file, JSON.stringify(this.data, null, 1));
      this._dirty = false;
    } catch (e) {
      console.error(`[store] save ${this.name} failed:`, e.message);
    }
  }

  // 防抖保存
  scheduleSave() {
    this._dirty = true;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.save(), 400);
  }

  flushAll() {
    clearTimeout(this._timer);
    if (this._dirty) this.save();
  }
}

const stores = {};

export function initStores() {
  stores.config = new Store('config.json', {
    theme: 'dark',
    accentColor: 'galaxy',
    visualMode: 'particles',
    ffmpegPath: '',
    volume: 0.8,
    crossfade: 0,
    repeat: 'off', // off | all | one
    shuffle: false,
    eq: { enabled: false, preamp: 0, preset: 'flat', bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    libraryFolders: [],
    session: { queue: [], index: -1, position: 0, name: '' },
    desktopLyrics: {
      visible: false, locked: false,
      x: 200, y: 700, w: 900, h: 170,
      fontSize: 34, color: '#7df9ff', stroke: true, dualLine: true, opacity: 0.92,
    },
    mini: { onTop: true },
    favorites: [], // 收藏的曲目 id
    shortcuts: { mediaKeys: true },
    translation: { enabled: false, endpoint: '', model: '', keyEncrypted: '', targetLang: 'zh-CN' },
    update: { autoCheck: true, customUrl: '', skippedVersion: '', mirror: 'auto', preferredMirror: '' },
  });
  stores.library = new Store('library.json', { tracks: {}, folders: [] });
  stores.playlists = new Store('playlists.json', { lists: [] });
  stores.stats = new Store('stats.json', { tracks: {}, history: [] });
  for (const s of Object.values(stores)) s.load();
}

export function getStore(name) {
  return stores[name];
}

export { stores };
