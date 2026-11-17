# v2.3.0 下载修复:blob → IPC → 主进程写 Downloads
import io

# ---- ipc.js:export:saveVideo ----
p = 'desktop/lib/ipc.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("import { detectFfmpeg, resetFfmpegCache } from './audio/transcode.js';",
              "import { detectFfmpeg, resetFfmpegCache } from './audio/transcode.js';\nimport { writeFileSync } from 'node:fs';")
s = s.replace("""  ipcMain.handle('app:checkFfmpeg', () => {""",
"""  ipcMain.handle('export:saveVideo', (_e, base64, filename) => {
    try {
      const safe = String(filename).replace(/[\\\\/:*?"<>|]/g, '_');
      const dir = app.getPath('downloads');
      const path = join(dir, safe);
      writeFileSync(path, Buffer.from(base64, 'base64'));
      return { ok: true, path };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  });
  ipcMain.handle('app:checkFfmpeg', () => {""")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- preload ----
p = 'desktop/preload.cjs'
s = io.open(p, encoding='utf-8').read()
s = s.replace("'translation:getConfig', 'translation:set', 'translation:test', 'translation:translate', 'app:checkFfmpeg',",
              "'translation:getConfig', 'translation:set', 'translation:test', 'translation:translate', 'app:checkFfmpeg', 'export:saveVideo',")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- export-video.js:blob → dataURL → IPC 保存 ----
p = 'public/js/export-video.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""  rec.onstop = () => {
    exporting = false;
    const blob = new Blob(chunks, { type: mime || 'video/webm' });
    console.log('[export] stopped. chunks:', chunks.length, 'blob size:', blob.size, 'mime:', mime || 'default');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mineradio-${track.title || 'video'}-${new Date().toISOString().slice(0, 10)}.webm`.replace(/[\\\\/:*?"<>|]/g, '_');
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('视频已导出到下载目录', 5000, 'success');
  };""",
"""  rec.onstop = async () => {
    exporting = false;
    const blob = new Blob(chunks, { type: mime || 'video/webm' });
    console.log('[export] stopped. chunks:', chunks.length, 'blob size:', blob.size, 'mime:', mime || 'default');
    if (!blob.size) { toast('录制内容为空,导出失败', 4000); return; }
    // blob → dataURL → 主进程直接写入下载目录(绕过 <a download> 的不确定性)
    const dataUrl = await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.readAsDataURL(blob);
    });
    const b64 = dataUrl.split(',')[1] || '';
    const filename = `Mineradio-${track.title || 'video'}-${new Date().toISOString().slice(0, 10)}.webm`;
    const r = await api.invoke('export:saveVideo', b64, filename);
    toast(r.ok ? `视频已保存:${r.path}` : `导出失败:${r.reason}`, 6000, r.ok ? 'success' : null);
  };""")
io.open(p, 'w', encoding='utf-8').write(s)
print('export save via ipc OK')
