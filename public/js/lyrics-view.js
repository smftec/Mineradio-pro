// 主窗口歌词视图(覆盖层):逐字高亮 + 跟随滚动 + 实时频谱
import { api, coverUrl, esc } from './api.js';
import { registerSpectrum } from './visualizer.js';

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
    el.innerHTML = `
      <div class="lv-ambient" style="background-image:url('${coverSrc}')"></div>
      <div class="lv-veil"></div>
      <button class="btn lv-close"><svg viewBox="0 0 24 24" class="ico" style="width:14px;height:14px"><path d="M6 6l12 12M18 6L6 18"/></svg> 退出歌词</button>
      <div class="lv-left">
        <img class="lv-cover" src="${coverSrc}" onerror="this.src='./assets/default-cover.png'">
        <div class="lv-info">
          <div class="lv-title">${esc(t?.title || '未在播放')}</div>
          <div class="lv-artist">${esc(t?.artist || '—')}</div>
        </div>
        <canvas id="lv-spectrum" class="lv-spectrum" width="600" height="128" aria-hidden="true"></canvas>
      </div>
      <div class="lv-lyrics" id="lv-lyrics"><div class="empty" style="padding:40px">加载歌词中…</div></div>`;
    document.getElementById('app').appendChild(el);
    this.el = el;
    // 歌词视图大频谱(关闭时反注册)
    this._unregSpectrum = registerSpectrum(el.querySelector('#lv-spectrum'), { bars: 44 });

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
      if (l.words && l.words.length) {
        return `<div class="lv-line" data-i="${i}" data-time="${l.time}">${
          l.words.map((w) => `<span class="word" data-t0="${w.t0}" data-t1="${w.t1}">${esc(w.text)}</span>`).join('')
        }</div>`;
      }
      return `<div class="lv-line" data-i="${i}" data-time="${l.time}">${esc(l.text || '♪')}</div>`;
    }).join('');
    box.querySelectorAll('.lv-line[data-time]').forEach((lineEl) => {
      lineEl.addEventListener('click', () => {
        const t = parseFloat(lineEl.dataset.time);
        if (isFinite(t)) this._onSeek?.(t);
      });
    });
    this.sync(state_position());
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
