(async () => {
  // 打开设置页并点击"下载更新"
  window.__state.navigate('settings');
  await new Promise(r => setTimeout(r, 400));
  const dl = document.getElementById('upd-download');
  if (!dl) return 'download button not found: ' + document.getElementById('update-status').textContent.slice(0, 80);
  dl.click();
  return 'download clicked';
})();
