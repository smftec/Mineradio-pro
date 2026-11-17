# v1.9.0 app.js:home 分支 + 频谱管理 + 命令面板
import io
p = 'public/js/app.js'
s = io.open(p, encoding='utf-8').read()

s = s.replace("import { renderView, bindTable, bindDragReorder, EQ_BARS, trackTable, ACTIONS_PLAY_ALL } from './views.js';",
              "import { renderView, renderHome, bindTable, bindDragReorder, EQ_BARS, trackTable, ACTIONS_PLAY_ALL } from './views.js';")

# render():home 分支 + 频谱注册管理
s = s.replace("""  render() {
    const root = document.getElementById('view-root');
    if (this.view === 'settings') {
      renderSettings(root, this);
      $('pb-queue').classList.remove('active');
    } else if (this.view === 'queue') {
      renderQueueView(root);
      $('pb-queue').classList.add('active');
    } else if (this.view === 'favorites') {
      renderFavoritesView(root);
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
  },""",
"""  render() {
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
      this._homeUnreg = registerSpectrum(document.getElementById('home-spectrum'), { bars: 64 });
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
  },""")

# boot 默认视图 home
s = s.replace("""  state.navigate('library');
  registerSpectrum(document.getElementById('pb-spectrum'), { bars: 22 });""",
"""  state.navigate('home');
  registerSpectrum(document.getElementById('pb-spectrum'), { bars: 22 });""")

# ---- 命令面板 ----
s = s.replace("""// ---------------- 列表键盘导航(↑↓ 移动,Enter 播放) ----------------""",
"""// ---------------- 命令面板(Ctrl+K) ----------------
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

// ---------------- 列表键盘导航(↑↓ 移动,Enter 播放) ----------------""")

# Ctrl+K 打开命令面板(替换聚焦搜索)
s = s.replace("""    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      search.focus();
      search.select();
      return;
    }""",
"""    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCmdK();
      return;
    }""")

io.open(p, 'w', encoding='utf-8').write(s)
print('app.js home + cmdk OK')
