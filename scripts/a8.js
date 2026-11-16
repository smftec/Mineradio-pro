(async () => {
  const st = window.__state;
  st.navigate('library');
  await new Promise(r => setTimeout(r, 250));
  const search = document.getElementById('search');
  search.focus();
  search.value = '不存在的歌曲xyz';
  search.dispatchEvent(new Event('input'));
  await new Promise(r => setTimeout(r, 350));
  return 'empty';
})();
