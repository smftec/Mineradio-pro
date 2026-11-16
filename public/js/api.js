// window.mpro API 封装
export const api = window.mpro;

export const appInfo = await api.invoke('app:info');

export function mediaUrl(path) {
  return `mpro://media/?path=${encodeURIComponent(path)}`;
}

// track.cover 由主进程保存为封面缓存的绝对路径
export function coverUrl(track) {
  return track && track.cover ? mediaUrl(track.cover) : null;
}

export function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function toast(msg, ms = 2600) {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 320);
  }, ms);
}
