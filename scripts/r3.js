(async () => {
  // 打开桌面歌词,改颜色,锁定
  window.mpro.send('dl:show');
  await new Promise(r => setTimeout(r, 1200));
  window.mpro.send('dl:config', { color: '#ffd76e', fontSize: 42 });
  await new Promise(r => setTimeout(r, 400));
  return 'configured';
})();
