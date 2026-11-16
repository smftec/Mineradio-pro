(async () => {
  // 在渲染进程里直接 fetch mpro 协议,看返回什么
  try {
    const r = await fetch('mpro://media/?path=' + encodeURIComponent('C:\Users\索末菲\Music\MineradioTest\雾里看花.flac'));
    const txt = r.ok ? '(binary ok)' : await r.text();
    return JSON.stringify({ status: r.status, ok: r.ok, body: String(txt).slice(0, 200) });
  } catch (e) {
    return 'FETCH ERROR: ' + e.message;
  }
})();
