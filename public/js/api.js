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

// 小尺寸展示用缩略(96px,列表/播放条);无缩略回退原图
export function thumbUrl(track) {
  if (track && track.thumb) return mediaUrl(track.thumb);
  return coverUrl(track);
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

export function toast(msg, ms = 2600, icon = null) {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast' + (icon === 'success' ? ' success' : '');
  el.innerHTML = icon
    ? `<svg viewBox="0 0 24 24" class="ico">${icon === 'success' ? '<path d="M20 6L9 17l-5-5"/>' : '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'}</svg><span></span>`
    : '<span></span>';
  el.querySelector('span').textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 320);
  }, ms);
}
