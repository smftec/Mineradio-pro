# v2.2.0 补丁:封面缩略图 + GPU 自愈 + 代码清理 + ARIA
import io

# ---- A1. metadata.js:封面缩略生成(nativeImage 96px) ----
p = 'desktop/lib/metadata.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""import electron from 'electron';
const { app } = electron;""",
"""import electron from 'electron';
const { app, nativeImage } = electron;""")
s = s.replace("""  const name = `${hash}.${ext}`;
  const file = join(coverDir, name);
  if (!existsSync(file)) {
    try { writeFileSync(file, Buffer.from(picture.data)); } catch { return null; }
  }
  return file; // 绝对路径,渲染端经 mpro:// 读取
}""",
"""  const name = `${hash}.${ext}`;
  const file = join(coverDir, name);
  if (!existsSync(file)) {
    try { writeFileSync(file, Buffer.from(picture.data)); } catch { return null; }
  }
  // 同步生成 96px 缩略(列表 38px/播放条 58px 使用,避免全尺寸解码开销)
  const thumbName = `${hash}_t.jpg`;
  const thumbFile = join(coverDir, thumbName);
  if (!existsSync(thumbFile)) {
    try {
      const img = nativeImage.createFromBuffer(Buffer.from(picture.data));
      if (!img.isEmpty()) {
        img.resize({ width: 96 }).toJPEG(82);
        writeFileSync(thumbFile, img.resize({ width: 96 }).toJPEG(82));
      }
    } catch { /* 缩略失败回退原图 */ }
  }
  return file; // 绝对路径,渲染端经 mpro:// 读取
}

// 惰性补齐:为已有封面但缺缩略的曲目生成缩略(启动后台执行一次)
export function ensureThumbs(tracks) {
  if (!coverDir) return 0;
  let done = 0;
  for (const t of tracks) {
    if (!t.cover || t.thumb) continue;
    const base = t.cover.replace(/[\\\\/][^\\\\/]+$/, '');
    const m = t.cover.match(/([0-9a-f]{16})\\./);
    if (!m) continue;
    const thumbFile = join(base, `${m[1]}_t.jpg`);
    try {
      if (existsSync(thumbFile)) { t.thumb = thumbFile; continue; }
      const img = nativeImage.createFromFile(t.cover);
      if (!img.isEmpty()) {
        writeFileSync(thumbFile, img.resize({ width: 96 }).toJPEG(82));
        t.thumb = thumbFile;
        done++;
      }
    } catch { /* ignore */ }
  }
  return done;
}""")
s = s.replace("import { mkdirSync, writeFileSync, existsSync } from 'node:fs';",
              "import { mkdirSync, writeFileSync, existsSync } from 'node:fs';")
io.open(p, 'w', encoding='utf-8').write(s)
print('metadata thumbs OK')

# ---- A2. library.js:启动后台补 thumb + 落库 ----
p = 'desktop/lib/library.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""  const folders = store.data.folders || [];
  if (folders.length) {
    // 后台静默同步标签变更(mtime 变化的重新解析)
    syncChangedFiles();
    startWatcher(folders);
  }""",
"""  const folders = store.data.folders || [];
  if (folders.length) {
    // 后台静默同步标签变更(mtime 变化的重新解析)
    syncChangedFiles();
    startWatcher(folders);
  }
  // 后台惰性补齐封面缩略
  setTimeout(() => {
    try {
      const { ensureThumbs } = require_meta();
      const n = ensureThumbs(allTracks());
      if (n > 0) { store.scheduleSave(); send('library:changed', { tracks: allTracks() }); }
      console.log('[thumbs] ensured:', n);
    } catch (e) { console.error('[thumbs]', e.message); }
  }, 4000);
})

// 动态引入(避免循环依赖:metadata → library)
function require_meta() {
  return import('./metadata.js');
}""")
io.open(p, 'w', encoding='utf-8').write(s)
print('library thumbs OK')

# ---- A3. 渲染端:thumbUrl + 使用点 ----
p = 'public/js/api.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""// track.cover 由主进程保存为封面缓存的绝对路径
export function coverUrl(track) {
  return track && track.cover ? mediaUrl(track.cover) : null;
}""",
"""// track.cover 由主进程保存为封面缓存的绝对路径
export function coverUrl(track) {
  return track && track.cover ? mediaUrl(track.cover) : null;
}

// 小尺寸展示用缩略(96px,列表/播放条);无缩略回退原图
export function thumbUrl(track) {
  if (track && track.thumb) return mediaUrl(track.thumb);
  return coverUrl(track);
}""")
io.open(p, 'w', encoding='utf-8').write(s)

p = 'public/js/views.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("import { api, coverUrl, fmtTime, esc, toast } from './api.js';",
              "import { api, coverUrl, thumbUrl, fmtTime, esc, toast } from './api.js';")
s = s.replace("""function trackRow(t, i, playingId) {
  const cover = coverUrl(t) || DEFAULT_COVER;""",
"""function trackRow(t, i, playingId) {
  const cover = thumbUrl(t) || DEFAULT_COVER;""")
s = s.replace("""    <img class="t-cover" src="${cover}" loading="lazy" alt="" onerror="this.src='${DEFAULT_COVER}'">""",
"""    <img class="t-cover" src="${cover}" loading="lazy" alt="" onerror="this.src='${DEFAULT_COVER}'">""")
# Home 拼贴与唱片保持原图;播放条用 thumb
s = s.replace("""  $('pb-cover').src = coverUrl(t) || './assets/default-cover.png';""",
"""  $('pb-cover').src = thumbUrl(t) || './assets/default-cover.png';""")
io.open(p, 'w', encoding='utf-8').write(s)

p = 'public/js/mini.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""  $('m-cover').src = st.cover ? `mpro://media/?path=${encodeURIComponent(st.cover)}` : './assets/default-cover.png';""",
"""  $('m-cover').src = st.thumb ? `mpro://media/?path=${encodeURIComponent(st.thumb)}` : (st.cover ? `mpro://media/?path=${encodeURIComponent(st.cover)}` : './assets/default-cover.png');""")
io.open(p, 'w', encoding='utf-8').write(s)
print('renderer thumbs OK')

# ---- B. GPU 崩溃自愈(bootstrap 标记 + main 监听) ----
p = 'desktop/bootstrap.cjs'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""const { app, protocol } = require('electron');

// 开发模式(未打包)下,项目可能位于网络/虚拟盘(T: 等),
// Windows 沙箱进程无法读取其上的 Electron 安装目录 → 禁用沙箱。
// 打包安装到本地盘后不受影响。
if (!app.isPackaged) {""",
"""const { app, protocol } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// GPU 崩溃自愈标记:上次 GPU 崩溃后禁用硬件加速启动
let gpuDisabled = false;
try {
  const flag = path.join(app.getPath('userData'), 'gpu-disabled.flag');
  if (fs.existsSync(flag)) { gpuDisabled = true; }
  if (gpuDisabled) app.disableHardwareAcceleration();
  global.__gpuFlagPath = flag;
} catch { /* ignore */ }

// 开发模式(未打包)下,项目可能位于网络/虚拟盘(T: 等),
// Windows 沙箱进程无法读取其上的 Electron 安装目录 → 禁用沙箱。
// 打包安装到本地盘后不受影响。
if (!app.isPackaged) {""")
io.open(p, 'w', encoding='utf-8').write(s)

p = 'desktop/main.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""// 全局异常日志(便于排查用户反馈的问题)""",
"""// GPU 进程崩溃自愈:写标记禁用硬件加速并重启(标记由 bootstrap 读取)
app.on('child-process-gone', (_e, details) => {
  if (details.type === 'GPUProcess' && details.reason === 'Crashed') {
    console.error('[gpu] crashed — disabling hardware acceleration and relaunching');
    try {
      const flag = global.__gpuFlagPath;
      if (flag) require('node:fs').writeFileSync(flag, String(Date.now()));
      app.relaunch();
      app.exit(0);
    } catch { /* ignore */ }
  }
});

// 全局异常日志(便于排查用户反馈的问题)""")
io.open(p, 'w', encoding='utf-8').write(s)
print('gpu guard OK')

# ---- C. 代码清理 ----
p = 'public/js/views.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""    if (player.current) state.navigate('library').then ? null : null;
    document.getElementById('pb-lyrics').click();""",
"""    document.getElementById('pb-lyrics').click();""")
s = s.replace("export function bindTableRow(tr, state, tracks, playlistId = null, playFn = null) {",
              "export function bindTableRow(tr, state, tracks, playlistId = null) {")
s = s.replace("""    const idx = tracks.findIndex((t) => t.id === id);
    if (idx >= 0) (playFn || state.playFromList)(tracks, idx);
  });
  tr.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    state.showTrackMenu(e, tracks.find((t) => t.id === id), playlistId);
  });
  tr.querySelector('.t-artist')?.addEventListener('click', () => state.navigate('artists', { value: tr.querySelector('.t-artist').dataset.artist }));
  tr.querySelector('.t-album')?.addEventListener('click', () => state.navigate('albums', { value: tr.querySelector('.t-album').dataset.album }));
}""",
"""    const idx = tracks.findIndex((t) => t.id === id);
    if (idx >= 0) state.playFromList(tracks, idx);
  });
  tr.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    state.showTrackMenu(e, tracks.find((t) => t.id === id), playlistId);
  });
  tr.querySelector('.t-artist')?.addEventListener('click', () => state.navigate('artists', { value: tr.querySelector('.t-artist').dataset.artist }));
  tr.querySelector('.t-album')?.addEventListener('click', () => state.navigate('albums', { value: tr.querySelector('.t-album').dataset.album }));
}""")
io.open(p, 'w', encoding='utf-8').write(s)
print('cleanup OK')

# ---- D. ARIA 补全(index.html 播放条按钮) ----
p = 'public/index.html'
s = io.open(p, encoding='utf-8').read()
for old, new in [
  ('<button id="pb-play" class="pb-playbtn" title="播放/暂停">', '<button id="pb-play" class="pb-playbtn" title="播放/暂停" aria-label="播放或暂停">'),
  ('<button id="pb-prev" class="pb-iconbtn big" title="上一首">', '<button id="pb-prev" class="pb-iconbtn big" title="上一首" aria-label="上一首">'),
  ('<button id="pb-next" class="pb-iconbtn big" title="下一首">', '<button id="pb-next" class="pb-iconbtn big" title="下一首" aria-label="下一首">'),
  ('<button id="pb-shuffle" class="pb-iconbtn" title="随机播放">', '<button id="pb-shuffle" class="pb-iconbtn" title="随机播放" aria-label="随机播放">'),
  ('<button id="pb-repeat" class="pb-iconbtn" title="循环模式">', '<button id="pb-repeat" class="pb-iconbtn" title="循环模式" aria-label="循环模式">'),
  ('<button id="pb-lyrics" class="pb-iconbtn" title="歌词视图">', '<button id="pb-lyrics" class="pb-iconbtn" title="歌词视图" aria-label="歌词视图">'),
  ('<button id="pb-queue" class="pb-iconbtn" title="播放队列">', '<button id="pb-queue" class="pb-iconbtn" title="播放队列" aria-label="播放队列">'),
  ('<button id="pb-mute" class="pb-iconbtn" title="静音">', '<button id="pb-mute" class="pb-iconbtn" title="静音" aria-label="静音">'),
  ('<button id="pb-mini" class="pb-iconbtn" title="迷你播放器">', '<button id="pb-mini" class="pb-iconbtn" title="迷你播放器" aria-label="迷你播放器">'),
  ('<button id="pb-fav" class="pb-iconbtn" title="喜欢">', '<button id="pb-fav" class="pb-iconbtn" title="喜欢" aria-label="喜欢">'),
]:
    s = s.replace(old, new)
io.open(p, 'w', encoding='utf-8').write(s)
print('aria OK')
