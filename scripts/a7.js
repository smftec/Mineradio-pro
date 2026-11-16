(async () => {
  // 依次捕获:专辑网格 → 搜索空态 → 歌词视图
  const st = window.__state;
  st.navigate('albums');
  await new Promise(r => setTimeout(r, 350));
  return 'albums';
})();
