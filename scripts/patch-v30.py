# v3.0.0 补丁:艺术家详情专辑分区 + 详情 hero 沉浸式模糊背景
import io

p = 'public/js/views.js'
s = io.open(p, encoding='utf-8').read()

# ---- 1. viewGroupDetail 重构:artist 加专辑分区;hero 加沉浸式模糊背景 ----
old = """  const heroLabel = { artist: '艺术家', album: '专辑', genre: '流派', year: '年代' }[kind] || '';
  root.innerHTML = `<button class="back-link" data-nav="${backView}">← 返回${heroLabel}</button>
    <div class="detail-hero">
      <div class="dh-art ${withArt ? '' : phClass(value)}">${withArt
        ? `<img src="${coverUrl(withArt)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'dh-art-fallback',textContent:'♪'}))">`
        : esc((value || '♪')[0].toUpperCase())}</div>
      <div class="dh-meta">
        <div class="dh-kind">${heroLabel}</div>
        <h1 class="dh-title">${esc(value)}</h1>
        <div class="dh-sub">${esc(metaBits.join(' · '))}</div>
        <div class="dh-actions">
          <button class="btn primary" id="btn-play-all"><svg viewBox="0 0 24 24" class="ico"><path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/></svg>播放全部</button>
          <button class="btn" id="btn-shuffle-all"><svg viewBox="0 0 24 24" class="ico"><path d="M16 3h5v5M21 3l-7.5 7.5M8 21H3v-5M3 21l7.5-7.5M16 21h5v-5M21 21l-6-6M3 3l6 6"/></svg>随机播放</button>
        </div>
      </div>
    </div>
    ${trackTable(sorted, state.playingId)}`;
  bindTable(root, state, sorted);
  setupIncrementalList(root, state, sorted);
  bindBack(root, state);
  root.querySelector('#btn-play-all')?.addEventListener('click', () => state.playAll(sorted));
  root.querySelector('#btn-shuffle-all')?.addEventListener('click', () => {
    if (sorted.length) state.playFromList(sorted, Math.floor(Math.random() * sorted.length));
  });
}"""
assert old in s, 'detail anchor'
s = s.replace(old, """  const heroLabel = { artist: '艺术家', album: '专辑', genre: '流派', year: '年代' }[kind] || '';
  // 艺术家详情:专辑分区(信息架构对标原版)
  const albumSection = kind === 'artist' ? (() => {
    const seen = new Map();
    for (const t of sorted) {
      const key = t.album || '未知专辑';
      if (!seen.has(key)) seen.set(key, t);
    }
    const albums = [...seen.entries()];
    if (albums.length < 2) return ''; // 单专辑不需要分区
    return `<div class="dh-albums-head">专辑 <span class="count">${albums.length}</span></div>
      <div class="grid">${albums.map(([name, t]) => {
        const attr = `data-nav="albums" data-value="${esc(name)}"`;
        return groupCard(name, `${sorted.filter((x) => (x.album || '未知专辑') === name).length} 首`,
          [t], 'albums');
      }).join('')}</div>
      <div class="dh-albums-head songs">歌曲 <span class="count">${sorted.length}</span></div>`;
  })() : '';
  root.innerHTML = `<button class="back-link" data-nav="${backView}">← 返回${heroLabel}</button>
    <div class="detail-hero">
      <div class="dh-blur" style="background-image:url('${withArt ? coverUrl(withArt) : ''}')"></div>
      <div class="dh-veil"></div>
      <div class="dh-art ${withArt ? '' : phClass(value)}">${withArt
        ? `<img src="${coverUrl(withArt)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'dh-art-fallback',textContent:'♪'}))">`
        : esc((value || '♪')[0].toUpperCase())}</div>
      <div class="dh-meta">
        <div class="dh-kind">${heroLabel}</div>
        <h1 class="dh-title">${esc(value)}</h1>
        <div class="dh-sub">${esc(metaBits.join(' · '))}</div>
        <div class="dh-actions">
          <button class="btn primary" id="btn-play-all"><svg viewBox="0 0 24 24" class="ico"><path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/></svg>播放全部</button>
          <button class="btn" id="btn-shuffle-all"><svg viewBox="0 0 24 24" class="ico"><path d="M16 3h5v5M21 3l-7.5 7.5M8 21H3v-5M3 21l7.5-7.5M16 21h5v-5M21 21l-6-6M3 3l6 6"/></svg>随机播放</button>
        </div>
      </div>
    </div>
    ${albumSection}
    ${trackTable(sorted, state.playingId)}`;
  bindTable(root, state, sorted);
  setupIncrementalList(root, state, sorted);
  bindBack(root, state);
  root.querySelector('#btn-play-all')?.addEventListener('click', () => state.playAll(sorted));
  root.querySelector('#btn-shuffle-all')?.addEventListener('click', () => {
    if (sorted.length) state.playFromList(sorted, Math.floor(Math.random() * sorted.length));
  });
  // 艺术家页专辑卡导航(bindCards 的通用绑定无法覆盖动态插入,此处单独绑)
  root.querySelectorAll('.dh-albums-head + .grid [data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.card-play')) return;
      state.navigate(el.dataset.nav, { value: el.dataset.value });
    });
  });
}""")
io.open(p, 'w', encoding='utf-8').write(s)
print('artist albums section OK')

# ---- CSS:dh-blur 沉浸背景 + dh-albums-head ----
p = 'public/css/app.css'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""/* 详情 hero 头部(专辑/艺术家/流派/年代) */""",
"""/* 详情 hero 头部(专辑/艺术家/流派/年代)— 沉浸式模糊背景 */
.detail-hero { position: relative; overflow: hidden; }
.dh-blur {
  position: absolute; inset: -60px; z-index: 0;
  background-size: cover; background-position: center 30%;
  filter: blur(70px) saturate(1.5) brightness(.5);
  opacity: .6;
}
.dh-veil { position: absolute; inset: 0; z-index: 1; background: rgba(8, 10, 18, .38); }
[data-theme="light"] .dh-veil { background: rgba(244, 245, 250, .5); }
.detail-hero .dh-art, .detail-hero .dh-meta { position: relative; z-index: 2; }
.dh-albums-head {
  font-size: 15px; font-weight: 700; margin: 26px 0 14px;
  color: var(--text);
}
.dh-albums-head .count { color: var(--faint); font-size: 12.5px; font-weight: 500; margin-left: 8px; }
.dh-albums-head.songs { margin-top: 30px; }

/* 唱片墙(CSS 3D 封面墙) */""")
io.open(p, 'w', encoding='utf-8').write(s)
print('css OK')
