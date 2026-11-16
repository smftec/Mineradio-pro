(async () => {
  const st = window.__state;
  const track = st.tracks.find(t => t.title === '雾里看花');
  // 播放该曲目并跳到最后 1.5 秒,等待自然结束
  const idx = st.tracks.indexOf(track);
  st.playFromList(st.tracks, idx);
  await new Promise(r => setTimeout(r, 1200));
  window.__state.player.seek(28.5);
  await new Promise(r => setTimeout(r, 4000)); // 等待结束 + 自动切下一首
  // 查询统计
  const stats = await window.mpro.invoke('stats:all');
  const s = stats.tracks[track.id] || {};
  const next = st.player.current && st.player.current.title;
  return JSON.stringify({ ended: true, nowPlaying: next, plays: s.plays, seconds: s.seconds, completed: s.completed });
})();
