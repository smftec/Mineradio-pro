// 主窗口入口:状态 + 路由 + 播放条 + 公共交互
import { api, appInfo, coverUrl, fmtTime, esc, toast } from './api.js';
import { player } from './player.js';
import { renderView, renderHome, renderRecordWall, bindTable, bindDragReorder, EQ_BARS, trackTable, ACTIONS_PLAY_ALL } from './views.js';
import { setVisualParams } from './visual-modes.js';
import { registerSpectrum } from './visualizer.js';
import { renderSettings, renderUpdateStatus } from './settings-view.js';
import { openLyricsView, closeLyricsView, isLyricsOpen } from './lyrics-view.js';

// ---------------- 全局状态 ----------------
const state = {
  tracks: [],
  trackMap: new Map(),
  config: null,
  stats: { tracks: {}, history: [] },
  playlists: [],
  libraryFolders: [],
  view: 'library',
  params: null,
  playingId: null,
  filteredTracks: null,
  updateState: { type: 'idle' },
  sinkId: 'default',

  trackById(id) { return this.trackMap.get(id) || null; },

  navigate(view, params = null) {
    if (view === '__playlists') { view = 'library'; this.openPlaylistsView(); return; }
    this.view = view;
    this.params = params;
    document.querySelectorAll('.nav-item[data-view]').forEach((n) => {
      n.classList.toggle('active', n.dataset.view === view && (!params?.value || true));
    });
    if (isLyricsOpen()) closeLyricsView();
    this.render();
  },

  render() {
    const root = document.getElementById('view-root');
    // 频谱注册随视图切换(home 有专用 canvas)
    if (this._homeUnreg) { this._homeUnreg(); this._homeUnreg = null; }
    if (this.view === 'settings') {
      renderSettings(root, this);
      $('pb-queue').classList.remove('active');
    } else if (this.view === 'queue') {
      renderQueueView(root);
      $('pb-queue').classList.add('active');
    } else if (this.view === 'favorites') {
      renderFavoritesView(root);
      $('pb-queue').classList.remove('active');
    } else if (this.view === 'home') {
      renderHome(root, this);
      setVisualParams(this.config.visualParams);
      this._homeUnreg = registerSpectrum(document.getElementById('home-spectrum'), { bars: 64 });
      $('pb-queue').classList.remove('active');
    } else if (this.view === 'wall') {
      renderRecordWall(root, this);
      $('pb-queue').classList.remove('active');
    } else {
      renderView(root, this);
      $('pb-queue').classList.remove('active');
    }
    // 页面切换过渡
    kbdIndex = -1;
    root.classList.remove('view-anim');
    void root.offsetWidth; // 重新触发动画
    root.classList.add('view-anim');
  },

  reloadStats: null,
  reloadLibrary: null,
  checkUpdate: null,
  addFolderFlow: null,
  addFilesFlow: null,
  openPlaylistsView: null,
  renamePlaylist: null,
  deletePlaylist: null,
  showTrackMenu: null,
  playAll: null,
  playFromList: null,
  enqueue: null,
  updateDlBadge: null,
  applyTheme: null,
  clearSearch: null,
  player, // 歌词视图等模块需要访问播放引擎
};
window.__state = state; // 调试用

// ---------------- 播放控制 ----------------
function playTracks(tracks, startIndex) {
  player.setQueue(tracks, startIndex);
  updatePlaybarTrack(player.current);
}

state.playAll = (tracks) => playTracks(tracks, 0);
state.playFromList = (tracks, idx) => playTracks(tracks, idx);
state.enqueue = (t) => {
  player.enqueue(t);
  toast(`已加入队列:${t.title}`);
};

// ---------------- 播放条 ----------------
const $ = (id) => document.getElementById(id);

function updatePlaybarTrack(t) {
  state.playingId = t?.id || null;
  $('pb-title').textContent = t?.title || '未在播放';
  $('pb-artist').textContent = t ? `${t.artist}${t.album ? ' · ' + t.album : ''}` : '—';
  $('pb-cover').src = coverUrl(t) || './assets/default-cover.png';
  // 同步"喜欢"按钮状态
  const isFav = !!t && (state.config.favorites || []).includes(t.id);
  const favBtn = $('pb-fav');
  favBtn.classList.toggle('active', isFav);
  favBtn.style.color = isFav ? 'var(--danger)' : '';
  markPlayingRow();
  // 歌词视图内部监听 track 事件自行刷新,无需重建(避免闪烁)
}

function markPlayingRow() {
  document.querySelectorAll('tr[data-id]').forEach((tr) => {
    const isPlaying = tr.dataset.id === state.playingId;
    tr.classList.toggle('playing', isPlaying);
    // 序号列 ↔ 均衡器动画同步(渲染后仅切 class 不会重建内容)
    const num = tr.querySelector('.t-num');
    if (num && num.dataset.i !== undefined) {
      num.innerHTML = isPlaying ? EQ_BARS : String(+num.dataset.i + 1);
    }
  });
}

let lastPlayingState = null;
function updatePlayState() {
  const wasPlaying = lastPlayingState;
  lastPlayingState = player.playing;
  if (wasPlaying !== null && wasPlaying !== player.playing) {
    const btn = document.querySelector('.pb-playbtn');
    btn.classList.remove('pop');
    void btn.offsetWidth;
    btn.classList.add('pop');
    setTimeout(() => btn.classList.remove('pop'), 450);
  }
  $('pb-icon-play').classList.toggle('hidden', player.playing);
  $('pb-icon-pause').classList.toggle('hidden', !player.playing);
  $('pb-shuffle').classList.toggle('active', player.shuffle);
  $('pb-repeat').classList.toggle('active', player.repeat !== 'off');
  $('pb-repeat-one').classList.toggle('hidden', player.repeat !== 'one');
  $('pb-cover').classList.toggle('spin', player.playing);
}

function updateProgressUI() {
  const dur = player.duration || player.current?.duration || 0;
  const pct = dur ? (player.position / dur) * 100 : 0;
  $('pb-fill').style.width = pct + '%';
  $('pb-cur').textContent = fmtTime(player.position);
  $('pb-dur').textContent = fmtTime(dur);
}

function bindPlaybar() {
  $('pb-play').addEventListener('click', () => player.toggle());
  $('pb-next').addEventListener('click', () => player.next(false));
  $('pb-prev').addEventListener('click', () => player.prev());
  const popBtn = (btn) => {
    const ico = btn.querySelector('svg');
    if (!ico) return;
    ico.classList.remove('pop');
    void ico.offsetWidth;
    ico.classList.add('pop');
    setTimeout(() => ico.classList.remove('pop'), 450);
  };
  $('pb-shuffle').addEventListener('click', () => { popBtn($('pb-shuffle')); player.setShuffle(!player.shuffle); });
  $('pb-repeat').addEventListener('click', () => {
    popBtn($('pb-repeat'));
    const order = ['off', 'all', 'one'];
    player.setRepeat(order[(order.indexOf(player.repeat) + 1) % 3]);
  });

  const seekbar = $('pb-seekbar');
  const seekFromEvent = (e) => {
    const rect = seekbar.getBoundingClientRect();
    const dur = player.duration || player.current?.duration || 0;
    if (dur) player.seek(((e.clientX - rect.left) / rect.width) * dur);
  };
  seekbar.addEventListener('click', seekFromEvent);
  // 进度条拖动
  let seekDrag = false;
  seekbar.addEventListener('mousedown', () => { seekDrag = true; seekbar.classList.add('dragging'); });
  let lastParticle = 0;
  window.addEventListener('mousemove', (e) => {
    if (!seekDrag) return;
    seekFromEvent(e);
    // 拖动粒子尾迹(节流 45ms,参考原版 progress-particle)
    const now = performance.now();
    if (now - lastParticle > 45) {
      lastParticle = now;
      const p = document.createElement('span');
      p.className = 'progress-particle';
      const dx = (Math.random() * 2 - 1) * 34;
      const dy = -Math.random() * 26 - 6;
      p.style.setProperty('--px', e.clientX + 'px');
      p.style.setProperty('--py', e.clientY + 'px');
      p.style.setProperty('--dx', dx + 'px');
      p.style.setProperty('--dy', dy + 'px');
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 620);
    }
  });
  window.addEventListener('mouseup', () => { seekDrag = false; seekbar.classList.remove('dragging'); });

  $('pb-queue').addEventListener('click', () => {
    if (state.view === 'queue') state.navigate('library');
    else state.navigate('queue');
  });

  $('pb-mute').addEventListener('click', () => {
    player.setVolume(player.volume > 0 ? 0 : 0.8);
  });
  const volbar = $('pb-volbar');
  const setVol = (e) => {
    const rect = volbar.getBoundingClientRect();
    const v = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    player.setVolume(v);
    $('pb-volfill').style.width = v * 100 + '%';
  };
  volbar.addEventListener('click', setVol);
  let volDrag = false;
  volbar.addEventListener('mousedown', () => { volDrag = true; });
  window.addEventListener('mousemove', (e) => { if (volDrag) setVol(e); });
  window.addEventListener('mouseup', () => { volDrag = false; });

  $('pb-lyrics').addEventListener('click', () => {
    if (isLyricsOpen()) closeLyricsView();
    else if (player.current) openLyricsView(state);
    else toast('先播放一首歌,再打开歌词视图');
  });
  $('pb-mini').addEventListener('click', () => api.send('mini:open'));
  // 喜欢:真实存储(config.favorites)
  $('pb-fav').addEventListener('click', async (e) => {
    if (!player.current) { toast('先播放一首歌,再点喜欢'); return; }
    const btn = e.currentTarget; // await 之后 currentTarget 会被置空,先存引用
    const r = await api.invoke('fav:toggle', player.current.id);
    state.config.favorites = r.favorites;
    btn.classList.toggle('active', r.fav);
    btn.style.color = r.fav ? 'var(--danger)' : '';
    toast(r.fav ? `已收藏「${player.current.title}」` : `已取消收藏「${player.current.title}」`);
    if (state.view === 'favorites') state.render();
  });

  player.on('track', ({ track }) => updatePlaybarTrack(track));
  player.on('state', () => { updatePlayState(); updateProgressUI(); });
  player.on('tick', () => updateProgressUI());
  player.on('queue', () => { if (state.view === 'queue') renderQueueView(document.getElementById('view-root')); });
  player.on('error', ({ track }) => toast(`无法播放:${track?.title || '未知曲目'}(格式可能不受支持),将自动跳过`));
}

// ---------------- 标题栏 / 导航 ----------------
function bindChrome() {
  $('btn-min').addEventListener('click', () => api.send('win:minimize'));
  $('btn-max').addEventListener('click', () => api.send('win:maximize'));
  $('btn-close').addEventListener('click', () => api.send('win:close'));
  api.on('win:maximized', () => {});

  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => state.navigate(btn.dataset.view));
  });

  $('btn-new-playlist').addEventListener('click', () => createPlaylistModal());
  $('nav-desktop-lyrics').addEventListener('click', () => {
    const on = !state.config.desktopLyrics.visible;
    api.send('dl:' + (on ? 'show' : 'hide'));
    state.updateDlBadge(on);
    api.invoke('config:set', { desktopLyrics: { visible: on } });
  });
  $('nav-mini').addEventListener('click', () => api.send('mini:open'));

  // 更新徽标 → 设置页
  $('btn-update-badge').addEventListener('click', () => state.navigate('settings'));

  // 搜索
  const search = $('search');
  const searchWrap = document.querySelector('.tb-search');
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    searchWrap.classList.toggle('has-value', search.value.length > 0);
    if (!q) {
      state.filteredTracks = null;
      if (state.view === 'library') state.render();
      return;
    }
    state.filteredTracks = state.tracks.filter((t) =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.artist || '').toLowerCase().includes(q) ||
      (t.album || '').toLowerCase().includes(q));
    if (state.view !== 'library') {
      state.view = 'library';
      document.querySelectorAll('.nav-item[data-view]').forEach((n) => n.classList.toggle('active', n.dataset.view === 'library'));
    }
    state.render();
  });
  // 供"搜索无结果"空态的清空按钮调用
  state.clearSearch = () => {
    search.value = '';
    searchWrap.classList.remove('has-value');
    state.filteredTracks = null;
    state.render();
  };
  $('search-clear').addEventListener('click', () => { state.clearSearch(); search.focus(); });
  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
    // Folia 界面激活时:全局快捷键让位给 Folia 自有处理(避免双触发)
    if (document.body.classList.contains('folia-interface-active')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCmdK();
      return;
    }
    if (e.key === 'Escape') {
      const menuOpen = !$('ctx-menu').classList.contains('hidden');
      if (menuOpen) { $('ctx-menu').classList.add('hidden'); return; }
      if (cmdkEl) { closeCmdK(); return; }
      if (tag === 'INPUT') {
        search.value = '';
        search.dispatchEvent(new Event('input'));
        search.blur();
        return;
      }
      if (isLyricsOpen()) { closeLyricsView(); return; }
      if (document.querySelector('.modal-mask')) { document.querySelector('.modal-mask').remove(); return; }
    }
    if (typing) return;
    switch (e.key) {
      case ' ':
        // 焦点在按钮上时空格本来就是点击,避免双重触发
        if (tag !== 'BUTTON') {
          e.preventDefault();
          player.toggle();
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        player.seekBy(-5);
        break;
      case 'ArrowRight':
        e.preventDefault();
        player.seekBy(5);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (e.ctrlKey) {
          player.setVolume(player.volume + 0.05);
          $('pb-volfill').style.width = player.volume * 100 + '%';
        } else {
          kbdMove(-1);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (e.ctrlKey) {
          player.setVolume(player.volume - 0.05);
          $('pb-volfill').style.width = player.volume * 100 + '%';
        } else {
          kbdMove(1);
        }
        break;
      case 'Enter': {
        const tr = kbdPlay();
        break;
      }
      default:
        return;
    }
  });
}

// ---------------- 歌单 ----------------
state.openPlaylistsView = function () {
  const root = document.getElementById('view-root');
  root.innerHTML = `<div class="view-head"><h1>歌单</h1><span class="count">${state.playlists.length} 个</span>
    <div class="view-actions"><button class="btn primary" id="pl-new">新建歌单</button></div></div>
    ${state.playlists.length ? `<div class="grid">${state.playlists.map((p) => `
      <div class="card" data-pl="${p.id}">
        <div class="card-art placeholder" style="font-size:30px">🎼</div>
        <div class="card-name">${esc(p.name)}</div>
        <div class="card-sub">${p.trackIds.length} 首</div>
        <button class="card-play" data-pl="${p.id}"><svg viewBox="0 0 24 24" class="ico" style="width:17px;height:17px"><path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/></svg></button>
      </div>`).join('')}</div>`
      : `<div class="empty"><div class="big-ico">🎼</div><div>还没有歌单<br><span style="font-size:12.5px">右键歌曲 → 添加到歌单</span></div></div>`}`;
  root.querySelector('#pl-new')?.addEventListener('click', () => createPlaylistModal());
  root.querySelectorAll('[data-pl]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.card-play')) {
        const pl = state.playlists.find((p) => p.id === el.dataset.pl);
        const tracks = pl.trackIds.map((id) => state.trackById(id)).filter(Boolean);
        if (tracks.length) state.playAll(tracks);
        return;
      }
      if (el.classList.contains('card')) state.navigate('playlist', { id: el.dataset.pl });
    });
  });
};

function createPlaylistModal(_name = '', cb) {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `<div class="modal">
    <h3>新建歌单</h3>
    <input type="text" id="pl-name-input" placeholder="歌单名称">
    <div class="modal-actions">
      <button class="btn" id="pl-cancel">取消</button>
      <button class="btn primary" id="pl-ok">确定</button>
    </div></div>`;
  document.body.appendChild(mask);
  const input = mask.querySelector('#pl-name-input');
  input.focus();
  input.select();
  const ok = async () => {
    const v = input.value.trim();
    if (!v) return;
    await api.invoke('pl:create', v, []);
    mask.remove();
    await reloadPlaylists();
    cb?.(v);
  };
  mask.querySelector('#pl-ok').addEventListener('click', ok);
  mask.querySelector('#pl-cancel').addEventListener('click', () => mask.remove());
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') mask.remove(); });
}

state.renamePlaylist = function (pl) {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `<div class="modal"><h3>重命名歌单</h3>
    <input type="text" id="rn-input" value="${esc(pl.name)}">
    <div class="modal-actions"><button class="btn" id="rn-cancel">取消</button><button class="btn primary" id="rn-ok">确定</button></div></div>`;
  document.body.appendChild(mask);
  const input = mask.querySelector('#rn-input');
  input.focus();
  input.select();
  mask.querySelector('#rn-ok').addEventListener('click', async () => {
    const v = input.value.trim();
    if (v) { await api.invoke('pl:rename', pl.id, v); await reloadPlaylists(); state.render(); }
    mask.remove();
  });
  mask.querySelector('#rn-cancel').addEventListener('click', () => mask.remove());
};

state.deletePlaylist = async function (pl) {
  await api.invoke('pl:remove', pl.id);
  toast(`已删除歌单「${pl.name}」`);
  await reloadPlaylists();
  state.navigate('__playlists');
};

async function reloadPlaylists() {
  state.playlists = await api.invoke('pl:list');
  renderNavPlaylists();
}

function renderNavPlaylists() {
  const box = $('nav-playlists');
  box.innerHTML = state.playlists.map((p) => `
    <button class="nav-item nav-playlist-item" data-plid="${p.id}">
      <svg viewBox="0 0 24 24" class="ico"><path d="M3 6h13M3 12h13M3 18h9"/><circle cx="19" cy="16" r="2.5"/><path d="M21.5 16V8l-4 1"/></svg>
      <span class="pl-name">${esc(p.name)}</span>
      <button class="pl-del" title="删除">✕</button>
    </button>`).join('');
  box.querySelectorAll('.nav-playlist-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.pl-del')) {
        const pl = state.playlists.find((p) => p.id === el.dataset.plid);
        if (pl) state.deletePlaylist(pl);
        return;
      }
      state.navigate('playlist', { id: el.dataset.plid });
    });
  });
}

// ---------------- 命令面板(Ctrl+K) ----------------
const CMDK_ICONS = {
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
  queue: '<path d="M3 6h13M3 12h13M3 18h9"/><path d="M18 9v9M14.5 13.5h7"/>',
  heart: '<path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2.4 4.5 6 4.5c2.2 0 3.6 1.2 6 3.8 2.4-2.6 3.8-3.8 6-3.8 3.6 0 5.6 3.9 4 7.2C19.5 16.4 12 21 12 21z"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  library: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  lyrics: '<path d="M4 5h16M4 10h16M4 15h10M4 20h7"/>',
  shuffle: '<path d="M16 3h5v5M21 3l-7.5 7.5M8 21H3v-5M3 21l7.5-7.5M16 21h5v-5M21 21l-6-6"/>',
  theme: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/>',
  mini: '<rect x="3" y="3" width="18" height="18" rx="3"/><rect x="10" y="12" width="8" height="6" rx="1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83"/>',
};

let cmdkEl = null;

function cmdkCommands(q) {
  const q2 = q.toLowerCase();
  const all = [
    { group: '播放控制', label: player.playing ? '暂停播放' : '继续播放', icon: 'play', act: () => player.toggle() },
    { group: '播放控制', label: '随机播放一首', icon: 'shuffle', act: () => { if (state.tracks.length) state.playFromList(state.tracks, Math.floor(Math.random() * state.tracks.length)); } },
    { group: '导航', label: '打开首页', icon: 'home', act: () => state.navigate('home') },
    { group: '导航', label: '打开曲库', icon: 'library', act: () => state.navigate('library') },
    { group: '导航', label: '打开最近播放', icon: 'library', act: () => state.navigate('recent-played') },
    { group: '导航', label: '打开播放队列', icon: 'queue', act: () => state.navigate('queue') },
    { group: '导航', label: '打开我喜欢的音乐', icon: 'heart', act: () => state.navigate('favorites') },
    { group: '视图', label: isLyricsOpen() ? '关闭歌词视图' : '打开歌词视图', icon: 'lyrics', act: () => $('pb-lyrics').click() },
    { group: '视图', label: player.shuffle ? '关闭随机播放' : '开启随机播放', icon: 'shuffle', act: () => player.setShuffle(!player.shuffle) },
    { group: '视图', label: '打开设置', icon: 'settings', act: () => state.navigate('settings') },
    ...state.playlists.map((pl) => ({ group: '歌单', label: pl.name, icon: 'queue', sub: pl.trackIds.length + ' 首', act: () => state.navigate('playlist', { id: pl.id }) })),
  ];
  const cmds = all.filter((c) => !q || c.label.toLowerCase().includes(q2));
  const songs = q ? state.tracks.filter((t) =>
    (t.title || '').toLowerCase().includes(q2) ||
    (t.artist || '').toLowerCase().includes(q2)).slice(0, 8)
    .map((t) => ({ group: '歌曲', label: t.title, icon: 'library', sub: t.artist, act: () => state.playFromList([t], 0) }))
  : [];
  return [...cmds, ...songs];
}

function openCmdK() {
  if (cmdkEl) return;
  const mask = document.createElement('div');
  mask.className = 'cmdk-mask';
  const panel = document.createElement('div');
  panel.className = 'cmdk';
  panel.innerHTML = `
    <div class="cmdk-input-wrap">
      <svg viewBox="0 0 24 24" class="ico"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input id="cmdk-input" type="text" placeholder="搜索歌曲或输入命令…">
      <span class="sub" style="font-size:11px;color:var(--faint)">ESC 关闭</span>
    </div>
    <div class="cmdk-list" id="cmdk-list"></div>`;
  mask.appendChild(panel);
  document.body.appendChild(mask);
  cmdkEl = { mask, panel, input: panel.querySelector('#cmdk-input'), list: panel.querySelector('#cmdk-list'), sel: 0, items: [] };

  const renderList = (q) => {
    const items = cmdkCommands(q);
    cmdkEl.items = items;
    cmdkEl.sel = Math.min(cmdkEl.sel, Math.max(0, items.length - 1));
    if (!items.length) {
      cmdkEl.list.innerHTML = '<div class="cmdk-empty">没有匹配的结果</div>';
      return;
    }
    let html = '';
    let lastGroup = '';
    items.forEach((it, i) => {
      if (it.group !== lastGroup) { html += `<div class="cmdk-group-label">${esc(it.group)}</div>`; lastGroup = it.group; }
      html += `<div class="cmdk-item ${i === cmdkEl.sel ? 'selected' : ''}" data-i="${i}">
        <svg viewBox="0 0 24 24" class="ico">${CMDK_ICONS[it.icon] || ''}</svg>
        <span>${esc(it.label)}</span>
        ${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ''}
      </div>`;
    });
    cmdkEl.list.innerHTML = html;
    cmdkEl.list.querySelectorAll('.cmdk-item').forEach((el) => {
      el.addEventListener('click', () => runCmd(+el.dataset.i));
      el.addEventListener('mousemove', () => { cmdkEl.sel = +el.dataset.i; highlightSel(); });
    });
    const selEl = cmdkEl.list.querySelector('.cmdk-item.selected');
    selEl?.scrollIntoView({ block: 'nearest' });
  };
  const highlightSel = () => {
    cmdkEl.list.querySelectorAll('.cmdk-item').forEach((el, i) => el.classList.toggle('selected', i === cmdkEl.sel));
  };
  const runCmd = (i) => {
    const it = cmdkEl.items[i];
    closeCmdK();
    it?.act?.();
  };
  const onInput = () => { cmdkEl.sel = 0; renderList(cmdkEl.input.value.trim()); };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); closeCmdK(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); cmdkEl.sel = Math.min(cmdkEl.items.length - 1, cmdkEl.sel + 1); highlightSel(); cmdkEl.list.querySelector('.cmdk-item.selected')?.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'ArrowUp') { e.preventDefault(); cmdkEl.sel = Math.max(0, cmdkEl.sel - 1); highlightSel(); cmdkEl.list.querySelector('.cmdk-item.selected')?.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter') { e.preventDefault(); runCmd(cmdkEl.sel); }
  };
  cmdkEl._onInput = onInput;
  cmdkEl._onKey = onKey;
  cmdkEl.input.addEventListener('input', onInput);
  cmdkEl.input.addEventListener('keydown', onKey);
  mask.addEventListener('click', (e) => { if (e.target === mask) closeCmdK(); });
  cmdkEl.input.focus();
  renderList('');
}

function closeCmdK() {
  if (!cmdkEl) return;
  cmdkEl.mask.remove();
  cmdkEl = null;
}
window.__openCmdK = openCmdK;

// ---------------- 列表键盘导航(↑↓ 移动,Enter 播放) ----------------
let kbdIndex = -1;
function kbdMove(dir) {
  const rows = [...document.querySelectorAll('#view-root tr[data-id]')];
  if (!rows.length) return;
  if (kbdIndex < 0 || kbdIndex >= rows.length) kbdIndex = dir > 0 ? -1 : rows.length;
  kbdIndex = Math.max(0, Math.min(rows.length - 1, kbdIndex + dir));
  rows.forEach((r, i) => r.classList.toggle('kbd-active', i === kbdIndex));
  rows[kbdIndex].scrollIntoView({ block: 'nearest' });
}
function kbdPlay() {
  const rows = [...document.querySelectorAll('#view-root tr[data-id]')];
  if (kbdIndex < 0 || kbdIndex >= rows.length) { kbdMove(1); return; }
  rows[kbdIndex].click();
}

// ---------------- 播放队列视图 ----------------
function renderQueueView(root) {
  if (!player.queue.length) {
    root.innerHTML = `<div class="view-head"><h1>播放队列</h1></div>
      <div class="empty"><img class="empty-art small" src="./assets/empty-music.png" alt="" draggable="false"><div class="empty-title">队列是空的</div><div class="empty-sub">播放歌曲,或在歌曲上右键「加入队列」</div></div>`;
    return;
  }
  root.innerHTML = `<div class="view-head"><h1>播放队列</h1><span class="count">${player.queue.length} 首</span>
    <div class="view-actions"><button class="btn" id="q-clear">清空(保留当前)</button></div></div>
    <table class="track-table"><tbody>
      ${player.queue.map((t, i) => `<tr data-id="${t.id}" class="${t.id === state.playingId ? 'playing' : ''}">
        <td class="t-num">${i + 1}</td>
        <td style="max-width:340px"><div class="t-title-cell">
          <div style="min-width:0"><div class="t-title">${esc(t.title)}</div></div>
        </div></td>
        <td class="t-artist">${esc(t.artist)}</td>
        <td class="t-dur">${fmtTime(t.duration)}</td>
        <td class="t-actions"><button class="pb-iconbtn q-rm" data-i="${i}" title="从队列移除">✕</button></td>
      </tr>`).join('')}
    </tbody></table>`;
  root.querySelector('#q-clear')?.addEventListener('click', () => {
    player.clearQueue({ keepCurrent: true });
    toast('已清空队列(保留当前曲目)');
  });
  root.querySelectorAll('tr[data-id]').forEach((tr) => {
    tr.addEventListener('click', (e) => {
      if (e.target.closest('.q-rm')) return;
      const idx = player.queue.findIndex((t) => t.id === tr.dataset.id);
      if (idx >= 0) player.playTrackAt(idx);
    });
  });
  root.querySelectorAll('.q-rm').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      player.removeAt(+btn.dataset.i);
      if (state.view === 'queue') renderQueueView(root);
    });
  });
  if (player.queue.length > 1) bindDragReorder(root, (f, t, b) => player.moveInQueue(f, t, b));
}

// ---------------- 我喜欢的音乐 ----------------
function renderFavoritesView(root) {
  const ids = state.config.favorites || [];
  const tracks = ids.map((id) => state.trackById(id)).filter(Boolean);
  root.innerHTML = `<div class="view-head"><h1>我喜欢的音乐</h1><span class="count">${tracks.length} 首</span>
    <div class="view-actions">${tracks.length ? ACTIONS_PLAY_ALL : ''}</div></div>
    ${tracks.length ? trackTable(tracks, state.playingId) : `<div class="empty">
      <img class="empty-art small" src="./assets/empty-music.png" alt="" draggable="false">
      <div class="empty-title">还没有收藏的歌曲</div>
      <div class="empty-sub">播放时点击播放条上的 ♥ 收藏喜欢的音乐</div>
    </div>`}`;
  if (tracks.length) {
    bindTable(root, state, tracks);
    if (tracks.length > 1) bindDragReorder(root, (f, t, b) => state.reorderPlaylist(pl, f, t, b));
    root.querySelector('#btn-play-all')?.addEventListener('click', () => state.playAll(tracks));
  }
}

// 歌单内拖拽重排
state.reorderPlaylist = (pl, fromId, toId, below) => {
  const arr = [...pl.trackIds];
  const from = arr.indexOf(fromId);
  if (from < 0 || fromId === toId) return;
  arr.splice(from, 1);
  const idx = arr.indexOf(toId);
  if (idx < 0) return;
  arr.splice(below ? idx + 1 : idx, 0, fromId);
  pl.trackIds = arr;
  api.invoke('pl:reorder', pl.id, arr);
  state.render();
};

// ---------------- 右键菜单 ----------------
const MENU_ICONS = {
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
  queue: '<path d="M3 6h13M3 12h13M3 18h9"/><path d="M18 9v9M14.5 13.5h7"/>',
  artist: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
  album: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="4.5"/>',
  playlistAdd: '<path d="M3 6h11M3 12h11M3 18h7"/><path d="M18 9v9M14.5 13.5h7"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  remove: '<path d="M6 6l12 12M18 6L6 18"/>',
  heart: '<path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2.4 4.5 6 4.5c2.2 0 3.6 1.2 6 3.8 2.4-2.6 3.8-3.8 6-3.8 3.6 0 5.6 3.9 4 7.2C19.5 16.4 12 21 12 21z"/>',
};

state.showTrackMenu = function (e, track, playlistId) {
  if (!track) return;
  const menu = $('ctx-menu');
  const items = [
    { label: '播放', icon: 'play', act: () => state.playFromList([track], 0) },
    { label: '加入队列', icon: 'queue', act: () => state.enqueue(track) },
    { sep: true },
    { label: '查看艺术家', icon: 'artist', act: () => state.navigate('artists', { value: track.albumArtist || track.artist }) },
    { label: '查看专辑', icon: 'album', act: () => state.navigate('albums', { value: track.album }) },
    { sep: true },
  ];
  // 歌单子项
  if (state.playlists.length) {
    for (const pl of state.playlists) {
      items.push({
        label: `添加到「${pl.name}」`,
        icon: 'playlistAdd',
        act: async () => {
          await api.invoke('pl:addTracks', pl.id, [track.id]);
          await reloadPlaylists();
          toast(`已添加到「${pl.name}」`);
          if (state.view === 'playlist' && state.params?.id === pl.id) state.render();
        },
      });
    }
  } else {
    items.push({ label: '新建歌单并加入…', icon: 'playlistAdd', act: () => createPlaylistModal('', async () => {
      const pl = state.playlists[state.playlists.length - 1];
      if (pl) { await api.invoke('pl:addTracks', pl.id, [track.id]); toast(`已添加到「${pl.name}」`); }
    }) });
  }
  if (playlistId) {
    items.push({ sep: true }, {
      label: '从歌单移除',
      icon: 'remove',
      act: async () => {
        await api.invoke('pl:removeTrack', playlistId, track.id);
        state.render();
      },
    });
  }
  items.push({ sep: true }, { label: '打开文件位置', icon: 'folder', act: () => api.invoke('lib:reveal', track.path) });

  menu.innerHTML = items.map((it, i) =>
    it.sep ? '<div class="ctx-sep"></div>' : `<div class="ctx-item" data-i="${i}"><svg viewBox="0 0 24 24" class="ico">${MENU_ICONS[it.icon] || ''}</svg>${esc(it.label)}</div>`).join('');
  menu.classList.remove('hidden');
  const mw = 200, mh = items.length * 30 + 20;
  menu.style.left = Math.min(e.clientX, window.innerWidth - mw - 8) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - mh - 8) + 'px';

  menu.querySelectorAll('.ctx-item').forEach((el) => {
    el.addEventListener('click', () => {
      const it = items[+el.dataset.i];
      menu.classList.add('hidden');
      it.act?.();
    });
  });
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('#ctx-menu')) $('ctx-menu').classList.add('hidden');
});

// ---------------- 导入流程 ----------------
state.addFolderFlow = async function () {
  const folder = await api.invoke('lib:pickFolder');
  if (!folder) return;
  toast('正在扫描文件夹…');
  const r = await api.invoke('lib:addFolder', folder);
  if (r.ok) toast(`导入完成,新增 ${r.added} 首`);
  state.libraryFolders = await api.invoke('lib:getFolders');
  if (state.view === 'settings') state.render();
};

state.addFilesFlow = async function () {
  const files = await api.invoke('lib:pickFiles');
  if (!files.length) return;
  const r = await api.invoke('lib:addFiles', files);
  toast(`导入完成,新增 ${r.added} 首`);
};

state.reloadLibrary = async function () {
  state.libraryFolders = await api.invoke('lib:getFolders');
  const tracks = await api.invoke('lib:getAll');
  setTracks(tracks);
  state.render();
};

function setTracks(tracks) {
  state.tracks = tracks;
  state.trackMap = new Map(tracks.map((t) => [t.id, t]));
  if (state.filteredTracks) {
    const ids = new Set(tracks.map((t) => t.id));
    state.filteredTracks = state.filteredTracks.filter((t) => ids.has(t.id));
  }
}

// ---------------- 主题 ----------------
state.applyTheme = async function (theme) {
  state.config.theme = theme;
  document.documentElement.dataset.theme = theme;
  await api.invoke('config:set', { theme });
};

state.applyAccent = async function (accent) {
  state.config.accentColor = accent;
  if (accent === 'galaxy') delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = accent;
  document.body.classList.add('accent-pulse');
  setTimeout(() => document.body.classList.remove('accent-pulse'), 740);
  await api.invoke('config:set', { accentColor: accent });
};

// ---------------- 桌面歌词徽标 ----------------
state.updateDlBadge = function (on) {
  const el = $('dl-state');
  el.textContent = on ? '开' : '关';
  el.classList.toggle('on', on);
  el.classList.toggle('off', !on);
};

// ---------------- 曲库事件 ----------------
function bindLibraryEvents() {
  api.on('library:changed', ({ tracks }) => {
    setTracks(tracks);
    state.render();
  });
  api.on('library:updated', ({ track }) => {
    if (state.trackMap.has(track.id)) {
      const idx = state.tracks.findIndex((t) => t.id === track.id);
      if (idx >= 0) state.tracks[idx] = track;
      state.trackMap.set(track.id, track);
    }
  });
  api.on('library:removed', ({ id }) => {
    state.tracks = state.tracks.filter((t) => t.id !== id);
    state.trackMap.delete(id);
    if (state.playingId === id) state.playingId = null;
  });

  // 扫描进度浮条
  let scanEl = null;
  api.on('library:scan-progress', ({ done, total, added, folder }) => {
    if (!scanEl) {
      scanEl = document.createElement('div');
      scanEl.className = 'scan-float';
      document.body.appendChild(scanEl);
    }
    scanEl.innerHTML = `<div>正在扫描 ${esc(folder.split('\\').pop() || folder)}</div>
      <div class="progress-track"><div class="progress-fill" style="width:${total ? (done / total) * 100 : 0}%"></div></div>
      <div style="color:var(--faint)">${done} / ${total} · 新增 ${added}</div>`;
    if (done >= total && total > 0) {
      setTimeout(() => { scanEl?.remove(); scanEl = null; }, 1200);
    }
  });
}

// ---------------- 迷你播放器命令 ----------------
function bindPlayerCommands() {
  api.on('player:command', ({ cmd, arg }) => {
    switch (cmd) {
      case 'toggle': player.toggle(); break;
      case 'next': player.next(false); break;
      case 'prev': player.prev(); break;
      case 'seek': player.seek(arg); break;
      case 'volume': player.setVolume(arg); break;
      case 'like': $('pb-fav').click(); break;
    }
  });
}

// ---------------- 更新事件 ----------------
function bindUpdateEvents() {
  const badge = $('btn-update-badge');
  const setBadgeState = (cls) => {
    badge.className = 'tb-btn update-badge ' + cls;
    badge.classList.toggle('hidden', cls === 'idle' || cls === 'not-available');
  };
  api.on('update:event', (ev) => {
    state.updateState = ev;
    switch (ev.type) {
      case 'checking': setBadgeState('checking'); break;
      case 'available':
        setBadgeState('has-update');
        toast(`发现新版本 v${ev.version},可到设置中下载更新`, 5000);
        break;
      case 'not-available': setBadgeState('idle'); break;
      case 'progress':
        setBadgeState('downloading');
        // 进度环:percent → stroke-dashoffset(周长 100)
        const ring = badge.querySelector('.ring-progress');
        if (ring) ring.style.strokeDashoffset = String(100 - (ev.percent || 0));
        break;
      case 'downloaded':
        setBadgeState('ready');
        toast('更新下载完成,重启后安装', 4000);
        break;
      case 'error': setBadgeState('idle'); break;
    }
    if (state.view === 'settings') {
      renderUpdateStatus(document.getElementById('view-root'), ev);
    }
  });
  state.checkUpdate = async () => {
    state.updateState = { type: 'checking' };
    setBadgeState('checking');
    renderUpdateStatus(document.getElementById('view-root'), state.updateState);
    await api.invoke('update:check');
  };
}

// ---------------- 壁纸挂载状态(全局跟踪,推送节流用) ----------------
function bindWallpaperState() {
  api.on('wallpaper:state', (s2) => { state.wallpaperActive = !!s2.active; });
}

// Folia 界面切换:宿主自管按钮文字/标题(updateButtons),此处无需额外同步

// ---------------- 启动 ----------------
async function boot() {
  player.init();
  bindPlaybar();
  bindChrome();
  bindLibraryEvents();
  bindPlayerCommands();
  bindUpdateEvents();
  bindWallpaperState();
  bindFoliaSwitch();

  // 加载配置
  state.config = await api.invoke('config:get');
  document.documentElement.dataset.theme = state.config.theme || 'dark';
  if (state.config.accentColor && state.config.accentColor !== 'galaxy') {
    document.documentElement.dataset.accent = state.config.accentColor;
  }
  player.volume = state.config.volume ?? 0.8;
  player.crossfade = state.config.crossfade || 0;
  player.repeat = state.config.repeat || 'off';
  player.shuffle = !!state.config.shuffle;
  player.setEq(state.config.eq || {});
  $('pb-volfill').style.width = player.volume * 100 + '%';
  state.updateDlBadge(!!state.config.desktopLyrics?.visible);

  // 曲库 / 歌单 / 统计
  await Promise.all([state.reloadLibrary(), reloadPlaylists()]);
  state.stats = await api.invoke('stats:all');
  state.reloadStats = async () => { state.stats = await api.invoke('stats:all'); state.render(); };

  // 断点续播:恢复上次队列(不自动播放)
  const sess = state.config.session;
  if (sess && sess.queue?.length) {
    const tracks = sess.queue.map((id) => state.trackById(id)).filter(Boolean);
    if (tracks.length) {
      player.queue = tracks;
      player.index = Math.min(sess.index ?? 0, tracks.length - 1);
      const cur = tracks[player.index];
      if (cur) {
        player.current = cur;
        updatePlaybarTrack(cur);
        $('pb-dur').textContent = fmtTime(cur.duration || 0);
      }
    }
  }

  state.navigate('home');
  registerSpectrum(document.getElementById('pb-spectrum'), { bars: 22 });

  // Folia 宿主桥(适配器在此拿到播放器/状态引用)
  window.__setFoliaBridge({
    player, state,
    addFolderFlow: state.addFolderFlow,
  });
  // Folia 偏好:恢复上次界面选择
  try {
    const lastMode = localStorage.getItem('mineradio-player-interface-v1');
    if (lastMode === 'folia' && window.MineradioFoliaHost) {
      setTimeout(() => window.MineradioFoliaHost.setInterface('folia'), 600);
    }
  } catch { /* ignore */ }

  // 周期保存
  player.startProgressSaver();
  player.startSessionSaver();

  // 频谱数据推送(桌面壁纸联动,30fps 节流;仅在壁纸挂载时推送)
  let lastSpecPush = 0;
  setInterval(() => {
    if (!state.wallpaperActive) return;
    const now = performance.now();
    if (now - lastSpecPush < 33) return;
    lastSpecPush = now;
    const spec = player.getSpectrum();
    if (spec) window.mpro.send('player:spec', Array.from(spec));
  }, 33);
  setInterval(() => {
    api.invoke('config:set', {
      volume: player.volume, crossfade: player.crossfade,
      repeat: player.repeat, shuffle: player.shuffle,
    });
  }, 8000);
}

boot();
