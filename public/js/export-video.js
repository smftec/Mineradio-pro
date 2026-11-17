// 视频导出:可视化 + 当前歌词行 + 音频 → WebM(MediaRecorder)
// 绑定 window.__exportVideo(lyricsViewInstance) 由歌词视图调用
import { player } from './player.js';
import { VISUAL_MODES, registerVisualizer } from './visual-modes.js';
import { toast, api } from './api.js';

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

  const stop = (auto) => {
    cancelAnimationFrame(raf);
    unregTrack?.();
    try { if (rec.state !== 'inactive') rec.stop(); } catch {}
  };
  // 曲目结束/切歌自动停止
  let unregTrack = null;
  const onTrackEnd = () => setTimeout(() => stop(true), 300);
  unregTrack = player.on('track', onTrackEnd);
  rec.onstop = async () => {
    exporting = false;
    const blob = new Blob(chunks, { type: mime || 'video/webm' });
    console.log('[export] stopped. chunks:', chunks.length, 'blob size:', blob.size, 'mime:', mime || 'default');
    if (!blob.size) { toast('录制内容为空,导出失败', 4000); return; }
    // blob → dataURL → 主进程直接写入下载目录(绕过 <a download> 的不确定性)
    const dataUrl = await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.readAsDataURL(blob);
    });
    const b64 = dataUrl.split(',')[1] || '';
    const filename = `Mineradio-${track.title || 'video'}-${new Date().toISOString().slice(0, 10)}.webm`;
    const r = await api.invoke('export:saveVideo', b64, filename);
    toast(r.ok ? `视频已保存:${r.path}` : `导出失败:${r.reason}`, 6000, r.ok ? 'success' : null);
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
