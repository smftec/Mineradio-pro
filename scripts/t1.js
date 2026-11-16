new Promise((resolve) => setTimeout(() => {
  resolve(JSON.stringify({
    pauseVisible: !document.getElementById('pb-icon-pause').classList.contains('hidden'),
    cur: document.getElementById('pb-cur').textContent,
    dur: document.getElementById('pb-dur').textContent,
    title: document.getElementById('pb-title').textContent,
    playingRow: document.querySelectorAll('tr.playing').length,
  }));
}, 3000));
