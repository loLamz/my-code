/*
 * Procedurally draws the CircuitMC app icon (a stylised circuit-board "C")
 * and writes it out as PNG + a multi-resolution Windows .ico, with zero
 * external dependencies (just zlib, which ships with Node).
 *
 * Run with: node tools/gen-icons.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [0x13, 0x15, 0x18, 255]; // near-black panel
const BG2 = [0x1b, 0x1e, 0x22, 255]; // rounded card
const TRACE = [0x4f, 0xd1, 0xc5, 255]; // teal circuit trace
const TRACE_DIM = [0x2c, 0x5f, 0x5b, 255];
const PAD = [0xf0, 0xa6, 0x3c, 255]; // amber solder pad

function makeCanvas(size) {
  const px = new Float64Array(size * size * 4);
  return {
    size,
    px,
    set(x, y, color, alpha = 1) {
      if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
      const i = (y * this.size + x) * 4;
      const a = Math.max(0, Math.min(1, alpha));
      for (let c = 0; c < 4; c++) {
        const src = c === 3 ? 255 : color[c];
        this.px[i + c] = this.px[i + c] * (1 - a) + src * a;
      }
      this.px[i + 3] = Math.max(this.px[i + 3], a * 255);
    },
  };
}

function roundedRectMask(canvas, x0, y0, x1, y1, radius, color) {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const inX = x >= x0 + radius && x <= x1 - radius;
      const inY = y >= y0 + radius && y <= y1 - radius;
      let inside = false;
      if (inX || inY) {
        inside = x >= x0 && x <= x1 && y >= y0 && y <= y1;
      } else {
        const cx = x < x0 + radius ? x0 + radius : x1 - radius;
        const cy = y < y0 + radius ? y0 + radius : y1 - radius;
        const dx = x - cx;
        const dy = y - cy;
        inside = dx * dx + dy * dy <= radius * radius;
      }
      if (inside) canvas.set(x, y, color);
    }
  }
}

function thickLine(canvas, x0, y0, x1, y1, w, color) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x0 + (x1 - x0) * t;
    const cy = y0 + (y1 - y0) * t;
    for (let dx = -w; dx <= w; dx++) {
      for (let dy = -w; dy <= w; dy++) {
        if (dx * dx + dy * dy <= w * w) canvas.set(Math.round(cx + dx), Math.round(cy + dy), color);
      }
    }
  }
}

function pad(canvas, cx, cy, r, color) {
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      if (dx * dx + dy * dy <= r * r) canvas.set(cx + dx, cy + dy, color);
    }
  }
}

function drawIcon(size) {
  const c = makeCanvas(size);
  const s = size / 64; // design at a 64px grid, then scale

  roundedRectMask(c, 0, 0, size - 1, size - 1, 12 * s, BG);
  roundedRectMask(c, 3 * s, 3 * s, size - 1 - 3 * s, size - 1 - 3 * s, 10 * s, BG2);

  // Faint background trace grid
  for (let gy = 10; gy <= 54; gy += 11) {
    thickLine(c, 6 * s, gy * s, 58 * s, gy * s, 0.6 * s, TRACE_DIM);
  }

  // Stylised "C" built from a circuit trace ring, opening to the right,
  // with two leads breaking out to solder pads (circuit-board motif).
  const cx = 30 * s;
  const cy = 32 * s;
  const r = 15 * s;
  const gapDeg = 66; // total opening, centered on 0deg (right)
  const startDeg = gapDeg / 2;
  const endDeg = 360 - gapDeg / 2;
  const steps = 56;
  for (let i = 0; i < steps; i++) {
    const d0 = startDeg + ((endDeg - startDeg) * i) / steps;
    const d1 = startDeg + ((endDeg - startDeg) * (i + 1)) / steps;
    const a0 = (d0 * Math.PI) / 180;
    const a1 = (d1 * Math.PI) / 180;
    thickLine(
      c,
      cx + Math.cos(a0) * r,
      cy + Math.sin(a0) * r,
      cx + Math.cos(a1) * r,
      cy + Math.sin(a1) * r,
      3.4 * s,
      TRACE
    );
  }
  // Leads from the two open ends of the C straight out to solder pads
  const a0 = (startDeg * Math.PI) / 180;
  const a1 = (-startDeg * Math.PI) / 180;
  const end0x = cx + Math.cos(a0) * r;
  const end0y = cy + Math.sin(a0) * r;
  const end1x = cx + Math.cos(a1) * r;
  const end1y = cy + Math.sin(a1) * r;
  thickLine(c, end0x, end0y, 50 * s, 19 * s, 3.2 * s, TRACE);
  thickLine(c, end1x, end1y, 50 * s, 45 * s, 3.2 * s, TRACE);
  pad(c, 50 * s, 19 * s, 3.6 * s, PAD);
  pad(c, 50 * s, 45 * s, 3.6 * s, PAD);
  pad(c, cx, cy, 3 * s, PAD);

  return c;
}

// ---- Minimal PNG encoder (RGBA, no filtering, zlib via Node) ----
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(canvas) {
  const { size, px } = canvas;
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const o = rowStart + 1 + x * 4;
      raw[o] = Math.round(px[i]);
      raw[o + 1] = Math.round(px[i + 1]);
      raw[o + 2] = Math.round(px[i + 2]);
      raw[o + 3] = Math.round(px[i + 3]);
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// ---- Minimal ICO packer (embeds PNGs, supported since Vista) ----
function encodeICO(pngsBySize) {
  const sizes = Object.keys(pngsBySize).map(Number).sort((a, b) => a - b);
  const count = sizes.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  const imageBufs = [];
  let offset = 6 + count * 16;
  for (const size of sizes) {
    const png = pngsBySize[size];
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    imageBufs.push(png);
    offset += png.length;
  }
  return Buffer.concat([header, ...dirEntries, ...imageBufs]);
}

function main() {
  const buildDir = path.join(__dirname, '..', 'build');
  const rendererIconsDir = path.join(__dirname, '..', 'src', 'renderer', 'assets');
  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(rendererIconsDir, { recursive: true });

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngsBySize = {};
  for (const size of sizes) {
    pngsBySize[size] = encodePNG(drawIcon(size));
  }

  fs.writeFileSync(path.join(buildDir, 'icon.png'), pngsBySize[256]);
  fs.writeFileSync(path.join(rendererIconsDir, 'app-icon.png'), pngsBySize[256]);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), encodeICO(pngsBySize));

  console.log('Wrote build/icon.png, build/icon.ico, src/renderer/assets/app-icon.png');
}

main();
