// 元数据解析:标签 + 封面缓存
import * as mm from 'music-metadata';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import electron from 'electron';
const { app, nativeImage } = electron;

let coverDir = null;

export function initMetadata() {
  coverDir = join(app.getPath('userData'), 'covers');
  mkdirSync(coverDir, { recursive: true });
}

// 保存封面到缓存,返回相对文件名(渲染端经 mpro:// 读取)
function saveCover(picture, trackPath) {
  if (!picture || !picture.data || !picture.data.length) return null;
  const hash = createHash('md5').update(picture.data).digest('hex').slice(0, 16);
  let ext = (picture.format || 'image/jpeg').split('/')[1] || 'jpeg';
  if (ext === 'jpeg') ext = 'jpg';
  if (!['jpg', 'png', 'webp'].includes(ext)) ext = 'jpg';
  const name = `${hash}.${ext}`;
  const file = join(coverDir, name);
  if (!existsSync(file)) {
    try { writeFileSync(file, Buffer.from(picture.data)); } catch { return null; }
  }
  // 同步生成 96px 缩略(列表 38px/播放条 58px 使用,避免全尺寸解码开销)
  const thumbName = `${hash}_t.jpg`;
  const thumbFile = join(coverDir, thumbName);
  if (!existsSync(thumbFile)) {
    try {
      const img = nativeImage.createFromBuffer(Buffer.from(picture.data));
      if (!img.isEmpty()) {
        writeFileSync(thumbFile, img.resize({ width: 96 }).toJPEG(82));
      }
    } catch { /* 缩略失败回退原图 */ }
  }
  return file; // 绝对路径,渲染端经 mpro:// 读取
}

// 惰性补齐:为已有封面但缺缩略的曲目生成缩略(启动后台执行一次)
export function ensureThumbs(tracks) {
  if (!coverDir) return 0;
  let done = 0;
  for (const t of tracks) {
    if (!t.cover || t.thumb) continue;
    const base = t.cover.replace(/[\\/][^\\/]+$/, '');
    const m = t.cover.match(/([0-9a-f]{16})\./);
    if (!m) continue;
    const thumbFile = join(base, `${m[1]}_t.jpg`);
    try {
      if (existsSync(thumbFile)) { t.thumb = thumbFile; continue; }
      const img = nativeImage.createFromFile(t.cover);
      if (!img.isEmpty()) {
        writeFileSync(thumbFile, img.resize({ width: 96 }).toJPEG(82));
        t.thumb = thumbFile;
        done++;
      }
    } catch { /* ignore */ }
  }
  return done;
}

// 依赖顺序 fallback:未知 → 各种标签 → 文件名
function fallbackTitle(trackPath) {
  return basename(trackPath, extname(trackPath));
}

export async function readMetadata(filePath) {
  try {
    // DSF 的 duration 由自研解析器修正(music-metadata 对 DSD 时长解析有偏差)
    if (extname(filePath).toLowerCase() === '.dsf') {
      try {
        const { parseDsf } = await import('./audio/dsf-decoder.js');
        const { openSync, readSync, closeSync } = await import('node:fs');
        const fd = openSync(filePath, 'r');
        const head = Buffer.alloc(200);
        readSync(fd, head, 0, 200, 0);
        closeSync(fd);
        const info = parseDsf(head);
        const meta = await mm.parseFile(filePath);
        meta.format.duration = info.durationSec;
        const c = meta.common || {};
        const f = meta.format || {};
        let cover = null;
        if (c.picture && c.picture.length) cover = saveCover(c.picture[0], filePath);
        return {
          title: (c.title || '').trim() || fallbackTitle(filePath),
          artist: (c.artist || c.albumartist || '未知艺术家').trim(),
          album: (c.album || '未知专辑').trim(),
          albumArtist: (c.albumartist || c.artist || '未知艺术家').trim(),
          genre: (c.genre && c.genre[0]) || '未知流派',
          year: c.year || null,
          trackNo: c.track && c.track.no ? c.track.no : null,
          duration: f.duration || 0,
          sampleRate: f.sampleRate || null,
          bitrate: f.bitrate ? Math.round(f.bitrate / 1000) : null,
          cover,
          lyrics: extractEmbeddedLyrics(c),
        };
      } catch { /* 解析失败回落常规流程 */ }
    }
    const meta = await mm.parseFile(filePath, { duration: true });
    const c = meta.common || {};
    const f = meta.format || {};
    let cover = null;
    if (c.picture && c.picture.length) cover = saveCover(c.picture[0], filePath);
    return {
      title: (c.title || '').trim() || fallbackTitle(filePath),
      artist: (c.artist || c.albumartist || '未知艺术家').trim(),
      album: (c.album || '未知专辑').trim(),
      albumArtist: (c.albumartist || c.artist || '未知艺术家').trim(),
      genre: (c.genre && c.genre[0]) || '未知流派',
      year: c.year || null,
      trackNo: c.track && c.track.no ? c.track.no : null,
      duration: f.duration || 0,
      sampleRate: f.sampleRate || null,
      bitrate: f.bitrate ? Math.round(f.bitrate / 1000) : null,
      cover,
      lyrics: extractEmbeddedLyrics(c),
    };
  } catch (e) {
    return {
      title: fallbackTitle(filePath), artist: '未知艺术家', album: '未知专辑',
      albumArtist: '未知艺术家', genre: '未知流派', year: null, trackNo: null,
      duration: 0, sampleRate: null, bitrate: null, cover: null, lyrics: null,
    };
  }
}

// 内嵌歌词:music-metadata 将 USLT / Vorbis LYRICS 归入 common.lyrics
function extractEmbeddedLyrics(c) {
  if (!c.lyrics || !c.lyrics.length) return null;
  const parts = c.lyrics.map((l) => (typeof l === 'string' ? l : l.text || '')).filter(Boolean);
  const text = parts.join('\n').trim();
  return text || null;
}

export function getCoverDir() {
  return coverDir;
}
