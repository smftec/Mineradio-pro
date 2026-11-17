// 实时频谱可视化:共享 player 的 AnalyserNode,rAF 统一绘制
import { player } from './player.js';

const registries = new Set();

export function registerSpectrum(canvas, { bars = 24 } = {}) {
  if (!canvas) return () => {};
  const entry = { canvas, c2d: canvas.getContext('2d'), bars };
  registries.add(entry);
  return () => registries.delete(entry);
}

function roundRect(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
  c.fill();
}

function frame() {
  const spec = player.getSpectrum();
  for (const r of registries) {
    if (r.canvas.id === 'pb-spectrum' && window.__lyricsOverlay) continue;
    if (!r.canvas.isConnected) continue;
    const { canvas, c2d, bars } = r;
    const w = canvas.width, h = canvas.height;
    c2d.clearRect(0, 0, w, h);
    if (!spec) continue;
    const usable = Math.floor(spec.length * 0.62); // 高频段几乎无声,忽略
    const gap = 3;
    const bw = (w - gap * (bars - 1)) / bars;
    const grad = c2d.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, 'rgba(124, 92, 255, .95)');
    grad.addColorStop(1, 'rgba(53, 224, 255, .95)');
    c2d.fillStyle = grad;
    for (let i = 0; i < bars; i++) {
      // 对数频率分段(贴合听感)
      const start = Math.floor(Math.pow(i / bars, 1.6) * usable);
      const end = Math.max(start + 1, Math.floor(Math.pow((i + 1) / bars, 1.6) * usable));
      let peak = 0;
      for (let j = start; j < end && j < usable; j++) peak = Math.max(peak, spec[j]);
      const v = Math.pow(peak / 255, 1.15);
      if (v < 0.015) continue; // 静音柱不绘制
      const bh = Math.max(3, v * (h - 5));
      roundRect(c2d, i * (bw + gap), h - bh, bw, bh, 2.5);
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
