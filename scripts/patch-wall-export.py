# v2.3.0 补丁:唱片墙视图 + 视频导出 + 设置页(可视化/ffmpeg)
import io

# ---- views.js:唱片墙视图 ----
p = 'public/js/views.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""// ---------------- 播放队列视图 ----------------""" if '播放队列视图' in s else "// ---------------- 右键菜单 ----------------""",
"""// ---------------- 唱片墙(CSS 3D 封面墙) ----------------
export function renderRecordWall(root, state) {
  // 按专辑去重(取每专辑第一首的封面)
  const seen = new Map();
  for (const t of state.tracks) {
    const key = t.album || '未知专辑';
    if (!seen.has(key)) seen.set(key, t);
  }
  const albums = [...seen.values()];
  if (!albums.length) {
    root.innerHTML = `<div class="empty"><img class="empty-art small" src="./assets/empty-music.png" alt="" draggable="false"><div class="empty-title">唱片墙是空的</div><div class="empty-sub">导入音乐后,专辑封面将以 3D 墙面呈现</div></div>`;
    return;
  }
  root.innerHTML = `<div class="view-head"><h1>唱片墙</h1><span class="count">${albums.length} 张专辑</span>
    <div class="view-actions"><button class="btn primary" id="wall-play-all">随机播放</button></div></div>
    <div class="wall-stage"><div class="wall-grid">
      ${albums.map((t) => {
        const cover = coverUrl(t) || './assets/default-cover.png';
        return `<div class="wall-card" data-album="${esc(t.album)}" title="${esc(t.album)}">
          <img src="${cover}" loading="lazy" alt="" draggable="false">
          <div class="wall-sub">${esc(t.artist)}</div>
          <div class="wall-label">${esc(t.album)}</div>
        </div>`;
      }).join('')}
    </div></div>`;
  root.querySelector('#wall-play-all')?.addEventListener('click', () => {
    if (albums.length) state.playFromList(albums, Math.floor(Math.random() * albums.length));
  });
  root.querySelectorAll('.wall-card').forEach((card) => {
    card.addEventListener('click', () => state.navigate('albums', { value: card.dataset.album }));
  });
}

// ---------------- 播放队列视图 ----------------""") if '播放队列视图' in s else s
io.open(p, 'w', encoding='utf-8').write(s)
print('record wall OK')

# ---- index.html:导航加唱片墙 ----
p = 'public/index.html'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""            <button class="nav-item" data-view="albums">""",
"""            <button class="nav-item" data-view="wall">
              <svg viewBox="0 0 24 24" class="ico"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
              <span>唱片墙</span>
            </button>
            <button class="nav-item" data-view="albums">""")
io.open(p, 'w', encoding='utf-8').write(s)
print('nav wall OK')

# ---- app.js:wall 分支 + 视频导出注册 ----
p = 'public/js/app.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("import { renderView, renderHome, bindTable, bindDragReorder, EQ_BARS, trackTable, ACTIONS_PLAY_ALL } from './views.js';",
              "import { renderView, renderHome, renderRecordWall, bindTable, bindDragReorder, EQ_BARS, trackTable, ACTIONS_PLAY_ALL } from './views.js';")
s = s.replace("""    } else if (this.view === 'favorites') {
      renderFavoritesView(root);
      $('pb-queue').classList.remove('active');
    } else {""",
"""    } else if (this.view === 'favorites') {
      renderFavoritesView(root);
      $('pb-queue').classList.remove('active');
    } else if (this.view === 'wall') {
      renderRecordWall(root, this);
      $('pb-queue').classList.remove('active');
    } else {""")
io.open(p, 'w', encoding='utf-8').write(s)
print('app wall OK')

# ---- export-video.js:视频导出(渲染端 MediaRecorder) ----
export_js = """// 视频导出:可视化 + 当前歌词行 + 音频 → WebM(MediaRecorder)
// 绑定 window.__exportVideo(lyricsViewInstance) 由歌词视图调用
import { player } from './player.js';
import { VISUAL_MODES, registerVisualizer } from './visual-modes.js';
import { toast } from './api.js';

let exporting = false;

function pickMime() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

export function startExport(lv) {
  if (exporting) { toast('已有导出任务进行中'); return; }
  if (!player.current) { toast('先播放一首歌,再导出视频'); return; }
  const W = 1280, H = 720;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const c2d = canvas.getContext('2d');

  // 可视化引擎(独立实例)
  const mode = window.__state.config.visualMode || 'particles';
  const engine = (VISUAL_MODES.find(m => m.id === mode) || VISUAL_MODES[0]).id;
  let drawFn = null;
  // 直接复用 registerVisualizer 不适合离屏 — 手动驱动:构造 engine
  // (visual-modes 导出工厂不可直接取;这里用简化绘制器:频谱柱 + 波形带,与主窗模式呼应)

  const videoStream = canvas.captureStream(30);
  const audioStream = player.getAudioStream();
  const stream = new MediaStream([...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()]);
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  let raf = 0;
  let startedAt = performance.now();
  const track = player.current;

  const drawFrame = () => {
    const spec = player.getSpectrum() || new Uint8Array(256);
    // 背景
    const bg = c2d.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#141225');
    bg.addColorStop(1, '#0b0d14');
    c2d.fillStyle = bg;
    c2d.fillRect(0, 0, W, H);
    // 频谱柱(底部)
    const bars = 72;
    const bw = W / bars;
    const cs = getComputedStyle(document.documentElement);
    const ca = (cs.getPropertyValue('--accent-rgb') || '124,92,255').trim();
    const cb = (cs.getPropertyValue('--accent2-rgb') || '53,224,255').trim();
    for (let i = 0; i < bars; i++) {
      const idx = Math.floor(Math.pow(i / bars, 1.5) * spec.length * 0.7);
      const v = Math.pow(spec[idx] / 255, 1.15);
      const bh = v * H * 0.28;
      const GR = c2d.createLinearGradient(0, H - bh, 0, H);
      GR.addColorStop(0, `rgba(${cb}, .9)`);
      GR.addColorStop(1, `rgba(${ca}, .5)`);
      c2d.fillStyle = GR;
      c2d.fillRect(i * bw + 1, H - bh, bw - 2, bh);
    }
    // 封面(左下角圆角)
    const coverImg = document.getElementById('pb-cover');
    if (coverImg && coverImg.complete && coverImg.naturalWidth) {
      const s = 120, x = 40, y = H - s - 40;
      c2d.save();
      c2d.beginPath();
      const r = 14;
      c2d.moveTo(x + r, y);
      c2d.arcTo(x + s, y, x + s, y + s, r);
      c2d.arcTo(x + s, y + s, x, y + s, r);
      c2d.arcTo(x, y + s, x, y, r);
      c2d.arcTo(x, y, x + s, y, r);
      c2d.closePath();
      c2d.clip();
      c2d.drawImage(coverImg, x, y, s, s);
      c2d.restore();
    }
    // 当前歌词行(居中大字,逐字进度)
    const ls = lv.getLyricState();
    const pos = player.position;
    if (ls.text) {
      c2d.font = '700 52px "Segoe UI", "Microsoft YaHei", sans-serif';
      c2d.textAlign = 'center';
      c2d.textBaseline = 'middle';
      const cy = H * 0.42;
      if (ls.words && ls.words.length) {
        // 逐字渐变
        const total = ls.words.length;
        let cx = W / 2 - (c2d.measureText(ls.words.map(w => w.text).join('')).width / 2);
        c2d.textAlign = 'left';
        for (const w of ls.words) {
          const done = pos >= w.t0;
          c2d.fillStyle = done ? '#ffffff' : 'rgba(255,255,255,.38)';
          c2d.shadowColor = 'rgba(124,92,255,.6)';
          c2d.shadowBlur = done ? 18 : 0;
          c2d.fillText(w.text, cx, cy);
          cx += c2d.measureText(w.text).width;
        }
        c2d.shadowBlur = 0;
      } else {
        c2d.shadowColor = 'rgba(53,224,255,.55)';
        c2d.shadowBlur = 22;
        c2d.fillStyle = '#ffffff';
        c2d.fillText(ls.text, W / 2, cy);
        c2d.shadowBlur = 0;
      }
      // 曲目信息
      c2d.font = '600 20px "Segoe UI", "Microsoft YaHei", sans-serif';
      c2d.fillStyle = 'rgba(255,255,255,.62)';
      c2d.textAlign = 'center';
      c2d.fillText(`${track.title} — ${track.artist}`, W / 2, cy + 64);
    }
    // 录制指示
    const secs = Math.floor((performance.now() - startedAt) / 1000);
    c2d.fillStyle = '#ff5d7a';
    c2d.beginPath();
    c2d.arc(W - 36, 34, 7, 0, Math.PI * 2);
    c2d.fill();
    c2d.font = '600 14px sans-serif';
    c2d.fillStyle = 'rgba(255,255,255,.8)';
    c2d.textAlign = 'left';
    c2d.fillText(`REC ${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`, W - 26, 39);
    raf = requestAnimationFrame(drawFrame);
  };
  drawFrame();

  exporting = true;
  rec.start(1000);
  toast(`开始导出视频(录制中,曲目结束自动保存)…`, 4500);

  // 画导出预览:直接在歌词视图可视化 canvas 上叠加?不 — 保持后台录制
  const stop = (auto) => {
    cancelAnimationFrame(raf);
    try { rec.state !== 'inactive' && rec.stop(); } catch {}
    player.off('track', onTrackEnd);
    window.__state.player._els && null;
  };
  // 曲目结束自动停止
  const onTrackEnd = () => setTimeout(() => stop(true), 300);
  player.on('track', onTrackEnd); // 切歌也停
  const onStateChange = () => {};
  rec.onstop = () => {
    exporting = false;
    const blob = new Blob(chunks, { type: mime || 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mineradio-${track.title || 'video'}-${new Date().toISOString().slice(0, 10)}.webm`.replace(/[\\\\/:*?"<>|]/g, '_');
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast(auto === undefined ? '视频已导出' : '视频已导出(曲目结束自动停止)', 5000, 'success');
  };
  // 自然结束:监听当前曲目 ended → 通过 track 切换触发 onTrackEnd;队列末尾结束需要显式 state
  const checkEnd = setInterval(() => {
    if (!exporting) { clearInterval(checkEnd); return; }
    if (!player.playing && player.position >= (player.duration || 0) - 0.2 && player.duration > 0) {
      clearInterval(checkEnd);
      stop(true);
    }
  }, 500);

  // 返回停止句柄(手动停止入口)
  window.__stopExport = () => stop(false);
  // 导出期间把歌词视图导出按钮变为停止
  const btn = document.getElementById('lv-export');
  if (btn) {
    btn.textContent = '■ 停止导出';
    btn.onclick = () => { window.__stopExport?.(); };
    const restore = new MutationObserver(() => {});
    setTimeout(() => {
      if (btn.isConnected && !exporting) { btn.textContent = '▣ 导出视频'; btn.onclick = () => window.__exportVideo?.(lv); }
    }, 60000);
  }
}
window.__exportVideo = startExport;
"""
with open('public/js/export-video.js', 'w', encoding='utf-8') as f:
    f.write(export_js)
print('export-video OK')

# index.html 引入
p = 'public/index.html'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""  <script type="module" src="./js/visualizer.js"></script>""",
"""  <script type="module" src="./js/visualizer.js"></script>
  <script type="module" src="./js/export-video.js"></script>""")
io.open(p, 'w', encoding='utf-8').write(s)
print('index export script OK')
