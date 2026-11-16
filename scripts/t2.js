(() => {
  const a = document.getElementById('audioA');
  const b = document.getElementById('audioB');
  return JSON.stringify({
    aSrc: (a.src || '').slice(0, 70),
    aPaused: a.paused, aReady: a.readyState, aNet: a.networkState, aErr: a.error && a.error.code,
    bSrc: (b.src || '').slice(0, 70),
    bPaused: b.paused, bReady: b.readyState, bErr: b.error && b.error.code,
  });
})();
