# v1.7.0 补丁:翻译 IPC/设置/歌词行 + APE-DSD 扫描提示
import io

# ---- store.js: translation defaults ----
p = 'desktop/lib/store.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("    shortcuts: { mediaKeys: true },",
              "    shortcuts: { mediaKeys: true },\n    translation: { enabled: false, endpoint: '', model: '', keyEncrypted: '', targetLang: 'zh-CN' },")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- ipc.js: translation handlers ----
p = 'desktop/lib/ipc.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("import { applyMediaKeys } from './shortcuts.js';",
              "import { applyMediaKeys } from './shortcuts.js';\nimport * as translation from './translation.js';")
s = s.replace("""  ipcMain.handle('backup:export', async () => backup.exportBackup(windows.main));""",
"""  ipcMain.handle('translation:getConfig', () => translation.getConfig());
  ipcMain.handle('translation:set', (_e, patch) => translation.setConfig(patch || {}));
  ipcMain.handle('translation:test', () => translation.testTranslation());
  ipcMain.handle('translation:translate', (_e, lines, targetLang) => translation.translateLines(lines || [], targetLang));
  ipcMain.handle('backup:export', async () => backup.exportBackup(windows.main));""")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- preload ----
p = 'desktop/preload.cjs'
s = io.open(p, encoding='utf-8').read()
s = s.replace("'fav:toggle', 'shortcuts:setMediaKeys', 'backup:export', 'backup:import', 'backup:relaunch',",
              "'fav:toggle', 'shortcuts:setMediaKeys', 'backup:export', 'backup:import', 'backup:relaunch',\n  'translation:getConfig', 'translation:set', 'translation:test', 'translation:translate',")
io.open(p, 'w', encoding='utf-8').write(s)

# ---- library.js: APE/DSD 识别(扫描计数提示,不入曲库) ----
p = 'desktop/lib/library.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("export const AUDIO_EXT = new Set(['.mp3', '.m4a', '.m4b', '.aac', '.flac', '.wav', '.ogg', '.oga', '.opus', '.webm', '.weba', '.aif', '.aiff']);",
"""export const AUDIO_EXT = new Set(['.mp3', '.m4a', '.m4b', '.aac', '.flac', '.wav', '.ogg', '.oga', '.opus', '.webm', '.weba', '.aif', '.aiff']);
// 识别但暂不支持解码的格式(播放时给出明确提示而非静默忽略)
export const UNSUPPORTED_EXT = new Set(['.ape', '.dsf', '.dff']);""")
s = s.replace("""// 扫描多个文件夹(批量导入)
export async function scanFolders(folders) {
  if (scanning) return { ok: false, reason: 'busy' };
  scanning = true;
  let added = 0;""",
"""// 扫描多个文件夹(批量导入)
export async function scanFolders(folders) {
  if (scanning) return { ok: false, reason: 'busy' };
  scanning = true;
  let added = 0;
  let unsupported = 0;""")
s = s.replace("""      const files = [];
      walk(folder, files);
      const total = files.length;""",
"""      const files = [];
      walk(folder, files);
      // 统计暂不支持的格式(如 APE/DSD),扫描结束后提示
      for (const f of files) {
        if (UNSUPPORTED_EXT.has(extname(f).toLowerCase())) unsupported++;
      }
      const total = files.length;""")
s = s.replace("""  send('library:changed', { tracks: allTracks() });
  return { ok: true, added };
}""",
"""  send('library:changed', { tracks: allTracks() });
  return { ok: true, added, unsupported };
}""")
io.open(p, 'w', encoding='utf-8').write(s)
print('ipc/store/library OK')
