'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

function javaBinaryName() {
  return process.platform === 'win32' ? 'javaw.exe' : 'java';
}

function candidateRoots() {
  if (process.platform === 'win32') {
    const roots = [];
    for (const envVar of ['ProgramFiles', 'ProgramFiles(x86)', 'LOCALAPPDATA']) {
      if (process.env[envVar]) roots.push(process.env[envVar]);
    }
    const vendors = ['Java', 'Eclipse Adoptium', 'Eclipse Foundation', 'Microsoft', 'Zulu', 'BellSoft', 'AdoptOpenJDK'];
    const found = [];
    for (const root of roots) {
      for (const vendor of vendors) found.push(path.join(root, vendor));
    }
    return found;
  }
  return ['/usr/lib/jvm', '/opt/java', path.join(os.homedir(), '.jdks')];
}

function walkForJavaHomes(dir, depth = 2) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return results;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    const bin = path.join(full, 'bin', javaBinaryName());
    if (fs.existsSync(bin)) {
      results.push(full);
    } else if (depth > 0) {
      results.push(...walkForJavaHomes(full, depth - 1));
    }
  }
  return results;
}

function queryVersion(javaHome) {
  return new Promise((resolve) => {
    const bin = path.join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
    execFile(bin, ['-version'], { timeout: 5000 }, (err, stdout, stderr) => {
      if (err) return resolve(null);
      const text = `${stdout}\n${stderr}`;
      const match = text.match(/version "(\d+)(?:\.(\d+))?/);
      if (!match) return resolve(null);
      // Old scheme "1.8.0_xxx" reports major "1" with minor "8" -> Java 8.
      const major = match[1] === '1' ? parseInt(match[2] || '0', 10) : parseInt(match[1], 10);
      resolve({ javaHome, major, raw: text.trim().split('\n')[0] });
    });
  });
}

async function findAllJavaInstalls() {
  const homes = new Set();

  if (process.env.JAVA_HOME) homes.add(process.env.JAVA_HOME);

  for (const root of candidateRoots()) {
    for (const home of walkForJavaHomes(root)) homes.add(home);
  }

  // Whatever `java` resolves to on PATH.
  const pathJava = await new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    execFile(cmd, ['java'], { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const first = stdout.split(/\r?\n/).find(Boolean);
      if (!first) return resolve(null);
      // bin/java(.exe) -> javaHome is two levels up
      resolve(path.dirname(path.dirname(first.trim())));
    });
  });
  if (pathJava) homes.add(pathJava);

  const results = [];
  for (const home of homes) {
    const info = await queryVersion(home);
    if (info) results.push(info);
  }
  results.sort((a, b) => b.major - a.major);
  return results;
}

// Java requirements roughly follow Mojang's own launcher_meta javaVersion
// field; this table covers the common ranges when that data isn't handy.
function recommendedJavaMajor(mcVersion) {
  const [maj, min, patch] = mcVersion.split('.').map((n) => parseInt(n, 10) || 0);
  if (maj !== 1) return 21;
  if (min >= 20 && (min > 20 || patch >= 5)) return 21;
  if (min >= 18) return 17;
  if (min >= 17) return 17;
  return 8;
}

async function pickBestJavaFor(mcVersion, installs) {
  const wanted = recommendedJavaMajor(mcVersion);
  const exact = installs.find((i) => i.major === wanted);
  if (exact) return exact;
  const newerEnough = installs.filter((i) => i.major >= wanted).sort((a, b) => a.major - b.major)[0];
  if (newerEnough) return newerEnough;
  return installs[0] || null;
}

module.exports = { findAllJavaInstalls, recommendedJavaMajor, pickBestJavaFor, javaBinaryName };
