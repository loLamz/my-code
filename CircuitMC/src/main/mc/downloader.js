'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');

function sha1File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function isFileValid(filePath, expectedSha1, expectedSize) {
  try {
    const stat = await fsp.stat(filePath);
    if (typeof expectedSize === 'number' && stat.size !== expectedSize) return false;
    if (expectedSha1) {
      const actual = await sha1File(filePath);
      return actual === expectedSha1;
    }
    return stat.size > 0;
  } catch (_) {
    return false;
  }
}

// Downloads a single file, skipping it if a valid (hash-matching) copy is
// already on disk, and verifying the hash after downloading.
async function downloadFile({ url, destPath, sha1, size, retries = 3 }) {
  if (await isFileValid(destPath, sha1, size)) {
    return { skipped: true, destPath };
  }
  await fsp.mkdir(path.dirname(destPath), { recursive: true });

  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const tmp = `${destPath}.part`;
      const body = res.body ? Readable.fromWeb(res.body) : null;
      if (!body) throw new Error(`No response body for ${url}`);
      await pipeline(body, fs.createWriteStream(tmp));
      if (sha1) {
        const actual = await sha1File(tmp);
        if (actual !== sha1) {
          await fsp.unlink(tmp).catch(() => {});
          throw new Error(`Hash mismatch for ${url} (expected ${sha1}, got ${actual})`);
        }
      }
      await fsp.rename(tmp, destPath);
      return { skipped: false, destPath };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw lastErr;
}

// Runs `tasks` (each a downloadFile()-shaped options object) through a
// bounded worker pool, reporting aggregate progress as it goes.
async function downloadAll(tasks, { concurrency = 10, onProgress, label } = {}) {
  let completed = 0;
  const total = tasks.length;
  let index = 0;
  const errors = [];

  async function worker() {
    while (index < tasks.length) {
      const myIndex = index++;
      const task = tasks[myIndex];
      try {
        await downloadFile(task);
      } catch (err) {
        errors.push({ task, error: err });
      }
      completed++;
      if (onProgress) onProgress({ completed, total, label, current: task.displayName || path.basename(task.destPath) });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, tasks.length)) }, worker);
  await Promise.all(workers);

  if (errors.length) {
    const err = new Error(`${errors.length} of ${total} downloads failed (${label || 'files'}). First: ${errors[0].error.message}`);
    err.details = errors;
    throw err;
  }
}

module.exports = { downloadFile, downloadAll, sha1File, isFileValid };
