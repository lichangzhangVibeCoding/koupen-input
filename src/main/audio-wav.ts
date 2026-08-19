/** 16 kHz mono PCM16 helpers. TalkNow captures this rate so cloud/local ASR skip extra decode. */

export const PCM16K_RATE = 16000

export function pcm16leToFloat32(pcm: Buffer): Float32Array {
  const n = Math.floor(pcm.length / 2)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = pcm.readInt16LE(i * 2) / 32768
  }
  return out
}

export function wavPcm16le(wav: Buffer): Buffer {
  let offset = 44
  for (let i = 12; i < Math.min(wav.length - 8, 200); i++) {
    if (wav.toString('ascii', i, i + 4) === 'data') {
      offset = i + 8
      break
    }
  }
  return wav.subarray(offset)
}

export function encodeWav16kMono(pcm16le: Buffer): Buffer {
  const dataSize = pcm16le.length
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(PCM16K_RATE, 24)
  buf.writeUInt32LE(PCM16K_RATE * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  pcm16le.copy(buf, 44)
  return buf
}

export function wavOrPcmDurationSeconds(audio: Buffer, mime: string): number {
  const pcm = /wav/i.test(mime) ? wavPcm16le(audio) : audio
  return Math.max(1, Math.round(pcm.length / 2 / PCM16K_RATE))
}
