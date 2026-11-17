// 歌词翻译:OpenAI 兼容 chat/completions 接口
// API Key 经 Electron safeStorage 加密存储;批量行翻译 + LRU 缓存
import electron from 'electron';
const { safeStorage } = electron;
import { getStore } from './store.js';

const TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 400_000;
const CACHE_MAX = 600;

const cache = new Map(); // key = `${lang}|${text}` → 翻译

function cacheGet(key) {
  if (!cache.has(key)) return undefined;
  const v = cache.get(key);
  cache.delete(key);
  cache.set(key, v); // LRU 触顶
  return v;
}
function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, value);
}

function decryptKey() {
  const cfg = getStore('config').data.translation || {};
  if (!cfg.keyEncrypted) return '';
  try {
    if (!safeStorage.isEncryptionAvailable()) return '';
    return safeStorage.decryptString(Buffer.from(cfg.keyEncrypted, 'base64'));
  } catch {
    return '';
  }
}

// 对外配置视图(不回传明文密钥)
export function getConfig() {
  const cfg = getStore('config').data.translation || {};
  const encAvailable = safeStorage.isEncryptionAvailable();
  return {
    enabled: !!cfg.enabled,
    endpoint: cfg.endpoint || '',
    model: cfg.model || '',
    hasKey: !!cfg.keyEncrypted,
    keyUnavailable: !encAvailable,
    targetLang: cfg.targetLang || 'zh-CN',
  };
}

export function setConfig(patch = {}) {
  const cfg = getStore('config').data.translation ||= {};
  if (typeof patch.enabled === 'boolean') cfg.enabled = patch.enabled;
  if (typeof patch.endpoint === 'string') cfg.endpoint = patch.endpoint.trim();
  if (typeof patch.model === 'string') cfg.model = patch.model.trim();
  if (typeof patch.targetLang === 'string') cfg.targetLang = patch.targetLang;
  if (typeof patch.apiKey === 'string') {
    if (!patch.apiKey.trim()) {
      delete cfg.keyEncrypted; // 清空密钥
    } else if (safeStorage.isEncryptionAvailable()) {
      cfg.keyEncrypted = safeStorage.encryptString(patch.apiKey.trim()).toString('base64');
    } else {
      return { ok: false, reason: '系统加密组件不可用,无法安全存储 API Key' };
    }
  }
  getStore('config').scheduleSave();
  return { ok: true };
}

function redact(message) {
  const key = decryptKey();
  let m = String(message || '连接翻译服务失败');
  if (key) m = m.split(key).join('[REDACTED]');
  return m.replace(/https?:\/\/[^\s"'<>]+/gi, '[接口地址]').slice(0, 240);
}

async function request(messages, { timeoutMs = TIMEOUT_MS } = {}) {
  const cfg = getStore('config').data.translation || {};
  const apiKey = decryptKey();
  if (!cfg.enabled || !cfg.endpoint || !cfg.model || (cfg.endpoint.includes('api.openai.com') && !apiKey && !cfg.allowKeyless)) {
    throw Object.assign(new Error('请先在设置中配置并启用翻译源'), { code: 'NOT_CONFIGURED' });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (apiKey) headers.Authorization = 'Bearer ' + apiKey;
    const response = await fetch(cfg.endpoint, {
      method: 'POST', headers, signal: controller.signal,
      body: JSON.stringify({ model: cfg.model, temperature: 0.1, stream: false, messages }),
    });
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) throw Object.assign(new Error('翻译服务响应过大'), { code: 'UPSTREAM_TOO_LARGE' });
    let data;
    try { data = JSON.parse(text); } catch { throw Object.assign(new Error('翻译服务返回格式异常'), { code: 'UPSTREAM_INVALID' }); }
    if (!response.ok || data.error) {
      const detail = data.error;
      const message = typeof detail === 'string' ? detail : detail?.message || `HTTP ${response.status}`;
      throw Object.assign(new Error(redact(message)), { code: 'UPSTREAM_HTTP_' + response.status });
    }
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw Object.assign(new Error('模型未返回有效内容'), { code: 'UPSTREAM_EMPTY' });
    return content;
  } catch (e) {
    if (e.name === 'AbortError') throw Object.assign(new Error('翻译服务超过 30 秒未响应'), { code: 'UPSTREAM_TIMEOUT' });
    if (!e.code) throw Object.assign(new Error(redact('连接翻译服务失败,请检查地址与网络')), { code: 'UPSTREAM_NETWORK' });
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// 测试连通性
export async function testTranslation() {
  try {
    const content = await request([{ role: 'user', content: 'Reply with OK only.' }], { timeoutMs: 15_000 });
    return content.trim() ? { ok: true, message: '连接成功,模型可用' } : { ok: false, message: '接口已连接,但模型未返回有效内容' };
  } catch (e) {
    return { ok: false, code: e.code, message: redact(e.message) };
  }
}

// 批量翻译多行歌词;主进程 LRU 缓存避免重复请求
export async function translateLines(lines, targetLang) {
  const cfg = getStore('config').data.translation || {};
  const lang = targetLang || cfg.targetLang || 'zh-CN';
  const result = new Array(lines.length).fill(null);
  const pending = [];
  lines.forEach((text, i) => {
    if (!text || !text.trim()) { result[i] = ''; return; }
    const cached = cacheGet(`${lang}|${text}`);
    if (cached !== undefined) result[i] = cached;
    else pending.push(i);
  });
  if (!pending.length) return { lines: result, cachedOnly: true };

  // 分批(每批 ≤ 10 行),失败不阻塞(返回 null 行)
  for (let start = 0; start < pending.length; start += 10) {
    const batch = pending.slice(start, start + 10);
    const texts = batch.map((i) => lines[i]);
    const messages = [
      { role: 'system', content: `你是歌词翻译器。把用户给的歌词逐行翻译成${lang === 'zh-CN' ? '简体中文' : lang}。保留原文的行顺序与行数,不要合并或改写,不要加注释。只输出一个 JSON 字符串数组,例如 ["翻译1","翻译2"]。` },
      { role: 'user', content: JSON.stringify(texts) },
    ];
    try {
      const content = await request(messages);
      const m = content.match(/\[[\s\S]*\]/); // 容错截取 JSON 数组
      const arr = m ? JSON.parse(m[0]) : null;
      if (!Array.isArray(arr)) throw new Error('bad array');
      batch.forEach((idx, j) => {
        const t = typeof arr[j] === 'string' ? arr[j].trim() : '';
        result[idx] = t;
        if (t) cacheSet(`${lang}|${lines[idx]}`, t);
      });
    } catch (e) {
      console.error('[translation] batch failed:', redact(e.message));
      return { lines: result, error: redact(e.message), code: e.code };
    }
  }
  return { lines: result };
}
