// Wallpaper Engine 联动(自研桥接):
// 1. 检测 Wallpaper Engine 安装(常见路径 + Steam libraryFolders.vdf)
// 2. 将 Mineradio 可视化导出为 Wallpaper Engine Web 壁纸项目
//    (project.json + index.html,使用 WE 注入的 wallpaperRegisterAudioListener 音频 API 驱动)
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

const WE_PATHS = [
  join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Steam', 'steamapps', 'common', 'wallpaper_engine'),
  join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Steam', 'steamapps', 'common', 'wallpaper_engine_engine'),
  'D:\\Steam\\steamapps\\common\\wallpaper_engine',
  'E:\\Steam\\steamapps\\common\\wallpaper_engine',
];

export function detectWallpaperEngine() {
  for (const p of WE_PATHS) {
    if (existsSync(join(p, 'wallpaper32.exe')) || existsSync(join(p, 'wallpaper64.exe')) || existsSync(join(p, 'project.json'))) {
      return { found: true, path: p, projectsDir: join(p, 'projects', 'myprojects') };
    }
  }
  // Steam 库文件夹扫描(libraryfolders.vdf)
  try {
    const vdfPath = join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Steam', 'steamapps', 'libraryfolders.vdf');
    if (existsSync(vdfPath)) {
      const vdf = readFileSync(vdfPath, 'utf-8');
      const re = /"path"\s+"([^"]+)"/g;
      let m;
      while ((m = re.exec(vdf))) {
        const lib = m[1].replace(/\\\\/g, '\\');
        const we = join(lib, 'steamapps', 'common', 'wallpaper_engine');
        if (existsSync(join(we, 'wallpaper32.exe'))) {
          return { found: true, path: we, projectsDir: join(we, 'projects', 'myprojects') };
        }
      }
    }
  } catch { /* ignore */ }
  return { found: false, path: '' };
}

// 生成 WE Web 壁纸项目(自研 shader 集 + WE 音频 API 驱动)
export function exportToWallpaperEngine(mode = 'nebula', params = {}) {
  const we = detectWallpaperEngine();
  if (!we.found) return { ok: false, reason: '未检测到 Wallpaper Engine(steamapps/common/wallpaper_engine)' };
  const projName = 'mineradio-pro-visualizer';
  const projDir = join(we.projectsDir, projName);
  mkdirSync(projDir, { recursive: true });

  // project.json(WE 项目清单格式)
  const manifest = {
    file: 'index.html',
    title: 'Mineradio pro Visualizer',
    type: 'web',
    supporturl: 'https://github.com/smftec/Mineradio-pro',
    preview: '',
    general: {
      properties: {},
      supportsaudioprocessing: true,
    },
  };
  writeFileSync(join(projDir, 'project.json'), JSON.stringify(manifest, null, 2));

  // shaders 源码(从 asar/目录读取并内嵌,使 WE 项目自包含)
  let shadersSrc = '';
  try {
    shadersSrc = readFileSync(join(app.getAppPath(), 'public', 'js', 'shaders.js'), 'utf-8');
  } catch { /* fallback 内嵌占位 */ }

  const intensity = params.intensity || 1;
  const speed = params.speed || 1;
  const c1 = params.c1 ? JSON.stringify(params.c1) : 'null';
  const c2 = params.c2 ? JSON.stringify(params.c2) : 'null';

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; height: 100%; background: #0b0d14; overflow: hidden; }
  canvas { width: 100vw; height: 100vh; display: block; }
</style></head>
<body>
<canvas id="c"></canvas>
<script>
${shadersSrc}
</script>
<script>
// Wallpaper Engine 音频 API 对接(WE 注入 wallpaperRegisterAudioListener)
const canvas = document.getElementById('c');
const engine = new MiniEngine(canvas);
engine.setParams({ intensity: ${intensity}, speed: ${speed}, c1: ${c1}, c2: ${c2} });
engine.use(${JSON.stringify(mode)});
engine.active = true;
let specOverride = new Uint8Array(32);
engine.specOverride = specOverride;
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

// WE 音频监听:64 bin 数组 → 32 bin 纹理
if (typeof wallpaperRegisterAudioListener === 'function') {
  wallpaperRegisterAudioListener((arr) => {
    // WE 提供 64 个 0~1 值;映射到 32 bin
    for (let i = 0; i < 32; i++) {
      specOverride[i] = Math.min(255, Math.round((arr[i * 2] || 0) * 255));
    }
  });
  document.title = 'wallpaper-engine-audio';
} else {
  // 无音频输入时模拟缓慢呼吸
  setInterval(() => {
    const t = performance.now() / 1000;
    for (let i = 0; i < 32; i++) {
      specOverride[i] = Math.round(90 + Math.sin(t * 0.8 + i * 0.4) * 40 + Math.random() * 20);
    }
  }, 66);
}
// 渲染循环(MiniEngine 内部 rAF)
</script>
</body></html>`;

  writeFileSync(join(projDir, 'index.html'), html);

  // MiniEngine 精简实现(内嵌到 WE 页面,自研,与主程序 ShaderEngine 同构)
  const mini = `// Mineradio MiniEngine(自研,与主程序 ShaderEngine 同构精简版)
class MiniEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    this.ok = !!this.gl;
    if (!this.ok) return;
    const gl = this.gl;
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.specTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.specTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 32, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(32));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.programs = {}; this.current = null; this.failed = [];
    this.params = { intensity: 1, speed: 1, c1: null, c2: null };
    this.scaledTime = 0; this.start = performance.now();
    this.beatPulse = 0; this.beatCount = 0; this.prevLow = 0;
  }
  use(id) {
    if (!this.ok) return false;
    if (this.programs[id]) { this.current = id; this.gl.useProgram(this.programs[id].prog); return true; }
    const src = (typeof SHADERS !== 'undefined' && SHADERS[id]) || null;
    if (!src) return false;
    const gl = this.gl;
    const compile = (type, code) => { const sh = gl.createShader(type); gl.shaderSource(sh, code); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(sh)); return null; } return sh; };
    const vs = compile(gl.VERTEX_SHADER, VERT); const fs = compile(gl.FRAGMENT_SHADER, src);
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    this.programs[id] = { prog, aPos: gl.getAttribLocation(prog, 'a_pos') };
    this.current = id; gl.useProgram(prog);
    return true;
  }
  setParams(p) { if (p) { if (p.intensity != null) this.params.intensity = p.intensity; if (p.speed != null) this.params.speed = p.speed;
    if (p.c1) this.params.c1 = p.c1; if (p.c2) this.params.c2 = p.c2; } }
  render(dt, themeRGB) {
    if (!this.ok || !this.current) return;
    const gl = this.gl, c = this.canvas;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.floor(c.clientWidth * dpr), h = Math.floor(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; gl.viewport(0, 0, w, h); }
    const p = this.programs[this.current];
    const prm = this.params;
    this.scaledTime += dt * (prm.speed || 1);
    gl.useProgram(p.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(p.aPos);
    gl.vertexAttribPointer(p.aPos, 2, gl.FLOAT, false, 0, 0);
    const spec = this.specOverride;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.specTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 32, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, spec);
    const avg = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += spec[i]; return s / (b - a) / 255; };
    const bass = avg(0, 6), mid = avg(6, 18), high = avg(18, 30), all = avg(0, 30);
    const flux = bass - this.prevLow; this.prevLow = bass;
    if (flux > 0.12) { this.beatCount += 1; this.beatPulse = 1; }
    this.beatPulse = Math.max(0, this.beatPulse - dt * 2.2);
    const I = prm.intensity || 1;
    const tRGB = themeRGB || { a: [124/255, 92/255, 255/255], b: [53/255, 224/255, 255/255] };
    const c1 = prm.c1 || tRGB.a, c2 = prm.c2 || tRGB.b;
    gl.uniform2f(u(p, 'u_res'), w, h);
    gl.uniform1f(u(p, 'u_time'), this.scaledTime);
    gl.uniform1f(u(p, 'u_bass'), Math.min(1, bass * I));
    gl.uniform1f(u(p, 'u_mid'), Math.min(1, mid * I));
    gl.uniform1f(u(p, 'u_high'), Math.min(1, high * I));
    gl.uniform1f(u(p, 'u_all'), Math.min(1, all * I));
    gl.uniform1f(u(p, 'u_beat'), Math.min(1, this.beatPulse * I));
    gl.uniform1f(u(p, 'u_beatCount'), this.beatCount);
    gl.uniform3f(u(p, 'u_c1'), c1[0], c1[1], c1[2]);
    gl.uniform3f(u(p, 'u_c2'), c2[0], c2[1], c2[2]);
    gl.uniform1i(u(p, 'u_specTex'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    function u(p, n) { return gl.getUniformLocation(p.prog, n); }
  }
}
// 主循环
let _last = performance.now();
(function loop(now) {
  const dt = Math.min(0.05, (now - _last) / 1000); _last = now;
  if (engine.active && engine.current) engine.render(dt);
  requestAnimationFrame(loop);
})(performance.now());
`;
  writeFileSync(join(projDir, 'mini-engine.js'), mini);

  // index.html 引入 mini-engine(shaders.js 之后)
  const html2 = html.replace('</script>\n<script>\n// Wallpaper Engine', '</script>\n<script src="mini-engine.js"></script>\n<script>\n// Wallpaper Engine');
  writeFileSync(join(projDir, 'index.html'), html2);

  return { ok: true, path: projDir };
}

// 打开 WE 项目目录
export function openWallpaperEngineProjects() {
  const we = detectWallpaperEngine();
  if (!we.found) return { ok: false };
  const { shell } = require('electron');
  shell.openPath(we.projectsDir);
  return { ok: true, path: we.projectsDir };
}
