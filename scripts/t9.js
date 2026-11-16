(async () => {
  // 回到曲库 + 打开桌面歌词和迷你播放器
  window.__state.navigate('library');
  window.mpro.send('dl:show');
  window.mpro.send('mini:open');
  await new Promise(r => setTimeout(r, 1500));
  return 'opened dl + mini';
})();
