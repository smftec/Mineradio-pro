(async () => {
  const st = window.__state;
  const out = { tracks: st.tracks.length, playingId: st.playingId };
  // 1. 播放状态
  out.pauseVisible = !document.getElementById('pb-icon-pause').classList.contains('hidden');
  // 2. 队列视图
  st.navigate('queue');
  await new Promise(r => setTimeout(r, 300));
  out.queueView = {
    rows: document.querySelectorAll('#view-root tr[data-id]').length,
    hasClear: !!document.getElementById('q-clear'),
    queueActive: document.getElementById('pb-queue').classList.contains('active'),
  };
  // 3. 移除一首(非当前)
  const rmBtn = document.querySelector('.q-rm[data-i="1"]');
  rmBtn?.click();
  await new Promise(r => setTimeout(r, 200));
  out.afterRemove = document.querySelectorAll('#view-root tr[data-id]').length;
  // 4. 设置页新控件
  st.navigate('settings');
  await new Promise(r => setTimeout(r, 300));
  out.settings = {
    groups: [...document.querySelectorAll('.set-group h3')].map(h => h.textContent),
    hasAutorun: !!document.getElementById('set-autorun'),
    hasDlLock: !!document.getElementById('set-dl-lock'),
    hasDlColor: !!document.getElementById('set-dl-color'),
  };
  // 5. 回曲库
  st.navigate('library');
  await new Promise(r => setTimeout(r, 200));
  out.backToLibrary = document.querySelectorAll('#view-root tr[data-id]').length;
  return JSON.stringify(out, null, 1);
})();
