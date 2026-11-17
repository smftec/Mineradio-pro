# v2.8.0 补丁:Folia 模式细节 + 设置页分组导航
import io

# ---- 1. body 加 desktop-shell(标题栏保留在 Folia 之上) ----
p = 'public/index.html'
s = io.open(p, encoding='utf-8').read()
s = s.replace('<body>', '<body class="desktop-shell">')
io.open(p, 'w', encoding='utf-8').write(s)
print('body class OK')

# ---- 2. CSS:切换按钮 active 态 + Folia 模式细节 ----
p = 'public/css/app.css'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""/* 扫描进度浮条 */""",
"""/* Folia 模式细节 */
#btn-folia-switch.active { color: var(--accent2); background: rgba(var(--accent-rgb), .18); }
#btn-folia-switch.active .ico { color: var(--accent2); }
body.folia-interface-active #titlebar .tb-search { pointer-events: none; opacity: .55; }
body.folia-interface-active #playerbar,
body.folia-interface-active #body,
body.folia-interface-active #toast-wrap { visibility: hidden; }
body.folia-interface-active #titlebar { border-bottom-color: rgba(var(--accent-rgb), .35); }

/* 扫描进度浮条 */""")
io.open(p, 'w', encoding='utf-8').write(s)
print('css OK')

# ---- 3. app.js:快捷键守卫 + 按钮状态同步 + 频谱挂起检查 ----
p = 'public/js/app.js'
s = io.open(p, encoding='utf-8').read()

# 快捷键守卫:Folia 激活时跳过全局快捷键(Folia 自有键盘处理,避免双触发)
s = s.replace("""    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCmdK();
      return;
    }""",
"""    // Folia 界面激活时:全局快捷键让位给 Folia 自有处理(避免双触发)
    if (document.body.classList.contains('folia-interface-active')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCmdK();
      return;
    }""")

# 切换按钮状态同步(监听 body class 变化太重;在切换处直接维护)
s = s.replace("""  $('btn-folia-switch')""", """  $('btn-folia-switch')""") if "$('btn-folia-switch')" in s else s

# 绑定切换按钮(当前只有 HTML 属性,宿主 load 时自动绑定 click;补 active 态同步)
s = s.replace("""function bindWallpaperState() {
  api.on('wallpaper:state', (s2) => { state.wallpaperActive = !!s2.active; });
}""",
"""function bindWallpaperState() {
  api.on('wallpaper:state', (s2) => { state.wallpaperActive = !!s2.active; });
}

// Folia 界面切换按钮:active 视觉态同步
function bindFoliaSwitch() {
  const btn = $('btn-folia-switch');
  if (!btn) return;
  const sync = () => {
    const active = document.body.classList.contains('folia-interface-active');
    btn.classList.toggle('active', active);
    btn.title = active ? '切回 Mineradio 界面' : '切换 Folia 界面';
  };
  // 宿主 setInterface 翻转 body class;MutationObserver 轻量监听属性变化
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  sync();
}""")
s = s.replace("""  bindUpdateEvents();
  bindWallpaperState();""",
"""  bindUpdateEvents();
  bindWallpaperState();
  bindFoliaSwitch();""")

# 启动时恢复上次界面选择已存在;补充:Folia 激活时 home 视图渲染挂起标志已被 adapter 处理
io.open(p, 'w', encoding='utf-8').write(s)
print('app.js folia UX OK')

# ---- 4. visualizer.js:Home 频谱在 Folia 激活时跳过 ----
p = 'public/js/visualizer.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""    if (r.canvas.id === 'pb-spectrum' && window.__lyricsOverlay) continue;
    if (!r.canvas.isConnected) continue;""",
"""    if (r.canvas.id === 'pb-spectrum' && window.__lyricsOverlay) continue;
    if (window.__suspendHomeVisual && r.canvas.id === 'home-spectrum') continue;
    if (!r.canvas.isConnected) continue;""")
io.open(p, 'w', encoding='utf-8').write(s)
print('visualizer skip OK')

# ---- 5. 设置页分组导航(sticky 侧锚 + scroll-spy) ----
p = 'public/js/settings-view.js'
s = io.open(p, encoding='utf-8').read()
old = """  root.innerHTML = `<div class="settings">
    <h1>设置</h1>"""
assert old in s, 'settings anchor'
s = s.replace(old, """  root.innerHTML = `<div class="settings" style="position:relative">
    <aside class="settings-nav" id="settings-nav"></aside>
    <div class="settings-body">
    <h1>设置</h1>""")
# 收尾:settings-body 闭合
old = """    <div class="set-group">
      <h3>关于</h3>
      <div class="set-row"><label>Mineradio pro</label><span class="val">版本 ${esc(appInfo.version)} ${appInfo.packaged ? '' : '(开发模式)'}</span></div>
      <div class="set-row"><label>说明</label><span class="val">本地音乐播放器 · 纯本地播放,不上传任何数据 · 支持软件检测与自动更新</span></div>
    </div>
  </div>`;"""
assert old in s, 'settings close anchor'
s = s.replace(old, """    <div class="set-group">
      <h3>关于</h3>
      <div class="set-row"><label>Mineradio pro</label><span class="val">版本 ${esc(appInfo.version)} ${appInfo.packaged ? '' : '(开发模式)'}</span></div>
      <div class="set-row"><label>说明</label><span class="val">本地音乐播放器 · 纯本地播放,不上传任何数据 · 支持软件检测与自动更新</span></div>
    </div>
    </div>
  </div>`;""")
# 绑定导航(scroll-spy)
old = """  bindSettings(root, state);
  renderUpdateStatus(root, state.updateState);"""
assert old in s, 'bind anchor'
s = s.replace(old, """  bindSettings(root, state);
  renderUpdateStatus(root, state.updateState);
  buildSettingsNav(root);""")
io.open(p, 'w', encoding='utf-8').write(s)
print('settings nav markup OK')

# ---- settings-view.js 末尾:buildSettingsNav ----
s = io.open(p, encoding='utf-8').read()
s += """
// ---------- 设置页分组导航(sticky 锚点 + scroll-spy) ----------
function buildSettingsNav(root) {
  const groups = [...root.querySelectorAll('.set-group')];
  const nav = root.querySelector('#settings-nav');
  if (!nav || groups.length < 2) { if (nav) nav.style.display = 'none'; return; }
  groups.forEach((g, i) => {
    if (!g.id) g.id = 'sg-' + i;
    g.dataset.navName = (g.querySelector('h3')?.textContent || ('组 ' + (i + 1))).replace('⭐ ', '').trim();
  });
  nav.innerHTML = groups.map((g) => `<a class="sn-item" href="#${g.id}" data-for="${g.id}">${esc(g.dataset.navName)}</a>`).join('');
  nav.querySelectorAll('.sn-item').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = root.querySelector('#' + CSS.escape(a.dataset.for));
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  // scroll-spy
  const content = document.getElementById('content');
  const spy = () => {
    let current = groups[0];
    for (const g of groups) {
      if (g.getBoundingClientRect().top <= 120) current = g;
    }
    nav.querySelectorAll('.sn-item').forEach((a) => a.classList.toggle('active', a.dataset.for === current.id));
  };
  content.addEventListener('scroll', spy, { passive: true });
  spy();
}
"""
io.open(p, 'w', encoding='utf-8').write(s)
print('nav fn OK')

# ---- CSS:settings 布局(双栏)+ 导航样式 ----
p = 'public/css/app.css'
s = io.open(p, encoding='utf-8').read()
s = s.replace(""".settings { max-width: 820px; }
.settings h1 { margin-bottom: 20px; }""",
""".settings { max-width: 980px; position: relative; }
.settings-body { max-width: 820px; }
.settings h1 { margin-bottom: 20px; }
.settings-nav {
  position: sticky; top: 8px; float: right; width: 148px; margin-left: 24px;
  display: flex; flex-direction: column; gap: 2px; padding: 10px 8px;
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg);
  max-height: calc(100vh - 180px); overflow-y: auto;
}
.sn-item {
  padding: 6px 10px; border-radius: 7px; font-size: 12px; color: var(--muted);
  text-decoration: none; cursor: pointer; transition: background var(--t-fast), color var(--t-fast);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sn-item:hover { background: var(--panel-hi); color: var(--text); }
.sn-item.active { background: rgba(var(--accent-rgb), .16); color: var(--accent2); font-weight: 600; }
@media (max-width: 1180px) { .settings-nav { display: none; } }""")
io.open(p, 'w', encoding='utf-8').write(s)
print('settings css OK')
