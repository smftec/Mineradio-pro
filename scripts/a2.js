(async () => {
  const st = window.__state;
  st.navigate('queue');
  await new Promise(r => setTimeout(r, 300));
  return 'queue';
})();
