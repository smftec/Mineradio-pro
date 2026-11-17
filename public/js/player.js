// 播放引擎:双 <audio> 交叉淡入淡出 + Web Audio(预增益/十段EQ/限幅)
import { mediaUrl } from './api.js';

const EQ_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const player = {
  queue: [],
  index: -1,
  repeat: 'off', // off | all | one
  shuffle: false,
  crossfade: 0,
  volume: 0.8,
  eq: { enabled: false, preamp: 0, bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], preset: 'flat' },

  current: null, // 当前 track 对象
  playing: false,
  position: 0,
  duration: 0,

  // 内部
  _ctx: null,
  _preampGain: null,
  _filters: [],
  _limiter: null,
  _active: 'A',
  _els: {},
  _fadeTimer: null,
  _listeners: {},
  _playStartPos: 0,   // 本次播放起始秒(统计累计时长)
  _settled: false,    // 当前曲目是否已结算(防止 ended + 切歌双计)
  _sinkId: 'default',
  _errorSkips: 0,     // 连续错误跳过计数(防死循环)

  on(evt, cb) {
    (this._listeners[evt] ||= []).push(cb);
    return () => { this._listeners[evt] = this._listeners[evt].filter((f) => f !== cb); };
  },
  _emit(evt, data) {
    for (const f of this._listeners[evt] || []) f(data);
    // 状态推送给迷你播放器/桌面歌词窗口
    if (evt === 'state' || evt === 'track') {
      window.mpro.send('player:state', this.stateSnapshot());
    }
  },

  stateSnapshot() {
    return {
      trackId: this.current?.id || null,
      title: this.current?.title || '',
      artist: this.current?.artist || '',
      cover: this.current?.cover || null,
      playing: this.playing,
      position: this.position,
      duration: this.duration,
      queue: this.queue.map((t) => t.id),
      index: this.index,
    };
  },

  init() {
    this._els.A = document.getElementById('audioA');
    this._els.B = document.getElementById('audioB');
    for (const key of ['A', 'B']) {
      const el = this._els[key];
      // 关键:MediaElementAudioSource 要求 CORS 模式,否则输出全零(静音)
      el.crossOrigin = 'anonymous';
      el.addEventListener('timeupdate', () => {
        if (this._active !== key) return;
        this.position = el.currentTime;
        this._emit('tick', { position: this.position, duration: el.duration || 0 });
        window.mpro.send('player:tick', { position: this.position, playing: this.playing, trackId: this.current?.id || null });
      });
      el.addEventListener('durationchange', () => {
        if (this._active === key) { this.duration = el.duration || 0; this._emit('state', {}); }
      });
      el.addEventListener('play', () => { if (this._active === key) { this.playing = true; this._errorSkips = 0; this._emit('state', {}); } });
      el.addEventListener('pause', () => { if (this._active === key) { this.playing = false; this._emit('state', {}); } });
      el.addEventListener('ended', () => {
        if (this._active !== key) return;
        this._settled = true; // 已结算,避免 _load 再次记录
        this._recordPlay(true);
        if (this.repeat === 'one') {
          this._settled = false;
          el.currentTime = 0;
          el.play().catch(() => {});
        } else {
          this.next(true);
        }
      });
      el.addEventListener('error', () => {
        if (this._active !== key || !this.current) return;
        this._emit('error', { track: this.current });
        // 自动跳过坏文件,连跳超过队列长度则停止,防死循环
        if (this._errorSkips < this.queue.length) {
          this._errorSkips++;
          this._settled = true;
          setTimeout(() => { if (this.current && !this.playing) this.next(true); }, 1200);
        }
      });
    }
  },

  _ensureCtx() {
    if (this._ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this._ctx = new Ctx();
    const srcA = this._ctx.createMediaElementSource(this._els.A);
    const srcB = this._ctx.createMediaElementSource(this._els.B);
    this._preampGain = this._ctx.createGain();
    this._limiter = this._ctx.createDynamicsCompressor();
    this._limiter.threshold.value = -3;
    this._limiter.knee.value = 0;
    this._limiter.ratio.value = 12;
    this._limiter.attack.value = 0.003;
    this._limiter.release.value = 0.25;
    this._filters = EQ_FREQS.map((f, i) => {
      const bq = this._ctx.createBiquadFilter();
      bq.type = i === 0 ? 'lowshelf' : i === EQ_FREQS.length - 1 ? 'highshelf' : 'peaking';
      bq.frequency.value = f;
      bq.Q.value = 1.1;
      bq.gain.value = 0;
      return bq;
    });
    const chain = (src) => {
      let node = src;
      for (const f of this._filters) { node.connect(f); node = f; }
      node.connect(this._preampGain);
      this._preampGain.connect(this._limiter);
      this._limiter.connect(this._ctx.destination);
    };
    chain(srcA);
    chain(srcB);
    // 频谱分析(tap,不影响输出链路)
    this._analyser = this._ctx.createAnalyser();
    this._analyser.fftSize = 512;
    this._analyser.smoothingTimeConstant = 0.82;
    this._limiter.connect(this._analyser);
    this._applyEq();
    this._els.A.volume = this.volume;
    this._els.B.volume = this.volume;
  },

  // 音频流(视频导出录制用;tap 不影响扬声器输出)
  getAudioStream() {
    this._ensureCtx();
    if (!this._msDest) {
      this._msDest = this._ctx.createMediaStreamDestination();
      this._limiter.connect(this._msDest);
    }
    return this._msDest.stream;
  },

  // 实时频谱(Uint8Array 0~255,无 ctx 或未播放时为低幅值)
  getSpectrum() {
    if (!this._analyser) return null;
    const arr = new Uint8Array(this._analyser.frequencyBinCount);
    this._analyser.getByteFrequencyData(arr);
    return arr;
  },

  _applyEq() {
    if (!this._ctx) return;
    const on = this.eq.enabled;
    this._preampGain.gain.value = on ? Math.pow(10, this.eq.preamp / 20) : 1;
    this._filters.forEach((f, i) => { f.gain.value = on ? this.eq.bands[i] || 0 : 0; });
  },

  setEq(eq) {
    this.eq = { ...this.eq, ...eq };
    this._applyEq();
    this._emit('state', {});
  },

  async setSinkId(deviceId) {
    this._sinkId = deviceId || 'default';
    for (const el of Object.values(this._els)) {
      if (el.setSinkId) {
        try { await el.setSinkId(this._sinkId); } catch { /* 设备可能已断开 */ }
      }
    }
  },

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this._els.A.volume = this.volume;
    this._els.B.volume = this.volume;
    this._emit('state', {});
  },

  playTrackAt(index) {
    if (index < 0 || index >= this.queue.length) return;
    this.index = index;
    this._load(this.queue[index]);
  },

  async _load(track) {
    this._ensureCtx();
    if (this._ctx.state === 'suspended') await this._ctx.resume();

    // 结算上一首的播放时长(ended 已结算过则跳过)
    if (this.current && !this._settled) this._recordPlay(false);
    this._settled = false;

    // 终止进行中的淡入淡出并复位音量
    clearInterval(this._fadeTimer);
    this._fadeTimer = null;
    this._els.A.volume = this.volume;
    this._els.B.volume = this.volume;

    const prevKey = this._active;
    const nextKey = prevKey === 'A' ? 'B' : 'A';
    const prevEl = this._els[prevKey];
    const nextEl = this._els[nextKey];

    this.current = track;
    this.position = 0;
    this.duration = track.duration || 0;
    nextEl.src = mediaUrl(track.path);

    // 断点续播:专用接口查该曲目的上次进度
    const st = await window.mpro.invoke('stats:position', track.id).catch(() => null);
    const lastPos = st?.lastPosition || 0;
    let startPos = 0;
    if (lastPos > 5 && track.duration && lastPos < track.duration - 10) {
      startPos = lastPos;
    }
    const cf = Math.max(0, this.crossfade || 0);
    const crossfading = cf > 0 && !prevEl.paused && !!prevEl.src;

    try {
      nextEl.currentTime = startPos;
    } catch { /* loadedmetadata 前 seek 可能抛错,忽略 */ }
    nextEl.volume = crossfading ? 0 : this.volume;
    this._active = nextKey;
    try {
      await nextEl.play();
    } catch { /* 由 error 事件处理 */ }
    this._playStartPos = startPos;
    this.position = startPos;

    if (crossfading) {
      const steps = 40;
      let step = 0;
      this._fadeTimer = setInterval(() => {
        step++;
        const t = Math.min(1, step / steps);
        nextEl.volume = this.volume * t;
        prevEl.volume = this.volume * (1 - t);
        if (t >= 1) {
          clearInterval(this._fadeTimer);
          this._fadeTimer = null;
          try { prevEl.pause(); prevEl.removeAttribute('src'); prevEl.load(); } catch { /* ignore */ }
          prevEl.volume = this.volume;
        }
      }, (cf * 1000) / steps);
    } else {
      try { prevEl.pause(); prevEl.removeAttribute('src'); prevEl.load(); } catch { /* ignore */ }
    }

    this._emit('track', { track });
    this._emit('state', {});
  },

  async toggle() {
    if (!this.current) {
      if (this.queue.length) this.playTrackAt(Math.max(0, this.index));
      return;
    }
    const el = this._els[this._active];
    if (el.paused) {
      this._ensureCtx();
      if (this._ctx.state === 'suspended') await this._ctx.resume();
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  },

  _nextIndex(auto = false) {
    if (!this.queue.length) return -1;
    if (this.shuffle) {
      if (this.queue.length === 1) return this.index;
      let i;
      do { i = Math.floor(Math.random() * this.queue.length); } while (i === this.index);
      return i;
    }
    if (this.index + 1 < this.queue.length) return this.index + 1;
    if (auto && this.repeat === 'off') return -1; // 列表自然结束
    return 0;
  },

  next(auto = false) {
    const i = this._nextIndex(auto);
    if (i === -1) {
      this.playing = false;
      this.position = 0;
      this._emit('state', {});
      return;
    }
    this.playTrackAt(i);
  },

  prev() {
    if (this.position > 3) { this.seek(0); return; }
    if (!this.queue.length) return;
    const i = this.index - 1 >= 0 ? this.index - 1 : this.queue.length - 1;
    this.playTrackAt(i);
  },

  seek(t) {
    const el = this._els[this._active];
    if (!el || !el.src || !isFinite(t)) return;
    el.currentTime = Math.max(0, Math.min(t, el.duration || t));
    this.position = el.currentTime;
    this._emit('tick', { position: this.position, duration: this.duration });
  },

  seekBy(delta) {
    this.seek((this._els[this._active]?.currentTime || 0) + delta);
  },

  setQueue(tracks, startIndex = -1) {
    this.queue = [...tracks];
    this._errorSkips = 0;
    if (startIndex >= 0) {
      this.playTrackAt(startIndex);
    } else {
      this.index = -1;
      this._emit('queue', {});
    }
  },

  enqueue(tracks, { playNow = false } = {}) {
    const list = Array.isArray(tracks) ? tracks : [tracks];
    const start = this.queue.length;
    this.queue.push(...list);
    if (playNow) this.playTrackAt(start);
    else this._emit('queue', {});
  },

  removeAt(index) {
    if (index < 0 || index >= this.queue.length) return;
    const wasCurrent = index === this.index;
    this.queue.splice(index, 1);
    if (index < this.index) {
      this.index--;
    } else if (wasCurrent) {
      this.index = Math.min(this.index, this.queue.length - 1);
      if (this.queue.length === 0) this.stop();
    }
    this._emit('queue', {});
  },

  // 队列内拖拽移动(fromId 移动到 toId 前/后),同步修正当前播放索引
  moveInQueue(fromId, toId, below) {
    const from = this.queue.findIndex((t) => t.id === fromId);
    if (from < 0 || fromId === toId) return;
    const [moved] = this.queue.splice(from, 1);
    let idx = this.queue.findIndex((t) => t.id === toId);
    if (idx < 0) { this.queue.splice(from, 0, moved); return; }
    this.queue.splice(below ? idx + 1 : idx, 0, moved);
    if (this.current) this.index = this.queue.findIndex((t) => t.id === this.current.id);
    this._emit('queue', {});
  },

  clearQueue({ keepCurrent = true } = {}) {
    if (keepCurrent && this.current) {
      this.queue = [this.current];
      this.index = 0;
    } else {
      this.queue = [];
      this.index = -1;
      this.stop();
    }
    this._emit('queue', {});
  },

  stop() {
    const el = this._els[this._active];
    try { el.pause(); el.removeAttribute('src'); el.load(); } catch { /* ignore */ }
    this.playing = false;
    this.position = 0;
    this._emit('state', {});
  },

  setRepeat(mode) {
    this.repeat = mode;
    this._emit('state', {});
  },

  setShuffle(on) {
    this.shuffle = !!on;
    if (on && this.current) {
      // 保持当前曲目在首位,其余洗牌
      const rest = this.queue.filter((_, i) => i !== this.index);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      this.queue = [this.current, ...rest];
      this.index = 0;
    }
    this._emit('state', {});
  },

  _recordPlay(completed) {
    if (!this.current) return;
    const seconds = Math.max(0, Math.round(this.position - this._playStartPos));
    if (!completed && seconds < 1) return; // 无意义切换不记录
    window.mpro.invoke('stats:record', this.current.id, { seconds, completed: !!completed });
  },

  // 周期性保存进度(断点续播)
  startProgressSaver() {
    setInterval(() => {
      if (this.current && this.playing) {
        window.mpro.invoke('stats:progress', this.current.id, Math.floor(this.position));
      }
    }, 3000);
  },

  // 会话保存/恢复(断点续播队列)
  saveSession() {
    window.mpro.invoke('config:set', {
      session: {
        queue: this.queue.map((t) => t.id),
        index: this.index,
        position: Math.floor(this.position),
        name: this.current?.title || '',
      },
    });
  },
  startSessionSaver() {
    setInterval(() => {
      if (this.current) this.saveSession();
    }, 5000);
  },
};
