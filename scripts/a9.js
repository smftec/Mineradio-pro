(async () => {
  const st = window.__state;
  st.clearSearch();
  await new Promise(r => setTimeout(r, 250));
  document.getElementById('pb-lyrics').click();
  await new Promise(r => setTimeout(r, 900));
  return 'lyrics';
})();
