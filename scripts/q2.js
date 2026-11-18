(async () => {
  const out = {};
  const st = window.__state;
  // 边界测试
  // 1. 空队列播放
  st.player.clearQueue({ keepCurrent: false });
  st.player.toggle();
  out.emptyQueueToggle = st.player.playing;
  // 2. 越界索引
  st.player.playTrackAt(999);
  out.oobIndex = st.player.index;
  // 3. 零长度 seek
  st.player.seek(-999);
  out.seekNegative = st.player.position >= 0;
  st.player.seek(99999);
  out.seekBeyond = st.player.position <= (st.player.duration || 0);
  // 4. 重复 clearQueue
  st.player.clearQueue();
  st.player.clearQueue();
  out.doubleClearOk = true;
  // 5. 恢复正常播放
  st.playFromList(st.tracks, 0);
  await new Promise(r => setTimeout(r, 700));
  out.recovered = st.player.playing;
  // 6. 快速连续 next()(竞态检测)
  for (let i = 0; i < 5; i++) st.player.next();
  await new Promise(r => setTimeout(r, 500));
  out.rapidNextCurrent = st.player.current?.title?.slice(0, 8);
  return JSON.stringify(out, null, 1);
})();
