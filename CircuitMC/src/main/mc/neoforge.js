'use strict';

const path = require('path');
const paths = require('../paths');
const { readJson, writeJson } = require('../store');

const METADATA_URL = 'https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

function parseVersionsXml(xml) {
  const versions = [];
  const re = /<version>([^<]+)<\/version>/g;
  let m;
  while ((m = re.exec(xml))) versions.push(m[1]);
  return versions;
}

// NeoForge's own versioning scheme mirrors Minecraft's: for Minecraft
// "1.<minor>.<patch>" the NeoForge build is "<minor>.<patch>.<build>"
// (patch is omitted -> 0, e.g. Minecraft 1.21 -> NeoForge 21.0.x).
// NeoForge only exists for Minecraft 1.20.1 onward.
function mcVersionToPrefix(mcVersion) {
  const parts = mcVersion.split('.').map((n) => parseInt(n, 10));
  if (parts[0] !== 1 || Number.isNaN(parts[1])) return null;
  const minor = parts[1];
  const patch = parts[2] || 0;
  return `${minor}.${patch}.`;
}

function isCleanSemver(v) {
  return /^\d+\.\d+\.\d+(-beta)?$/.test(v);
}

async function loadAllVersions({ forceRefresh = false } = {}) {
  const cachePath = path.join(paths.metaCacheDir(), 'neoforge-versions.json');
  if (!forceRefresh) {
    const cached = readJson(cachePath, null);
    if (cached) return cached;
  }
  const xml = await fetchText(METADATA_URL);
  const versions = parseVersionsXml(xml).filter(isCleanSemver);
  writeJson(cachePath, versions);
  return versions;
}

function compareVersion(a, b) {
  const clean = (v) => v.replace('-beta', '');
  const pa = clean(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = clean(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function getNeoForgeVersionsForMinecraft(mcVersion) {
  const prefix = mcVersionToPrefix(mcVersion);
  if (!prefix) return [];
  const all = await loadAllVersions();
  return all.filter((v) => v.startsWith(prefix)).sort((a, b) => compareVersion(b, a));
}

function installerUrl(neoforgeVersion) {
  return `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoforgeVersion}/neoforge-${neoforgeVersion}-installer.jar`;
}

function isSupported(mcVersion) {
  return mcVersionToPrefix(mcVersion) !== null;
}

module.exports = { getNeoForgeVersionsForMinecraft, installerUrl, isSupported, mcVersionToPrefix };
