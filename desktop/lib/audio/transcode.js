// 转码管道:.ape(系统 ffmpeg)/ .dsf(自研解码)→ WAV 缓存 → 协议流式播放
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, existsSync, statSync, readdirSync, unlinkSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { app } from 'electron';
import { getStore } from '../store.js';
import { dsfToWav, parseDsf } from './dsf-decoder.js';

const SUPPORTED_TRANSCODE = new Set(['.ape', '.dsf']);
let ffmpegPath = null;
let ffmpegChecked = false;

export function isTranscodable(filePath) {
  return SUPPORTED_TRANSCODE.has(filePath.slice(filePath.lastIndexOf('.')).toLowerCase());
}

export function resetFfmpegCache() { ffmpegChecked = false; }

export function detectFfmpeg() {
  if (ffmpegChecked) return ffmpegPath;
  ffmpegChecked = true;
  // 设置中自定义路径优先
  const custom = getStore('config').data.ffmpegPath;
  if (custom) {
    try {
      const r = spawnSync(custom, ['-version'], { timeout: 5000 });
      if (r.status === 0) { ffmpegPath = custom; return ffmpegPath; }
    } catch { /* invalid path */ }
  }
  try {
    const r = spawnSync('ffmpeg', ['-version'], { timeout: 5000 });
    if (r.status === 0) { ffmpegPath = 'ffmpeg'; return ffmpegPath; }
  } catch { /* not in PATH */ }
  ffmpegPath = null;
  return null;
}

function cacheDir() {
  const dir = join(app.getPath('userData'), 'transcode-cache');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cachePath(filePath) {
  const hash = createHash('md5').update(filePath.toLowerCase()).digest('hex').slice(0, 16);
  return join(cacheDir(), hash + '.wav');
}

// 缓存上限(600MB),超出清最旧
function pruneCache() {
  try {
    const dir = cacheDir();
    const files = readdirSync(dir).filter((f) => f.endsWith('.wav'))
      .map((f) => {
        const fp = join(dir, f);
        return { fp, mtime: statSync(fp).mtimeMs, size: statSync(fp).size };
      });
    let total = files.reduce((a, f) => a + f.size, 0);
    const LIMIT = 600 * 1024 * 1024;
    if (total <= LIMIT) return;
    files.sort((a, b) => a.mtime - b.mtime);
    for (const f of files) {
      if (total <= LIMIT) break;
      unlinkSync(f.fp);
      total -= f.size;
    }
  } catch { /* ignore */ }
}

// 转码到缓存 WAV;返回 { wavPath, size } 或 null(无需转码/失败)
export async function transcodeToWav(filePath, ext) {
  const ext2 = ext.toLowerCase();
  if (!SUPPORTED_TRANSCODE.has(ext2)) return null;
  const out = cachePath(filePath);
  if (existsSync(out) && statSync(out).size > 44) {
    pruneCache();
    return { wavPath: out, size: statSync(out).size };
  }
  const tmp = out + '.tmp';
  try {
    if (ext2 === '.dsf') {
      // 自研 DSF 解码(DSD → PCM WAV)
      const { readFileSync, writeFileSync } = await import('node:fs');
      const wav = dsfToWav(readFileSync(filePath));
      writeFileSync(tmp, wav);
    } else if (ext2 === '.ape') {
      const ff = detectFfmpeg();
      if (!ff) throw Object.assign(new Error('未检测到系统 ffmpeg,无法播放 APE 文件。请安装 ffmpeg 后重启应用。'), { code: 'NO_FFMPEG' });
      await new Promise((resolve, reject) => {
        const proc = spawn(ff, ['-y', '-i', filePath, '-f', 'wav', '-c:a', 'pcm_s16le', tmp], { windowsHide: true });
        let stderr = '';
        proc.stderr.on('data', (d) => { stderr += d; });
        proc.on('exit', (code) => {
          if (code === 0 && existsSync(tmp) && statSync(tmp).size > 44) resolve();
          else reject(new Error('ffmpeg 转码失败(' + code + '):' + stderr.slice(-200)));
        });
        proc.on('error', reject);
      });
    }
    // WAV 头修正(流式文件大小已知后统一重写?ffmpeg 输出文件完整,头正确)
    renameSafe(tmp, out);
    pruneCache();
    return { wavPath: out, size: statSync(out).size };
  } catch (e) {
    try { if (existsSync(tmp)) unlinkSync(tmp); } catch { /* ignore */ }
    throw e;
  }
}

function renameSafe(a, b) {
  try { if (existsSync(b)) unlinkSync(b); } catch { /* ignore */ }
  renameSync(a, b);
}

export function transcodeKindOf(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return SUPPORTED_TRANSCODE.has(ext) ? ext : null;
}

void parseDsf; void dirname;
