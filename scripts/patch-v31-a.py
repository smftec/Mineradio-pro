# v3.1.0 补丁:睡眠定时器 + 自定义封面 + 播放速度(IPC/store/preload/player)
import io

# ---- store ----
p = 'desktop/lib/store.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("    shortcuts: { mediaKeys: true },",
              "    shortcuts: { mediaKeys: true },\n    sleepTimer: { minutes: 0 },\n    playbackRate: 1,\n    customCovers: {},")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- player.js: rate + sleep timer ----
p = 'public/js/player.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""  _sinkId: 'default',
  _errorSkips: 0,""",
"""  _sinkId: 'default',
  _rate: 1,
  _sleepTimer: null,
  _errorSkips: 0,""")
s = s.replace("""  // 音频流(视频导出录制用;tap 不影响扬声器输出)""",
"""  // 播放速度
  setRate(rate) {
    this._rate = Math.max(0.25, Math.min(4, rate || 1));
    for (const el of Object.values(this._els)) { if (el) el.playbackRate = this._rate; }
  },
  getRate() { return this._rate || 1; },

  // 睡眠定时器:倒计时结束渐出暂停
  startSleepTimer(minutes, onEnd) {
    this.stopSleepTimer();
    if (!minutes || minutes <= 0) return;
    const ms = minutes * 60 * 1000;
    const start = performance.now();
    this._sleepTimer = setInterval(() => {
      if (performance.now() - start >= ms) {
        this.stopSleepTimer();
        const el = this._els[this._active];
        if (el && !el.paused) {
          const steps = 20; let step = 0;
          const fade = setInterval(() => {
            step++;
            const t = 1 - step / steps;
            this._els.A.volume = this.volume * t;
            this._els.B.volume = this.volume * t;
            if (step >= steps) {
              clearInterval(fade);
              el.pause();
              this._els.A.volume = this.volume;
              this._els.B.volume = this.volume;
              if (onEnd) onEnd();
            }
          }, 150);
        } else if (onEnd) onEnd();
      }
    }, 500);
  },
  stopSleepTimer() { clearInterval(this._sleepTimer); this._sleepTimer = null; },

  // 音频流(视频导出录制用;tap 不影响扬声器输出)""")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- ipc: 自定义封面 ----
p = 'desktop/lib/ipc.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""  ipcMain.handle('app:checkFfmpeg', () => {""",
"""  ipcMain.handle('cover:custom', async (_e, albumKey, srcPath) => {
    try {
      const { copyFileSync } = await import('node:fs');
      const { getCoverDir } = await import('./metadata.js');
      const dir = getCoverDir();
      if (!dir) return { ok: false, reason: 'cover dir not ready' };
      const hash = createHash('md5').update('custom-' + albumKey).digest('hex').slice(0, 16);
      const ext = srcPath.slice(srcPath.lastIndexOf('.')).toLowerCase() || '.jpg';
      const dest = join(dir, 'custom_' + hash + ext);
      copyFileSync(srcPath, dest);
      const cfg = getStore('config').data;
      cfg.customCovers ||= {};
      cfg.customCovers[albumKey] = dest;
      getStore('config').scheduleSave();
      return { ok: true, path: dest };
    } catch (e) { return { ok: false, reason: e.message }; }
  });
  ipcMain.handle('cover:customRemove', (_e, albumKey) => {
    const cfg = getStore('config').data;
    if (cfg.customCovers) { delete cfg.customCovers[albumKey]; getStore('config').scheduleSave(); }
    return { ok: true };
  });
  ipcMain.handle('app:checkFfmpeg', () => {""")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- preload ----
p = 'desktop/preload.cjs'
s = io.open(p, encoding='utf-8').read()
s = s.replace("'export:saveVideo',",
              "'export:saveVideo', 'cover:custom', 'cover:customRemove',")
io.open(p, 'w', encoding='utf-8').write(s)
print('v3.1.0 ipc/store/player OK')
