# v2.6.0 补丁四:视觉参数接入渲染端(歌词视图/Home/壁纸)
import io

# ---- lyrics-view.js ----
p = 'public/js/lyrics-view.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""    // 可视化背景(19 种模式循环:3 Canvas2D + 16 WebGL)
    this._unregVisual = registerVisual(el.querySelector('#lv-visual'), { mode: visMode });""",
"""    // 可视化背景(19 种模式循环:3 Canvas2D + 16 WebGL)+ Folia 预设参数
    this._unregVisual = registerVisual(el.querySelector('#lv-visual'), { mode: visMode });
    if (window.__state.config.visualParams) this._setVisualParams(window.__state.config.visualParams);""")
s = s.replace("""  // 可视化模式切换
  _setVisualMode(mode) {
    if (this._unregVisual) this._unregVisual();
    this._unregVisual = registerVisual(this.el.querySelector('#lv-visual'), { mode });
  },""",
"""  // 可视化模式切换
  _setVisualMode(mode) {
    if (this._unregVisual) this._unregVisual();
    this._unregVisual = registerVisual(this.el.querySelector('#lv-visual'), { mode });
    if (window.__state.config.visualParams) this._setVisualParams(window.__state.config.visualParams);
  },

  // 视觉参数(Folia 预设):{ intensity, speed } — 经全局入口调制渲染
  _setVisualParams(params) {
    window.__applyVisualParams?.(params);
  },""")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- visual-modes.js:params 全局入口 + bands 调制 ----
p = 'public/js/visual-modes.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""// 统一注册:shader id 走 WebGL 引擎,canvas2d 模式走原有绘制器
// 支持视觉参数:registerVisual(canvas, { mode, params })
let _activeParams = { intensity: 1, speed: 1 };
export function setVisualParams(params) {
  if (params) _activeParams = { ..._activeParams, ...params };
}
export function getVisualParams() { return _activeParams; }
export function registerVisual(canvas, { mode = 'particles', params = null } = {}) {
  if (params) setVisualParams(params);
  if (SHADER_IDS.includes(mode) && probeGL() === 'yes') {
    const engine = new ShaderEngine(canvas);
    if (engine.ok && engine.use(mode)) {
      engine.active = true;
      if (params) engine.setParams(params);
      return attachEngine(engine);
    }
  }
  return registerVisualizer(canvas, { mode });
}""",
"""// 统一注册:shader id 走 WebGL 引擎,canvas2d 模式走原有绘制器
// 支持视觉参数:registerVisual(canvas, { mode, params });全局调制 setVisualParams
let _activeParams = { intensity: 1, speed: 1 };
export function setVisualParams(params) {
  if (params) _activeParams = { ..._activeParams, ...params };
}
export function getVisualParams() { return _activeParams; }
window.__applyVisualParams = (p) => setVisualParams(p);
export function registerVisual(canvas, { mode = 'particles', params = null } = {}) {
  if (params) setVisualParams(params);
  if (SHADER_IDS.includes(mode) && probeGL() === 'yes') {
    const engine = new ShaderEngine(canvas);
    if (engine.ok && engine.use(mode)) {
      engine.active = true;
      if (params) engine.setParams(params);
      return attachEngine(engine);
    }
  }
  return registerVisualizer(canvas, { mode });
}""")
s = s.replace("""// 频谱能量摘要(低/中/高频均值 0~1)
function bands(spec) {
  const n = spec.length;
  const seg = (a, b) => {
    let s = 0;
    for (let i = a; i < b; i++) s += spec[i];
    return s / (b - a) / 255;
  };
  return { low: seg(0, n * 0.15), mid: seg(n * 0.15, n * 0.5), high: seg(n * 0.5, n * 0.8), all: seg(0, n * 0.8) };
}""",
"""// 频谱能量摘要(低/中/高频均值 0~1;视觉强度调制)
function bands(spec) {
  const n = spec.length;
  const I = _activeParams.intensity || 1;
  const seg = (a, b) => {
    let s = 0;
    for (let i = a; i < b; i++) s += spec[i];
    return Math.min(1, (s / (b - a) / 255) * I);
  };
  return { low: seg(0, n * 0.15), mid: seg(n * 0.15, n * 0.5), high: seg(n * 0.5, n * 0.8), all: seg(0, n * 0.8) };
}""")
io.open(p, 'w', encoding='utf-8').write(s)
print('visual-modes params OK')

# ---- app.js:Home 频谱参数 ----
p = 'public/js/app.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("import { renderView, renderHome, renderRecordWall, bindTable, bindDragReorder, EQ_BARS, trackTable, ACTIONS_PLAY_ALL } from './views.js';",
"""import { renderView, renderHome, renderRecordWall, bindTable, bindDragReorder, EQ_BARS, trackTable, ACTIONS_PLAY_ALL } from './views.js';
import { setVisualParams } from './visual-modes.js';""")
s = s.replace("""    } else if (this.view === 'home') {
      renderHome(root, this);
      this._homeUnreg = registerSpectrum(document.getElementById('home-spectrum'), { bars: 64 });""",
"""    } else if (this.view === 'home') {
      renderHome(root, this);
      setVisualParams(this.config.visualParams);
      this._homeUnreg = registerSpectrum(document.getElementById('home-spectrum'), { bars: 64 });""")
io.open(p, 'w', encoding='utf-8').write(s)
print('app params OK')
