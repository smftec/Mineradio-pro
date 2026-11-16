(async () => {
  await new Promise(r => setTimeout(r, 600));
  const l1 = document.getElementById('dl-line1');
  return JSON.stringify({ color: l1.style.color, fontSize: l1.style.fontSize, wrap: document.getElementById('dl-wrap').className });
})();
