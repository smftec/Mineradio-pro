// 视图渲染:曲库 / 分类 / 歌单
import { api, coverUrl, fmtTime, esc, toast } from './api.js';

const DEFAULT_COVER = './assets/default-cover.png';

// 名称 hash → 占位渐变(0~5)
export function phClass(name) {
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return 'ph-' + (h % 6);
}

// 播放中均衡器动画图标
export const EQ_BARS = `<span class="eq-bars" aria-hidden="true"><span></span><span></span><span></span></span>`;

function trackRow(t, i, playingId) {
  const cover = coverUrl(t) || DEFAULT_COVER;
  const isPlaying = t.id === playingId;
  return `<tr data-id="${t.id}" class="${isPlaying ? 'playing' : ''}">
    <td class="t-num" data-i="${i}">${isPlaying ? EQ_BARS : i + 1}</td>
    <td style="max-width:340px"><div class="t-title-cell">
      <img class="t-cover" src="${cover}" loading="lazy" alt="" onerror="this.src='${DEFAULT_COVER}'">
      <div style="min-width:0"><div class="t-title">${esc(t.title)}</div></div>
    </div></td>
    <td class="t-artist" data-artist="${esc(t.artist)}">${esc(t.artist)}</td>
    <td class="t-album" data-album="${esc(t.album)}">${esc(t.album)}</td>
    <td class="t-dur">${fmtTime(t.duration)}</td>
    <td class="t-actions">
      <button class="pb-iconbtn act-queue" data-id="${t.id}" title="加入队列"><svg viewBox="0 0 24 24" class="ico"><path d="M3 6h13M3 12h13M3 18h9"/><path d="M18 9v9M14.5 13.5h7"/></svg></button>
      <button class="pb-iconbtn act-menu" data-id="${t.id}" title="更多"><svg viewBox="0 0 24 24" class="ico"><circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/></svg></button>
    </td>
  </tr>`;
}

export const PAGE_SIZE = 120; // 大曲库增量渲染:初始/每次追加 120 行(参考原版窗口化策略)

// 增量列表上下文(滚动接近底部时追加下一页)
const listCtx = { tracks: [], playingId: '', playlistId: null, state: null, offset: 0 };

export function trackTable(tracks, playingId) {
  if (!tracks.length) return '';
  const limited = tracks.length > PAGE_SIZE;
  const shown = limited ? tracks.slice(0, PAGE_SIZE) : tracks;
  return `<table class="track-table"><tbody>
    ${shown.map((t, i) => trackRow(t, i, playingId)).join('')}
  </tbody>${limited ? '</table><div id="list-more" class="val" style="text-align:center;padding:12px;color:var(--faint)">滚动加载更多…</div><table style="display:none"><tbody class="track-more"></tbody>' : ''}
  </tbody></table>`;
}

// 增量列表注册:渲染后调用;滚动近底部自动追加下一页并逐行绑定
export function setupIncrementalList(root, state, tracks, playlistId = null) {
  if (tracks.length <= PAGE_SIZE) return;
  Object.assign(listCtx, { tracks, playingId: state.playingId, playlistId, state, offset: PAGE_SIZE });
  const tbody = root.querySelector('.track-more');
  const sentinel = root.querySelector('#list-more');
  if (!tbody || !sentinel) return;
  const content = document.getElementById('content');
  const onScroll = () => {
    if (listCtx.offset >= listCtx.tracks.length) {
      content.removeEventListener('scroll', onScroll);
      sentinel.remove();
      return;
    }
    const el = content;
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 500) return;
    appendBatch(root, tbody, sentinel);
  };
  content.addEventListener('scroll', onScroll);
}

function appendBatch(root, tbody, sentinel) {
  const start = listCtx.offset;
  const batch = listCtx.tracks.slice(start, start + PAGE_SIZE);
  const playingId = listCtx.playingId;
  const frag = document.createElement('tbody');
  frag.innerHTML = batch.map((t, i) => trackRow(t, start + i, playingId)).join('');
  for (const tr of frag.children) {
    bindTrackRow(tr, listCtx.tracks, start + [...root.querySelectorAll('tr[data-id]')].indexOf(tr) + start, listCtx.playlistId);
    listCtx.state?.bindRowExtras?.(tr, listCtx.tracks, listCtx.playlistId);
  }
  while (frag.firstChild) tbody.appendChild(frag.firstChild);
  listCtx.offset += PAGE_SIZE;
  if (listCtx.offset >= listCtx.tracks.length) sentinel.remove();
}

// 行级绑定(增量追加用)
function bindTrackRow(tr, tracks, playlistId) { /* 由 bindTable 的委托实现覆盖,此处保留占位 */ }

function card(art, isPlaceholder, name, sub, onclickAttr, withPlay) {
  const ph = esc((name || '♪')[0].toUpperCase());
  const phc = phClass(name);
  const artEl = isPlaceholder
    ? `<div class="card-art placeholder ${phc}">${ph}</div>`
    : `<img class="card-art" src="${art}" loading="lazy" data-ph="${ph}" data-phc="${phc}">`;
  return `<div class="card" ${onclickAttr}>
    ${artEl}
    ${withPlay ? `<button class="card-play" ${onclickAttr}><svg viewBox="0 0 24 24" class="ico" style="width:17px;height:17px"><path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/></svg></button>` : ''}
    <div class="card-name" title="${esc(name)}">${esc(name)}</div>
    <div class="card-sub">${esc(sub)}</div>
  </div>`;
}

function groupCard(name, sub, artTracks, view, withPlay = true) {
  const withArt = artTracks.find((t) => t.cover);
  const attr = `data-nav="${view}" data-value="${esc(name)}"`;
  return card(withArt ? coverUrl(withArt) : null, !withArt, name, sub, attr, withPlay);
}

// ---------- 各视图 ----------
export function renderView(root, state) {
  const { view, params } = state;
  switch (view) {
    case 'library': return viewLibrary(root, state, null, '全部歌曲');
    case 'artists': return params?.value ? viewGroupDetail(root, state, 'artist', params.value) : viewGroups(root, state, 'artist', '艺术家');
    case 'albums': return params?.value ? viewGroupDetail(root, state, 'album', params.value) : viewGroups(root, state, 'album', '专辑');
    case 'genres': return params?.value ? viewGroupDetail(root, state, 'genre', params.value) : viewGroups(root, state, 'genre', '流派');
    case 'years': return params?.value ? viewGroupDetail(root, state, 'year', params.value) : viewGroups(root, state, 'year', '年代');
    case 'recent-added': return viewRecentAdded(root, state);
    case 'recent-played': return viewRecentPlayed(root, state);
    case 'most-played': return viewMostPlayed(root, state);
    case 'playlist': return viewPlaylistDetail(root, state, params.id);
    default: return viewLibrary(root, state, null, '全部歌曲');
  }
}

function head(title, count, actions = '') {
  return `<div class="view-head"><h1>${esc(title)}</h1><span class="count">${count}</span><div class="view-actions">${actions}</div></div>`;
}

export const ACTIONS_PLAY_ALL = `<button class="btn primary" id="btn-play-all"><svg viewBox="0 0 24 24" class="ico"><path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/></svg>播放全部</button>`;

function viewLibrary(root, state, filterTracks, title) {
  const filtering = state.filteredTracks !== null && state.filteredTracks !== undefined;
  const tracks = filterTracks || sortDefault(state.filteredTracks || state.tracks);
  if (!state.tracks.length) return renderEmptyLibrary(root, state);
  // 搜索无结果:给出明确提示与清除入口(而非空白列表)
  if (filtering && !tracks.length) {
    root.innerHTML = `<div class="empty">
      <img class="empty-art" src="./assets/empty-music.png" alt="" draggable="false">
      <div class="empty-title">没有找到匹配的歌曲</div>
      <div class="empty-sub">换个关键词试试,或按 Esc 清空搜索</div>
      <div class="empty-actions"><button class="btn" id="empty-clear-search">清空搜索</button></div>
    </div>`;
    root.querySelector('#empty-clear-search')?.addEventListener('click', () => state.clearSearch());
    return;
  }
  root.innerHTML = head(title, `${tracks.length} 首`, ACTIONS_PLAY_ALL) + trackTable(tracks, state.playingId);
  bindTable(root, state, tracks);
  setupIncrementalList(root, state, tracks);
  root.querySelector('#btn-play-all')?.addEventListener('click', () => state.playAll(tracks));
}

function sortDefault(tracks) {
  return [...tracks].sort((a, b) =>
    (a.albumArtist || a.artist).localeCompare(b.albumArtist || b.artist, 'zh') ||
    (a.album || '').localeCompare(b.album || '', 'zh') ||
    (a.trackNo || 0) - (b.trackNo || 0));
}

function renderEmptyLibrary(root, state) {
  root.innerHTML = `<div class="empty">
    <img class="empty-art" src="./assets/empty-music.png" alt="" draggable="false">
    <div class="empty-title">曲库还是空的</div>
    <div class="empty-sub">导入音乐文件夹开始使用<br>支持 MP3 / FLAC / WAV / OGG / Opus / M4A / AAC</div>
    <div class="empty-actions">
      <button class="btn primary" id="empty-add-folder">导入文件夹</button>
      <button class="btn" id="empty-add-files">导入文件</button>
    </div>
  </div>`;
  root.querySelector('#empty-add-folder')?.addEventListener('click', () => state.addFolderFlow());
  root.querySelector('#empty-add-files')?.addEventListener('click', () => state.addFilesFlow());
}

function viewGroups(root, state, kind, title) {
  const groups = new Map();
  for (const t of state.tracks) {
    let key;
    if (kind === 'artist') key = t.albumArtist || t.artist || '未知艺术家';
    else if (kind === 'album') key = t.album || '未知专辑';
    else if (kind === 'genre') key = t.genre || '未知流派';
    else key = t.year ? String(t.year) : '未知年代';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  const keys = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'zh'));
  if (!keys.length) return renderEmptyLibrary(root, state);
  root.innerHTML = head(title, `${keys.length} 组`) +
    `<div class="grid">${keys.map((k) => {
      const list = groups.get(k);
      const sub = kind === 'album'
        ? (list[0].albumArtist || list[0].artist || '') + (list[0].year ? ` · ${list[0].year}` : '')
        : `${list.length} 首`;
      const navView = kind === 'artist' ? 'artists' : kind === 'album' ? 'albums' : kind === 'genre' ? 'genres' : 'years';
      return groupCard(k, sub, sortDefault(list), navView);
    }).join('')}</div>`;
  bindCards(root, state);
}

function viewGroupDetail(root, state, kind, value) {
  const tracks = state.tracks.filter((t) => {
    if (kind === 'artist') return (t.albumArtist || t.artist || '未知艺术家') === value;
    if (kind === 'album') return (t.album || '未知专辑') === value;
    if (kind === 'genre') return (t.genre || '未知流派') === value;
    return (t.year ? String(t.year) : '未知年代') === value;
  });
  const sorted = kind === 'album' ? sortDefault(tracks) : [...tracks].sort((a, b) => (a.album || '').localeCompare(b.album || '', 'zh') || (a.trackNo || 0) - (b.trackNo || 0));
  const backView = kind === 'artist' ? 'artists' : kind === 'album' ? 'albums' : kind === 'genre' ? 'genres' : 'years';
  const withArt = sorted.find((t) => t.cover);
  root.innerHTML = `<button class="back-link" data-nav="${backView}">← 返回</button>
    <div class="view-head">
      <h1>${esc(value)}</h1><span class="count">${sorted.length} 首</span>
      <div class="view-actions">${ACTIONS_PLAY_ALL}</div>
    </div>
    ${trackTable(sorted, state.playingId)}`;
  bindTable(root, state, sorted);
  setupIncrementalList(root, state, sorted);
  bindBack(root, state);
  root.querySelector('#btn-play-all')?.addEventListener('click', () => state.playAll(sorted));
}

function viewRecentAdded(root, state) {
  const tracks = [...state.tracks].sort((a, b) => b.addedAt - a.addedAt).slice(0, 500);
  if (!state.tracks.length) return renderEmptyLibrary(root, state);
  root.innerHTML = head('最近添加', `${tracks.length} 首`, ACTIONS_PLAY_ALL) + trackTable(tracks, state.playingId);
  bindTable(root, state, tracks);
  setupIncrementalList(root, state, tracks);
  root.querySelector('#btn-play-all')?.addEventListener('click', () => state.playAll(tracks));
}

function viewRecentPlayed(root, state) {
  const hist = state.stats.history || [];
  const seen = new Set();
  const tracks = [];
  for (const h of hist) {
    if (seen.has(h.id)) continue;
    seen.add(h.id);
    const t = state.trackById(h.id);
    if (t) tracks.push(t);
    if (tracks.length >= 300) break;
  }
  if (!tracks.length) {
    return void (root.innerHTML = head('最近播放', '0 首') + `<div class="empty"><img class="empty-art small" src="./assets/empty-music.png" alt="" draggable="false"><div class="empty-title">还没有播放记录</div><div class="empty-sub">播放的歌曲会出现在这里</div></div>`);
  }
  root.innerHTML = head('最近播放', `${tracks.length} 首`,
    `${ACTIONS_PLAY_ALL}<button class="btn" id="btn-clear-history">清空记录</button>`) +
    trackTable(tracks, state.playingId);
  bindTable(root, state, tracks);
  setupIncrementalList(root, state, tracks);
  root.querySelector('#btn-play-all')?.addEventListener('click', () => state.playAll(tracks));
  root.querySelector('#btn-clear-history')?.addEventListener('click', async () => {
    await api.invoke('stats:clearHistory');
    toast('已清空最近播放记录');
    state.reloadStats();
  });
}

function viewMostPlayed(root, state) {
  const entries = Object.entries(state.stats.tracks || {})
    .filter(([, s]) => s.plays > 0)
    .sort((a, b) => b[1].plays - a[1].plays)
    .slice(0, 300);
  const tracks = entries.map(([id]) => state.trackById(id)).filter(Boolean);
  if (!tracks.length) {
    return void (root.innerHTML = head('播放最多', '0 首') + `<div class="empty"><img class="empty-art small" src="./assets/empty-music.png" alt="" draggable="false"><div class="empty-title">还没有统计数据</div><div class="empty-sub">播放次数最多的歌曲会出现在这里</div></div>`);
  }
  root.innerHTML = head('播放最多', `${tracks.length} 首`, ACTIONS_PLAY_ALL) + trackTable(tracks, state.playingId);
  bindTable(root, state, tracks);
  setupIncrementalList(root, state, tracks);
  root.querySelector('#btn-play-all')?.addEventListener('click', () => state.playAll(tracks));
}

// 拖拽排序通用绑定:行可拖动,drop 时回调 onMove(fromId, toId, below)
export function bindDragReorder(root, onMove) {
  let dragId = null;
  root.querySelectorAll('tr[data-id]').forEach((tr) => {
    tr.draggable = true;
    tr.addEventListener('dragstart', (e) => {
      dragId = tr.dataset.id;
      tr.classList.add('drag-src');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragId); } catch { /* ignore */ }
    });
    tr.addEventListener('dragend', () => tr.classList.remove('drag-src'));
    tr.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (tr.dataset.id === dragId) return;
      const rect = tr.getBoundingClientRect();
      const below = e.clientY > rect.top + rect.height / 2;
      tr.classList.toggle('drag-over', !below);
      tr.classList.toggle('drag-over-below', below);
    });
    tr.addEventListener('dragleave', () => tr.classList.remove('drag-over', 'drag-over-below'));
    tr.addEventListener('drop', (e) => {
      e.preventDefault();
      const below = tr.classList.contains('drag-over-below');
      tr.classList.remove('drag-over', 'drag-over-below');
      if (dragId && tr.dataset.id !== dragId) onMove(dragId, tr.dataset.id, below);
      dragId = null;
    });
  });
}

function viewPlaylistDetail(root, state, plId) {
  const pl = state.playlists.find((p) => p.id === plId);
  if (!pl) { root.innerHTML = head('歌单', ''); return; }
  const tracks = pl.trackIds.map((id) => state.trackById(id)).filter(Boolean);
  root.innerHTML = `<button class="back-link" data-nav="__playlists">← 返回歌单</button>
    <div class="view-head">
      <h1>🎵 ${esc(pl.name)}</h1><span class="count">${tracks.length} 首</span>
      <div class="view-actions">
        ${ACTIONS_PLAY_ALL}
        <button class="btn" id="btn-rename-pl">重命名</button>
        <button class="btn danger" id="btn-del-pl">删除歌单</button>
      </div>
    </div>
    ${tracks.length ? trackTable(tracks, state.playingId) : `<div class="empty"><img class="empty-art small" src="./assets/empty-music.png" alt="" draggable="false"><div class="empty-title">歌单还是空的</div><div class="empty-sub">在歌曲上右键 → 添加到歌单</div></div>`}`;
  bindTable(root, state, tracks, plId);
  setupIncrementalList(root, state, tracks, plId);
  if (tracks.length > 1) bindDragReorder(root, (f, t, b) => state.reorderPlaylist(pl, f, t, b));
  bindBack(root, state);
  root.querySelector('#btn-play-all')?.addEventListener('click', () => state.playAll(tracks));
  root.querySelector('#btn-rename-pl')?.addEventListener('click', () => state.renamePlaylist(pl));
  root.querySelector('#btn-del-pl')?.addEventListener('click', () => state.deletePlaylist(pl));
}

// ---------- 绑定 ----------
function bindBack(root, state) {
  root.querySelector('.back-link')?.addEventListener('click', (e) => {
    const nav = e.currentTarget.dataset.nav;
    if (nav === '__playlists') state.navigate('__playlists');
    else state.navigate(nav);
  });
}

function bindCards(root, state) {
  root.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.card-play')) return;
      state.navigate(el.dataset.nav, { value: el.dataset.value });
    });
  });
  root.querySelectorAll('.card-play').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const holder = el.closest('[data-nav]');
      const { nav, value } = holder.dataset;
      const kind = nav === 'artists' ? 'artist' : nav === 'albums' ? 'album' : nav === 'genres' ? 'genre' : 'year';
      const tracks = state.tracks.filter((t) => {
        if (kind === 'artist') return (t.albumArtist || t.artist || '未知艺术家') === value;
        if (kind === 'album') return (t.album || '未知专辑') === value;
        if (kind === 'genre') return (t.genre || '未知流派') === value;
        return (t.year ? String(t.year) : '未知年代') === value;
      });
      state.playAll(sortDefault(tracks));
    });
  });
}

export function bindTable(root, state, tracks, playlistId = null) {
  root.querySelectorAll('tr[data-id]').forEach((tr) => bindTableRow(tr, state, tracks, playlistId));
  root.querySelectorAll('.act-queue').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = tracks.find((x) => x.id === btn.dataset.id);
      if (t) state.enqueue(t);
    });
  });
  root.querySelectorAll('.act-menu').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = tracks.find((x) => x.id === btn.dataset.id);
      if (t) state.showTrackMenu(e, tracks.find((x) => x.id === btn.dataset.id), playlistId);
    });
  });
}

// 单行绑定(增量追加行复用;队列/收藏等视图需要 playFromList 上下文)
export function bindTableRow(tr, state, tracks, playlistId = null, playFn = null) {
  const id = tr.dataset.id;
  tr.addEventListener('click', (e) => {
    if (e.target.closest('.t-actions') || e.target.closest('.t-artist') || e.target.closest('.t-album')) return;
    const idx = tracks.findIndex((t) => t.id === id);
    if (idx >= 0) (playFn || state.playFromList)(tracks, idx);
  });
  tr.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    state.showTrackMenu(e, tracks.find((t) => t.id === id), playlistId);
  });
  tr.querySelector('.t-artist')?.addEventListener('click', () => state.navigate('artists', { value: tr.querySelector('.t-artist').dataset.artist }));
  tr.querySelector('.t-album')?.addEventListener('click', () => state.navigate('albums', { value: tr.querySelector('.t-album').dataset.album }));
}

// 封面加载失败 → 按名称着色的占位卡(error 事件不冒泡,捕获阶段统一委托)
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img && img.tagName === 'IMG' && img.classList.contains('card-art') && img.dataset.ph) {
    const div = document.createElement('div');
    div.className = 'card-art placeholder ' + (img.dataset.phc || 'ph-0');
    div.textContent = img.dataset.ph;
    img.replaceWith(div);
  }
}, true);

// ---------------- Home 大屏首页(原版 hero 语言) ----------------
export function renderHome(root, state) {
  const player = state.player;
  const cur = player.current;
  const playing = player.playing;
  const cover = cur ? coverUrl(cur) || './assets/default-cover.png' : './assets/default-cover.png';
  const albumTiles = [...state.tracks]
    .sort((a, b) => b.addedAt - a.addedAt)
    .filter((t, i, arr) => arr.findIndex((x) => x.album === t.album) === i)
    .slice(0, 4);

  root.innerHTML = `
    <div class="home-hero">
      <div class="home-hero-inner">
        <div class="home-kicker">MINERADIO PRO · ${playing ? 'NOW PLAYING' : 'MUSIC LIBRARY'}</div>
        <div class="home-title" title="${esc(cur?.title || '')}">${esc(cur?.title || '欢迎回来')}</div>
        <div class="home-sub">${cur
          ? `${esc(cur.artist)} · ${esc(cur.album)}`
          : `曲库共 ${state.tracks.length} 首 · 从下面开始你的音乐`}</div>
        <div class="home-quick-row">
          <button class="home-quick" id="hm-toggle">
            <svg viewBox="0 0 24 24" class="ico">${playing
              ? '<rect x="6" y="4" width="4.5" height="16" rx="1.2"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.2"/>'
              : '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>'}</svg>
            ${playing ? '暂停' : '继续播放'}
          </button>
          <button class="home-quick" id="hm-random">
            <svg viewBox="0 0 24 24" class="ico"><path d="M16 3h5v5M21 3l-7.5 7.5M8 21H3v-5M3 21l7.5-7.5M16 21h5v-5M21 21l-6-6M3 3l6 6"/></svg>
            随机一首
          </button>
          <button class="home-quick" id="hm-recent">
            <svg viewBox="0 0 24 24" class="ico"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
            最近播放
          </button>
          <button class="home-quick" id="hm-lyrics">
            <svg viewBox="0 0 24 24" class="ico"><path d="M4 5h16M4 10h16M4 15h10M4 20h7"/></svg>
            歌词
          </button>
          <button class="home-quick" id="hm-cmdk">
            <svg viewBox="0 0 24 24" class="ico"><path d="M4 17l6-6-6-6M12 19h8"/></svg>
            命令面板 Ctrl+K
          </button>
        </div>
        <div class="home-visual ${playing ? "" : "drift"}">
          <img class="home-disc ${playing ? 'spinning' : ''}" id="hm-disc" src="${cover}" onerror="this.src='./assets/default-cover.png'" draggable="false">
          <div class="home-eq ${playing ? 'live' : ''}" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
          <canvas class="home-wave" id="home-spectrum" width="480" height="128" aria-hidden="true"></canvas>
        </div>
      </div>
    </div>
    ${albumTiles.length ? `
    <div class="home-section-head"><h2>最近添加的专辑</h2><span class="count">${albumTiles.length}</span>
      <button class="link" id="hm-more">查看全部 →</button></div>
    <div class="home-mosaic">
      ${albumTiles.map((t, i) => {
        const cover2 = coverUrl(t) || './assets/default-cover.png';
        const big = i < 2;
        return `<div class="home-tile float" data-album="${esc(t.album)}">
          <img src="${cover2}" loading="lazy" alt="" draggable="false">
          ${big ? `<div class="tile-sub">${esc(t.artist)}</div><div class="tile-label">${esc(t.album)}</div>` : ''}
        </div>`;
      }).join('')}
    </div>` : ''}`;

  root.querySelector('#hm-toggle')?.addEventListener('click', () => player.toggle());
  root.querySelector('#hm-random')?.addEventListener('click', () => {
    if (state.tracks.length) {
      const i = Math.floor(Math.random() * state.tracks.length);
      state.playFromList(state.tracks, i);
    }
  });
  root.querySelector('#hm-recent')?.addEventListener('click', () => state.navigate('recent-played'));
  root.querySelector('#hm-lyrics')?.addEventListener('click', () => {
    if (player.current) state.navigate('library').then ? null : null;
    document.getElementById('pb-lyrics').click();
  });
  root.querySelector('#hm-cmdk')?.addEventListener('click', () => window.__openCmdK?.());
  root.querySelector('#hm-more')?.addEventListener('click', () => state.navigate('albums'));
  root.querySelectorAll('.home-tile').forEach((tile) => {
    tile.addEventListener('click', () => state.navigate('albums', { value: tile.dataset.album }));
  });
}

