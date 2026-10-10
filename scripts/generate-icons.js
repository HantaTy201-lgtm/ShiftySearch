// scripts/generate-icons.js
// Generates sleek modern icons (SVG and valid PNG files) for ShiftySearch without external dependencies
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ICONS_DIR = path.join(__dirname, '..', 'src', 'icons');
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// 1. Create an SVG icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="50%" stop-color="#7c3aed" />
      <stop offset="100%" stop-color="#db2777" />
    </linearGradient>
    <linearGradient id="islandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1b4b" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0.95" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.4" />
    </filter>
  </defs>

  <!-- Background rounded rect -->
  <rect x="8" y="8" width="112" height="112" rx="28" fill="url(#bgGrad)" />

  <!-- Floating Island Capsule -->
  <rect x="22" y="38" width="84" height="52" rx="26" fill="url(#islandGrad)" filter="url(#shadow)" stroke="#a855f7" stroke-width="2.5" />

  <!-- Search / Sparkle AI Icon inside island -->
  <g transform="translate(34, 48)">
    <!-- Sparkle 1 -->
    <path d="M 12 0 L 14 8 L 22 10 L 14 12 L 12 20 L 10 12 L 2 10 L 10 8 Z" fill="#38bdf8" />
    <!-- Sparkle 2 (small) -->
    <path d="M 28 4 L 29 8 L 33 9 L 29 10 L 28 14 L 27 10 L 23 9 L 27 8 Z" fill="#f43f5e" />
    <!-- Search Magnifier ring -->
    <circle cx="44" cy="18" r="9" fill="none" stroke="#f8fafc" stroke-width="3" />
    <line x1="51" y1="25" x2="58" y2="32" stroke="#f8fafc" stroke-width="3.5" stroke-linecap="round" />
  </g>

  <!-- Subtle glow dot -->
  <circle cx="100" cy="28" r="4" fill="#38bdf8" opacity="0.8" />
</svg>`;

fs.writeFileSync(path.join(ICONS_DIR, 'icon.svg'), svgContent);
console.log('Created icon.svg');

// 2. Pure Node.js PNG encoder helper
function createPng(size) {
  // Color function for (x, y)
  const width = size;
  const height = size;

  // Raw RGBA buffer
  // PNG uncompressed scanlines: each row starts with filter byte 0, followed by width*4 bytes
  const rowStride = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowStride);

  const radius = size * 0.22;
  const center = size / 2;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowStride;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      // Distance from center for rounded corner icon
      const dx = Math.max(0, Math.abs(x - center) - (center - radius));
      const dy = Math.max(0, Math.abs(y - center) - (center - radius));
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > radius) {
        // Transparent outside rounded squircle
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
      } else {
        // Gradient from Indigo to Violet/Pink
        const t = (x + y) / (width + height);
        let r = Math.round(79 * (1 - t) + 219 * t);
        let g = Math.round(70 * (1 - t) + 39 * t);
        let b = Math.round(229 * (1 - t) + 119 * t);
        let a = 255;

        // Anti-aliasing border
        if (dist > radius - 1) {
          a = Math.round(255 * (radius - dist));
        }

        // Draw island capsule in center
        const capsuleW = width * 0.65;
        const capsuleH = height * 0.42;
        const capX = (width - capsuleW) / 2;
        const capY = (height - capsuleH) / 2;
        const capR = capsuleH / 2;

        const cdx = Math.max(0, Math.abs(x - center) - (capsuleW / 2 - capR));
        const cdy = Math.max(0, Math.abs(y - center) - (capsuleH / 2 - capR));
        const cdist = Math.sqrt(cdx * cdx + cdy * cdy);

        if (cdist <= capR) {
          // Inside island
          if (cdist > capR - Math.max(1, size * 0.03)) {
            // Purple border
            r = 168; g = 85; b = 247;
          } else {
            // Dark capsule
            r = 20; g = 20; b = 38;
          }

          // Center spark / lens highlight
          const sparkDist = Math.sqrt((x - center * 0.85)**2 + (y - center)**2);
          if (sparkDist < size * 0.1) {
            r = 56; g = 189; b = 248; // Cyan spark
          }
          const ringDist = Math.sqrt((x - center * 1.25)**2 + (y - center * 0.95)**2);
          if (Math.abs(ringDist - size * 0.08) < Math.max(1, size * 0.025)) {
            r = 248; g = 250; b = 252; // White search ring
          }
        }

        rawData[pixelOffset] = r;
        rawData[pixelOffset + 1] = g;
        rawData[pixelOffset + 2] = b;
        rawData[pixelOffset + 3] = a;
      }
    }
  }

  // Compress with zlib
  const compressed = zlib.deflateSync(rawData);

  // PNG structure
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);

    const typeBuf = Buffer.from(type, 'ascii');
    const body = Buffer.concat([typeBuf, data]);

    const crcBuf = Buffer.alloc(4);
    crcBuf.writeInt32BE(crc32(body), 0);

    return Buffer.concat([len, body, crcBuf]);
  }

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 table implementation
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ -1;
}

// Generate 16, 32, 48, 128 px icons
[16, 32, 48, 128].forEach(size => {
  const pngBuf = createPng(size);
  fs.writeFileSync(path.join(ICONS_DIR, `icon${size}.png`), pngBuf);
  console.log(`Generated icon${size}.png (${size}x${size})`);
});

console.log('All icons generated successfully!');
