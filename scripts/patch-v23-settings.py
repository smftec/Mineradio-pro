# v2.3.0 补丁:可视化默认模式 + ffmpeg 路径设置
import io

# ---- store 默认 ----
p = 'desktop/lib/store.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("    accentColor: 'galaxy',", "    accentColor: 'galaxy',\n    visualMode: 'particles',\n    ffmpegPath: '',")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- transcode.js:支持自定义 ffmpeg 路径 ----
p = 'desktop/lib/audio/transcode.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""export function detectFfmpeg() {
  if (ffmpegChecked) return ffmpegPath;
  ffmpegChecked = true;
  const candidates = ['ffmpeg'];
  try {
    const r = spawnSync('ffmpeg', ['-version'], { timeout: 5000 });
    if (r.status === 0) { ffmpegPath = 'ffmpeg'; return ffmpegPath; }
  } catch { /* not in PATH */ }
  void candidates;
  ffmpegPath = null;
  return null;
}""",
"""export function detectFfmpeg() {
  if (ffmpegChecked) return ffmpegPath;
  ffmpegChecked = true;
  // 设置中自定义路径优先
  const custom = getStore('config').data.ffmpegPath;
  if (custom) {
    try {
      const r = spawnSync(custom, ['-version'], { timeout: 5000 });
      if (r.status === 0) { ffmpegPath = custom; return ffmpegPath; }
    } catch { /* invalid path */ }
  }
  try {
    const r = spawnSync('ffmpeg', ['-version'], { timeout: 5000 });
    if (r.status === 0) { ffmpegPath = 'ffmpeg'; return ffmpegPath; }
  } catch { /* not in PATH */ }
  ffmpegPath = null;
  return null;
}""")
s = s.replace("import { app } from 'electron';", "import { app } from 'electron';\nimport { getStore } from '../store.js';")
s = s.replace("""export function detectFfmpeg() {
  if (ffmpegChecked) return ffmpegPath;""",
"""export function resetFfmpegCache() { ffmpegChecked = false; }

export function detectFfmpeg() {
  if (ffmpegChecked) return ffmpegPath;""")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- ipc:ffmpeg 检测 ----
p = 'desktop/lib/ipc.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("import * as translation from './translation.js';",
              "import * as translation from './translation.js';\nimport { detectFfmpeg, resetFfmpegCache } from './audio/transcode.js';")
s = s.replace("""  ipcMain.handle('translation:getConfig', () => translation.getConfig());""",
"""  ipcMain.handle('app:checkFfmpeg', () => {
    resetFfmpegCache();
    const path = detectFfmpeg();
    return { found: !!path, path: path || '' };
  });
  ipcMain.handle('translation:getConfig', () => translation.getConfig());""")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- preload ----
p = 'desktop/preload.cjs'
s = io.open(p, encoding='utf-8').read()
s = s.replace("'translation:getConfig', 'translation:set', 'translation:test', 'translation:translate',",
              "'translation:getConfig', 'translation:set', 'translation:test', 'translation:translate', 'app:checkFfmpeg',")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- settings-view.js:外观组加可视化模式;音乐库组加 ffmpeg ----
p = 'public/js/settings-view.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""      <div class="set-row"><label>主题色</label>""",
"""      <div class="set-row"><label>可视化模式</label>
        <select id="set-visual">
          ${[['particles', '频谱粒子'], ['ring', '环形频谱'], ['wave', '波形流动']].map(([v, n]) =>
            `<option value="${v}" ${(cfg.visualMode || 'particles') === v ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
        <span class="val">歌词视图背景可视化(视图内也可循环切换)</span>
      </div>
      <div class="set-row"><label>主题色</label>""")
s = s.replace("""      <div class="set-row">
        <button class="btn primary" id="set-add-folder">导入文件夹</button>
        <button class="btn" id="set-add-files">导入文件</button>
        <button class="btn" id="set-rescan">重新扫描</button>
      </div>""",
"""      <div class="set-row">
        <button class="btn primary" id="set-add-folder">导入文件夹</button>
        <button class="btn" id="set-add-files">导入文件</button>
        <button class="btn" id="set-rescan">重新扫描</button>
      </div>
      <div class="set-row"><label>ffmpeg 路径</label>
        <input type="text" class="set-input" id="set-ffmpeg" placeholder="自动检测系统 PATH;可指定 ffmpeg.exe 完整路径" value="${esc(cfg.ffmpegPath || '')}">
        <button class="btn" id="set-ffmpeg-save">保存</button>
        <button class="btn" id="set-ffmpeg-check">检测</button>
        <span class="val" id="ffmpeg-status">用于 APE 转码播放</span>
      </div>""")
s = s.replace("""  // 全局媒体键""",
"""  // 可视化模式
  root.querySelector('#set-visual').addEventListener('change', (e) => {
    api.invoke('config:set', { visualMode: e.target.value });
    toast('可视化模式已保存,重新打开歌词视图生效');
  });

  // ffmpeg 路径
  root.querySelector('#set-ffmpeg-save').addEventListener('click', async () => {
    await api.invoke('config:set', { ffmpegPath: root.querySelector('#set-ffmpeg').value.trim() });
    toast('ffmpeg 路径已保存');
  });
  root.querySelector('#set-ffmpeg-check').addEventListener('click', async () => {
    await api.invoke('config:set', { ffmpegPath: root.querySelector('#set-ffmpeg').value.trim() });
    const r = await api.invoke('app:checkFfmpeg');
    const box = root.querySelector('#ffmpeg-status');
    box.innerHTML = r.found
      ? `<span style="color:#4ade80">✓ 检测到 ffmpeg(${esc(r.path)})</span>`
      : '<span style="color:var(--danger)">✕ 未检测到 ffmpeg — APE 播放需要安装 ffmpeg.org</span>';
  });

  // 全局媒体键""")
io.open(p, 'w', encoding='utf-8').write(s)
print('settings OK')
