// 全局媒体键快捷键(MediaPlayPause / MediaNextTrack / MediaPreviousTrack)
import electron from 'electron';
const { globalShortcut, BrowserWindow } = electron;

let registered = false;

function broadcastCommand(cmd) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('player:command', { cmd });
  }
}

export function applyMediaKeys(enabled) {
  try {
    if (enabled && !registered) {
      globalShortcut.register('MediaPlayPause', () => broadcastCommand('toggle'));
      globalShortcut.register('MediaNextTrack', () => broadcastCommand('next'));
      globalShortcut.register('MediaPreviousTrack', () => broadcastCommand('prev'));
      registered = true;
      console.log('[shortcuts] media keys registered');
    } else if (!enabled && registered) {
      globalShortcut.unregister('MediaPlayPause');
      globalShortcut.unregister('MediaNextTrack');
      globalShortcut.unregister('MediaPreviousTrack');
      registered = false;
      console.log('[shortcuts] media keys unregistered');
    }
  } catch (e) {
    console.error('[shortcuts]', e.message);
  }
}

electron.app.on('will-quit', () => {
  try { globalShortcut.unregisterAll(); } catch { /* ignore */ }
});
