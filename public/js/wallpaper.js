// 动态桌面壁纸:WebGL 着色器可视化,频谱数据由主窗口经 IPC 推送
import { ShaderEngine, attachEngine } from './webgl-engine.js';

const canvas = document.getElementById('wp-canvas');
const engine = new ShaderEngine(canvas);
engine.specOverride = new Uint8Array(32);
engine.active = true;
attachEngine(engine); // 挂入全局渲染循环

let mode = 'nebula';
window.mpro?.on('wallpaper:config', (c) => {
  mode = c.mode || mode;
  engine.use(mode);
});
// 尺寸自适应
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();
// 立即注册常用效果(懒编译其余)
for (const id of ['nebula', 'cadenza', 'hanabi', 'machi', 'nebbia', 'fume']) engine.register(id);
engine.use(mode);

// 频谱数据
window.mpro?.on('player:spec', (bins) => {
  if (bins && bins.length) engine.specOverride = Uint8Array.from(bins);
});
console.log('[wallpaper] ready, engine ok:', engine.ok, 'mode:', mode);
