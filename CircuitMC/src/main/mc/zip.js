'use strict';

// Minimal ZIP reader/extractor (no external dependencies) -- just enough to
// pull native (.dll/.so/.dylib) files out of LWJGL "natives" jars, which is
// all CircuitMC needs a zip reader for.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

function findEndOfCentralDirectory(buf) {
  const maxBack = Math.min(buf.length, 65557);
  for (let i = buf.length - 22; i >= buf.length - maxBack; i--) {
    if (i < 0) break;
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  throw new Error('Not a valid zip file (no end-of-central-directory record found)');
}

function listEntries(zipPath) {
  const buf = fs.readFileSync(zipPath);
  const eocd = findEndOfCentralDirectory(buf);
  const entryCount = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);

  const entries = [];
  for (let i = 0; i < entryCount; i++) {
    if (buf.readUInt32LE(offset) !== CENTRAL_SIG) break;
    const compressionMethod = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const uncompressedSize = buf.readUInt32LE(offset + 24);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localHeaderOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLen);
    entries.push({ name, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return { buf, entries };
}

function readEntryData(buf, entry) {
  const off = entry.localHeaderOffset;
  if (buf.readUInt32LE(off) !== LOCAL_SIG) throw new Error('Corrupt zip local header');
  const nameLen = buf.readUInt16LE(off + 26);
  const extraLen = buf.readUInt16LE(off + 28);
  const dataStart = off + 30 + nameLen + extraLen;
  const raw = buf.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.compressionMethod === 0) return raw;
  if (entry.compressionMethod === 8) return zlib.inflateRawSync(raw);
  throw new Error(`Unsupported zip compression method ${entry.compressionMethod} for ${entry.name}`);
}

function shouldExclude(name, excludePatterns) {
  return excludePatterns.some((pattern) => {
    const normalized = pattern.replace(/\/$/, '');
    return name === normalized || name.startsWith(`${normalized}/`);
  });
}

// Extracts every file from `zipPath` into `destDir`, skipping directory
// entries and anything matching Mojang's `extract.exclude` patterns
// (typically ["META-INF/"]).
function extractZip(zipPath, destDir, { excludePatterns = [] } = {}) {
  const { buf, entries } = listEntries(zipPath);
  let extracted = 0;
  for (const entry of entries) {
    if (entry.name.endsWith('/')) continue; // directory
    if (shouldExclude(entry.name, excludePatterns)) continue;
    const data = readEntryData(buf, entry);
    const outPath = path.join(destDir, entry.name);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, data);
    extracted++;
  }
  return extracted;
}

function crc32(buf) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f);
  const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f);
  return { time, day };
}

function walkFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, base));
    else if (entry.isFile()) out.push({ full, rel: path.relative(base, full).split(path.sep).join('/') });
  }
  return out;
}

// Writes a standard (non-zip64) archive of every file under `srcDir` to
// `destZipPath`, using deflate compression. Good enough for exporting/
// importing instances between CircuitMC installs.
function zipDirectory(srcDir, destZipPath) {
  const files = walkFiles(srcDir);
  const chunks = [];
  const centralEntries = [];
  let offset = 0;
  const { time, day } = dosDateTime(new Date());

  for (const file of files) {
    const raw = fs.readFileSync(file.full);
    const crc = crc32(raw);
    let data = zlib.deflateRawSync(raw);
    let method = 8;
    if (data.length >= raw.length) {
      data = raw;
      method = 0;
    }
    const nameBuf = Buffer.from(file.rel, 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_SIG, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    chunks.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_SIG, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra len
    central.writeUInt16LE(0, 32); // comment len
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42);
    centralEntries.push(Buffer.concat([central, nameBuf]));

    offset += local.length + nameBuf.length + data.length;
  }

  const centralStart = offset;
  const centralBuf = Buffer.concat(centralEntries);
  const centralSize = centralBuf.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralStart, 16);
  eocd.writeUInt16LE(0, 20);

  fs.mkdirSync(path.dirname(destZipPath), { recursive: true });
  fs.writeFileSync(destZipPath, Buffer.concat([...chunks, centralBuf, eocd]));
  return files.length;
}

// Extracts an entire archive (of any origin, not just ones we wrote) into
// destDir, preserving its directory structure.
function extractZipAll(zipPath, destDir) {
  return extractZip(zipPath, destDir, { excludePatterns: [] });
}

module.exports = { extractZip, extractZipAll, listEntries, zipDirectory };
