(async () => {
  const st = window.__state;
  const tid = st.playingId;
  const track = st.trackById(tid);
  const res = await window.mpro.invoke('lyrics:get', tid);
  return JSON.stringify({
    track: track.title,
    source: res.source,
    lineCount: res.lines.length,
    firstLines: res.lines.slice(0, 2).map(l => ({ t: l.time, text: l.text, hasWords: !!(l.words && l.words.length) })),
    isPlain: !!res.plain,
  });
})();
