(async () => {
  const st = window.__state;
  const out = {};
  st.playFromList(st.tracks, 0);
  await new Promise(r => setTimeout(r, 1500));
  // 频谱振幅(应非零)
  const spec = st.player.getSpectrum();
  out.spectrumPlaying = { max: Math.max(...spec.slice(0, 80)), sum: spec.reduce((a, b) => a + b, 0) };
  const cv = document.getElementById('pb-spectrum');
  const px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let painted = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] > 0) painted++;
  out.paintedPx = painted;
  // 收藏真实点击
  document.getElementById('pb-fav').click();
  await new Promise(r => setTimeout(r, 400));
  out.fav = {
    active: document.getElementById('pb-fav').classList.contains('active'),
    count: st.config.favorites.length,
  };
  document.getElementById('pb-fav').click();
  await new Promise(r => setTimeout(r, 300));
  out.favUntoggled = st.config.favorites.length;
  return JSON.stringify(out, null, 1);
})();
