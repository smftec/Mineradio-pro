# v2.4.0 补丁二:歌词视图 19 模式 + 设置 select 扩展
import io

p = 'public/js/lyrics-view.js'
s = io.open(p, encoding='utf-8').read()

s = s.replace("import { registerVisualizer, VISUAL_MODES } from './visual-modes.js';",
              "import { registerVisual, VISUAL_MODES, SHADER_IDS } from './visual-modes.js';")

s = s.replace("""    const visMode = window.__state.config.visualMode || 'particles';
    el.innerHTML = `
      <canvas class="lv-visual" id="lv-visual" width="1280" height="720"></canvas>
      <div class="lv-ambient" style="background-image:url('${coverSrc}')"></div>
      <div class="lv-veil"></div>
      <div class="lv-toolbar">
        <button class="btn" id="lv-mode" title="切换可视化模式">✦ ${VISUAL_MODES.find(m => m.id === visMode)?.name || '频谱粒子'}</button>
        <button class="btn" id="lv-export">▣ 导出视频</button>
        <button class="btn lv-close"><svg viewBox="0 0 24 24" class="ico" style="width:14px;height:14px"><path d="M6 6l12 12M18 6L6 18"/></svg> 退出歌词</button>
      </div>""",
"""    const ALL_MODES = [...VISUAL_MODES.map(m => ({ id: m.id, name: m.name })), ...SHADER_IDS.map(id => ({ id, name: '✧ ' + id }))];
    const visMode = window.__state.config.visualMode || 'particles';
    const curName = (ALL_MODES.find(m => m.id === visMode)?.name) || '频谱粒子';
    el.innerHTML = `
      <canvas class="lv-visual" id="lv-visual" width="1280" height="720"></canvas>
      <div class="lv-ambient" style="background-image:url('${coverSrc}')"></div>
      <div class="lv-veil"></div>
      <div class="lv-toolbar">
        <button class="btn" id="lv-mode" title="切换可视化模式">✦ ${curName}</button>
        <button class="btn" id="lv-export">▣ 导出视频</button>
        <button class="btn lv-close"><svg viewBox="0 0 24 24" class="ico" style="width:14px;height:14px"><path d="M6 6l12 12M18 6L6 18"/></svg> 退出歌词</button>
      </div>""")

s = s.replace("""    // 可视化背景(模式可循环切换)
    this._unregVisual = registerVisualizer(el.querySelector('#lv-visual'), { mode: visMode });
    el.querySelector('#lv-mode').addEventListener('click', () => {
      const cur = window.__state.config.visualMode || 'particles';
      const next = VISUAL_MODES[(VISUAL_MODES.findIndex(m => m.id === cur) + 1) % VISUAL_MODES.length];
      window.__state.config.visualMode = next.id;
      api.invoke('config:set', { visualMode: next.id });
      this._setVisualMode(next.id);
      el.querySelector('#lv-mode').textContent = '✦ ' + next.name;
    });""",
"""    // 可视化背景(19 种模式循环:3 Canvas2D + 16 WebGL)
    this._unregVisual = registerVisual(el.querySelector('#lv-visual'), { mode: visMode });
    el.querySelector('#lv-mode').addEventListener('click', () => {
      const cur = window.__state.config.visualMode || 'particles';
      const next = ALL_MODES[(ALL_MODES.findIndex(m => m.id === cur) + 1) % ALL_MODES.length];
      window.__state.config.visualMode = next.id;
      api.invoke('config:set', { visualMode: next.id });
      this._setVisualMode(next.id);
      el.querySelector('#lv-mode').textContent = '✦ ' + next.name;
    });""")

s = s.replace("""  // 可视化模式切换
  _setVisualMode(mode) {
    if (this._unregVisual) this._unregVisual();
    this._unregVisual = registerVisualizer(this.el.querySelector('#lv-visual'), { mode });
  },""",
"""  // 可视化模式切换
  _setVisualMode(mode) {
    if (this._unregVisual) this._unregVisual();
    this._unregVisual = registerVisual(this.el.querySelector('#lv-visual'), { mode });
  },""")

io.open(p, 'w', encoding='utf-8').write(s)
print('lyrics 19 modes OK')

# ---- settings select 扩展 ----
p = 'public/js/settings-view.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""        <select id="set-visual">
          ${[['particles', '频谱粒子'], ['ring', '环形频谱'], ['wave', '波形流动']].map(([v, n]) =>
            `<option value="${v}" ${(cfg.visualMode || 'particles') === v ? 'selected' : ''}>${n}</option>`).join('')}
        </select>""",
"""        <select id="set-visual">
          ${[['particles', '频谱粒子(Canvas2D)'], ['ring', '环形频谱(Canvas2D)'], ['wave', '波形流动(Canvas2D)']].concat(
            SHADER_IDS.map(id => ['wgl:' + id, '✧ ' + id + '(WebGL)'])).map(([v, n]) =>
            `<option value="${v}" ${(cfg.visualMode || 'particles') === v || ('wgl:' + (cfg.visualMode || '')) === v ? 'selected' : ''}>${n}</option>`).join('')}
        </select>""")
io.open(p, 'w', encoding='utf-8').write(s)
print('settings select OK')
