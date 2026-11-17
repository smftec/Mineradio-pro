# v1.7.0 补丁:翻译设置 UI + 歌词翻译行
import io

# ---- CSS:翻译行 + 密码输入 ----
p = 'public/css/app.css'
s = io.open(p, encoding='utf-8').read()
s = s.replace(""".lv-line .word { transition: color .12s; }""",
""".lv-line .word { transition: color .12s; }
.lv-tran {
  padding: 1px 14px 6px; margin-top: -6px;
  font-size: 13px; line-height: 1.5; color: var(--muted);
  animation: row-in .3s cubic-bezier(.16, 1, .3, 1) both;
}
.lv-tran.pending { color: var(--faint); opacity: .6; }
input[type="password"].set-input {
  background: var(--panel); border: 1px solid var(--border); color: var(--text);
  border-radius: 8px; padding: 7px 10px; font-size: 13px; outline: none; min-width: 200px;
  letter-spacing: 1px;
}
input[type="password"].set-input:focus { border-color: rgba(124, 92, 255, .5); }""")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- settings-view.js:翻译源组(通用组后) ----
p = 'public/js/settings-view.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""    <div class="set-group">
      <h3>备份与恢复</h3>""",
"""    <div class="set-group" id="translation-group">
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
      <h3>备份与恢复</h3>""")

s = s.replace("""  // 备份与恢复
  root.querySelector('#btn-backup-export').addEventListener('click', async () => {""",
"""  // 歌词翻译
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
  root.querySelector('#btn-backup-export').addEventListener('click', async () => {""")

io.open(p, 'w', encoding='utf-8').write(s)

# ---- lyrics-view.js:翻译行渲染 + 批量获取 ----
p = 'public/js/lyrics-view.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""    if (t) await this.load(t.id);
    else el.querySelector('#lv-lyrics').innerHTML = '<div class="empty" style="padding:60px"><img class="empty-art small" src="./assets/empty-music.png" alt="" draggable="false"><div class="empty-title">先播放一首歌吧</div></div>';
  },""",
"""    // 翻译配置(决定 load 后是否拉取译文)
    this._tranCfg = await api.invoke('translation:getConfig');
    this.unsubs.push(api.on('player:state', () => { /* noop,保持生命周期 */ }));
    if (t) await this.load(t.id);
    else el.querySelector('#lv-lyrics').innerHTML = '<div class="empty" style="padding:60px"><img class="empty-art small" src="./assets/empty-music.png" alt="" draggable="false"><div class="empty-title">先播放一首歌吧</div></div>';
  },""")

s = s.replace("""      return `<div class="lv-line"${style} data-i="${i}" data-time="${l.time}">${esc(l.text || '♪')}</div>`;
    }).join('');
  }).join('');""",
"""      return `<div class="lv-line"${style} data-i="${i}" data-time="${l.time}">${esc(l.text || '♪')}</div>`;
    }).join('');""")

# 翻译拉取与填充:load 尾部追加
s = s.replace("""    box.querySelectorAll('.lv-line[data-time]').forEach((lineEl) => {
      lineEl.addEventListener('click', () => {
        const t = parseFloat(lineEl.dataset.time);
        if (isFinite(t)) this._onSeek?.(t);
      });
    });
    this.sync(state_position());
  },""",
"""    box.querySelectorAll('.lv-line[data-time]').forEach((lineEl) => {
      lineEl.addEventListener('click', () => {
        const t = parseFloat(lineEl.dataset.time);
        if (isFinite(t)) this._onSeek?.(t);
      });
    });
    this.sync(state_position());
    // 歌词翻译(异步,不阻塞渲染)
    this._maybeTranslate(trackId);
  },

  // 拉取歌词翻译并逐行插入 .lv-tran
  async _maybeTranslate(trackId) {
    const cfg = this._tranCfg;
    if (!cfg?.enabled || !cfg.endpoint || !this.el) return;
    const box = this.el.querySelector('#lv-lyrics');
    if (!box) return;
    const texts = this.lines.map((l) => l.text || '');
    const pendingIdx = texts.map((t, i) => (t.trim() ? i : -1)).filter((i) => i >= 0);
    if (!pendingIdx.length) return;
    try {
      const res = await api.invoke('translation:translate', texts, cfg.targetLang);
      if (!this.el || this.trackId !== trackId || !res?.lines) return;
      pendingIdx.forEach((i, j) => {
        const t = res.lines[i];
        const lineEl = box.querySelector(`.lv-line[data-i="${i}"]`);
        if (!lineEl || !t) return;
        const tran = document.createElement('div');
        tran.className = 'lv-tran';
        tran.textContent = t;
        lineEl.after(tran);
      });
    } catch (e) {
      console.error('[lyrics] translate failed:', e.message);
    }
  },""")

io.open(p, 'w', encoding='utf-8').write(s)
print('translation UI OK')
