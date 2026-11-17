// WebGL 着色器视觉引擎:共享渲染器,16 个效果 program 切换,音频 uniform 驱动
import { VERT, SHADERS, SHADER_IDS } from './shaders.js';
import { player } from './player.js';

const SPEC_BINS = 32;

export class ShaderEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' })
      || canvas.getContext('experimental-webgl');
    this.ok = !!this.gl;
    if (!this.ok) return;
    const gl = this.gl;
    // 全屏 quad
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    // 频谱纹理(32x1 LUMINANCE,LINEAR)
    this.specTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.specTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, SPEC_BINS, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(SPEC_BINS));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.programs = {};
    this.current = null;
    this.failed = [];
    this.start = performance.now();
    // 视觉参数(Folia 预设系统):强度/速度/色彩覆盖
    this.params = { intensity: 1, speed: 1, c1: null, c2: null };
    this.scaledTime = 0;
    this.beatAcc = 0;
    this.beatCount = 0;
    this.beatPulse = 0;
    this.prevLow = 0;
  }

  register(id) {
    if (!this.ok || this.programs[id]) return !!this.programs[id];
    const gl = this.gl;
    const src = SHADERS[id];
    if (!src) return false;
    const compile = (type, code) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, code);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('[shader]', id, gl.getShaderInfoLog(sh)?.slice(0, 200));
        return null;
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, src);
    if (!vs || !fs) { this.failed.push(id); return false; }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[shader link]', id, gl.getProgramInfoLog(prog)?.slice(0, 200));
      this.failed.push(id);
      return false;
    }
    this.programs[id] = { prog, u: {}, aPos: gl.getAttribLocation(prog, 'a_pos') };
    // 缓存 uniform 位置
    for (const name of ['u_res', 'u_time', 'u_bass', 'u_mid', 'u_high', 'u_all', 'u_beat', 'u_beatCount', 'u_c1', 'u_c2', 'u_specTex']) {
      this.programs[id].u[name] = gl.getUniformLocation(prog, name);
    }
    return true;
  }

  use(id) {
    if (!this.ok) return false;
    if (!this.register(id)) return false;
    this.current = id;
    this.gl.useProgram(this.programs[id].prog);
    return true;
  }

  // 视觉参数(Folia 预设):{ intensity, speed, c1, c2 }
  setParams(params) {
    if (!params) return;
    if (params.intensity != null) this.params.intensity = Math.max(0.2, Math.min(2.5, params.intensity));
    if (params.speed != null) this.params.speed = Math.max(0.1, Math.min(4, params.speed));
    if (params.c1) this.params.c1 = params.c1;
    if (params.c2) this.params.c2 = params.c2;
  }

  // 渲染档位:DPR 上限
  setDprCap(cap) {
    this._dprCap = Math.max(0.5, Math.min(2, cap || 1.5));
  }

  listOk() {
    if (!this.ok) return [];
    return SHADER_IDS.filter((id) => this.register(id));
  }

  render(dt, themeRGB) {
    if (!this.ok || !this.current) return;
    const gl = this.gl;
    const c = this.canvas;
    // 分辨率同步(DPR 档位,性能保护)
    const dpr = Math.min(window.devicePixelRatio || 1, this._dprCap || 1.5);
    const w = Math.floor(c.clientWidth * dpr), h = Math.floor(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; gl.viewport(0, 0, w, h); }

    // 频谱 → uniform 纹理(32 bins 对数分段)
    const spec = this.specOverride || player.getSpectrum();
    const bins = new Uint8Array(SPEC_BINS);
    if (spec) {
      const usable = spec.length * 0.75;
      for (let i = 0; i < SPEC_BINS; i++) {
        const s = Math.floor(Math.pow(i / SPEC_BINS, 1.4) * usable);
        const e = Math.max(s + 1, Math.floor(Math.pow((i + 1) / SPEC_BINS, 1.4) * usable));
        let m = 0;
        for (let j = s; j < e && j < usable; j++) m = Math.max(m, spec[j]);
        bins[i] = m;
      }
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.specTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SPEC_BINS, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, bins);

    // 频段能量 + 节拍检测(低频能量突增)
    const avg = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += bins[i]; return s / (b - a) / 255; };
    const bass = avg(0, 6), mid = avg(6, 18), high = avg(18, 30), all = avg(0, 30);
    const flux = bass - this.prevLow;
    this.prevLow = bass;
    if (flux > 0.12 && performance.now() - this.start > 500) {
      this.beatCount += 1;
      this.beatPulse = 1;
    }
    this.beatPulse = Math.max(0, this.beatPulse - dt * 2.2);

    const p = this.programs[this.current];
    const prm = this.params;
    this.scaledTime += dt * (prm.speed || 1);
    gl.useProgram(p.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(p.aPos);
    gl.vertexAttribPointer(p.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(p.u.u_res, w, h);
    gl.uniform1f(p.u.u_time, this.scaledTime);
    // 强度调制:能量缩放(Folia 预设)
    const I = prm.intensity || 1;
    gl.uniform1f(p.u.u_bass, Math.min(1, bass * I));
    gl.uniform1f(p.u.u_mid, Math.min(1, mid * I));
    gl.uniform1f(p.u.u_high, Math.min(1, high * I));
    gl.uniform1f(p.u.u_all, Math.min(1, all * I));
    gl.uniform1f(p.u.u_beat, Math.min(1, this.beatPulse * I));
    gl.uniform1f(p.u.u_beatCount, this.beatCount);
    // 色彩:预设覆盖优先,否则主题色
    const rgb = themeRGB || { a: [124/255, 92/255, 255/255], b: [53/255, 224/255, 255/255] };
    const c1 = prm.c1 || rgb.a, c2 = prm.c2 || rgb.b;
    gl.uniform3f(p.u.u_c1, c1[0], c1[1], c1[2]);
    gl.uniform3f(p.u.u_c2, c2[0], c2[1], c2[2]);
    gl.uniform1i(p.u.u_specTex, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

// 主题 RGB(JS 侧读 CSS 变量,缓存 250ms)
let themeCache = { at: 0, rgb: null };
export function themeRGB() {
  if (performance.now() - themeCache.at < 250) return themeCache.rgb;
  const cs = getComputedStyle(document.documentElement);
  const parse = (v) => (v || '124,92,255').split(',').map((x) => parseFloat(x) / 255);
  themeCache = {
    at: performance.now(),
    rgb: { a: parse(cs.getPropertyValue('--accent-rgb')), b: parse(cs.getPropertyValue('--accent2-rgb')) },
  };
  return themeCache.rgb;
}

export function shaderIds() {
  return SHADER_IDS;
}

// 全局帧循环(多 canvas 共享)
const engines = new Set();
let raf = 0;
export function attachEngine(engine) {
  engines.add(engine);
  if (!raf) {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (const e of engines) {
        if (e.active && e.canvas.isConnected) e.render(dt, themeRGB());
      }
      raf = engines.size ? requestAnimationFrame(loop) : 0;
    };
    raf = requestAnimationFrame(loop);
  }
  return () => engines.delete(engine);
}

// 引擎可用性探测(GPU 不可用 → 回退 Canvas2D)
export function webglAvailable(canvas) {
  try {
    const e = new ShaderEngine(canvas);
    const ok = e.ok;
    return { ok, engine: ok ? e : null };
  } catch {
    return { ok: false, engine: null };
  }
}
