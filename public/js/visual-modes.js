// 可视化引擎:三种 Canvas2D 视觉模式(频谱粒子 / 环形频谱 / 波形流动)
// 共享 player 的 AnalyserNode 数据;主题色跟随 CSS 变量实时联动
import { player } from './player.js';
import { SHADER_IDS } from './shaders.js';
export { SHADER_IDS };
import { ShaderEngine, attachEngine, webglAvailable } from './webgl-engine.js';

let glProbe = null;
function probeGL() {
  if (glProbe === null) {
    try { const test = new ShaderEngine(document.createElement('canvas')); glProbe = test.ok ? 'yes' : 'no'; }
    catch { glProbe = 'no'; }
  }
  return glProbe;
}

// 统一注册:shader id 走 WebGL,canvas2d 模式走原绘制器
export function registerVisual(canvas, { mode = 'particles' } = {}) {
  if (SHADER_IDS.includes(mode) && probeGL() === 'yes') {
    const engine = new ShaderEngine(canvas);
    if (engine.ok && engine.use(mode)) { engine.active = true; return attachEngine(engine); }
  }
  return registerVisualizer(canvas, { mode });
}

export const VISUAL_MODES = [
  { id: 'particles', name: '频谱粒子' },
  { id: 'ring', name: '环形频谱' },
  { id: 'wave', name: '波形流动' },
];

const runners = new Set();
let raf = 0;

function accentColors() {
  const cs = getComputedStyle(document.documentElement);
  const a = (cs.getPropertyValue('--accent-rgb') || '124,92,255').trim();
  const b = (cs.getPropertyValue('--accent2-rgb') || '53,224,255').trim();
  return { a, b, accent: `rgb(${a})`, accent2: `rgb(${b})` };
}

// 频谱能量摘要(低/中/高频均值 0~1)
function bands(spec) {
  const n = spec.length;
  const seg = (a, b) => {
    let s = 0;
    for (let i = a; i < b; i++) s += spec[i];
    return s / (b - a) / 255;
  };
  return { low: seg(0, n * 0.15), mid: seg(n * 0.15, n * 0.5), high: seg(n * 0.5, n * 0.8), all: seg(0, n * 0.8) };
}

// ---------- 模式一:频谱粒子 ----------
function makeParticles() {
  const parts = [];
  const MAX = 160;
  return {
    draw(c2d, w, h, spec, dt, colors) {
      const { low, mid, high, all } = bands(spec);
      // 补充粒子(能量驱动)
      if (parts.length < MAX && Math.random() < 0.3 + all * 0.7) {
        parts.push({
          x: Math.random() * w,
          y: h + 10,
          vx: (Math.random() - 0.5) * 30 * (0.4 + mid),
          vy: -(60 + Math.random() * 160) * (0.5 + low * 1.6),
          r: 1.5 + Math.random() * 3,
          life: 1,
          hue: Math.random() < 0.5 ? 'a' : 'b',
        });
      }
      c2d.clearRect(0, 0, w, h);
      // 底部频谱柱
      const bars = 48;
      const bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const idx = Math.floor(Math.pow(i / bars, 1.5) * spec.length * 0.7);
        const v = Math.pow(spec[idx] / 255, 1.2);
        const bh = v * h * 0.32;
        c2d.fillStyle = i % 2 ? `rgba(${colors.a}, .28)` : `rgba(${colors.b}, .28)`;
        c2d.fillRect(i * bw + 1, h - bh, bw - 2, bh);
      }
      // 粒子更新绘制
      const GR = c2d.createLinearGradient(0, h, 0, 0);
      GR.addColorStop(0, colors.accent);
      GR.addColorStop(1, colors.accent2);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 30 * dt; // 轻微重力
        p.life -= dt * 0.5;
        if (p.life <= 0 || p.y < -20 || p.x < -20 || p.x > w + 20) { parts.splice(i, 1); continue; }
        c2d.globalAlpha = Math.max(0, p.life) * 0.9;
        c2d.fillStyle = p.hue === 'a' ? GR : colors.accent2;
        c2d.beginPath();
        c2d.arc(p.x, p.y, p.r * (0.6 + high), 0, Math.PI * 2);
        c2d.fill();
      }
      c2d.globalAlpha = 1;
      // 中央呼吸光
      const glow = c2d.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.4);
      glow.addColorStop(0, `rgba(${colors.a}, ${0.05 + all * 0.1})`);
      glow.addColorStop(1, 'transparent');
      c2d.fillStyle = glow;
      c2d.fillRect(0, 0, w, h);
    },
  };
}

// ---------- 模式二:环形频谱 ----------
function makeRing() {
  let rot = 0;
  return {
    draw(c2d, w, h, spec, dt, colors) {
      rot += dt * (0.15 + bands(spec).all * 0.8);
      c2d.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const baseR = Math.min(w, h) * 0.22;
      const bars = 96;
      c2d.save();
      c2d.translate(cx, cy);
      c2d.rotate(rot);
      const GR = c2d.createLinearGradient(-baseR, 0, baseR, 0);
      GR.addColorStop(0, colors.accent);
      GR.addColorStop(1, colors.accent2);
      c2d.strokeStyle = GR;
      c2d.lineWidth = Math.max(2, (Math.PI * 2 * baseR) / bars * 0.55);
      c2d.lineCap = 'round';
      for (let i = 0; i < bars; i++) {
        const idx = Math.floor(Math.pow(i / bars, 1.4) * spec.length * 0.7);
        const v = Math.pow(spec[idx] / 255, 1.15);
        const len = baseR * 0.15 + v * baseR * 0.95;
        const ang = (i / bars) * Math.PI * 2;
        const x1 = Math.cos(ang) * (baseR * 1.12);
        const y1 = Math.sin(ang) * (baseR * 1.12);
        const x2 = Math.cos(ang) * (baseR * 1.12 + len);
        const y2 = Math.sin(ang) * (baseR * 1.12 + len);
        c2d.beginPath();
        c2d.moveTo(x1, y1);
        c2d.lineTo(x2, y2);
        c2d.stroke();
      }
      // 内环
      c2d.beginPath();
      c2d.arc(0, 0, baseR * 1.02, 0, Math.PI * 2);
      c2d.strokeStyle = `rgba(${colors.a}, .4)`;
      c2d.lineWidth = 1.5;
      c2d.stroke();
      // 低频呼吸内芯
      const { low } = bands(spec);
      c2d.beginPath();
      c2d.arc(0, 0, baseR * (0.3 + low * 0.25), 0, Math.PI * 2);
      c2d.fillStyle = `rgba(${colors.b}, ${0.12 + low * 0.3})`;
      c2d.fill();
      c2d.restore();
      // 外圈光晕
      const glow = c2d.createRadialGradient(cx, cy, baseR, cx, cy, baseR * 2.2);
      glow.addColorStop(0, `rgba(${colors.a}, ${0.04 + bands(spec).all * 0.08})`);
      glow.addColorStop(1, 'transparent');
      c2d.fillStyle = glow;
      c2d.fillRect(0, 0, w, h);
    },
  };
}

// ---------- 模式三:波形流动 ----------
function makeWave() {
  const layers = [
    { speed: 0.6, amp: 0.5, alpha: 0.5, color: 'a' },
    { speed: -0.9, amp: 0.32, alpha: 0.38, color: 'b' },
    { speed: 1.5, amp: 0.2, alpha: 0.3, color: 'a' },
  ];
  const hist = []; // 历史频谱带(波形随时间流动)
  return {
    draw(c2d, w, h, spec, dt, colors) {
      const { low, mid, all } = bands(spec);
      // 每帧推入当前能量采样(限制长度形成流动历史)
      hist.push({ low, mid, all, t: (hist[hist.length - 1]?.t || 0) + dt });
      if (hist.length > 240) hist.shift();
      c2d.clearRect(0, 0, w, h);
      layers.forEach((L, li) => {
        c2d.beginPath();
        c2d.moveTo(0, h);
        for (let x = 0; x <= w; x += 6) {
          const ph = x / w;
          const s = Math.sin(ph * 9 + L.speed * performance.now() / 1000) * 0.5
            + Math.sin(ph * 21 - L.speed * performance.now() / 700) * 0.3
            + Math.sin(ph * 4 + L.speed * performance.now() / 1600) * 0.4;
          const e = 0.35 + all * 1.3;
          const y = h * (0.62 - L.amp * 0.3) - s * h * 0.16 * L.amp * e - low * h * 0.12;
          c2d.lineTo(x, y);
        }
        c2d.lineTo(w, h);
        c2d.closePath();
        const GR = c2d.createLinearGradient(0, 0, w, h);
        GR.addColorStop(0, `rgba(${colors.a}, ${L.alpha})`);
        GR.addColorStop(1, `rgba(${colors.b}, ${L.alpha * 0.7})`);
        c2d.fillStyle = GR;
        c2d.fill();
      });
      // 流动历史频谱带(底部)
      const barW = w / 240;
      hist.forEach((s, i) => {
        const v = s.mid;
        c2d.fillStyle = `rgba(${colors.b}, ${0.1 + v * 0.4})`;
        const bh = v * h * 0.18;
        c2d.fillRect(i * barW, h - bh, Math.max(1.5, barW - 1), bh);
      });
    },
  };
}

const FACTORIES = { particles: makeParticles, ring: makeRing, wave: makeWave };

// 注册一个可视化 canvas(跟随播放状态绘制)
export function registerVisualizer(canvas, { mode = 'particles', idleDrift = true } = {}) {
  if (!canvas) return () => {};
  const entry = { canvas, c2d: canvas.getContext('2d'), mode, idleDrift, engine: (FACTORIES[mode] || makeParticles)(), last: performance.now() };
  runners.add(entry);
  startLoop();
  return () => { runners.delete(entry); };
}

export function setVisualMode(entry, mode) {
  if (entry && FACTORIES[mode]) { entry.mode = mode; entry.engine = (FACTORIES[mode] || makeParticles)(); }
}

function startLoop() {
  if (raf) return;
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const spec = player.getSpectrum();
    const playing = player.playing;
    const colors = accentColors();
    for (const r of runners) {
      const w = r.canvas.width, h = r.canvas.height;
      const active = playing && spec;
      if (!active) {
        // 空闲:轻呼吸渐隐
        r.c2d.clearRect(0, 0, w, h);
        if (r.idleDrift) {
          const g = r.c2d.createLinearGradient(0, 0, w, h);
          g.addColorStop(0, `rgba(${colors.a}, .05)`);
          g.addColorStop(1, `rgba(${colors.b}, .05)`);
          r.c2d.fillStyle = g;
          r.c2d.fillRect(0, 0, w, h);
        }
        continue;
      }
      r.engine.draw(r.c2d, w, h, spec, dt, colors);
    }
    raf = runners.size ? requestAnimationFrame(loop) : 0;
  };
  raf = requestAnimationFrame(loop);
}
