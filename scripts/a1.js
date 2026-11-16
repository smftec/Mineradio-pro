(async () => {
  const st = window.__state;
  st.navigate('albums');
  await new Promise(r => setTimeout(r, 300));
  return 'albums';
})();
