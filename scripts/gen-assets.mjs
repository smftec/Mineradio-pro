// 程序化生成 UI 素材:default-cover.png(无封面曲目的默认封面)+ empty-music.png(空状态插画)
// 用法:node scripts/gen-assets.mjs
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const len = (x, y) => Math.hypot(x, y);
function sdCapsule(px, py, ax, ay, bx, by, r) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
  return len(pax - bax * h, pay - bay * h) - r;
}
function sdEllipse(px, py, cx, cy, rx, ry, rotDeg) {
  const rot = (rotDeg * Math.PI) / 180, c = Math.cos(-rot), s = Math.sin(-rot);
  const dx = px - cx, dy = py - cy;
  const x = dx * c - dy * s, y = dx * s + dy * c;
  const k0 = len(x / rx, y / ry), k1 = len(x / (rx * rx), y / (ry * ry));
  return k0 * (k0 - 1) / Math.max(k1, 1e-6);
}
function sdBezier(px, py, p0, c1, c2, p1, wStart, wEnd) {
  const N = 40; let best = 1e9;
  let lx = p0[0], ly = p0[1];
  for (let i = 1; i <= N; i++) {
    const t = i / N, mt = 1 - t;
    const x = mt * mt * mt * p0[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t * t * t * p1[0];
    const y = mt * mt * mt * p0[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t * t * t * p1[1];
    const w = mix(wStart, wEnd, t) / 2;
    best = Math.min(best, sdCapsule(px, py, lx, ly, x, y, w));
    lx = x; ly = y;
  }
  return best;
}

function encodePng(S, img, outPath) {
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S.w, 0); ihdr.writeUInt32BE(S.h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(S.h * (S.w * 4 + 1));
  for (let y = 0; y < S.h; y++) {
    raw[y * (S.w * 4 + 1)] = 0;
    Buffer.from(img.buffer, y * S.w * 4, S.w * 4).copy(raw, y * (S.w * 4 + 1) + 1);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(outPath, png);
  console.log('written:', outPath, png.length, 'bytes');
}

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');

// ============ 1. 默认封面 512x512 ============
{
  const S = 512;
  const img = new Uint8Array(S * S * 4);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const i = (py * S + px) * 4;
      const fx = px + 0.5, fy = py + 0.5;
      // 对角渐变:深紫 → 亮紫
      const t = clamp((fx / S + fy / S) / 2, 0, 1);
      let r = mix(26, 88, t), g = mix(18, 52, t), b = mix(64, 168, t);
      // 顶部青色氛围
      const glowT = Math.exp(-((fx - S * 0.28) ** 2 + (fy - S * 0.2) ** 2) / (2 * (S * 0.32) ** 2));
      r += glowT * 18; g += glowT * 46; b += glowT * 66;
      // 右下品红氛围
      const glowM = Math.exp(-((fx - S * 0.85) ** 2 + (fy - S * 0.9) ** 2) / (2 * (S * 0.3) ** 2));
      r += glowM * 60; g += glowM * 10; b += glowM * 44;

      // 细网格纹理(低对比)
      if ((px % 32 === 0) || (py % 32 === 0)) {
        r += 5; g += 6; b += 10;
      }

      // 中央音符(缩小复用图标 SDF,S=512 对应原 1024 的 0.5 倍)
      const k = 0.5, ox = 512 * 0.5 * 0.06, oy = 512 * 0.5 * 0.1; // 轻微居中偏移
      const sx = (fx - ox) / k, sy = (fy - oy) / k;
      const dHead = sdEllipse(sx, sy, 400, 690, 102, 72, -18);
      const dStem = sdCapsule(sx, sy, 492, 682, 492, 315, 17);
      const dFlag = sdBezier(sx, sy, [505, 318], [700, 330], [708, 560], [556, 590], 62, 30);
      const dNote = Math.min(dHead, dStem, dFlag);
      const aNote = 1 - smoothstep(-2, 2, dNote);
      const tn = clamp((sy - 300) / 460, 0, 1);
      const nr = mix(125, 244, tn), ng = mix(249, 224, tn), nb = mix(255, 255, tn);
      const glow = Math.exp(-Math.max(dNote, 0) / 40);
      r += glow * 40; g += glow * 130; b += glow * 150;
      r = mix(r, nr, aNote); g = mix(g, ng, aNote); b = mix(b, nb, aNote);

      img[i] = clamp(r, 0, 255); img[i + 1] = clamp(g, 0, 255); img[i + 2] = clamp(b, 0, 255);
      img[i + 3] = 255;
    }
  }
  encodePng({ w: S, h: S }, img, join(OUT, 'default-cover.png'));
}

// ============ 2. 空状态插画 720x460(透明背景) ============
{
  const W = 720, H = 460;
  const img = new Uint8Array(W * H * 4);
  const cx = W / 2, cy = H / 2 + 12;

  // 星点(固定伪随机)
  const stars = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let n = 0; n < 26; n++) stars.push([rnd() * W, rnd() * H, 0.6 + rnd() * 1.6, rnd()]);

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4;
      const fx = px + 0.5, fy = py + 0.5;
      let r = 0, g = 0, b = 0, a = 0;

      // 唱片主体(圆盘)
      const dDisc = len(fx - cx, fy - cy) - 150;
      if (dDisc < 0) {
        const rad = len(fx - cx, fy - cy);
        const tt = clamp(rad / 150, 0, 1);
        // 盘面渐变
        r = mix(52, 26, tt); g = mix(36, 20, tt); b = mix(96, 58, tt);
        // 凹槽弧线
        const groove = Math.abs(((rad * 0.9) % 14) - 7) < 1.1 ? 1 : 0;
        r += groove * 16; g += groove * 16; b += groove * 26;
        // 高光(左上)
        const hi = Math.exp(-((fx - cx + 62) ** 2 + (fy - cy + 62) ** 2) / (2 * 58 ** 2));
        r += hi * 40; g += hi * 40; b += hi * 70;
        // 中心标签(青紫渐变圆)
        const dLabel = rad - 46;
        if (dLabel < 0) {
          const lt = clamp(rad / 46, 0, 1);
          r = mix(124, 60, lt); g = mix(92, 224, lt); b = mix(255, 255, lt);
          // 中孔
          if (rad < 9) { r = 16; g = 18; b = 34; }
        }
        a = 255;
      } else {
        // 盘外发光
        const glow = Math.exp(-dDisc / 60) * 0.55;
        r = 124 * glow; g = 92 * glow; b = 255 * glow;
        a = glow * 255;
      }

      // 旋转高光弧(右上)
      const dArc = Math.abs(len(fx - cx, fy - cy) - 132) - 3;
      const ang = Math.atan2(fy - cy, fx - cx);
      if (dArc < 0 && ang > -1.5 && ang < 0.3) {
        r = mix(r, 190, 0.7); g = mix(g, 230, 0.7); b = mix(b, 255, 0.7);
      }

      // 漂浮音符(两个小音符,左右上方)
      const note = (nx, ny, k) => {
        const sx = (fx - nx) / k, sy = (fy - ny) / k;
        const dh = sdEllipse(sx, sy, 0, 0, 46, 32, -18);
        const dst = sdCapsule(sx, sy, 42, -8, 42, -120, 8);
        const dfl = sdBezier(sx, sy, [48, -124], [140, -118], [146, -10], [62, 2], 28, 14);
        return Math.min(dh, dst, dfl);
      };
      for (const [nx, ny, k, al] of [[cx - 218, cy - 128, 0.42, 0.85], [cx + 226, cy - 158, 0.34, 0.6]]) {
        const d = note(nx, ny, k);
        const an = (1 - smoothstep(-1.5, 1.5, d)) * al;
        if (an > 0) {
          const glow2 = Math.exp(-Math.max(d, 0) / 26) * 0.6 * al;
          r = mix(r, 125 + glow2 * 100, an); g = mix(g, 249, an); b = mix(b, 255, an);
          a = Math.max(a, an * 255);
        }
      }

      // 星点
      for (const [sx2, sy2, sr, sb] of stars) {
        const d = len(fx - sx2, fy - sy2) - sr;
        if (d < 0) {
          const tw = 0.5 + 0.5 * sb;
          r = mix(r, 200 * tw + 40, 0.8); g = mix(g, 220 * tw + 30, 0.8); b = mix(b, 255, 0.8);
          a = Math.max(a, 200);
        }
      }

      // 底部声波线
      const waveY = H - 64 + Math.sin(fx / 34) * 10 + Math.sin(fx / 13) * 4;
      const dWave = Math.abs(fy - waveY) - 2.2;
      if (dWave < 0) {
        const fade = smoothstep(W * 0.08, W * 0.3, fx) * (1 - smoothstep(W * 0.7, W * 0.92, fx));
        const al = (1 - smoothstep(-1, 1, dWave)) * fade;
        r = mix(r, 53, al); g = mix(g, 224, al); b = mix(b, 255, al);
        a = Math.max(a, al * 230);
      }

      img[i] = clamp(r, 0, 255); img[i + 1] = clamp(g, 0, 255); img[i + 2] = clamp(b, 0, 255);
      img[i + 3] = a;
    }
  }
  encodePng({ w: W, h: H }, img, join(OUT, 'empty-music.png'));
}
console.log('assets done');
