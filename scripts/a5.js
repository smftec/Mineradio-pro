(async () => {
  document.querySelector('.lv-close')?.click();
  await new Promise(r => setTimeout(r, 200));
  const search = document.getElementById('search');
  search.focus();
  search.value = '不存在的歌曲xyz';
  search.dispatchEvent(new Event('input'));
  await new Promise(r => setTimeout(r, 300));
  return 'empty-search';
})();
