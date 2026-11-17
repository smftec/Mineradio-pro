// DSF(DSD Stream File)解码器 — 自研实现(DSD 1-bit → PCM 转换)
// 格式规范:DSD chunk(28B) + fmt chunk(52B) + data chunk(12B 头 + 数据,通道块交错)
// 转换:DSD64 → PCM 176.4kHz(16:1 decimation 低通平均)

export function parseDsf(buf) {
  if (buf.length < 92 || buf.toString('ascii', 0, 4) !== 'DSD ') {
    throw new Error('not a DSF file');
  }
  // fmt chunk 从 28 开始
  if (buf.toString('ascii', 28, 32) !== 'fmt ') throw new Error('missing fmt chunk');
  const formatVersion = buf.readUInt32LE(40);
  const formatID = buf.readUInt32LE(44); // 0 = DSD raw
  const channelType = buf.readUInt32LE(48);
  const channelNum = buf.readUInt32LE(52);
  const samplingFrequency = buf.readUInt32LE(56); // DSD 采样率(2822400/5644800)
  const bitsPerSample = buf.readUInt32LE(60); // 1 = LSB first, 8 = MSB per byte
  const sampleCount = Number(buf.readBigUInt64LE(64)); // 每通道 DSD 采样数
  const blockSizePerChannel = buf.readUInt32LE(72); // 恒 4096
  // data chunk(fmt chunk 总占用 = tag 4 + size 8 + 数据 48 含 12 reserved)
  let p = 28 + 8 + Number(buf.readBigUInt64LE(32));
  if (buf.toString('ascii', p, p + 4) !== 'data') throw new Error('missing data chunk');
  const dataChunkSize = Number(buf.readBigUInt64LE(p + 4));
  const dataOffset = p + 12;
  const dataSize = Math.min(dataChunkSize - 12, buf.length - dataOffset);

  return {
    formatVersion, formatID, channelType, channelNum,
    samplingFrequency, bitsPerSample, sampleCount, blockSizePerChannel,
    dataOffset, dataSize,
    pcmSampleRate: samplingFrequency / 16, // 16:1 decimation
    durationSec: sampleCount / samplingFrequency,
  };
}

// DSD 通道块交错还原为连续通道位流,再 16:1 decimation 成 Int16 PCM
// 返回 { sampleRate, channels, pcm: Int16Array(交错帧) }
export function dsfToPcm(buf) {
  const info = parseDsf(buf);
  const { channelNum, bitsPerSample, blockSizePerChannel, dataOffset, dataSize, samplingFrequency } = info;

  const DECIM = 16;
  const pcmRate = samplingFrequency / DECIM;
  const dsdFrames = Math.floor(info.sampleCount / DECIM); // PCM 每通道帧数
  const pcmFrames = Math.max(0, dsdFrames);
  const pcm = new Int16Array(pcmFrames * channelNum);

  // DSD 数据按 (block 4096B × channel) 交错;位流:1 → +1, 0 → -1
  const bitsTotal = Math.floor(dataSize * 8 / channelNum / DECIM) * DECIM * channelNum;
  const dataEnd = dataOffset + Math.min(dataSize, Math.ceil(info.sampleCount * channelNum / (bitsPerSample === 8 ? 1 : 8)));

  // 预计算表:字节 → 8 个位值(LSB first / MSB first)
  const table = new Int8Array(256 * 8);
  for (let b = 0; b < 256; b++) {
    for (let k = 0; k < 8; k++) {
      const bit = bitsPerSample === 1 ? ((b >> k) & 1) : ((b >> (7 - k)) & 1);
      table[b * 8 + k] = bit ? 1 : -1;
    }
  }

  const blocksTotal = Math.ceil(dataSize / (blockSizePerChannel * channelNum));
  let pcmPos = 0;
  let acc = 0; // 16 位累加器
  let accCount = 0;

  for (let blk = 0; blk < blocksTotal && pcmPos < pcm.length; blk++) {
    for (let ch = 0; ch < channelNum; ch++) {
      const blockStart = dataOffset + (blk * channelNum + ch) * blockSizePerChannel;
      const blockEnd = Math.min(blockStart + blockSizePerChannel, dataOffset + dataSize);
      const bytes = bitsPerSample === 8 ? 1 : 8;
      for (let bp = blockStart; bp < blockEnd; bp++) {
        const byte = buf[bp];
        for (let k = 0; k < 8; k++) {
          acc += table[byte * 8 + k];
          if (++accCount === DECIM) {
            // [-16,16] → [-32767,32767]
            const v = Math.round((acc / DECIM) * 32000);
            const frameIdx = Math.floor(pcmPos / channelNum);
            if (frameIdx < pcmFrames) {
              pcm[frameIdx * channelNum + ch] = v;
              pcmPos++;
            }
            acc = 0; accCount = 0;
            if (pcmPos >= pcm.length) break;
          }
        }
        if (pcmPos >= pcm.length) break;
      }
      if (pcmPos >= pcm.length) break;
    }
  }

  return {
    sampleRate: pcmRate,
    channels: channelNum,
    pcm,
    frames: pcmFrames,
    durationSec: info.durationSec,
  };
}

// DSD 转完整 WAV 文件(Int16 PCM)
export function dsfToWav(buf) {
  const { sampleRate, channels, pcm } = dsfToPcm(buf);
  const dataSize = pcm.length * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * channels * 2, 28); // byte rate
  wav.writeUInt16LE(channels * 2, 32); // block align
  wav.writeUInt16LE(16, 34); // bits
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < pcm.length; i++) wav.writeInt16LE(pcm[i], 44 + i * 2);
  return wav;
}
