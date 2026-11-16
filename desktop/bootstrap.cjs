// CJS bootstrap:privileged scheme 必须在 app ready 前注册(Electron 43:
// 该 API 位于 protocol 模块上),完成后转入 ESM 主逻辑。
const { app, protocol } = require('electron');

// 开发模式(未打包)下,项目可能位于网络/虚拟盘(T: 等),
// Windows 沙箱进程无法读取其上的 Electron 安装目录 → 禁用沙箱。
// 打包安装到本地盘后不受影响。
if (!app.isPackaged) {
  app.commandLine.appendSwitch('no-sandbox');
  // 桌面播放器允许无手势自动播放
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
}
// 自动化验证:显式设置 MPRO_DEBUG=1 时开启 CDP 端口(dev 与安装版均可)
if (process.env.MPRO_DEBUG) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'mpro', privileges: { stream: true, supportFetchAPI: true, corsEnabled: true } },
]);
import('./main.js');
