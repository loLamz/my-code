'use strict';

// Automatically downloads and installs a Java runtime when none is found on
// the system, the same convenience MultiMC/Prism/CurseForge offer, using
// Eclipse Temurin (Adoptium) builds -- no manual JDK install required.

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');

const paths = require('../paths');
const { downloadFile } = require('./downloader');
const { extractZipAll } = require('./zip');

// Adoptium only publishes zips for Windows/Mac and tarballs for Linux; this
// app ships for Windows, so automatic provisioning targets that. On other
// platforms callers fall back to asking the user to install Java manually.
const ADOPTIUM_OS = { win32: 'windows' };
const ADOPTIUM_ARCH = { x64: 'x64', arm64: 'aarch64' };

function isSupported() {
  return !!ADOPTIUM_OS[process.platform];
}

function javaHomeDir(major) {
  return path.join(paths.sharedDir(), 'java', String(major));
}

function javaBinPath(major) {
  return path.join(javaHomeDir(major), 'bin', process.platform === 'win32' ? 'javaw.exe' : 'java');
}

async function isProvisioned(major) {
  try {
    await fsp.access(javaBinPath(major));
    return true;
  } catch (_) {
    return false;
  }
}

function adoptiumDownloadUrl(major) {
  const osName = ADOPTIUM_OS[process.platform];
  const arch = ADOPTIUM_ARCH[os.arch()] || 'x64';
  return `https://api.adoptium.net/v3/binary/latest/${major}/ga/${osName}/${arch}/jdk/hotspot/normal/eclipse?project=jdk`;
}

// A Temurin zip extracts to a single top-level folder (e.g. "jdk-21.0.4+7").
async function findExtractedHome(extractDir) {
  const entries = await fsp.readdir(extractDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  for (const d of dirs) {
    const candidate = path.join(extractDir, d.name);
    if (fs.existsSync(path.join(candidate, 'bin', 'javaw.exe')) || fs.existsSync(path.join(candidate, 'bin', 'java'))) {
      return candidate;
    }
  }
  if (dirs.length === 1) return path.join(extractDir, dirs[0].name);
  throw new Error('Downloaded JDK archive did not contain a recognizable Java install.');
}

async function provisionJava(major, { onProgress } = {}) {
  if (await isProvisioned(major)) return javaHomeDir(major);

  if (!isSupported()) {
    throw new Error(
      `No Java ${major} installation found, and CircuitMC can only auto-download Java on Windows. Install a Java ${major} JDK manually.`
    );
  }

  const report = (message, extra) => onProgress && onProgress({ phase: 'java', message, ...extra });
  report(`Downloading Java ${major} runtime...`);

  const zipPath = path.join(paths.cacheDir(), 'java-downloads', `temurin-${major}-${process.arch}.zip`);
  let lastReportAt = 0;
  await downloadFile({
    url: adoptiumDownloadUrl(major),
    destPath: zipPath,
    onData: (received, total) => {
      const now = Date.now();
      if (now - lastReportAt < 350) return;
      lastReportAt = now;
      if (total > 0) {
        const pct = Math.round((received / total) * 100);
        report(`Downloading Java ${major} runtime (${pct}%)...`, { completed: pct, total: 100 });
      } else {
        report(`Downloading Java ${major} runtime (${(received / 1e6).toFixed(0)} MB)...`);
      }
    },
  });

  report(`Installing Java ${major}...`);
  const tmpExtractDir = path.join(paths.sharedDir(), 'java', `.tmp-${major}-${Date.now()}`);
  await fsp.mkdir(tmpExtractDir, { recursive: true });
  try {
    extractZipAll(zipPath, tmpExtractDir);
    const extractedHome = await findExtractedHome(tmpExtractDir);
    const finalHome = javaHomeDir(major);
    await fsp.rm(finalHome, { recursive: true, force: true });
    await fsp.mkdir(path.dirname(finalHome), { recursive: true });
    await fsp.rename(extractedHome, finalHome);
  } finally {
    await fsp.rm(tmpExtractDir, { recursive: true, force: true }).catch(() => {});
    await fsp.rm(zipPath, { force: true }).catch(() => {});
  }

  report(`Java ${major} installed.`);
  return javaHomeDir(major);
}

module.exports = { provisionJava, isProvisioned, isSupported, javaHomeDir, javaBinPath };
