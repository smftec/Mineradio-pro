# v3.1.0 补丁二:渲染端 UI(睡眠定时器/自定义封面/播放速度)
import io

# ---- index.html:播放条速度按钮(在迷你播放器按钮前) ----
p = 'public/index.html'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""        <button id="pb-mini" class="pb-iconbtn" title="迷你播放器" aria-label="迷你播放器">""",
"""        <button id="pb-rate" class="pb-iconbtn rate-btn" title="播放速度" aria-label="播放速度">
          <span id="pb-rate-text" style="font-size:10.5px;font-weight:700;letter-spacing:-0.5px">1.0x</span>
        </button>
        <button id="pb-mini" class="pb-iconbtn" title="迷你播放器" aria-label="迷你播放器">""")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- CSS:rate button ----
p = 'public/css/app.css'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""/* Folia 模式细节:标题栏常驻(可随时切回/最小化/关闭) */""",
"""/* 播放速度按钮 */
.rate-btn { min-width: 38px; }
.rate-btn span { font-variant-numeric: tabular-nums; }

/* Folia 模式细节:标题栏常驻(可随时切回/最小化/关闭) */""")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- app.js:速度循环 + 睡眠定时器 + 自定义封面右键 ----
p = 'public/js/app.js'
s = io.open(p, encoding='utf-8').read()

# 1. 速度按钮(在 pb-mini 绑定附近)
old = """  $('pb-mini').addEventListener('click', () => api.send('mini:open'));"""
assert old in s, 'mini anchor'
s = s.replace(old, """  $('pb-mini').addEventListener('click', () => api.send('mini:open'));
  // 播放速度循环(1.0 → 1.25 → 1.5 → 2.0 → 0.75 → 1.0)
  const rates = [1, 1.25, 1.5, 2, 0.75];
  let rateIdx = 0;
  $('pb-rate').addEventListener('click', () => {
    rateIdx = (rateIdx + 1) % rates.length;
    player.setRate(rates[rateIdx]);
    $('pb-rate-text').textContent = rates[rateIdx] + 'x';
    toast('播放速度 ' + rates[rateIdx] + 'x', 1500);
  });
  // 恢复上次速度
  if (st.config.playbackRate && st.config.playbackRate !== 1) {
    player.setRate(st.config.playbackRate);
    $('pb-rate-text').textContent = st.config.playbackRate + 'x';
  }""")

# 2. 速度持久化(周期保存里加)
s = s.replace("""      volume: player.volume, crossfade: player.crossfade,
      repeat: player.repeat, shuffle: player.shuffle,
    });""",
"""      volume: player.volume, crossfade: player.crossfade,
      repeat: player.repeat, shuffle: player.shuffle,
      playbackRate: player.getRate(),
    });""")

# 3. 睡眠定时器(通用组 UI 由 settings-view 提供;播放器侧的启动由设置页触发)

# 4. 自定义封面右键菜单项(showTrackMenu 里加"设置封面")
old = """  items.push({ sep: true }, { label: '打开文件位置', icon: 'folder', act: () => api.invoke('lib:reveal', track.path) });"""
assert old in s, 'menu anchor'
s = s.replace(old, """  items.push({ sep: true },
    { label: '设置专辑封面…', icon: 'folder', act: () => {
      api.invoke('lib:pickCover').then((r) => {
        if (r && r.ok) toast('封面已更新,重新打开歌词视图生效');
        else if (r && r.reason) toast('设置失败:' + r.reason, 4000);
      });
    } },
    { label: '打开文件位置', icon: 'folder', act: () => api.invoke('lib:reveal', track.path) });""")

io.open(p, 'w', encoding='utf-8').write(s)
print('app.js rate + cover menu OK')

# ---- settings-view.js:通用组加睡眠定时器 ----
p = 'public/js/settings-view.js'
s = io.open(p, encoding='utf-8').read()
old = """      <div class="set-row"><label>全局媒体键</label>
        <input type="checkbox" class="switch" id="set-media-keys" ${cfg.shortcuts?.mediaKeys !== false ? 'checked' : ''}>
        <span class="val">键盘媒体键(播放/暂停、上一首/下一首)在任意应用界面均可控制播放</span>
      </div>"""
assert old in s, 'media keys anchor'
s = s.replace(old, old + """
      <div class="set-row"><label>睡眠定时器</label>
        <select id="set-sleep-timer">
          <option value="0">关闭</option>
          <option value="15">15 分钟</option>
          <option value="30">30 分钟</option>
          <option value="60">60 分钟</option>
          <option value="90">90 分钟</option>
        </select>
        <span class="val" id="sleep-timer-status">到时后渐出暂停播放</span>
      </div>""")
# 绑定(全局媒体键后)
old = """  // 全局媒体键"""
assert old in s, 'media keys anchor'
s = s.replace(old, """  // 睡眠定时器
  const sleepSel = root.querySelector('#set-sleep-timer');
  const sleepStatus = root.querySelector('#sleep-timer-status');
  api.invoke('config:get').then((c) => {
    const m = c.sleepTimer?.minutes || 0;
    sleepSel.value = String(m);
    if (c.sleepTimer?.endsAt && c.sleepTimer.endsAt > Date.now()) {
      sleepStatus.textContent = `定时器运行中,约 ${Math.ceil((c.sleepTimer.endsAt - Date.now()) / 60000)} 分钟后暂停`;
    }
  });
  sleepSel.addEventListener('change', async (e) => {
    const minutes = parseInt(e.target.value, 10);
    await api.invoke('config:set', { sleepTimer: { minutes } });
    if (minutes > 0) {
      const endsAt = Date.now() + minutes * 60000;
      await api.invoke('config:set', { sleepTimer: { minutes, endsAt } });
      window.__startSleepTimer?.(minutes);
      sleepStatus.textContent = `定时器已启动,${minutes} 分钟后渐出暂停`;
    } else {
      window.__stopSleepTimer?.();
      sleepStatus.textContent = '定时器已关闭';
    }
    toast(minutes > 0 ? `睡眠定时器已启动(${minutes} 分钟)` : '睡眠定时器已关闭');
  });

  // 全局媒体键""")
io.open(p, 'w', encoding='utf-8').write(s)
print('settings sleep timer OK')

# ---- app.js:暴露睡眠定时器全局入口 ----
p = 'public/js/app.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""  window.__setFoliaBridge({
    player, state,
    addFolderFlow: state.addFolderFlow,
  });""",
"""  window.__setFoliaBridge({
    player, state,
    addFolderFlow: state.addFolderFlow,
  });
  // 睡眠定时器全局入口(设置页调用)
  window.__startSleepTimer = (minutes) => player.startSleepTimer(minutes, () => toast('睡眠定时器时间到,播放已暂停', 5000));
  window.__stopSleepTimer = () => player.stopSleepTimer();""")
io.open(p, 'w', encoding='utf-8').write(s)
print('sleep timer global OK')

# ---- ipc: pickCover(选择图片文件 + 返回路径) ----
p = 'desktop/lib/ipc.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""  ipcMain.handle('cover:custom', async (_e, albumKey, srcPath) => {""",
"""  ipcMain.handle('lib:pickCover', async () => {
    const r = await dialog.showOpenDialog(windows.main, {
      title: '选择封面图片',
      filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
      properties: ['openFile'],
    });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('cover:custom', async (_e, albumKey, srcPath) => {""")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- preload: lib:pickCover ----
p = 'desktop/preload.cjs'
s = io.open(p, encoding='utf-8').read()
s = s.replace("'lib:getAll', 'lib:getFolders', 'lib:removeFolder', 'lib:rescan', 'lib:isScanning', 'lib:reveal',",
              "'lib:getAll', 'lib:getFolders', 'lib:removeFolder', 'lib:rescan', 'lib:isScanning', 'lib:reveal', 'lib:pickCover',")
io.open(p, 'w', encoding='utf-8').write(s)
print('all OK')
