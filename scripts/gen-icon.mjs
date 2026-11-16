// 程序化生成 Mineradio pro 应用图标(1024x1024 PNG,纯 Node 实现,无外部依赖)
// 用法:node scripts/gen-icon.mjs
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const S = 1024;
const img = new Uint8Array(S * S * 4);

// ---------- 数学工具 ----------
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const len = (x, y) => Math.hypot(x, y);

// 圆角方形 SDF
function sdRoundBox(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r, qy = Math.abs(py - cy) - hh + r;
  return Math.min(Math.max(qx, qy), 0) + len(Math.max(qx, 0), Math.max(qy, 0)) - r;
}
// 胶囊(线段)SDF
function sdCapsule(px, py, ax, ay, bx, by, r) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
  return len(pax - bax * h, pay - bay * h) - r;
}
// 椭圆近似 SDF(缩放圆法)
function sdEllipse(px, py, cx, cy, rx, ry, rotDeg) {
  const rot = (rotDeg * Math.PI) / 180, c = Math.cos(-rot), s = Math.sin(-rot);
  const dx = px - cx, dy = py - cy;
  const x = dx * c - dy * s, y = dx * s + dy * c;
  const k0 = len(x / rx, y / ry), k1 = len(x / (rx * rx), y / (ry * ry));
  return k0 * (k0 - 1) / Math.max(k1, 1e-6);
}
// 三次贝塞尔折线近似 + 变宽度 → SDF
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

// ---------- 绘制 ----------
for (let py = 0; py < S; py++) {
  for (let px = 0; px < S; px++) {
    const i = (py * S + px) * 4;
    const fx = px + 0.5, fy = py + 0.5;

    // 圆角方块遮罩
    const dBox = sdRoundBox(fx, fy, 512, 512, 440, 440, 200);
    const aBox = 1 - smoothstep(-1.5, 1.5, dBox);

    // 背景对角渐变 深空蓝 → 紫罗兰
    const t = clamp((fx + fy) / 2048, 0, 1);
    let r = mix(18, 96, t), g = mix(14, 42, t), b = mix(56, 158, t);
    // 顶部青色氛围光
    const glowTop = Math.exp(-((fx - 512) ** 2 + (fy - 180) ** 2) / (2 * 300 ** 2));
    r += glowTop * 24; g += glowTop * 60; b += glowTop * 80;
    // 暗角
    const vig = Math.exp(-((fx - 512) ** 2 + (fy - 512) ** 2) / (2 * 520 ** 2));
    const shade = mix(0.55, 1.0, vig);
    r *= shade; g *= shade; b *= shade;

    // ---- 涟漪圆弧(音符周围) ----
    const dR1 = Math.abs(len(fx - 470, fy - 560) - 330) - 5;
    const dR2 = Math.abs(len(fx - 470, fy - 560) - 395) - 4;
    // 只保留右下方向的弧(角度窗口)
    const ang = Math.atan2(fy - 560, fx - 470);
    const inArc = (a) => a > -0.2 && a < 2.4;
    const rip1 = inArc(ang) ? Math.max(0, 1 - smoothstep(-2, 2, dR1)) : 0;
    const rip2 = inArc(ang) ? Math.max(0, 1 - smoothstep(-2, 2, dR2)) : 0;
    r += rip1 * 40 + rip2 * 26; g += rip1 * 190 + rip2 * 120; b += rip1 * 220 + rip2 * 150;

    // ---- 音符 SDF ----
    const dHead = sdEllipse(fx, fy, 400, 690, 102, 72, -18);
    const dStem = sdCapsule(fx, fy, 492, 682, 492, 315, 17);
    const dFlag = sdBezier(fx, fy,
      [505, 318], [700, 330], [708, 560], [556, 590], 62, 30);
    const dNote = Math.min(dHead, dStem, dFlag);

    // 音符本体(青→白→淡紫 垂直渐变)
    const tn = clamp((fy - 300) / 460, 0, 1);
    const nr = mix(125, 244, tn), ng = mix(249, 224, tn), nb = mix(255, 255, tn);
    const aNote = 1 - smoothstep(-1.5, 1.5, dNote);
    // 发光(青 + 品红双色)
    const glow = Math.exp(-Math.max(dNote, 0) / 34);
    r += glow * 56; g += glow * 190; b += glow * 210;
    const magenta = Math.exp(-Math.max(dNote, 0) / 90) * 0.5;
    r += magenta * 120; b += magenta * 60;

    // 合成:背景 → 涟漪 → 音符
    r = mix(r, nr, aNote); g = mix(g, ng, aNote); b = mix(b, nb, aNote);

    const alpha = aBox;
    img[i] = clamp(r, 0, 255); img[i + 1] = clamp(g, 0, 255); img[i + 2] = clamp(b, 0, 255);
    img[i + 3] = alpha * 255;
  }
}

// ---------- PNG 编码 ----------
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0; // filter none
  Buffer.from(img.buffer, y * S * 4, S * 4).copy(raw, y * (S * 4 + 1) + 1);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'build', 'icon-src.png');
writeFileSync(out, png);
console.log('icon written:', out, png.length, 'bytes');
