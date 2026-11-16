(async () => {
  const search = document.getElementById('search');
  search.value = '';
  search.dispatchEvent(new Event('input'));
  await new Promise(r => setTimeout(r, 200));
  window.mpro.send('mini:open');
  await new Promise(r => setTimeout(r, 800));
  return 'mini';
})();
