(async () => {
  const st = window.__state;
  const t1 = st.tracks.find(t => t.title === '星河入梦');
  const t2 = st.tracks.find(t => t.title === '指尖光年');
  const r1 = await window.mpro.invoke('lyrics:get', t1.id);
  const r2 = await window.mpro.invoke('lyrics:get', t2.id);
  return JSON.stringify({
    xinghe: { source: r1.source, n: r1.lines.length, first: r1.lines[0] && { t: r1.lines[0].time, text: r1.lines[0].text } },
    zhijian: { source: r2.source, n: r2.lines.length, first: r2.lines[0] && { t: r2.lines[0].time, text: r2.lines[0].text, words: r2.lines[0].words && r2.lines[0].words.length } },
  }, null, 1);
})();
