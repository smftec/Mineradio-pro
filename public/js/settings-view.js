// 设置视图:外观 / 播放 / 音频 / 曲库 / 桌面歌词 / 软件更新 / 关于
import { api, esc, toast, appInfo } from './api.js';
import { SHADER_IDS } from './visual-modes.js';

const EQ_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_PRESETS = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  pop: [-1, 1, 3, 4, 3, 1, -1, -1, 1, 2],
  rock: [4, 3, 2, -1, -2, 1, 3, 4, 4, 3],
  classic: [3, 2, 0, 0, 0, 0, -1, -1, 2, 3],
  bass: [7, 6, 5, 3, 1, 0, 0, 0, 0, 0],
  treble: [0, 0, 0, 0, 0, 2, 4, 5, 6, 7],
};

export function renderSettings(root, state) {
  const cfg = state.config;
  const folders = state.libraryFolders;
  root.innerHTML = `<div class="settings" style="position:relative">
    <aside class="settings-nav" id="settings-nav"></aside>
    <div class="settings-body">
    <h1>设置</h1>

    <div class="set-group">
      <h3>外观</h3>
      <div class="set-row"><label>主题</label>
        <select id="set-theme">
          <option value="dark" ${cfg.theme !== 'light' ? 'selected' : ''}>深色</option>
          <option value="light" ${cfg.theme === 'light' ? 'selected' : ''}>浅色</option>
        </select>
      </div>
      <div class="set-row"><label>可视化模式</label>
        <select id="set-visual">
          ${[['particles', '频谱粒子(Canvas2D)'], ['ring', '环形频谱(Canvas2D)'], ['wave', '波形流动(Canvas2D)']].concat(
            SHADER_IDS.map(id => [id, '✧ ' + id + '(WebGL)'])).map(([v, n]) =>
            `<option value="${v}" ${(cfg.visualMode || 'particles') === v ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
        <span class="val">歌词视图背景可视化(视图内也可循环切换)</span>
      </div>
      <div class="set-row"><label>渲染分辨率</label>
        <select id="set-dpr">
          ${[['auto', '自动(最高 1.5x)'], ['1', '1x(性能优先)'], ['1.5', '1.5x'], ['2', '2x(画质优先)']].map(([v, n]) =>
            `<option value="${v}" ${(cfg.render?.dpr || 'auto') === v ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
        <span class="val">WebGL 视觉渲染分辨率档位</span>
      </div>
      <div class="set-row"><label>视觉预设</label>
        <select id="set-preset-list">
          ${(cfg.visualPresets || []).map((p2, i) => `<option value="${i}">${esc(p2.name)}(${esc(p2.effect)})</option>`).join('') || '<option value="">(无已保存预设)</option>'}
        </select>
        <button class="btn" id="btn-preset-apply">应用</button>
        <button class="btn danger" id="btn-preset-del">删除</button>
      </div>
      <div class="set-row"><label>当前效果参数</label>
        <span class="val">强度</span><input type="range" class="slider" id="set-vis-intensity" min="0.2" max="2.5" step="0.1" value="${(cfg.visualParams?.intensity || 1)}" style="max-width:130px">
        <span class="val">速度</span><input type="range" class="slider" id="set-vis-speed" min="0.1" max="4" step="0.1" value="${(cfg.visualParams?.speed || 1)}" style="max-width:130px">
      </div>
      <div class="set-row">
        <button class="btn primary" id="btn-preset-save">保存为预设</button>
        <button class="btn" id="btn-preset-export">导出 JSON</button>
        <button class="btn" id="btn-preset-import">导入 JSON</button>
      </div>
      <div class="set-row"><label>主题色</label>
        <select id="set-accent">
          ${[['galaxy', '星河紫(默认)'], ['deep-sea', '深海青'], ['ember', '落日余烬'], ['forest', '森野绿'], ['sakura', '樱粉'], ['graphite', '石墨银'], ['midnight', '午夜靛蓝']].map(([v, n]) =>
            `<option value="${v}" ${(cfg.accentColor || 'galaxy') === v ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
        <span class="val">全站强调色即时切换</span>
      </div>
    </div>

    <div class="set-group">
      <h3>播放</h3>
      <div class="set-row"><label>交叉淡入淡出</label>
        <input type="range" class="slider" id="set-crossfade" min="0" max="10" step="0.5" value="${cfg.crossfade}">
        <span class="val" id="cf-val">${cfg.crossfade}s</span>
      </div>
    </div>

    <div class="set-group">
      <h3>音频</h3>
      <div class="set-row"><label>输出设备</label><select id="set-sink"></select></div>
      <div class="set-row"><label>均衡器</label>
        <input type="checkbox" class="switch" id="set-eq-on" ${cfg.eq.enabled ? 'checked' : ''}>
        <select id="set-eq-preset">
          ${Object.keys(EQ_PRESETS).map((p) => `<option value="${p}" ${cfg.eq.preset === p ? 'selected' : ''}>${{ flat: '平直', pop: '流行', rock: '摇滚', classic: '古典', bass: '低音增强', treble: '高音增强' }[p]}</option>`).join('')}
          <option value="custom" ${cfg.eq.preset === 'custom' ? 'selected' : ''}>自定义</option>
        </select>
        <span class="val">预增益</span>
        <input type="range" class="slider" id="set-preamp" min="-12" max="12" step="0.5" value="${cfg.eq.preamp}" style="max-width:140px">
        <span class="val" id="preamp-val">${cfg.eq.preamp} dB</span>
      </div>
      <div class="eq-bands" id="eq-bands">
        ${EQ_FREQS.map((f, i) => `<div class="eq-band">
          <span class="db" id="db-${i}">${cfg.eq.bands[i] || 0}</span>
          <input type="range" data-i="${i}" min="-12" max="12" step="1" value="${cfg.eq.bands[i] || 0}">
          <span class="hz">${f >= 1000 ? f / 1000 + 'k' : f}</span>
        </div>`).join('')}
      </div>
    </div>

    <div class="set-group">
      <h3>音乐库</h3>
      <div class="set-row">
        <button class="btn primary" id="set-add-folder">导入文件夹</button>
        <button class="btn" id="set-add-files">导入文件</button>
        <button class="btn" id="set-rescan">重新扫描</button>
      </div>
      <div class="set-row"><label>ffmpeg 路径</label>
        <input type="text" class="set-input" id="set-ffmpeg" placeholder="自动检测系统 PATH;可指定 ffmpeg.exe 完整路径" value="${esc(cfg.ffmpegPath || '')}">
        <button class="btn" id="set-ffmpeg-save">保存</button>
        <button class="btn" id="set-ffmpeg-check">检测</button>
        <span class="val" id="ffmpeg-status">用于 APE 转码播放</span>
      </div>
      <div class="folder-list">
        ${folders.length ? folders.map((f) => `<div class="folder-item">
          <svg viewBox="0 0 24 24" class="ico" style="color:var(--accent2)"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          <span class="path" title="${esc(f)}">${esc(f)}</span>
          <button data-rm="${esc(f)}" title="移除">✕</button>
        </div>`).join('') : '<div class="val" style="padding:6px 0">尚未导入任何文件夹</div>'}
      </div>
    </div>

    <div class="set-group">
      <h3>桌面歌词</h3>
      <div class="set-row"><label>显示桌面歌词</label>
        <input type="checkbox" class="switch" id="set-dl-on" ${cfg.desktopLyrics.visible ? 'checked' : ''}>
        <span class="val">开启后可拖动位置;锁定后鼠标穿透,需在此解锁</span>
      </div>
      <div class="set-row"><label>锁定(鼠标穿透)</label>
        <input type="checkbox" class="switch" id="set-dl-lock" ${cfg.desktopLyrics.locked ? 'checked' : ''}>
      </div>
      <div class="set-row"><label>歌词颜色</label>
        <select id="set-dl-color">
          ${[['#7df9ff', '霓虹青'], ['#ffffff', '纯白'], ['#ff7ad9', '樱粉'], ['#7dff9e', '荧光绿'], ['#ffd76e', '暖金']].map(([v, n]) =>
            `<option value="${v}" ${cfg.desktopLyrics.color === v ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>
      <div class="set-row"><label>字号</label>
        <input type="range" class="slider" id="set-dl-size" min="18" max="64" step="2" value="${cfg.desktopLyrics.fontSize}">
        <span class="val" id="dl-size-val">${cfg.desktopLyrics.fontSize}px</span>
      </div>
    </div>

    <div class="set-group">
      <h3>通用</h3>
      <div class="set-row"><label>开机自动启动</label>
        <input type="checkbox" class="switch" id="set-autorun">
        <span class="val">登录 Windows 后自动运行 Mineradio pro</span>
      </div>
      <div class="set-row"><label>全局媒体键</label>
        <input type="checkbox" class="switch" id="set-media-keys" ${cfg.shortcuts?.mediaKeys !== false ? 'checked' : ''}>
        <span class="val">键盘媒体键(播放/暂停、上一首/下一首)在任意应用界面均可控制播放</span>
      </div>
      <div class="set-row"><label>睡眠定时器</label>
        <select id="set-sleep-timer">
          <option value="0">关闭</option>
          <option value="15">15 分钟</option>
          <option value="30">30 分钟</option>
          <option value="60">60 分钟</option>
          <option value="90">90 分钟</option>
        </select>
        <span class="val" id="sleep-timer-status">到时后渐出暂停播放</span>
      </div>
    </div>

    <div class="set-group" id="wallpaper-group">
      <h3>动态桌面壁纸</h3>
      <div class="set-row"><label>启用动态壁纸</label>
        <button class="btn primary" id="btn-wallpaper-on">挂载到桌面</button>
        <button class="btn" id="btn-wallpaper-off">卸载恢复</button>
        <span class="val">将可视化画面(跟随播放)挂载到桌面图标层之后;应用退出时自动卸载</span>
      </div>
      <div class="update-status" id="wallpaper-status"></div>
    </div>

    <div class="set-group" id="translation-group">
      <h3>歌词翻译</h3>
      <div class="set-row"><label>启用歌词翻译</label>
        <input type="checkbox" class="switch" id="set-tran-on">
        <span class="val">通过 OpenAI 兼容接口逐行翻译歌词(API Key 经系统加密存储)</span>
      </div>
      <div class="set-row"><label>接口地址</label>
        <input type="text" class="set-input" id="set-tran-endpoint" placeholder="https://api.openai.com/v1/chat/completions">
      </div>
      <div class="set-row"><label>模型</label>
        <input type="text" class="set-input" id="set-tran-model" placeholder="gpt-4o-mini">
      </div>
      <div class="set-row"><label>API Key</label>
        <input type="password" class="set-input" id="set-tran-key" placeholder="sk-…(留空保持不变)">
      </div>
      <div class="set-row"><label>目标语言</label>
        <select id="set-tran-lang">
          ${[['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['en', 'English'], ['ja', '日本語']].map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}
        </select>
        <button class="btn" id="btn-tran-test">测试连接</button>
        <button class="btn primary" id="btn-tran-save">保存翻译设置</button>
      </div>
      <div class="update-status" id="tran-status"></div>
    </div>

    <div class="set-group">
      <h3>Wallpaper Engine 联动</h3>
      <div class="set-row"><label>检测 Wallpaper Engine</label>
        <button class="btn" id="btn-we-detect">检测</button>
        <span class="val" id="we-status">将可视化导出为 Wallpaper Engine Web 壁纸项目(自研桥接,使用 WE 音频 API)</span>
      </div>
      <div class="set-row"><label>导出项目</label>
        <button class="btn primary" id="btn-we-export">导出当前视觉到 Wallpaper Engine</button>
        <button class="btn" id="btn-we-open">打开项目目录</button>
      </div>
      <div class="update-status" id="we-export-status"></div>
    </div>

    <div class="set-group">
      <h3>备份与恢复</h3>
      <div class="set-row"><label>整机备份</label>
        <button class="btn" id="btn-backup-export">导出备份</button>
        <button class="btn" id="btn-backup-import">从备份恢复</button>
        <span class="val">包含曲库索引、歌单、收藏、统计与设置(不含音频文件);恢复后应用将自动重启</span>
      </div>
    </div>

    <div class="set-group" id="update-group">
      <h3>⭐ 软件更新</h3>
      <div class="set-row"><label>启动时自动检查</label>
        <input type="checkbox" class="switch" id="set-auto-check" ${cfg.update.autoCheck ? 'checked' : ''}>
      </div>
      <div class="set-row"><label>下载加速</label>
        <select id="set-mirror">
          ${[['auto', '自动(直连失败换镜像)'], ['direct', '仅直连 GitHub'], ['https://ghfast.top/', '镜像 ghfast.top'], ['https://gh-proxy.com/', '镜像 gh-proxy.com'], ['https://gh.llkk.cc/', '镜像 gh.llkk.cc']].map(([v, n]) =>
            `<option value="${v}" ${(cfg.update.mirror || 'auto') === v ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>
      <div class="set-row"><label>自定义更新源</label>
        <input type="text" class="set-input" id="set-custom-url" placeholder="留空使用 GitHub Releases;或填 https://…/latest.yml 所在目录" value="${esc(cfg.update.customUrl)}">
        <button class="btn" id="set-save-url">保存</button>
      </div>
      <div class="update-status" id="update-status"></div>
      <div class="set-row" style="margin-top:10px">
        <button class="btn primary" id="btn-check-update">检查更新</button>
        <button class="btn" id="btn-open-releases">查看发布页</button>
      </div>
    </div>

    <div class="set-group">
      <h3>关于</h3>
      <div class="set-row"><label>Mineradio pro</label><span class="val">版本 ${esc(appInfo.version)} ${appInfo.packaged ? '' : '(开发模式)'}</span></div>
      <div class="set-row"><label>说明</label><span class="val">本地音乐播放器 · 纯本地播放,不上传任何数据 · 支持软件检测与自动更新</span></div>
    </div>
    </div>
  </div>`;

  bindSettings(root, state);
  renderUpdateStatus(root, state.updateState);
  buildSettingsNav(root);
}

// ---------- 绑定 ----------
async function bindSettings(root, state) {
  const cfg = state.config;

  root.querySelector('#set-theme').addEventListener('change', (e) => {
    state.applyTheme(e.target.value);
  });
  root.querySelector('#set-accent').addEventListener('change', (e) => {
    state.applyAccent(e.target.value);
  });

  root.querySelector('#set-crossfade').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    root.querySelector('#cf-val').textContent = v + 's';
    state.player.crossfade = v;
    api.invoke('config:set', { crossfade: v });
  });

  // 音频输出设备
  const sinkSel = root.querySelector('#set-sink');
  navigator.mediaDevices?.enumerateDevices().then((devs) => {
    const outs = devs.filter((d) => d.kind === 'audiooutput');
    sinkSel.innerHTML = `<option value="default">系统默认</option>` +
      outs.map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || `输出设备 ${i + 1}`)}</option>`).join('');
    sinkSel.value = state.sinkId || 'default';
  });
  sinkSel.addEventListener('change', async (e) => {
    state.sinkId = e.target.value;
    await state.player.setSinkId(e.target.value);
    toast('音频输出设备已切换');
  });

  // EQ
  root.querySelector('#set-eq-on').addEventListener('change', (e) => {
    const eq = { ...cfg.eq, enabled: e.target.checked };
    Object.assign(cfg.eq, eq);
    state.player.setEq(eq);
    api.invoke('config:set', { eq });
  });
  root.querySelector('#set-eq-preset').addEventListener('change', (e) => {
    const bands = EQ_PRESETS[e.target.value] || EQ_PRESETS.flat;
    Object.assign(cfg.eq, { preset: e.target.value, bands: [...bands] });
    state.player.setEq({ preset: e.target.value, bands });
    api.invoke('config:set', { eq: cfg.eq });
    renderSettings(root, state); // 刷新滑块
  });
  root.querySelector('#set-preamp').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    root.querySelector('#preamp-val').textContent = v + ' dB';
    Object.assign(cfg.eq, { preamp: v });
    state.player.setEq({ preamp: v });
    api.invoke('config:set', { eq: cfg.eq });
  });
  root.querySelectorAll('#eq-bands input[type="range"]').forEach((r) => {
    r.addEventListener('input', (e) => {
      const i = +e.target.dataset.i;
      const v = parseFloat(e.target.value);
      root.querySelector(`#db-${i}`).textContent = v;
      cfg.eq.bands[i] = v;
      cfg.eq.preset = 'custom';
      state.player.setEq({ bands: cfg.eq.bands });
      api.invoke('config:set', { eq: cfg.eq });
    });
  });

  // 曲库
  root.querySelector('#set-add-folder').addEventListener('click', () => state.addFolderFlow());
  root.querySelector('#set-add-files').addEventListener('click', () => state.addFilesFlow());
  root.querySelector('#set-rescan').addEventListener('click', async () => {
    toast('开始重新扫描…');
    const r = await api.invoke('lib:rescan');
    toast(`扫描完成,共 ${r.added} 首新曲目`);
  });
  root.querySelectorAll('[data-rm]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api.invoke('lib:removeFolder', btn.dataset.rm);
      toast('已移除该文件夹');
      state.reloadLibrary();
    });
  });

  // 桌面歌词
  root.querySelector('#set-dl-on').addEventListener('change', (e) => {
    api.send('dl:' + (e.target.checked ? 'show' : 'hide'));
    state.updateDlBadge(e.target.checked);
  });
  root.querySelector('#set-dl-lock').addEventListener('change', (e) => {
    api.send('dl:lock', e.target.checked);
  });
  root.querySelector('#set-dl-color').addEventListener('change', (e) => {
    api.send('dl:config', { color: e.target.value });
  });
  root.querySelector('#set-dl-size').addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    root.querySelector('#dl-size-val').textContent = v + 'px';
    api.send('dl:config', { fontSize: v });
  });

  // 开机自启
  const autorun = root.querySelector('#set-autorun');
  api.invoke('app:getLoginItem').then((on) => { autorun.checked = !!on; });
  autorun.addEventListener('change', async (e) => {
    const ok = await api.invoke('app:setLoginItem', e.target.checked);
    if (e.target.checked && !ok) {
      toast('设置开机自启失败(可能需要管理员权限)', 4000);
      autorun.checked = false;
    } else {
      toast(ok ? '已开启开机自启' : '已关闭开机自启');
    }
  });

  // 可视化模式
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

  // 动态桌面壁纸
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

  // 渲染档位
  root.querySelector('#set-dpr').addEventListener('change', async (e) => {
    await api.invoke('config:set', { render: { dpr: e.target.value } });
    toast('渲染分辨率已保存,重新打开歌词视图生效');
  });

  // 视觉预设系统
  const presetSel = root.querySelector('#set-preset-list');
  const refreshPresets = () => {
    const ps = cfg.visualPresets || [];
    presetSel.innerHTML = ps.map((p2, i) => `<option value="${i}">${esc(p2.name)}(${esc(p2.effect)})</option>`).join('') || '<option value="">(无已保存预设)</option>';
  };
  const currentPreset = () => ({
    effect: cfg.visualMode || 'particles',
    params: {
      intensity: parseFloat(root.querySelector('#set-vis-intensity').value),
      speed: parseFloat(root.querySelector('#set-vis-speed').value),
      c1: cfg.visualParams?.c1 || null,
      c2: cfg.visualParams?.c2 || null,
    },
  });
  root.querySelector('#btn-preset-save').addEventListener('click', async () => {
    const name = `预设 ${new Date().toLocaleString('zh', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    const ps = cfg.visualPresets || [];
    ps.push({ name, ...currentPreset(), savedAt: Date.now() });
    await api.invoke('config:set', { visualPresets: ps });
    refreshPresets();
    presetSel.value = ps.length - 1;
    toast(`已保存「${name}」`);
  });
  root.querySelector('#btn-preset-del').addEventListener('click', async () => {
    const i = parseInt(presetSel.value, 10);
    if (isNaN(i)) return;
    const ps = cfg.visualPresets || [];
    ps.splice(i, 1);
    await api.invoke('config:set', { visualPresets: ps });
    refreshPresets();
    toast('预设已删除');
  });
  root.querySelector('#btn-preset-apply').addEventListener('click', async () => {
    const i = parseInt(presetSel.value, 10);
    const ps = cfg.visualPresets || [];
    if (isNaN(i) || !ps[i]) return;
    const p2 = ps[i];
    await api.invoke('config:set', { visualMode: p2.effect, visualParams: p2.params });
    cfg.visualMode = p2.effect; cfg.visualParams = p2.params;
    root.querySelector('#set-vis-intensity').value = p2.params.intensity;
    root.querySelector('#set-vis-speed').value = p2.params.speed;
    toast(`已应用「${p2.name}」— 重新打开歌词视图生效`);
  });
  root.querySelector('#btn-preset-export').addEventListener('click', async () => {
    const i = parseInt(presetSel.value, 10);
    const ps = cfg.visualPresets || [];
    if (isNaN(i) || !ps[i]) { toast('请先选择要导出的预设'); return; }
    const payload = JSON.stringify({ app: 'mineradio-pro-visual-preset', preset: ps[i] }, null, 2);
    const r = await api.invoke('preset:save', payload, `mineradio-preset-${ps[i].effect}.json`);
    if (r.ok) toast(`预设已导出:${r.path}`, 5000);
  });
  root.querySelector('#btn-preset-import').addEventListener('click', async () => {
    const r = await api.invoke('preset:load');
    if (!r.ok) { if (r.reason !== 'canceled') toast(`导入失败:${r.reason}`, 4000); return; }
    const ps = cfg.visualPresets || [];
    ps.push({ name: r.preset.name || '导入预设', ...r.preset, importedAt: Date.now() });
    await api.invoke('config:set', { visualPresets: ps });
    refreshPresets();
    toast(`已导入「${r.preset.name || '预设'}」`);
  });
  // 强度/速度滑块实时保存
  root.querySelector('#set-vis-intensity').addEventListener('change', (e) => {
    api.invoke('config:set', { visualParams: { ...cfg.visualParams, intensity: parseFloat(e.target.value) } });
  });
  root.querySelector('#set-vis-speed').addEventListener('change', (e) => {
    api.invoke('config:set', { visualParams: { ...cfg.visualParams, speed: parseFloat(e.target.value) } });
  });

  // Wallpaper Engine 联动
  root.querySelector('#btn-we-detect').addEventListener('click', async () => {
    const r = await api.invoke('we:detect');
    const box = root.querySelector('#we-status');
    box.innerHTML = r.found
      ? `<div class="val" style="color:#4ade80">✓ 检测到 Wallpaper Engine:${esc(r.path)}</div>`
      : '<div class="val" style="color:var(--danger)">✕ 未检测到 Wallpaper Engine(需 Steam 安装 Wallpaper Engine)</div>';
  });
  root.querySelector('#btn-we-export').addEventListener('click', async () => {
    const box = root.querySelector('#we-export-status');
    box.innerHTML = '<div class="val"><span class="spin-icon"></span> 正在导出项目…</div>';
    const r = await api.invoke('we:export', cfg.visualMode || 'particles', cfg.visualParams || {});
    if (r.ok) {
      box.innerHTML = `<div class="val" style="color:#4ade80">✓ 项目已导出:${esc(r.path)}</div><div class="val">在 Wallpaper Engine 中选择「我的项目」→ Mineradio pro Visualizer 即可使用(音频联动已内置)</div>`;
    } else {
      box.innerHTML = `<div class="val" style="color:var(--danger)">✕ ${esc(r.reason)}</div>`;
    }
  });
  root.querySelector('#btn-we-open').addEventListener('click', () => api.invoke('we:openProjects'));

  // 睡眠定时器
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

  // 全局媒体键
  root.querySelector('#set-media-keys').addEventListener('change', async (e) => {
    await api.invoke('shortcuts:setMediaKeys', e.target.checked);
    toast(e.target.checked ? '全局媒体键已开启' : '全局媒体键已关闭');
  });

  // 歌词翻译
  const tranCfg = await api.invoke('translation:getConfig');
  const tranOn = root.querySelector('#set-tran-on');
  tranOn.checked = !!tranCfg.enabled;
  root.querySelector('#set-tran-endpoint').value = tranCfg.endpoint || '';
  root.querySelector('#set-tran-model').value = tranCfg.model || '';
  root.querySelector('#set-tran-lang').value = tranCfg.targetLang || 'zh-CN';
  if (tranCfg.keyUnavailable) {
    const box = root.querySelector('#tran-status');
    box.innerHTML = '<div class="val" style="color:var(--danger)">系统加密组件不可用,无法存储 API Key(可改用不带鉴权的本地接口)</div>';
  }
  tranOn.addEventListener('change', async (e) => {
    const r = await api.invoke('translation:set', { enabled: e.target.checked });
    toast(e.target.checked ? '歌词翻译已开启' : '歌词翻译已关闭');
    if (!r.ok) toast(r.reason || '保存失败', 4000);
  });
  root.querySelector('#btn-tran-save').addEventListener('click', async () => {
    const r = await api.invoke('translation:set', {
      endpoint: root.querySelector('#set-tran-endpoint').value,
      model: root.querySelector('#set-tran-model').value,
      targetLang: root.querySelector('#set-tran-lang').value,
      apiKey: root.querySelector('#set-tran-key').value,
    });
    toast(r.ok ? '翻译设置已保存' : (r.reason || '保存失败'));
  });
  root.querySelector('#btn-tran-test').addEventListener('click', async () => {
    const box = root.querySelector('#tran-status');
    box.innerHTML = '<div class="val"><span class="spin-icon"></span> 正在测试连接…</div>';
    // 先保存当前表单再测试(确保测试的是填入的配置)
    await api.invoke('translation:set', {
      endpoint: root.querySelector('#set-tran-endpoint').value,
      model: root.querySelector('#set-tran-model').value,
      targetLang: root.querySelector('#set-tran-lang').value,
      apiKey: root.querySelector('#set-tran-key').value,
    });
    const r = await api.invoke('translation:test');
    box.innerHTML = `<div class="val" style="color:${r.ok ? '#4ade80' : 'var(--danger)'}">${r.ok ? '✓' : '✕'} ${esc(r.message)}</div>`;
  });

  // 备份与恢复
  root.querySelector('#btn-backup-export').addEventListener('click', async () => {
    const path = await api.invoke('backup:export');
    if (path) toast(`备份已导出:${path}`, 5000);
  });
  root.querySelector('#btn-backup-import').addEventListener('click', async () => {
    const r = await api.invoke('backup:import');
    if (r && r.ok) {
      toast('备份恢复完成,应用即将重启…', 3000);
      setTimeout(() => api.invoke('backup:relaunch'), 1500);
    } else if (r && r.reason && r.reason !== 'canceled') {
      toast(`恢复失败:${r.reason}`, 5000);
    }
  });

  // 更新设置
  root.querySelector('#set-auto-check').addEventListener('change', (e) => {
    api.invoke('config:set', { update: { ...cfg.update, autoCheck: e.target.checked } });
  });
  root.querySelector('#set-save-url').addEventListener('click', () => {
    const url = root.querySelector('#set-custom-url').value.trim();
    api.invoke('config:set', { update: { ...cfg.update, customUrl: url } });
    toast(url ? '自定义更新源已保存' : '已恢复使用默认 GitHub 更新源');
  });
  root.querySelector('#set-mirror').addEventListener('change', (e) => {
    api.invoke('config:set', { update: { ...cfg.update, mirror: e.target.value } });
    toast('下载加速策略已保存');
  });
  root.querySelector('#btn-check-update').addEventListener('click', () => state.checkUpdate());
  root.querySelector('#btn-open-releases').addEventListener('click', () => api.invoke('update:openReleases'));
}

// ---------- 更新 UI 状态机 ----------
// state.updateState = { type, ... }
export function renderUpdateStatus(root, us) {
  const box = root.querySelector('#update-status');
  if (!box) return;
  const rows = [];
  switch (us?.type) {
    case 'checking':
      rows.push('<div class="val"><span class="spin-icon"></span> 正在检查更新…</div>');
      break;
    case 'available':
      rows.push(`<div style="color:var(--accent2);font-weight:600">发现新版本 v${esc(us.version)}</div>`);
      if (us.releaseDate) rows.push(`<div class="val">发布时间:${new Date(us.releaseDate).toLocaleString()}</div>`);
      if (us.releaseNotes) rows.push(`<div class="update-notes">${esc(us.releaseNotes)}</div>`);
      rows.push(`<div style="display:flex;gap:10px">
        <button class="btn primary" id="upd-download">下载更新</button>
        <button class="btn" id="upd-skip">跳过此版本</button>
      </div>`);
      break;
    case 'progress-hint':
      rows.push(`<div class="val" style="color:var(--accent2)">${esc(us.message || '')}</div>`);
      break;
    case 'progress':
      rows.push(`<div class="progress-track"><div class="progress-fill" style="width:${us.percent || 0}%"></div></div>
        <div class="progress-meta"><span>${(us.percent || 0).toFixed(1)}%</span><span>${fmtMB(us.transferred)} / ${fmtMB(us.total)} · ${fmtSpeed(us.bytesPerSecond)}</span></div>`);
      break;
    case 'downloaded':
      rows.push(`<div style="color:var(--accent2);font-weight:600">更新已下载,准备就绪</div>
        <button class="btn primary" id="upd-install">重启并安装</button>`);
      break;
    case 'not-available':
      rows.push(`<div class="val">已是最新版本 ✓</div>`);
      break;
    case 'dev-mode':
      rows.push(`<div class="val" style="color:var(--accent2)">${esc(us.message || '开发模式下自动更新不可用')}</div>`);
      break;
    case 'error':
      rows.push(`<div class="val" style="color:var(--danger)">✕ ${esc(us.message)}</div>`);
      break;
    default:
      rows.push('<div class="val">点击「检查更新」手动检查;启用自动检查后,启动 10 秒后会静默检查。</div>');
  }
  box.innerHTML = rows.join('');

  box.querySelector('#upd-download')?.addEventListener('click', () => api.invoke('update:download'));
  box.querySelector('#upd-install')?.addEventListener('click', () => api.invoke('update:install'));
  box.querySelector('#upd-skip')?.addEventListener('click', async () => {
    await api.invoke('update:skip', us.version);
    toast(`已跳过 v${us.version},可在更新源变化后再检查`);
    renderUpdateStatus(root, { type: 'idle' });
  });
}

function fmtMB(b) { return b ? (b / 1024 / 1024).toFixed(1) + ' MB' : '—'; }
function fmtSpeed(b) { return b ? (b / 1024 / 1024).toFixed(1) + ' MB/s' : ''; }

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
