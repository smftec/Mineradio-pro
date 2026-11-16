(async () => {
  const box = document.getElementById('update-status');
  const t = box.textContent.replace(/\s+/g, ' ').trim();
  const hasInstall = !!document.getElementById('upd-install');
  return JSON.stringify({ t: t.slice(0, 120), readyToInstall: hasInstall });
})();
