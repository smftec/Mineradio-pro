// 主窗口歌词视图(覆盖层):逐字高亮 + 跟随滚动 + 实时频谱
import { api, coverUrl, esc } from './api.js';
import { registerVisual, VISUAL_MODES, SHADER_IDS } from './visual-modes.js';

const view = {
  el: null,
  lines: [],
  activeIdx: -1,
  trackId: null,
  unsubs: [],

  async open(state) {
    if (this.el) return;
    const t = state.player.current;
    const cover = t ? coverUrl(t) : null;
    const coverSrc = cover || './assets/default-cover.png';
    const el = document.createElement('div');
    el.className = 'lyrics-view';
    const ALL_MODES = [...VISUAL_MODES.map(m => ({ id: m.id, name: m.name })), ...SHADER_IDS.map(id => ({ id, name: '✧ ' + id }))];
    const visMode = window.__state.config.visualMode || 'particles';
    const curName = (ALL_MODES.find(m => m.id === visMode)?.name) || '频谱粒子';
    el.innerHTML = `
      <canvas class="lv-visual" id="lv-visual" width="1280" height="720"></canvas>
      <div class="lv-ambient" style="background-image:url('${coverSrc}')"></div>
      <div class="lv-veil"></div>
      <div class="lv-toolbar">
        <button class="btn" id="lv-mode" title="切换可视化模式">✦ ${curName}</button>
        <button class="btn" id="lv-export">▣ 导出视频</button>
        <button class="btn lv-close"><svg viewBox="0 0 24 24" class="ico" style="width:14px;height:14px"><path d="M6 6l12 12M18 6L6 18"/></svg> 退出歌词</button>
      </div>
      <div class="lv-left">
        <img class="lv-cover" src="${coverSrc}" onerror="this.src='./assets/default-cover.png'">
        <div class="lv-info">
          <div class="lv-title">${esc(t?.title || '未在播放')}</div>
          <div class="lv-artist">${esc(t?.artist || '—')}</div>
        </div>
      </div>
      <div class="lv-lyrics" id="lv-lyrics"><div class="empty" style="padding:40px">加载歌词中…</div></div>`;
    document.getElementById('app').appendChild(el);
    this.el = el;
    // 可视化背景(19 种模式循环:3 Canvas2D + 16 WebGL)
    this._unregVisual = registerVisual(el.querySelector('#lv-visual'), { mode: visMode });
    el.querySelector('#lv-mode').addEventListener('click', () => {
      const cur = window.__state.config.visualMode || 'particles';
      const next = ALL_MODES[(ALL_MODES.findIndex(m => m.id === cur) + 1) % ALL_MODES.length];
      window.__state.config.visualMode = next.id;
      api.invoke('config:set', { visualMode: next.id });
      this._setVisualMode(next.id);
      el.querySelector('#lv-mode').textContent = '✦ ' + next.name;
    });
    el.querySelector('#lv-export').addEventListener('click', () => window.__exportVideo?.(this));

    el.querySelector('.lv-close').addEventListener('click', () => this.close());

    this.unsubs.push(state.player.on('track', ({ track }) => {
      if (!this.el) return;
      const src = coverUrl(track) || './assets/default-cover.png';
      el.querySelector('.lv-cover').src = src;
      el.querySelector('.lv-ambient').style.backgroundImage = `url('${src}')`;
      el.querySelector('.lv-title').textContent = track.title;
      el.querySelector('.lv-artist').textContent = track.artist;
      this.load(track.id);
    }));
    this.unsubs.push(state.player.on('tick', ({ position }) => this.sync(position)));

    // 翻译配置(决定 load 后是否拉取译文)
    this._tranCfg = await api.invoke('translation:getConfig');
    this.unsubs.push(api.on('player:state', () => { /* noop,保持生命周期 */ }));
    if (t) await this.load(t.id);
    else el.querySelector('#lv-lyrics').innerHTML = '<div class="empty" style="padding:60px"><img class="empty-art small" src="./assets/empty-music.png" alt="" draggable="false"><div class="empty-title">先播放一首歌吧</div></div>';
  },

  async load(trackId) {
    if (!trackId || !this.el) return;
    this.trackId = trackId;
    const res = await api.invoke('lyrics:get', trackId);
    if (!this.el || this.trackId !== trackId) return;
    const box = this.el.querySelector('#lv-lyrics');
    this.lines = res?.lines || [];
    this.activeIdx = -1;
    if (!this.lines.length) {
      box.innerHTML = '<div class="empty" style="padding:60px"><img class="empty-art small" src="./assets/empty-music.png" alt="" draggable="false"><div class="empty-title">暂无歌词</div></div>';
      return;
    }
    if (res.plain) {
      box.innerHTML = this.lines.map((l) => `<div class="lv-line" style="cursor:default">${esc(l.text)}</div>`).join('');
      return;
    }
    box.innerHTML = this.lines.map((l, i) => {
      // 行间 3D 漂浮错落偏移(伪随机,基于行索引)
      const bx = ((i * 37) % 5 - 2) * 5;
      const style = ` style="--bx:${bx}px"`;
      if (l.words && l.words.length) {
        return `<div class="lv-line"${style} data-i="${i}" data-time="${l.time}">${
          l.words.map((w) => `<span class="word" data-t0="${w.t0}" data-t1="${w.t1}">${esc(w.text)}</span>`).join('')
        }</div>`;
      }
      return `<div class="lv-line"${style} data-i="${i}" data-time="${l.time}">${esc(l.text || '♪')}</div>`;
    }).join('');
    box.querySelectorAll('.lv-line[data-time]').forEach((lineEl) => {
      lineEl.addEventListener('click', () => {
        const t = parseFloat(lineEl.dataset.time);
        if (isFinite(t)) this._onSeek?.(t);
      });
    });
    this.sync(state_position());
    // 歌词翻译(异步,不阻塞渲染)
    this._maybeTranslate(trackId);
  },

  // 可视化模式切换
  _setVisualMode(mode) {
    if (this._unregVisual) this._unregVisual();
    this._unregVisual = registerVisual(this.el.querySelector('#lv-visual'), { mode });
  },

  // 视频导出所需的当前歌词状态
  getLyricState() {
    const idx = this.activeIdx;
    const line = this.lines[idx];
    return { text: line?.text || '', words: line?.words || null, index: idx };
  },

  // 拉取歌词翻译并逐行插入 .lv-tran
  async _maybeTranslate(trackId) {
    const cfg = this._tranCfg;
    if (!cfg?.enabled || !cfg.endpoint || !this.el) return;
    const box = this.el.querySelector('#lv-lyrics');
    if (!box) return;
    const texts = this.lines.map((l) => l.text || '');
    const pendingIdx = texts.map((t, i) => (t.trim() ? i : -1)).filter((i) => i >= 0);
    if (!pendingIdx.length) return;
    try {
      const res = await api.invoke('translation:translate', texts, cfg.targetLang);
      if (!this.el || this.trackId !== trackId || !res?.lines) return;
      pendingIdx.forEach((i, j) => {
        const t = res.lines[i];
        const lineEl = box.querySelector(`.lv-line[data-i="${i}"]`);
        if (!lineEl || !t) return;
        const tran = document.createElement('div');
        tran.className = 'lv-tran';
        tran.textContent = t;
        lineEl.after(tran);
      });
    } catch (e) {
      console.error('[lyrics] translate failed:', e.message);
    }
  },

  sync(pos) {
    if (!this.el || !this.lines.length) return;
    const lines = this.lines;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= pos + 0.02) idx = i; else break;
    }
    if (idx !== this.activeIdx) {
      this.activeIdx = idx;
      const box = this.el.querySelector('#lv-lyrics');
      box.querySelectorAll('.lv-line.active').forEach((e) => e.classList.remove('active'));
      if (idx >= 0) {
        const lineEl = box.querySelector(`.lv-line[data-i="${idx}"]`);
        if (lineEl) {
          lineEl.classList.add('active');
          const top = lineEl.offsetTop - box.clientHeight * 0.38;
          box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }
      }
    }
    // 逐字高亮
    if (idx >= 0 && lines[idx]?.words?.length) {
      const lineEl = this.el.querySelector(`.lv-line[data-i="${idx}"]`);
      if (lineEl) {
        // 逐字高亮:已唱到变亮,未唱到的保持灰
        for (const w of lineEl.querySelectorAll('.word')) {
          const t0 = parseFloat(w.dataset.t0);
          w.classList.toggle('w-done', pos >= t0);
        }
      }
    }
  },

  setSeekHandler(fn) { this._onSeek = fn; },

  close() {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    if (this._unregSpectrum) { this._unregSpectrum(); this._unregSpectrum = null; }
    this.el?.remove();
    this.el = null;
    this.lines = [];
    this.activeIdx = -1;
  },
};

let state_position = () => 0;

export function openLyricsView(state) {
  state_position = () => state.player.position;
  view.setSeekHandler((t) => state.player.seek(t));
  return view.open(state);
}
export function closeLyricsView() {
  view.close();
}
export function isLyricsOpen() {
  return !!view.el;
}
