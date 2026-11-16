// 桌面歌词:接收主窗 tick,双行显示,工具条控制
const api = window.mpro;

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let lines = [];
let isPlain = false;
let trackId = null;
let cfg = { fontSize: 34, dualLine: true };

const $ = (id) => document.getElementById(id);
const line1 = $('dl-line1');
const line2 = $('dl-line2');

function applyCfg() {
  line1.style.fontSize = cfg.fontSize + 'px';
  line2.style.fontSize = Math.round(cfg.fontSize * 0.62) + 'px';
  line2.style.display = cfg.dualLine ? '' : 'none';
  $('t-dual').textContent = cfg.dualLine ? '双行' : '单行';
  if (cfg.color) line1.style.color = cfg.color;
}

async function loadLyrics(tid) {
  trackId = tid;
  lines = [];
  if (!tid) { setIdle(); return; }
  const res = await api.invoke('lyrics:get', tid);
  if (trackId !== tid) return;
  lines = (res && res.lines) || [];
  isPlain = !!(res && res.plain);
  setIdle();
}

function setIdle() {
  line1.textContent = isPlain || !lines.length ? '♪ 暂无歌词' : '♪';
  line1.classList.add('idle');
  line2.textContent = '';
}

// 找当前行 index
function findIndex(pos) {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= pos + 0.02) idx = i; else break;
  }
  return idx;
}

function renderLine(el, line, pos, active) {
  if (!line) { el.textContent = ''; el.classList.remove('idle'); return; }
  el.classList.remove('idle');
  if (active && line.words && line.words.length) {
    // 逐字高亮:已唱部分白色
    el.innerHTML = line.words
      .map((w) => `<span class="${pos >= w.t0 ? 'done' : ''}">${esc(w.text)}</span>`)
      .join('');
  } else if (active) {
    el.textContent = line.text || '♪';
  } else {
    el.textContent = line.text || '';
  }
}

let lastIdx = -2;
function sync(pos) {
  if (!lines.length || isPlain) return;
  const idx = findIndex(pos);
  if (idx === lastIdx) {
    // 同一行内更新逐字
    if (idx >= 0 && lines[idx].words) renderLine(line1, lines[idx], pos, true);
    return;
  }
  lastIdx = idx;
  if (idx < 0) {
    line1.textContent = '♪';
    line1.classList.add('idle');
    line2.textContent = lines[0]?.text || '';
    return;
  }
  renderLine(line1, lines[idx], pos, true);
  renderLine(line2, cfg.dualLine ? lines[idx + 1] : null, pos, false);
}

api.on('player:state', (st) => {
  if (st.trackId && st.trackId !== trackId) loadLyrics(st.trackId);
  if (!st.trackId) { trackId = null; setIdle(); }
  if (st.trackId && !lines.length) loadLyrics(st.trackId);
});
api.on('player:tick', (t) => sync(t.position));

api.invoke('player:getState').then((st) => {
  if (st?.trackId) {
    loadLyrics(st.trackId);
    sync(st.position);
  }
});

api.invoke('config:get').then((c) => {
  cfg = { ...cfg, ...c.desktopLyrics, fontSize: c.desktopLyrics?.fontSize || 34, dualLine: c.desktopLyrics?.dualLine !== false };
  applyCfg();
});
api.on('dl:configChanged', (dl) => { cfg = { ...cfg, ...dl }; applyCfg(); });
api.on('dl:lockChanged', (locked) => {
  $('dl-wrap').classList.toggle('locked', locked);
  $('dl-wrap').classList.toggle('unlocked', !locked);
});

// 工具条
$('t-lock').addEventListener('click', () => api.send('dl:lock', true));
$('t-close').addEventListener('click', () => api.send('dl:hide'));
$('t-bigger').addEventListener('click', () => api.send('dl:config', { fontSize: Math.min(72, cfg.fontSize + 4) }));
$('t-smaller').addEventListener('click', () => api.send('dl:config', { fontSize: Math.max(16, cfg.fontSize - 4) }));
$('t-dual').addEventListener('click', () => api.send('dl:config', { dualLine: !cfg.dualLine }));
