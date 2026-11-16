(async () => {
  // 触发手动检查更新(dev 模式应提示不可用)
  document.getElementById('btn-check-update').click();
  await new Promise(r => setTimeout(r, 800));
  const box = document.getElementById('update-status');
  return JSON.stringify({ updateStatus: box ? box.textContent.trim().slice(0, 120) : null });
})();
