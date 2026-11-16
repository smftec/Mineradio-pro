(async () => {
  const out = {};
  const st = window.__state;
  // 1. 频谱数据
  const spec = st.player.getSpectrum();
  out.spectrum = spec ? { len: spec.length, max: Math.max(...spec.slice(0, 100)), sum: spec.reduce((a, b) => a + b, 0) } : null;
  // 2. 频谱 canvas 绘制(非空像素)
  const cv = document.getElementById('pb-spectrum');
  const px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let painted = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] > 0) painted++;
  out.spectrumPaintedPx = painted;
  // 3. 收藏 toggle
  const t = st.tracks[0];
  const r1 = await window.mpro.invoke('fav:toggle', t.id);
  const r2 = await window.mpro.invoke('fav:toggle', t.id);
  out.favToggle = { first: r1.fav, second: r2.fav, count: r2.favorites.length };
  // 4. 收藏视图
  await window.mpro.invoke('fav:toggle', t.id);
  st.config.favorites = (await window.mpro.invoke('config:get')).favorites;
  st.navigate('favorites');
  await new Promise(r2 => setTimeout(r2, 300));
  out.favoritesView = { rows: document.querySelectorAll('#view-root tr[data-id]').length };
  // 5. 播放并检查 pb-fav 状态同步
  st.navigate('library');
  st.playFromList(st.tracks, 0);
  await new Promise(r2 => setTimeout(r2, 500));
  await window.mpro.invoke('fav:toggle', st.tracks[0].id);
  st.config.favorites = (await window.mpro.invoke('config:get')).favorites;
  window.__state.player._emit('track', { track: st.player.current });
  await new Promise(r2 => setTimeout(r2, 100));
  out.favBtnActive = document.getElementById('pb-fav').classList.contains('active');
  // 取消收藏还原
  await window.mpro.invoke('fav:toggle', st.tracks[0].id);
  return JSON.stringify(out, null, 1);
})();
