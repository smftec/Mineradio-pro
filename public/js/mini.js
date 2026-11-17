// 迷你播放器:接收主窗状态,发送控制命令
import { fmtTime, esc } from './api.js';

const api = window.mpro;
let latest = null;

const $ = (id) => document.getElementById(id);

function fmt(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function render(st) {
  latest = st;
  $('m-title').textContent = st.title || '未在播放';
  $('m-artist').textContent = st.artist || '—';
  $('m-cover').src = st.cover ? `mpro://media/?path=${encodeURIComponent(st.cover)}` : './assets/default-cover.png';
  $('m-cover').onerror = () => { $('m-cover').src = './assets/default-cover.png'; };
  $('m-i-play').classList.toggle('hidden', st.playing);
  $('m-i-pause').classList.toggle('hidden', !st.playing);
  document.body.classList.toggle('paused', !st.playing);
  const dur = st.duration || 0;
  const pct = dur ? Math.min(100, (st.position / dur) * 100) : 0;
  $('m-fill').style.width = pct + '%';
  $('m-cur').textContent = fmt(st.position);
  $('m-dur').textContent = fmt(dur);
}

api.on('player:state', render);
api.on('player:tick', (t) => {
  if (!latest) return;
  latest.position = t.position;
  const dur = latest.duration || 0;
  $('m-fill').style.width = (dur ? Math.min(100, (t.position / dur) * 100) : 0) + '%';
  $('m-cur').textContent = fmt(t.position);
});

api.invoke('player:getState').then((st) => { if (st && st.trackId) render(st); });

$('m-play').addEventListener('click', () => api.send('player:command', 'toggle'));
$('m-next').addEventListener('click', () => api.send('player:command', 'next'));
$('m-prev').addEventListener('click', () => api.send('player:command', 'prev'));
$('m-restore').addEventListener('click', () => api.send('mini:restore'));
$('m-collapse').addEventListener('click', () => api.send('mini:collapse'));
// 悬浮封面双击展开
$('m-cover').addEventListener('dblclick', () => api.send('mini:expand'));
// 接收主进程的收起/展开广播,同步 UI
api.on('mini:collapsed', (on) => {
  document.getElementById('mini').classList.toggle('collapsed', !!on);
});
$('m-progress').addEventListener('click', (e) => {
  if (!latest?.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const t = ((e.clientX - rect.left) / rect.width) * latest.duration;
  api.send('player:command', 'seek', t);
});

// 置顶切换
let onTop = true;
api.invoke('config:get').then((cfg) => {
  onTop = !!cfg.mini?.onTop;
  $('m-ontop').classList.toggle('active', onTop);
  // 恢复悬浮封面状态
  if (cfg.mini?.collapsed) {
    document.getElementById('mini').classList.add('collapsed');
  }
});
$('m-ontop').addEventListener('click', () => {
  onTop = !onTop;
  $('m-ontop').classList.toggle('active', onTop);
  api.send('mini:setOnTop', onTop);
});
