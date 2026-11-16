(async () => {
  const st = window.__state;
  const t = st.tracks.find(x => x.title === '星河入梦');
  const idx = st.tracks.indexOf(t);
  st.playFromList(st.tracks, idx);
  await new Promise(r => setTimeout(r, 2500));
  document.getElementById('pb-lyrics').click();
  await new Promise(r => setTimeout(r, 1200));
  const lines = document.querySelectorAll('.lv-line');
  const active = document.querySelector('.lv-line.active');
  return JSON.stringify({
    playing: t.title,
    lyricLines: lines.length,
    activeText: active ? active.textContent : null,
    viewOpen: !!document.querySelector('.lyrics-view'),
  });
})();
