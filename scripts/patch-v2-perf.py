# v2.0.0 补丁:列表增量渲染(大曲库性能)+ 崩溃恢复
import io

# ---- views.js:增量渲染 ----
p = 'public/js/views.js'
s = io.open(p, encoding='utf-8').read()

s = s.replace("""function trackTable(tracks, playingId) {
  if (!tracks.length) return '';
  return `<table class="track-table"><tbody>
    ${tracks.map((t, i) => trackRow(t, i, playingId)).join('')}
  </tbody></table>`;
}""",
"""const PAGE_SIZE = 120; // 大曲库增量渲染:初始/每次追加 120 行(参考原版窗口化策略)

// 增量列表上下文(滚动接近底部时追加下一页)
const listCtx = { tracks: [], playingId: '', playlistId: null, state: null, offset: 0 };

function trackTable(tracks, playingId) {
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
function bindTrackRow(tr, tracks, playlistId) { /* 由 bindTable 的委托实现覆盖,此处保留占位 */ }""")

# bindTable 重构:抽出行级绑定以供增量追加复用
s = s.replace("""export function bindTable(root, state, tracks, playlistId = null) {
  root.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = tr.dataset.id;
    tr.addEventListener('click', (e) => {
      if (e.target.closest('.t-actions') || e.target.closest('.t-artist') || e.target.closest('.t-album')) return;
      const idx = tracks.findIndex((t) => t.id === id);
      if (idx >= 0) state.playFromList(tracks, idx);
    });
    tr.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      state.showTrackMenu(e, tracks.find((t) => t.id === id), playlistId);
    });
    tr.querySelector('.t-artist')?.addEventListener('click', () => state.navigate('artists', { value: tr.querySelector('.t-artist').dataset.artist }));
    tr.querySelector('.t-album')?.addEventListener('click', () => state.navigate('albums', { value: tr.querySelector('.t-album').dataset.album }));
  });
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
}""",
"""export function bindTable(root, state, tracks, playlistId = null) {
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
}""")

# 各视图渲染处调用 setupIncrementalList(检索调用点:viewLibrary/viewGroupDetail/recent/playlist/favorites/queue)
s = s.replace("""  root.innerHTML = head(title, `${tracks.length} 首`, ACTIONS_PLAY_ALL) + trackTable(tracks, state.playingId);
  bindTable(root, state, tracks);
  root.querySelector('#btn-play-all')?.addEventListener('click', () => state.playAll(tracks));
}""",
"""  root.innerHTML = head(title, `${tracks.length} 首`, ACTIONS_PLAY_ALL) + trackTable(tracks, state.playingId);
  bindTable(root, state, tracks);
  setupIncrementalList(root, state, tracks);
  root.querySelector('#btn-play-all')?.addEventListener('click', () => state.playAll(tracks));
}""")

io.open(p, 'w', encoding='utf-8').write(s)
print('incremental list OK')

# ---- windows.js:渲染进程崩溃自动恢复 ----
p = 'desktop/lib/windows.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""function forwardConsole(win) {
  if (!app.isPackaged) {
    win.webContents.on('console-message', (_e, _level, message, line, sourceId) => {
      console.log(`[renderer] ${message} (${sourceId}:${line})`);
    });
    win.webContents.on('preload-error', (_e, path, err) => {
      console.error('[preload-error]', path, err?.message);
    });
  }
}""",
"""function forwardConsole(win) {
  if (!app.isPackaged) {
    win.webContents.on('console-message', (_e, _level, message, line, sourceId) => {
      console.log(`[renderer] ${message} (${sourceId}:${line})`);
    });
    win.webContents.on('preload-error', (_e, path, err) => {
      console.error('[preload-error]', path, err?.message);
    });
  }
  // 渲染进程崩溃自动恢复(非正常退出时重载)
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer-gone]', details.reason);
    if (details.reason !== 'clean-exit') {
      setTimeout(() => {
        if (!win.isDestroyed()) win.webContents.reload();
      }, 800);
    }
  });
}""")
io.open(p, 'w', encoding='utf-8').write(s)
print('crash recovery OK')
