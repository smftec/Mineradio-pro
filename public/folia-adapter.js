// Folia 宿主适配层:把 Mineradio pro 的播放器状态映射为 folia-host.js 要求的全局表面
// 必须在 folia-host.js 之前以 classic script 加载(index.html 直接 <script src>)
(function () {
  'use strict';

  // ---------- 基础访问(等 app.js 的模块世界就绪后通过 window.__minerdadioBridge 访问) ----------
  var bridge = null; // 由 app.js 设置:{ player, state, st() 等 }
  window.__setFoliaBridge = function (b) { bridge = b; refreshLibrary(); pushLyrics(); };

  var songWrappers = new Map();   // trackId → 稳定的 song 包装对象
  var favorites = [];             // trackId 列表(缓存)
  var libraryRevision = 0;
  var queueRevision = 0;

  function P() { return bridge ? bridge.player : null; }
  function S() { return bridge ? bridge.state : null; }

  // ---------- song 包装(稳定对象身份;宿主按对象缓存) ----------
  function toSong(track) {
    if (!track) return null;
    var id = track.id;
    var w = songWrappers.get(id);
    if (!w) {
      w = { __trackId: id };
      songWrappers.set(id, w);
    }
    // 字段同步(浅更新,保持身份)
    w.name = track.title; w.title = track.title;
    w.artist = track.artist; w.albumArtist = track.albumArtist || track.artist;
    w.album = track.album;
    w.localPath = track.path; w.localFilePathAbsolute = track.path;
    w.localFormat = track.ext; w.format = track.ext;
    w.duration = track.duration || 0;
    w.cover = track.cover || '';
    w.thumb = track.thumb || '';
    w.genre = track.genre; w.year = track.year; w.trackNo = track.trackNo;
    return w;
  }
  function songId(song) { return song ? String(song.__trackId || song.id || '') : ''; }

  // ---------- 库/队列 全局(宿主直读) ----------
  function refreshLibrary() {
    if (!S()) return;
    var songs = (S().tracks || []).map(toSong);
    window.localLibrarySongs = songs;
    libraryRevision++;
    rebuildQueueGlobals();
    favorites = (S().config && S().config.favorites ? S().config.favorites : []).slice();
  }
  function rebuildQueueGlobals() {
    var p = P(); if (!p) return;
    window.playQueue = (p.queue || []).map(function (t) { return toSong(t); });
    window.currentIdx = p.index;
    window.currentLocalSong = p.current ? toSong(p.current) : null;
    queueRevision++;
  }

  // ---------- 播放状态函数 ----------
  window.getPlaybackCurrentSeconds = function () { var p = P(); return p ? p.position || 0 : 0; };
  window.getPlaybackDurationSeconds = function () {
    var p = P(); if (!p) return 0;
    return p.duration || (p.current && p.current.duration) || 0;
  };
  window.playbackDurationFromSong = function (song) { return song ? (song.duration || 0) : 0; };
  window.togglePlay = function () { var p = P(); if (p) p.toggle(); };
  window.nextTrack = function () { var p = P(); if (p) p.next(false); };
  window.prevTrack = function () { var p = P(); if (p) p.prev(); };
  window.playQueueAt = function (index) { var p = P(); if (p && index >= 0 && index < p.queue.length) p.playTrackAt(index); };
  window.setVolume = function (v) {
    v = Math.max(0, Math.min(1, Number(v) || 0));
    window.targetVolume = v;
    var p = P(); if (p) p.setVolume(v);
  };
  window.targetVolume = 0.8;
  window.lastNonZeroVolume = 0.8;
  window.setPlayMode = function (mode) {
    var p = P(); if (!p) return;
    var m = String(mode || '');
    if (m.indexOf('shuffle') >= 0) { p.setShuffle(true); return; }
    if (m.indexOf('one') >= 0) { p.setShuffle(false); p.setRepeat('one'); return; }
    if (m.indexOf('all') >= 0 || m.indexOf('repeat') >= 0) { p.setShuffle(false); p.setRepeat('all'); return; }
    p.setShuffle(false); p.setRepeat('off');
  };
  window.setPlaybackRate = function (rate) {
    var els = [document.getElementById('audioA'), document.getElementById('audioB')];
    els.forEach(function (el) { if (el) el.playbackRate = Math.max(0.25, Math.min(4, Number(rate) || 1)); });
  };
  window.shufflePlayQueueOnce = function () { var p = P(); if (p) p.setShuffle(true); };
  window.markQueueContentChanged = function () { rebuildQueueGlobals(); };
  window.savePlaybackSession = function () { var p = P(); if (p && p.saveSession) p.saveSession(); };
  window.schedulePlaybackProgressUi = function () { /* 无独立进度 UI */ };
  window.selectLocalPlaybackPlaylistSource = function (id) { window.localLibraryPlaybackSelection = id || 'library'; };
  window.setLocalPlaybackPlaylistSelection = function (id) { window.selectLocalPlaybackPlaylistSource(id); };
  window.localLibraryPlaybackSelection = 'library';
  window.localPlaybackPlaylistSourceName = function (id) {
    if (id === 'special-liked') return '特别喜欢';
    if (id === 'library' || !id) return '全部音乐';
    var pl = findPlaylist(id); return pl ? pl.name : '全部音乐';
  };
  window.normalizeLocalPlaylistKind = function (id) { return id || 'library'; };

  // ---------- 音频/分析器 ----------
  Object.defineProperty(window, 'audio', {
    get: function () {
      var p = P(); if (!p) return null;
      return p._els ? p._els[p._active] : null;
    },
  });
  Object.defineProperty(window, 'analyser', {
    get: function () { var p = P(); return p ? p._analyser || null : null; },
  });
  Object.defineProperty(window, 'audioCtx', {
    get: function () { var p = P(); return p ? p._ctx || null : null; },
  });

  // ---------- 封面 ----------
  window.songCoverSrc = function (song, size) {
    if (!song) return '';
    var track = S() && S().trackById ? S().trackById(song.__trackId) : null;
    var src = track && (track.thumb || track.cover) ? track.thumb || track.cover : '';
    if (!src) return '';
    // 走本地 HTTP 封面端点(同源、可缓存);HTTP 服务未起时回退 mpro://
    var origin = location.origin && location.origin.indexOf('http') === 0 ? location.origin : '';
    if (origin && src) return origin + '/api/cover?path=' + encodeURIComponent(src);
    return 'mpro://media/?path=' + encodeURIComponent(src);
  };
  window.customCoverMap = {};

  // ---------- 喜欢 ----------
  window.specialLikedSongKey = function (song) { return songId(song); };
  window.isSpecialLikedSong = function (song) {
    var id = songId(song); return !!id && favorites.indexOf(id) >= 0;
  };
  window.specialLikedSongRef = function (song) { return songId(song); };
  window.getSpecialLikedSongs = function () {
    return favorites.map(function (id) { return songWrappers.get(id); }).filter(Boolean);
  };
  window.readSpecialLikedSongRefs = function () { return favorites.slice(); };
  window.writeSpecialLikedSongRefs = function (refs) {
    favorites = (refs || []).slice();
    if (bridge) window.mpro.invoke('config:set', { favorites: favorites });
  };
  window.toggleLikeSong = function (song) {
    var id = songId(song); if (!id) return false;
    var i = favorites.indexOf(id);
    if (i >= 0) favorites.splice(i, 1); else favorites.push(id);
    if (bridge) window.mpro.invoke('fav:toggle', id);
    return i < 0;
  };
  window.updateLikeButtons = function () { /* 主窗按钮由 player track 事件同步 */ };
  window.syncLocalLibraryDbFavorite = function () { /* 收藏已即时持久化 */ };

  // ---------- 歌单 ----------
  function findPlaylist(id) {
    var s = S(); if (!s) return null;
    return (s.playlists || []).find(function (p) { return p.id === id; }) || null;
  }
  window.readLocalPlaylists = function () {
    var s = S(); if (!s) return [];
    return (s.playlists || []).map(function (pl) {
      return { id: pl.id, name: pl.name, songRefs: pl.trackIds.map(function (id) { return songWrappers.get(id); }).filter(Boolean) };
    });
  };
  window.writeLocalPlaylists = function () { /* 各操作已即时持久化 */ };
  window.createLocalPlaylist = function (name, songs) {
    if (!bridge) return null;
    var ids = (songs || []).map(function (s2) { return s2.__trackId; }).filter(Boolean);
    var pl = null;
    window.mpro.invoke('pl:create', name, ids).then(function (created) { pl = created; });
    return { id: null, name: name, songRefs: songs || [] }; // 同步返回占位;Folia 会重新拉取列表
  };
  window.renameLocalPlaylist = function (id, name) { if (bridge) window.mpro.invoke('pl:rename', id, name); };
  window.deleteLocalPlaylist = function (id) { if (bridge) window.mpro.invoke('pl:remove', id); };
  window.localPlaylistById = function (id) {
    var pl = findPlaylist(id);
    if (!pl) return null;
    return { id: pl.id, name: pl.name, songRefs: pl.trackIds.map(function (tid) { return songWrappers.get(tid); }).filter(Boolean) };
  };
  window.localPlaylistSongs = function (id) {
    var pl = window.localPlaylistById(id);
    return pl ? pl.songRefs : [];
  };
  window.getLocalPlaylistSongLookup = function () {
    var lookup = {};
    S().tracks.forEach(function (t) { lookup[t.id] = toSong(t); });
    (S().playlists || []).forEach(function (pl) { lookup['local-playlist:' + pl.id] = pl; });
    return lookup;
  };
  window.refreshLocalPlaylistSurfaces = function () { /* Folia 自行拉取 */ };
  window.clearLocalLibraryPassiveQueue = function () { /* 无被动队列 */ };
  window.safeRenderQueuePanel = function () { /* 无独立队列面板 */ };
  window.safeShelfRebuild = function () { /* 无 shelf */ };
  window.backupPersistentUiState = function () { /* Folia 自管 localStorage */ };
  window.suspendMainRenderLoop = function () { window.__suspendHomeVisual = true; };
  window.resumeMainRenderLoop = function () { window.__suspendHomeVisual = false; };

  // ---------- 歌词 ----------
  // 宿主格式:{ t, duration, text, translation, words: [{t, d, text}], fallback }
  function pushLyrics() {
    var p = P(), s = S();
    if (!p || !s || !p.current) { window.lyricsLines = []; return; }
    window.mpro.invoke('lyrics:get', p.current.id).then(function (res) {
      if (!res || !res.lines) return;
      var src = res.lines;
      var mapped = [];
      for (var i = 0; i < src.length; i++) {
        var line = src[i];
        var next = src[i + 1];
        var t = (line.time != null && line.time >= 0) ? line.time : (i === 0 ? 0 : -1);
        if (t < 0) { // 纯文本:顺序排布
          t = mapped.length ? mapped[mapped.length - 1].t + (mapped[mapped.length - 1].duration || 4) : 0;
        }
        var dur = next && next.time > t ? next.time - t : 4.8;
        var words = (line.words || []).map(function (w) {
          return { t: w.t0, d: Math.max(0.05, (w.t1 || w.t0 + 0.24) - w.t0), text: w.text };
        });
        mapped.push({ t: t, duration: dur, text: line.text || '', words: words, fallback: false });
      }
      window.lyricsLines = mapped;
      window.lyricRowTranslationRevision = (window.lyricRowTranslationRevision || 0) + 1;
    }).catch(function () { window.lyricsLines = []; });
  }

  // ---------- 功能性 stub(优雅降级,不影响核心) ----------
  window.setSleepTimerMode = function () { return null; };
  window.commitGaplessSettings = function () {};
  window.commitReplayGainSettings = function () {};
  window.gaplessSettings = { enabled: false };
  window.setUiLanguage = function () {};
  window.openLocalFolderImport = function () {
    if (bridge && bridge.addFolderFlow) bridge.addFolderFlow();
  };
  window.openTranslationSourceSettings = function () {
    if (bridge && bridge.state) bridge.state.navigate('settings');
  };
  window.syncBeatMapPlaybackCursor = function () {};
  window.beatMapCache = {}; window.djBeatMapCache = {};
  window.getLocalBeatEntry = function () { return null; };
  window.localBeatDiskKey = 'mineradio-beatmap';
  // 宿主启动期即调用 create():必须提供完整表面
  window.MineradioFoliaAudioSettings = {
    create: function (globalObj) {
      var current = { rate: 1, output: 'default', muted: false };
      return {
        options: function () { return { devices: [], rate: current.rate, output: current.output, muted: current.muted }; },
        snapshot: function () { return { rate: current.rate, output: current.output, muted: current.muted }; },
        update: function (patch) { if (patch) Object.assign(current, patch); return this.snapshot(); },
        selectOutput: function (deviceId) { current.output = deviceId || 'default'; if (bridge && bridge.player) bridge.player.setSinkId(current.output); return this.snapshot(); },
      };
    },
  };
  window.MineradioSonicWorkshop = {
    clear: function () {},
    onPresetChange: function () { return null; },
  };
  window.MineradioVideoExport = {
    create: function (globalObj, deps) {
      // 视频导出在 Folia 内不可用(主窗歌词视图提供);返回可用的空会话避免宿主崩溃
      var busy = false;
      return {
        start: function () { return Promise.reject(new Error('请在 Mineradio 界面的歌词视图中使用视频导出')); },
        stop: function () {},
        cancel: function () {},
        getState: function () { return { busy: busy, progress: 0 }; },
      };
    },
  };
  window.MineradioVideoExportSession = null;
  window.isFoliaInterfaceActive = false;
  // getAnalysis(音频分析摘要):返回基线结构,Folia 据此调整视觉
  window.getAnalysis = function () {
    var p = P();
    return { bass: 0, mid: 0, high: 0, beat: 0, playing: !!(p && p.playing) };
  };
  window.getAudioOptions = function () {
    return { devices: [], replayGain: {}, gapless: { enabled: false }, rate: 1 };
  };
  window.setAudioChain = function () { return window.getAudioOptions(); };
  window.setOutputDevice = function () { return window.getAudioOptions(); };
  window.setReplayGain = function () {};
  window.setGapless = function () {};
  window.getVideoExportState = function () { return { busy: false }; };
  window.startVideoExport = function () { throw new Error('请在 Mineradio 界面的歌词视图中使用视频导出'); };
  window.stopVideoExport = function () {};
  window.cancelVideoExport = function () {};
  window.switchInterface = function () { /* Folia → Mineradio 由宿主按钮处理 */ };

  // ---------- 跟踪播放器事件 ----------
  function startTracking() {
    var p = P(); if (!p) { setTimeout(startTracking, 200); return; }
    p.on('queue', rebuildQueueGlobals);
    p.on('track', function () {
      rebuildQueueGlobals();
      pushLyrics();
      if (window.MineradioFoliaHost && window.MineradioFoliaHost.noteTrackChanged) {
        window.MineradioFoliaHost.noteTrackChanged();
      }
    });
    rebuildQueueGlobals();
    refreshLibrary();
  }
  // app.js boot 后调用 __setFoliaBridge 时启动跟踪
  var origSet = window.__setFoliaBridge;
  window.__setFoliaBridge = function (b) {
    origSet(b);
    startTracking();
  };
})();
