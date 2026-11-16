(async () => {
  const out = {};
  // 更新状态(badge 可见性 + 设置页状态)
  out.badgeVisible = !document.getElementById('btn-update-badge').classList.contains('hidden');
  window.__state.navigate('settings');
  await new Promise(r => setTimeout(r, 400));
  out.updateStatus = document.getElementById('update-status').textContent.trim().slice(0, 100);
  return JSON.stringify(out, null, 1);
})();
