(async () => {
  const box = document.getElementById('update-status');
  return JSON.stringify({ status: box.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) });
})();
