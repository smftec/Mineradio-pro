// 设置视图:外观 / 播放 / 音频 / 曲库 / 桌面歌词 / 软件更新 / 关于
import { api, esc, toast, appInfo } from './api.js';

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
  root.innerHTML = `<div class="settings">
    <h1>设置</h1>

    <div class="set-group">
      <h3>外观</h3>
      <div class="set-row"><label>主题</label>
        <select id="set-theme">
          <option value="dark" ${cfg.theme !== 'light' ? 'selected' : ''}>深色</option>
          <option value="light" ${cfg.theme === 'light' ? 'selected' : ''}>浅色</option>
        </select>
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
      <div class="set-row"><label>自定义更新源</label>
        <input type="text" class="set-input" id="set-custom-url" placeholder="留空使用 GitHub Releases;或填 https://…/latest.yml 所在目录(可配国内镜像)" value="${esc(cfg.update.customUrl)}">
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
  </div>`;

  bindSettings(root, state);
  renderUpdateStatus(root, state.updateState);
}

// ---------- 绑定 ----------
function bindSettings(root, state) {
  const cfg = state.config;

  root.querySelector('#set-theme').addEventListener('change', (e) => {
    state.applyTheme(e.target.value);
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

  // 全局媒体键
  root.querySelector('#set-media-keys').addEventListener('change', async (e) => {
    await api.invoke('shortcuts:setMediaKeys', e.target.checked);
    toast(e.target.checked ? '全局媒体键已开启' : '全局媒体键已关闭');
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
      rows.push('<div class="val">正在检查更新…</div>');
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
