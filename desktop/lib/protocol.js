// mpro:// 自定义协议:安全的本地音频/图片流(支持 Range,供 audio seek)
import electron from 'electron';
const { protocol } = electron;
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { isAllowedMediaPath } from './library.js';
import { getCoverDir } from './metadata.js';
import { transcodeToWav, isTranscodable } from './audio/transcode.js';

// 路径白名单:封面缓存目录 / 曲库文件夹 / 已索引文件,其余一律拒绝
function inAllowedScope(filePath) {
  const norm = filePath.toLowerCase().replace(/[\\/]+$/, '');
  const coverDir = (getCoverDir() || '').toLowerCase();
  if (coverDir && norm.startsWith(coverDir.toLowerCase() + '\\')) return true;
  return isAllowedMediaPath(filePath);
}

const AUDIO_MIME = {
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.m4b': 'audio/mp4', '.aac': 'audio/aac',
  '.flac': 'audio/flac', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.oga': 'audio/ogg',
  '.opus': 'audio/ogg', '.webm': 'audio/webm', '.weba': 'audio/webm',
  '.aif': 'audio/aiff', '.aiff': 'audio/aiff',
};
const IMAGE_MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const ALLOWED = new Set([...Object.keys(AUDIO_MIME), ...Object.keys(IMAGE_MIME)]);

export function registerProtocolHandler() {
  try {
    protocol.handle('mpro', async (request) => {
      let filePath = '';
      try {
        console.log('[mpro] request:', request.url.slice(0, 60));
        const u = new URL(request.url);
        const raw = u.searchParams.get('path') || decodeURIComponent(u.pathname.replace(/^\/+/, ''));
        filePath = decodeURIComponent(raw).replace(/\//g, '\\');

        let ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
        // APE/DSD:转码为缓存 WAV 后流式播放(失败给出可读错误,由渲染端 toast)
        if (isTranscodable(filePath)) {
          try {
            const r = await transcodeToWav(filePath, ext);
            if (!r) return new Response('transcode unsupported', { status: 415 });
            filePath = r.wavPath;
            ext = '.wav';
          } catch (e) {
            return new Response(JSON.stringify({ transcodeError: e.message }), { status: 422, headers: { 'Content-Type': 'application/json' } });
          }
        }
        if (!ALLOWED.has(ext)) {
          return new Response('forbidden ext: ' + ext, { status: 403 });
        }
        if (!inAllowedScope(filePath)) {
          return new Response('path outside library scope', { status: 403 });
        }

        const info = await stat(filePath).catch(() => null);
        if (!info || !info.isFile()) {
          return new Response('not found: ' + filePath, { status: 404 });
        }

        const mime = AUDIO_MIME[ext] || IMAGE_MIME[ext];
        const range = request.headers.get('range');
        if (range) {
          const m = /bytes=(\d*)-(\d*)/.exec(range);
          let start = m && m[1] ? parseInt(m[1], 10) : 0;
          let end = m && m[2] ? parseInt(m[2], 10) : info.size - 1;
          if (start >= info.size) {
            return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${info.size}` } });
          }
          end = Math.min(end, info.size - 1);
          const stream = createReadStream(filePath, { start, end });
          return new Response(Readable.toWeb(stream), {
            status: 206,
            headers: {
              'Content-Type': mime,
              'Content-Length': String(end - start + 1),
              'Content-Range': `bytes ${start}-${end}/${info.size}`,
              'Accept-Ranges': 'bytes',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
        const stream = createReadStream(filePath);
        return new Response(Readable.toWeb(stream), {
          status: 200,
          headers: {
            'Content-Type': mime, 'Content-Length': String(info.size),
            'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (e) {
        console.error('[protocol] handler error:', e.message, filePath);
        return new Response('error: ' + e.message, { status: 500 });
      }
    });
    console.log('[protocol] mpro handler registered, handled =', protocol.isProtocolHandled ? protocol.isProtocolHandled('mpro') : 'n/a');
  } catch (e) {
    console.error('[protocol] register failed:', e);
  }
}

export function mediaUrl(filePath) {
  return `mpro://media/?path=${encodeURIComponent(filePath)}`;
}
