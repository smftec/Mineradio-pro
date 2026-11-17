# v2.3.0 补丁:歌词视图可视化集成 + 唱片墙 CSS + 音频流
import io

# ---- player.js:音频流接口 ----
p = 'public/js/player.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""  // 实时频谱(Uint8Array 0~255,无 ctx 或未播放时为低幅值)
  getSpectrum() {""",
"""  // 音频流(视频导出录制用;tap 不影响扬声器输出)
  getAudioStream() {
    this._ensureCtx();
    if (!this._msDest) {
      this._msDest = this._ctx.createMediaStreamDestination();
      this._limiter.connect(this._msDest);
    }
    return this._msDest.stream;
  },

  // 实时频谱(Uint8Array 0~255,无 ctx 或未播放时为低幅值)
  getSpectrum() {""")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- lyrics-view.js:可视化背景 + 工具条 + 导出按钮 ----
p = 'public/js/lyrics-view.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("import { registerSpectrum } from './visualizer.js';",
              "import { registerVisualizer, VISUAL_MODES } from './visual-modes.js';")
s = s.replace("""    el.innerHTML = `
      <div class="lv-ambient" style="background-image:url('${coverSrc}')"></div>
      <div class="lv-veil"></div>
      <button class="btn lv-close"><svg viewBox="0 0 24 24" class="ico" style="width:14px;height:14px"><path d="M6 6l12 12M18 6L6 18"/></svg> 退出歌词</button>""",
"""    const visMode = window.__state.config.visualMode || 'particles';
    el.innerHTML = `
      <canvas class="lv-visual" id="lv-visual" width="1280" height="720"></canvas>
      <div class="lv-ambient" style="background-image:url('${coverSrc}')"></div>
      <div class="lv-veil"></div>
      <div class="lv-toolbar">
        <button class="btn" id="lv-mode" title="切换可视化模式">✦ ${VISUAL_MODES.find(m => m.id === visMode)?.name || '频谱粒子'}</button>
        <button class="btn" id="lv-export">▣ 导出视频</button>
        <button class="btn lv-close"><svg viewBox="0 0 24 24" class="ico" style="width:14px;height:14px"><path d="M6 6l12 12M18 6L6 18"/></svg> 退出歌词</button>
      </div>""")
s = s.replace("""    document.getElementById('app').appendChild(el);
    this.el = el;
    // 歌词视图大频谱(关闭时反注册)
    this._unregSpectrum = registerSpectrum(el.querySelector('#lv-spectrum'), { bars: 44 });

    el.querySelector('.lv-close').addEventListener('click', () => this.close());""",
"""    document.getElementById('app').appendChild(el);
    this.el = el;
    // 可视化背景(模式可循环切换)
    this._unregVisual = registerVisualizer(el.querySelector('#lv-visual'), { mode: visMode });
    el.querySelector('#lv-mode').addEventListener('click', () => {
      const cur = window.__state.config.visualMode || 'particles';
      const next = VISUAL_MODES[(VISUAL_MODES.findIndex(m => m.id === cur) + 1) % VISUAL_MODES.length];
      window.__state.config.visualMode = next.id;
      api.invoke('config:set', { visualMode: next.id });
      this._setVisualMode(next.id);
      el.querySelector('#lv-mode').textContent = '✦ ' + next.name;
    });
    el.querySelector('#lv-export').addEventListener('click', () => window.__exportVideo?.(this));

    el.querySelector('.lv-close').addEventListener('click', () => this.close());""")
s = s.replace("""    // 歌词翻译(异步,不阻塞渲染)
    this._maybeTranslate(trackId);
  },""",
"""    // 歌词翻译(异步,不阻塞渲染)
    this._maybeTranslate(trackId);
  },

  // 可视化模式切换
  _setVisualMode(mode) {
    if (this._unregVisual) this._unregVisual();
    this._unregVisual = registerVisualizer(this.el.querySelector('#lv-visual'), { mode });
  },

  // 视频导出所需的当前歌词状态
  getLyricState() {
    const idx = this.activeIdx;
    const line = this.lines[idx];
    return { text: line?.text || '', words: line?.words || null, index: idx };
  },""")
s = s.replace("""  close() {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    if (this._unregSpectrum) { this._unregSpectrum(); this._unregSpectrum = null; }
    const el = this.el;""",
"""  close() {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    if (this._unregVisual) { this._unregVisual(); this._unregVisual = null; }
    const el = this.el;""")
# 移除旧 lv-spectrum canvas
s = s.replace("""        <canvas id="lv-spectrum" class="lv-spectrum" width="600" height="128" aria-hidden="true"></canvas>
      </div>""", """      </div>""")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- CSS:可视化层/工具条/唱片墙 ----
p = 'public/css/app.css'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""/* 搜索/命令面板结果下滑进入(原版 search-results-in) */""",
""".lv-visual { position: absolute; inset: 0; z-index: 1; opacity: .9; }
.lv-toolbar { position: absolute; top: 18px; right: 22px; z-index: 3; display: flex; gap: 8px; }
.lv-toolbar .btn { font-size: 12.5px; padding: 7px 14px; }

/* 唱片墙(CSS 3D 封面墙) */
.wall-stage { perspective: 1400px; perspective-origin: 50% 30%; }
.wall-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 26px;
  transform: rotateX(12deg) scale(.96); transform-style: preserve-3d;
}
.wall-card {
  position: relative; border-radius: 16px; overflow: hidden; cursor: pointer;
  aspect-ratio: 1; background: var(--panel-hi);
  border: 1px solid rgba(var(--accent-rgb), .2);
  box-shadow: 0 20px 50px rgba(0, 0, 0, .4);
  transition: transform var(--t-med), box-shadow var(--t-med), border-color var(--t-med);
}
.wall-card:hover {
  transform: translateZ(46px) translateY(-6px);
  box-shadow: 0 36px 90px rgba(0, 0, 0, .55), 0 0 34px rgba(var(--accent-rgb), .3);
  border-color: rgba(var(--accent-rgb), .5); z-index: 3;
}
.wall-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
.wall-card .wall-label {
  position: absolute; left: 12px; right: 12px; bottom: 10px;
  font-weight: 650; font-size: 13.5px; color: #fff; text-shadow: 0 2px 10px rgba(0, 0, 0, .7);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.wall-card .wall-sub { position: absolute; left: 12px; bottom: 34px; font-size: 11px; color: rgba(255,255,255,.72); text-shadow: 0 2px 8px rgba(0,0,0,.7); }

/* 搜索/命令面板结果下滑进入(原版 search-results-in) */""")
io.open(p, 'w', encoding='utf-8').write(s)
print('visual integration OK')
