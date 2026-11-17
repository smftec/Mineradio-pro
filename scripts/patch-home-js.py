# v1.9.0 补丁:Home 视图渲染 + 命令面板
import io

# ---- views.js: renderHome ----
p = 'public/js/views.js'
s = io.open(p, encoding='utf-8').read()

home_fn = """
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
        <div class="home-visual">
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
        return `<div class="home-tile" data-album="${esc(t.album)}">
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

"""
s = s.replace("""// ---------------- 播放队列视图 ----------------""", home_fn + """// ---------------- 播放队列视图 ----------------""") if '播放队列视图' in s else s
# 播放队列视图在 app.js — 直接把 renderHome 加到 views.js 末尾
if 'export function renderHome' not in s:
    s += home_fn
io.open(p, 'w', encoding='utf-8').write(s)
print('views renderHome OK')

# ---- index.html:导航加"首页" ----
p = 'public/index.html'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""        <nav>
          <div class="nav-group">
            <button class="nav-item active" data-view="library">""",
"""        <nav>
          <div class="nav-group">
            <button class="nav-item" data-view="home">
              <svg viewBox="0 0 24 24" class="ico"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>
              <span>首页</span>
            </button>
            <button class="nav-item" data-view="library">""")
io.open(p, 'w', encoding='utf-8').write(s)
print('nav home OK')
