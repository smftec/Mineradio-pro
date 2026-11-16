(async () => {
  const st = window.__state;
  st.navigate('settings');
  await new Promise(r => setTimeout(r, 600));
  const groups = [...document.querySelectorAll('.set-group h3')].map(h => h.textContent);
  const checkBtn = document.getElementById('btn-check-update');
  return JSON.stringify({ groups, hasCheckBtn: !!checkBtn });
})();
