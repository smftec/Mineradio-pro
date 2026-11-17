// preload:安全的 IPC 桥(CommonJS)
const { contextBridge, ipcRenderer } = require('electron');

const INVOKE_CHANNELS = new Set([
  'app:info',
  'lib:pickFolder', 'lib:pickFiles', 'lib:addFolder', 'lib:addFiles',
  'lib:getAll', 'lib:getFolders', 'lib:removeFolder', 'lib:rescan', 'lib:isScanning', 'lib:reveal',
  'lyrics:get', 'media:url', 'player:getState',
  'pl:list', 'pl:create', 'pl:rename', 'pl:remove', 'pl:addTracks', 'pl:removeTrack', 'pl:reorder',
  'stats:record', 'stats:progress', 'stats:position', 'stats:all', 'stats:clearHistory', 'stats:reset',
  'config:get', 'config:set', 'app:setLoginItem', 'app:getLoginItem',
  'fav:toggle', 'shortcuts:setMediaKeys', 'backup:export', 'backup:import', 'backup:relaunch',
  'wallpaper:mount', 'wallpaper:unmount', 'wallpaper:isMounted', 'wallpaper:diag',
  'we:detect', 'we:export', 'we:openProjects', 'preset:save', 'preset:load',
  'translation:getConfig', 'translation:set', 'translation:test', 'translation:translate', 'app:checkFfmpeg', 'export:saveVideo',
  'update:check', 'update:download', 'update:install', 'update:skip', 'update:openReleases',
]);

const ON_CHANNELS = new Set([
  'library:scan-progress', 'library:changed', 'library:updated', 'library:removed',
  'win:maximized',
  'update:event', 'dl:lockChanged', 'dl:configChanged',
  'player:state', 'player:tick', 'player:command', 'mini:collapsed', 'player:spec', 'wallpaper:config', 'wallpaper:state',
]);

contextBridge.exposeInMainWorld('mpro', {
  invoke(channel, ...args) {
    if (!INVOKE_CHANNELS.has(channel)) return Promise.reject(new Error('channel not allowed: ' + channel));
    return ipcRenderer.invoke(channel, ...args);
  },
  send(channel, ...args) {
    if (!['player:state', 'player:tick', 'player:spec', 'player:command', 'mini:collapsed', 'win:minimize', 'win:maximize', 'win:close',
      'mini:open', 'mini:close', 'mini:setOnTop', 'mini:restore', 'mini:collapse', 'mini:expand',
      'dl:show', 'dl:hide', 'dl:lock', 'dl:config'].includes(channel)) {
      throw new Error('channel not allowed: ' + channel);
    }
    ipcRenderer.send(channel, ...args);
  },
  on(channel, callback) {
    if (!ON_CHANNELS.has(channel)) return () => {};
    const handler = (_e, data) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});
