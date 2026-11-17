# v2.4.0 壁纸补丁:路径/preload/频谱推送/页面/设置页
import io

# ---- wallpaper.js 修正 ----
p = 'desktop/lib/wallpaper.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""import { BrowserWindow } from 'electron';
import { createRequire } from 'node:module';""",
"""import { BrowserWindow } from 'electron';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));""")
s = s.replace("""      preload: null,
      contextIsolation: true,""",
"""      preload: join(__dirname, '..', 'preload.cjs'),
      contextIsolation: true,""")
s = s.replace("""  wallpaperWindow.loadFile(join('public', 'wallpaper.html'), { query: {} });""",
"""  wallpaperWindow.loadFile(join(__dirname, '..', '..', 'public', 'wallpaper.html'));""")
s = s.replace("void join;", "")
# 频率:loadFile 后 ready-to-show
s = s.replace("""  wallpaperWindow.setIgnoreMouseEvents(true);
  wallpaperWindow.loadFile""",
"""  wallpaperWindow.setIgnoreMouseEvents(true);
  wallpaperWindow.once('ready-to-show', () => { try { wallpaperWindow.showInactive(); } catch {} });
  wallpaperWindow.loadFile""")
io.open(p, 'w', encoding='utf-8').write(s)
print('wallpaper.js fixed')

# ---- 主窗:频谱推送(30fps 节流) ----
p = 'public/js/app.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""  // 周期保存
  player.startProgressSaver();
  player.startSessionSaver();""",
"""  // 周期保存
  player.startProgressSaver();
  player.startSessionSaver();

  // 频谱数据推送(桌面壁纸联动,30fps 节流)
  let lastSpecPush = 0;
  setInterval(() => {
    const now = performance.now();
    if (now - lastSpecPush < 33) return;
    lastSpecPush = now;
    const spec = player.getSpectrum();
    if (spec) window.mpro.send('player:spec', Array.from(spec));
  }, 33);""")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- ipc.js:spec 广播 + 壁纸 handlers ----
p = 'desktop/lib/ipc.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""import {
  createMainWindow, createMiniWindow, closeMiniWindow,
  createDesktopLyricsWindow, closeDesktopLyricsWindow, windows,
} from './windows.js';""",
"""import {
  createMainWindow, createMiniWindow, closeMiniWindow,
  createDesktopLyricsWindow, closeDesktopLyricsWindow, windows,
} from './windows.js';
import { mountWallpaper, unmountWallpaper } from './wallpaper.js';""")
s = s.replace("""  ipcMain.on('player:tick', (e, tick) => {
    broadcastExcept(e.sender, 'player:tick', tick);
  });""",
"""  ipcMain.on('player:tick', (e, tick) => {
    broadcastExcept(e.sender, 'player:tick', tick);
  });
  ipcMain.on('player:spec', (e, bins) => {
    broadcastExcept(e.sender, 'player:spec', bins);
  });
  ipcMain.handle('wallpaper:mount', (_e, mode) => mountWallpaper(mode));
  ipcMain.handle('wallpaper:unmount', () => unmountWallpaper());
  ipcMain.handle('wallpaper:isMounted', () => Boolean(wallpaperWindow && !wallpaperWindow.isDestroyed()));""")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- preload:通道 ----
p = 'desktop/preload.cjs'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""  'player:state', 'player:tick', 'player:command', 'mini:collapsed',""",
"""  'player:state', 'player:tick', 'player:command', 'mini:collapsed', 'player:spec', 'wallpaper:config',""")
s = s.replace("'fav:toggle', 'shortcuts:setMediaKeys', 'backup:export', 'backup:import', 'backup:relaunch',",
              "'fav:toggle', 'shortcuts:setMediaKeys', 'backup:export', 'backup:import', 'backup:relaunch',\n  'wallpaper:mount', 'wallpaper:unmount', 'wallpaper:isMounted',")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- public/wallpaper.html + js ----
with open('public/wallpaper.html', 'w', encoding='utf-8') as f:
    f.write("""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' mpro: data:; connect-src 'self'">
  <title>Mineradio pro — 动态壁纸</title>
  <style>
    html, body { margin: 0; height: 100%; background: #0b0d14; overflow: hidden; }
    canvas { width: 100vw; height: 100vh; display: block; }
  </style>
</head>
<body>
  <canvas id="wp-canvas" width="1920" height="1080"></canvas>
  <script type="module" src="./js/wallpaper.js"></script>
</body>
</html>
""")

with open('public/js/wallpaper.js', 'w', encoding='utf-8') as f:
    f.write("""// 动态桌面壁纸:WebGL 着色器可视化,频谱数据由主窗口经 IPC 推送
import { ShaderEngine } from './webgl-engine.js';

const canvas = document.getElementById('wp-canvas');
const engine = new ShaderEngine(canvas);
engine.specOverride = new Uint8Array(32);
engine.active = true;

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
for (const id of ['nebula', 'cadenza', 'hanabi', 'machi', 'nebbla', 'fume']) engine.register(id);
engine.use(mode);

// 频谱数据
window.mpro?.on('player:spec', (bins) => {
  if (bins && bins.length) engine.specOverride = Uint8Array.from(bins);
});
console.log('[wallpaper] ready, engine ok:', engine.ok, 'mode:', mode);
""")

# ---- 设置页:动态壁纸开/关 ----
p = 'public/js/settings-view.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""    <div class="set-group">
      <h3>歌词翻译</h3>""",
"""    <div class="set-group">
      <h3>动态桌面壁纸</h3>
      <div class="set-row"><label>启用动态壁纸</label>
        <button class="btn primary" id="btn-wallpaper-on">挂载到桌面</button>
        <button class="btn" id="btn-wallpaper-off">卸载恢复</button>
        <span class="val">将可视化画面(跟随播放)挂载到桌面图标层之后;会话退出时自动卸载</span>
      </div>
      <div class="update-status" id="wallpaper-status"></div>
    </div>

    <div class="set-group">
      <h3>歌词翻译</h3>""")
s = s.replace("""  // 全局媒体键""",
"""  // 动态桌面壁纸
  const wpStatus = root.querySelector('#wallpaper-status');
  const setWpStatus = (t, ok) => { wpStatus.innerHTML = `<div class="val" style="color:${ok ? '#4ade80' : 'var(--danger)'}">${esc(t)}</div>`; };
  root.querySelector('#btn-wallpaper-on').addEventListener('click', async () => {
    setWpStatus('正在挂载到桌面…', true);
    const r = await api.invoke('wallpaper:mount', cfg.visualMode || 'nebula');
    setWpStatus(r.ok ? '✓ 已挂载 — 可视化壁纸运行中(播放联动)' : `✕ ${r.reason || '挂载失败'}`, r.ok);
  });
  root.querySelector('#btn-wallpaper-off').addEventListener('click', async () => {
    const r = await api.invoke('wallpaper:unmount');
    setWpStatus(r.ok ? '已卸载,桌面已恢复' : '卸载失败', r.ok);
  });

  // 全局媒体键""")
io.open(p, 'w', encoding='utf-8').write(s)
print('wallpaper UI OK')
