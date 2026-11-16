(async () => {
  const st = window.__state;
  st.navigate('settings');
  await new Promise(r => setTimeout(r, 300));
  document.getElementById('view-root').scrollTop = 0;
  return 'settings-top';
})();
