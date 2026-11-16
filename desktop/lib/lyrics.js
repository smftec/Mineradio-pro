// 歌词解析:外置 .lrc/.txt(多编码自动识别,含逐字增强 LRC)+ 内嵌标签
import { readFileSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import chardet from 'chardet';
import iconv from 'iconv-lite';

// 将 LRC 文本解析为行(支持多时间标签、逐字 <mm:ss.xx,ms> / <mm:ss.xx>)
export function parseLrc(content) {
  const lines = [];
  let offset = 0;
  const tagTime = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

  for (const rawLine of content.split(/\r\n|\n|\r/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // 全局 offset 标签
    const off = line.match(/^\[offset:\s*([+-]?\d+)\s*\]$/i);
    if (off) { offset = parseInt(off[1], 10); continue; }
    // 纯信息标签(标题/艺术家等)
    if (/^\[(ti|ar|al|by|kana|hash):.*\]$/i.test(line)) continue;

    // 逐字格式:时间标签后跟 <t,ms> 或 <t> 片段
    const timeTags = [...line.matchAll(tagTime)];
    if (!timeTags.length) continue;

    let body = line.replace(tagTime, '').trim();
    const words = [];
    let isWordLevel = false;

    const wordRe = /<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?(?:,(\d{1,4}))?>/g;
    const wordTags = [...body.matchAll(wordRe)];
    if (wordTags.length) {
      isWordLevel = true;
      for (let i = 0; i < wordTags.length; i++) {
        const m = wordTags[i];
        const t0 = (+m[1]) * 60 + (+m[2]) + (m[3] ? +`0.${m[3]}` : 0);
        const next = wordTags[i + 1];
        const t1 = next
          ? (+next[1]) * 60 + (+next[2]) + (next[3] ? +`0.${next[3]}` : 0)
          : t0 + (m[4] ? +m[4] / 1000 : 0);
        const text = body.slice(m.index + m[0].length, next ? next.index : undefined).trim();
        if (text) words.push({ t0, t1, text });
      }
      body = body.replace(wordRe, '').trim();
    }

    const text = body.replace(/^\s*[-—~]\s*$/, '');
    for (const tag of timeTags) {
      const t = (+tag[1]) * 60 + (+tag[2]) + (tag[3] ? +`0.${tag[3]}` : 0);
      lines.push({ time: t, text, words: isWordLevel ? words : null });
    }
  }

  lines.sort((a, b) => a.time - b.time);
  if (offset) {
    const ms = offset / 1000;
    for (const l of lines) l.time = Math.max(0, l.time - ms);
  }
  return lines;
}

// 编码检测并解码
function decodeBuffer(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return iconv.decode(buf, 'utf16-le');
  if (buf[0] === 0xfe && buf[1] === 0xff) return iconv.decode(buf, 'utf16-be');
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.toString('utf-8');
  const enc = chardet.detect(buf) || 'UTF-8';
  const e = enc.toLowerCase();
  if (e.includes('utf-8')) return buf.toString('utf-8');
  try {
    return iconv.decode(buf, enc);
  } catch {
    return buf.toString('utf-8');
  }
}

// 查找同目录同名外置歌词
const LYRIC_EXT = ['.lrc', '.txt'];

export function findExternalLyric(trackPath) {
  const dir = join(trackPath, '..');
  const base = basename(trackPath, extname(trackPath));
  for (const ext of LYRIC_EXT) {
    const p = join(dir, base + ext);
    if (existsSync(p)) return p;
  }
  return null;
}

// 汇总:外置优先,其次内嵌
// 返回 { source: 'external'|'embedded'|null, lines }
export function getLyrics(track) {
  if (!track) return { source: null, lines: [] };
  const extPath = findExternalLyric(track.path);
  if (extPath) {
    try {
      const buf = readFileSync(extPath);
      const text = decodeBuffer(buf);
      const lines = parseLrc(text);
      if (lines.length) return { source: 'external', file: extPath, lines };
      // 无时间戳的纯文本歌词
      const plain = text.split(/\r\n|\n|\r/).map((s) => s.trim()).filter(Boolean)
        .map((t, i) => ({ time: i === 0 ? 0 : -1, text: t, words: null }));
      if (plain.length) return { source: 'external', file: extPath, lines: plain, plain: true };
    } catch { /* 落入内嵌 */ }
  }
  if (track.lyrics) {
    const lines = parseLrc(track.lyrics);
    if (lines.length) return { source: 'embedded', lines };
    const plain = track.lyrics.split(/\r\n|\n|\r/).map((s) => s.trim()).filter(Boolean)
      .map((t, i) => ({ time: i === 0 ? 0 : -1, text: t, words: null }));
    if (plain.length) return { source: 'embedded', lines: plain, plain: true };
  }
  return { source: null, lines: [] };
}
