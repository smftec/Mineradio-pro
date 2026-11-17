// 本地 HTTP 静态服务:为 Folia 同源 iframe 集成提供页面与资产(127.0.0.1 仅本机)
// 参考原版 server.js 的架构思路(随机端口 + 仅本机绑定),实现自研。
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { getStore } from './store.js';
import { isAllowedMediaPath } from './library.js';
import { getCoverDir } from './metadata.js';

let server = null;
let port = 0;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.webm': 'video/webm',
  '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.vtt': 'text/vtt', '.bin': 'application/octet-stream',
};

function safeJoin(root, urlPath) {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  return join(root, clean);
}

export function startServer(publicRoot) {
  if (server) {
    return new Promise((resolve) => {
      if (port) resolve({ port, origin: `http://127.0.0.1:${port}` });
      else server.once('listening', () => resolve({ port: server.address().port, origin: `http://127.0.0.1:${server.address().port}` }));
    });
  }
  server = http.createServer((req, res) => {
    try {
      const u = new URL(req.url, 'http://127.0.0.1');
      let pathname = u.pathname;

      // 封面端点:/api/cover?path=<封面绝对路径>(限封面缓存目录)
      if (pathname === '/api/cover') {
        const p = u.searchParams.get('path') || '';
        const coverDir = (getCoverDir() || '').toLowerCase();
        if (!p || !coverDir || !p.toLowerCase().startsWith(coverDir.toLowerCase())) {
          res.writeHead(403); res.end('forbidden'); return;
        }
        if (!existsSync(p)) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, {
          'Content-Type': p.endsWith('.png') ? 'image/png' : 'image/jpeg',
          'Cache-Control': 'max-age=86400',
        });
        createReadStream(p).pipe(res);
        return;
      }

      // 根 → index.html
      if (pathname === '/') pathname = '/index.html';
      const file = safeJoin(publicRoot, pathname);
      if (!file.startsWith(publicRoot) || !existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      createReadStream(file).pipe(res);
    } catch (e) {
      try { res.writeHead(500); res.end('error'); } catch { /* ignore */ }
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      console.log('[server] listening on http://127.0.0.1:' + port);
      resolve({ port, origin: `http://127.0.0.1:${port}` });
    });
  });
}

export function getServerOrigin() {
  return port ? `http://127.0.0.1:${port}` : '';
}

export function stopServer() {
  if (server) { server.close(); server = null; port = 0; }
}
