# v2.1.0 JS 补丁:更新徽标 SVG 环 / 歌词 leaving / 主题脉冲 / Home drift / 面板 out
import io

# ---- index.html:更新徽标升级为 SVG 环 ----
p = 'public/index.html'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""        <button id="btn-update-badge" class="tb-btn update-badge hidden" title="发现新版本">
          <svg viewBox="0 0 24 24" class="ico"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v6h-6"/></svg>
          <span class="dot"></span>
        </button>""",
"""        <button id="btn-update-badge" class="tb-btn update-badge hidden" title="发现新版本" aria-label="软件更新">
          <svg class="update-ring-svg" viewBox="0 0 34 34">
            <circle class="ring-base" cx="17" cy="17" r="15"/>
            <circle class="ring-dash" cx="17" cy="17" r="15"/>
            <circle class="ring-progress" cx="17" cy="17" r="15"/>
            <path class="ring-arrow" d="M17 10v8M13.5 14.5L17 10.5l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
          <span class="dot"></span>
        </button>""")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- app.js:徽标状态机(SVG 环)+ 歌词 leaving + 主题脉冲 + Home drift ----
p = 'public/js/app.js'
s = io.open(p, encoding='utf-8').read()

# 徽标状态机:替换 bindUpdateEvents 与 badge 点击行为
s = s.replace("""function bindUpdateEvents() {
  api.on('update:event', (ev) => {
    state.updateState = ev;
    if (ev.type === 'available') {
      $('btn-update-badge').classList.remove('hidden');
      toast(`发现新版本 v${ev.version},可到设置中下载更新`, 5000);
    }
    if (ev.type === 'downloaded') toast('更新下载完成,重启后安装', 4000);
    if (state.view === 'settings') {
      renderUpdateStatus(document.getElementById('view-root'), ev);
    }
  });
  state.checkUpdate = async () => {
    state.updateState = { type: 'checking' };
    renderUpdateStatus(document.getElementById('view-root'), state.updateState);
    await api.invoke('update:check');
  };
}""",
"""function bindUpdateEvents() {
  const badge = $('btn-update-badge');
  const setBadgeState = (cls) => {
    badge.className = 'tb-btn update-badge ' + cls;
    badge.classList.toggle('hidden', cls === 'idle' || cls === 'not-available');
  };
  api.on('update:event', (ev) => {
    state.updateState = ev;
    switch (ev.type) {
      case 'checking': setBadgeState('checking'); break;
      case 'available':
        setBadgeState('has-update');
        toast(`发现新版本 v${ev.version},可到设置中下载更新`, 5000);
        break;
      case 'not-available': setBadgeState('idle'); break;
      case 'progress':
        setBadgeState('downloading');
        // 进度环:percent → stroke-dashoffset(周长 100)
        const ring = badge.querySelector('.ring-progress');
        if (ring) ring.style.strokeDashoffset = String(100 - (ev.percent || 0));
        break;
      case 'downloaded':
        setBadgeState('ready');
        toast('更新下载完成,重启后安装', 4000);
        break;
      case 'error': setBadgeState('idle'); break;
    }
    if (state.view === 'settings') {
      renderUpdateStatus(document.getElementById('view-root'), ev);
    }
  });
  state.checkUpdate = async () => {
    state.updateState = { type: 'checking' };
    setBadgeState('checking');
    renderUpdateStatus(document.getElementById('view-root'), state.updateState);
    await api.invoke('update:check');
  };
}""")

# 歌词 leaving 行(切换时 lyr-out)
s = s.replace("""    if (idx !== this.activeIdx) {
      this.activeIdx = idx;
      const box = this.el.querySelector('#lv-lyrics');
      box.querySelectorAll('.lv-line.active').forEach((e) => e.classList.remove('active'));""",
"""    if (idx !== this.activeIdx) {
      const prevEl = this.el.querySelector('.lv-line.active');
      if (prevEl && this.lines[idx - 1] !== undefined) {
        // 旧行 3D 退出(lyr-out),700ms 后清理
        const prev = prevEl;
        prev.classList.add('leaving');
        setTimeout(() => prev.classList.remove('leaving'), 720);
      }
      this.activeIdx = idx;
      const box = this.el.querySelector('#lv-lyrics');
      box.querySelectorAll('.lv-line.active').forEach((e) => e.classList.remove('active'));""")

# 主题色切换:body 脉冲
s = s.replace("""state.applyAccent = async function (accent) {
  state.config.accentColor = accent;
  if (accent === 'galaxy') delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = accent;
  await api.invoke('config:set', { accentColor: accent });
};""",
"""state.applyAccent = async function (accent) {
  state.config.accentColor = accent;
  if (accent === 'galaxy') delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = accent;
  document.body.classList.add('accent-pulse');
  setTimeout(() => document.body.classList.remove('accent-pulse'), 740);
  await api.invoke('config:set', { accentColor: accent });
};""")

# Home 视觉区:未播放时漂移、播放时去漂移(renderHome 内已按 playing 处理 eq;drift 交给 CSS:在 renderHome 中给 .home-visual 加 drift class 当 !playing)
s = s.replace("""          <div class="home-visual">""",
"""          <div class="home-visual ${playing ? '' : 'drift'}">""")

# Home tiles 悬浮(克制 ±2px)
s = s.replace("""        return `<div class="home-tile" data-album="${esc(t.album)}">""",
"""        return `<div class="home-tile float" data-album="${esc(t.album)}">""")

# 歌词视图关闭:fx-panel-out(closing 类延迟移除)
s = s.replace("""  close() {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    if (this._unregSpectrum) { this._unregSpectrum(); this._unregSpectrum = null; }
    this.el?.remove();""",
"""  close() {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    if (this._unregSpectrum) { this._unregSpectrum(); this._unregSpectrum = null; }
    const el = this.el;
    if (el) {
      el.classList.add('closing');
      setTimeout(() => el.remove(), 280);
    }
    this.el = null;""")

io.open(p, 'w', encoding='utf-8').write(s)
print('fx js OK')
