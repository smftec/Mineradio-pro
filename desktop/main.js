// Mineradio pro — 主进程入口(由 bootstrap.cjs 转入;协议注册见 bootstrap.cjs)
import electron from 'electron';
const { app, BrowserWindow, session } = electron;
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// GPU 进程崩溃自愈:写标记禁用硬件加速并重启(标记由 bootstrap 读取)
app.on('child-process-gone', (_e, details) => {
  if (details.type === 'GPUProcess' && details.reason === 'Crashed') {
    console.error('[gpu] crashed — disabling hardware acceleration and relaunching');
    try {
      const flag = global.__gpuFlagPath;
      if (flag) require('node:fs').writeFileSync(flag, String(Date.now()));
      app.relaunch();
      app.exit(0);
    } catch { /* ignore */ }
  }
});

// 全局异常日志(便于排查用户反馈的问题)
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

// 单实例锁
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  const [{ registerProtocolHandler }, { initStores, stores }, { createMainWindow }, { initLibrary }, { initUpdater }, { registerIpc }] = await Promise.all([
    import('./lib/protocol.js'),
    import('./lib/store.js'),
    import('./lib/windows.js'),
    import('./lib/library.js'),
    import('./lib/updater.js'),
    import('./lib/ipc.js'),
  ]);

  // 二次启动:唤起主窗(可能在迷你模式下被隐藏)
  app.on('second-instance', () => {
    import('./lib/windows.js').then(({ windows }) => {
      if (windows.main && !windows.main.isDestroyed()) {
        if (windows.main.isMinimized()) windows.main.restore();
        windows.main.show();
        windows.main.focus();
      } else {
        createMainWindow().catch(() => {});
      }
    });
  });

  app.whenReady().then(async () => {
    console.log('[boot] ready, registering protocol…');
    try {
      registerProtocolHandler();
    // 本地 HTTP 服务(Folia 同源 iframe 集成)
    try {
      const { startServer } = await import('./lib/server.js');
      await startServer(join(__dirname, '..', 'public'));
      console.log('[boot] server started');
    } catch (e) { console.error('[boot] server failed:', e.message); }
      console.log('[boot] stores…');
      initStores();
      console.log('[boot] ipc…');
      registerIpc();
      console.log('[boot] library…');
      await initLibrary(); // 加载已有索引 + 恢复文件夹监控
      console.log('[boot] window…');
      await createMainWindow();
      // 测试钩子:MPRO_IMPORT=<文件夹> 启动后自动导入并播放(仅开发验证用)
      if (process.env.MPRO_IMPORT) {
        const folder = process.env.MPRO_IMPORT;
        setTimeout(async () => {
          try {
            const { addFolder } = await import('./lib/library.js');
            const r = await addFolder(folder);
            console.log('[test] imported:', JSON.stringify(r));
            const { windows } = await import('./lib/windows.js');
            await new Promise((res) => setTimeout(res, 1200));
            const out = await windows.main?.webContents.executeJavaScript(`
              (async () => {
                const st = window.__state;
                if (st && st.tracks.length) { st.playAll(st.tracks); return 'playing, tracks=' + st.tracks.length; }
                return 'no tracks: ' + (st ? st.tracks.length : 'no state');
              })()
            `);
            console.log('[test] play:', out);
          } catch (e) {
            console.error('[test] failed:', e);
          }
        }, 1500);
      }
      console.log('[boot] updater…');

      // 更新模块(启动 10s 后静默检查,可由设置关闭)
      initUpdater({ autoCheckDelayMs: 10_000 });

      // 全局媒体键(可由设置关闭)
      const { applyMediaKeys } = await import('./lib/shortcuts.js');
      applyMediaKeys(stores.config.data.shortcuts?.mediaKeys !== false);
      console.log('[boot] done');
    } catch (e) {
      console.error('[boot] FAILED:', e);
    }
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('before-quit', () => {
    try {
      stores.flushAll();
    } catch { /* ignore */ }
  });
}
