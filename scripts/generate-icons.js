import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

// Minimal pure-Node PNG generator without external dependencies
function createPng(width, height, r, g, b) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 2; // Color type 2 (RGB)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // Scanlines: raw bytes with filter type 0 (None)
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter 0
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      // Draw a subtle gradient with amber/orange branding
      const grad = Math.min(255, Math.floor((y / height) * 40));
      rawData[pxOffset] = Math.max(0, r - grad);
      rawData[pxOffset + 1] = Math.max(0, g - grad);
      rawData[pxOffset + 2] = Math.max(0, b - grad);
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', compressedData);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const crc = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const outDir = path.resolve('public');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Generate brand icons with #ea580c (RGB: 234, 88, 12)
fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), createPng(192, 192, 234, 88, 12));
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), createPng(512, 512, 234, 88, 12));
fs.writeFileSync(path.join(outDir, 'pwa-maskable-512x512.png'), createPng(512, 512, 234, 88, 12));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), createPng(180, 180, 234, 88, 12));
fs.writeFileSync(path.join(outDir, 'favicon.ico'), createPng(32, 32, 234, 88, 12));

console.log('Successfully generated PWA icon assets in public/');
