(async () => {
  const out = {};
  const st = window.__state;
  // 1. 事件监听器计数(检测泄漏)
  out.listeners = {
    track: st.player._listeners?.track?.length || 0,
    state: st.player._listeners?.state?.length || 0,
    tick: st.player._listeners?.tick?.length || 0,
    queue: st.player._listeners?.queue?.length || 0,
    error: st.player._listeners?.error?.length || 0,
  };
  // 2. 快速导航 20 次(检测 DOM/监听器泄漏)
  const views = ['home', 'library', 'albums', 'artists', 'wall', 'queue', 'settings', 'home', 'library', 'albums', 'artists', 'wall', 'queue', 'settings', 'home', 'library', 'albums', 'artists', 'wall', 'queue'];
  for (const v of views) { st.navigate(v); await new Promise(r => setTimeout(r, 50)); }
  out.afterNav = {
    track: st.player._listeners?.track?.length || 0,
    state: st.player._listeners?.state?.length || 0,
  };
  // 3. 歌词视图开/关 5 次(检测可视化泄漏)
  st.navigate('library');
  for (let i = 0; i < 5; i++) {
    document.getElementById('pb-lyrics').click();
    await new Promise(r => setTimeout(r, 300));
    document.querySelector('.lv-close')?.click();
    await new Promise(r => setTimeout(r, 300));
  }
  out.lyricsToggleDone = true;
  // 4. 内存使用
  if (performance.memory) {
    out.memoryMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
  }
  return JSON.stringify(out, null, 1);
})();
