# v2.9.0 补丁:专辑/艺术家详情 hero 头部(views.js)+ 队列结构(app.js)
import io

# ---- 1. views.js: viewGroupDetail hero ----
p = 'public/js/views.js'
s = io.open(p, encoding='utf-8').read()
old = """function viewGroupDetail(root, state, kind, value) {
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
}"""
assert old in s, 'detail anchor'
s = s.replace(old, """function viewGroupDetail(root, state, kind, value) {
  const tracks = state.tracks.filter((t) => {
    if (kind === 'artist') return (t.albumArtist || t.artist || '未知艺术家') === value;
    if (kind === 'album') return (t.album || '未知专辑') === value;
    if (kind === 'genre') return (t.genre || '未知流派') === value;
    return (t.year ? String(t.year) : '未知年代') === value;
  });
  const sorted = kind === 'album' ? sortDefault(tracks) : [...tracks].sort((a, b) => (a.album || '').localeCompare(b.album || '', 'zh') || (a.trackNo || 0) - (b.trackNo || 0));
  const backView = kind === 'artist' ? 'artists' : kind === 'album' ? 'albums' : kind === 'genre' ? 'genres' : 'years';
  // hero 头部(专辑/艺术家/流派/年代通用)
  const withArt = sorted.find((t) => t.cover);
  const totalSec = Math.round(sorted.reduce((a, t) => a + (t.duration || 0), 0));
  const metaBits = [];
  if (kind !== 'artist') {
    const artists = [...new Set(sorted.map((t) => t.albumArtist || t.artist).filter(Boolean))];
    metaBits.push(artists.join(' / '));
  } else {
    const albums = [...new Set(sorted.map((t) => t.album).filter(Boolean))];
    if (albums.length > 1) metaBits.push(albums.length + ' 张专辑');
  }
  metaBits.push(sorted.length + ' 首');
  if (totalSec > 0) metaBits.push('总时长 ' + fmtTime(totalSec));
  const heroLabel = { artist: '艺术家', album: '专辑', genre: '流派', year: '年代' }[kind] || '';
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
}""")
io.open(p, 'w', encoding='utf-8').write(s)
print('views hero OK')

# ---- 2. app.js: 队列结构 ----
p = 'public/js/app.js'
s = io.open(p, encoding='utf-8').read()
old = """  root.innerHTML = `<div class="view-head"><h1>播放队列</h1><span class="count">${player.queue.length} 首</span>
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
    </tbody></table>`;"""
assert old in s, 'queue anchor'
s = s.replace(old, """  const curIdx = player.queue.findIndex((t) => t.id === state.playingId);
  const nowT = curIdx >= 0 ? player.queue[curIdx] : null;
  const upcoming = player.queue.map((t, i) => ({ t, i })).filter(({ i }) => i !== curIdx);
  const qRow = ({ t, i }, isNow) => `<tr data-id="${t.id}" class="${isNow ? 'playing' : ''}">
        <td class="t-num">${isNow ? EQ_BARS : i + 1}</td>
        <td style="max-width:340px"><div class="t-title-cell">
          <img class="t-cover" src="${thumbUrl(t) || './assets/default-cover.png'}" loading="lazy" alt="" onerror="this.src='./assets/default-cover.png'">
          <div style="min-width:0"><div class="t-title">${esc(t.title)}</div></div>
        </div></td>
        <td class="t-artist">${esc(t.artist)}</td>
        <td class="t-dur">${fmtTime(t.duration)}</td>
        <td class="t-actions"><button class="pb-iconbtn q-rm" data-i="${i}" title="从队列移除">✕</button></td>
      </tr>`;
  root.innerHTML = `<div class="view-head"><h1>播放队列</h1><span class="count">${player.queue.length} 首</span>
    <div class="view-actions"><button class="btn" id="q-clear">清空(保留当前)</button></div></div>
    ${nowT ? `<div class="q-now-label">现在播放</div>
    <table class="track-table"><tbody>${qRow({ t: nowT, i: curIdx }, true)}</tbody></table>
    <div class="q-now-label next">接下来</div>` : ''}
    <table class="track-table"><tbody>
      ${upcoming.map(({ t, i }) => qRow({ t, i }, false)).join('')}
    </tbody></table>`;""")
# thumbUrl import
s = s.replace("import { api, coverUrl, thumbUrl, fmtTime, esc, toast } from './api.js';" if "thumbUrl" in s else "import { api, coverUrl, fmtTime, esc, toast } from './api.js';",
              "import { api, coverUrl, thumbUrl, fmtTime, esc, toast } from './api.js';")
io.open(p, 'w', encoding='utf-8').write(s)
print('queue structure OK')
