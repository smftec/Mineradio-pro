(() => {
  const a = document.getElementById('audioA'), b = document.getElementById('audioB');
  const active = window.__state.player._active;
  const el = active === 'A' ? a : b;
  return JSON.stringify({
    active, paused: el.paused, currentTime: el.currentTime, readyState: el.readyState,
    err: el.error && el.error.code, src: (el.src || '').slice(0, 60),
    ctxState: window.__state.player._ctx && window.__state.player._ctx.state,
  });
})();
