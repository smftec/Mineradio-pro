(async () => {
  const st = window.__state;
  st.navigate('library');
  await new Promise(r => setTimeout(r, 200));
  document.getElementById('pb-lyrics').click();
  await new Promise(r => setTimeout(r, 800));
  return 'lyrics';
})();
