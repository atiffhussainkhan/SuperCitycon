#!/usr/bin/env node
// Crop + zoom a PNG region and write it out (8-bit RGBA, no dependencies).
import { readPng } from './png-read.mjs';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n += 1) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
export function writePng(path, width, height, rgba) {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

export function cropZoom(src, out, x0, y0, w, h, zoom = 6) {
  const img = readPng(src);
  const W = img.width;
  const ow = w * zoom, oh = h * zoom;
  const outBuf = Buffer.alloc(ow * oh * 4);
  for (let y = 0; y < oh; y += 1) {
    for (let x = 0; x < ow; x += 1) {
      const sx = Math.min(W - 1, x0 + Math.floor(x / zoom));
      const sy = Math.min(img.height - 1, y0 + Math.floor(y / zoom));
      const si = (sy * W + sx) * 4;
      const di = (y * ow + x) * 4;
      outBuf[di] = img.data[si]; outBuf[di + 1] = img.data[si + 1];
      outBuf[di + 2] = img.data[si + 2]; outBuf[di + 3] = 255;
    }
  }
  writePng(out, ow, oh, outBuf);
  return { out, ow, oh };
}

if (process.argv[1] && process.argv[1].endsWith('crop.mjs')) {
  const [, , src, out, x0, y0, w, h, zoom] = process.argv;
  const r = cropZoom(src, out, Number(x0), Number(y0), Number(w), Number(h), Number(zoom || 6));
  console.log('wrote', JSON.stringify(r));
}
