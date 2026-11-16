(async () => {
  const st = window.__state;
  st.navigate('library');
  await new Promise(r => setTimeout(r, 200));
  window.mpro.send('mini:open');
  await new Promise(r => setTimeout(r, 900));
  return 'mini';
})();
