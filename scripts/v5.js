(async () => {
  document.getElementById('pb-lyrics').click();
  await new Promise(r => setTimeout(r, 1000));
  return 'lyrics open';
})();
