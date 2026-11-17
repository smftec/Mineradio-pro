# v2.6.0 补丁三:设置页(预设管理/渲染档位/WE 联动)+ 预设导入导出
import io

# ---- ipc:预设 JSON 保存/读取 ----
p = 'desktop/lib/ipc.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""  ipcMain.handle('export:saveVideo', (_e, base64, filename) => {""",
"""  ipcMain.handle('preset:save', async (_e, payload, defaultName) => {
    const r = await dialog.showSaveDialog(windows.main, {
      title: '导出视觉预设',
      defaultPath: defaultName || 'mineradio-preset.json',
      filters: [{ name: 'Mineradio 视觉预设', extensions: ['json'] }],
    });
    if (r.canceled || !r.filePath) return { ok: false, reason: 'canceled' };
    writeFileSync(r.filePath, payload);
    return { ok: true, path: r.filePath };
  });
  ipcMain.handle('preset:load', async () => {
    const r = await dialog.showOpenDialog(windows.main, {
      title: '导入视觉预设',
      filters: [{ name: 'Mineradio 视觉预设', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (r.canceled || !r.filePaths.length) return { ok: false, reason: 'canceled' };
    try {
      const data = JSON.parse(readFileSync(r.filePaths[0], 'utf-8'));
      if (data.app !== 'mineradio-pro-visual-preset') return { ok: false, reason: '不是有效的视觉预设文件' };
      return { ok: true, preset: data.preset };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  });
  ipcMain.handle('export:saveVideo', (_e, base64, filename) => {""")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- preload ----
p = 'desktop/preload.cjs'
s = io.open(p, encoding='utf-8').read()
s = s.replace("'we:detect', 'we:export', 'we:openProjects',",
              "'we:detect', 'we:export', 'we:openProjects', 'preset:save', 'preset:load',")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- settings-view.js:外观组扩展(预设管理/渲染档位)+ WE 联动区 ----
p = 'public/js/settings-view.js'
s = io.open(p, encoding='utf-8').read()

# 渲染档位 + 预设管理(插在可视化模式行后)
s = s.replace("""        <span class="val">歌词视图背景可视化(视图内也可循环切换)</span>
      </div>""",
"""        <span class="val">歌词视图背景可视化(视图内也可循环切换)</span>
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
      </div>""")

# WE 联动区(动态壁纸组后)
s = s.replace("""    <div class="set-group">
      <h3>歌词翻译</h3>""",
"""    <div class="set-group">
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
      <h3>歌词翻译</h3>""")

# 绑定逻辑(全局媒体键前)
s = s.replace("""  // 全局媒体键""",
"""  // 渲染档位
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

  // 全局媒体键""")

io.open(p, 'w', encoding='utf-8').write(s)
print('settings UI OK')
