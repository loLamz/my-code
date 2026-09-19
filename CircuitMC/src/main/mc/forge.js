'use strict';

const path = require('path');
const paths = require('../paths');
const { readJson, writeJson } = require('../store');

const METADATA_URL = 'https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml';
const PROMOTIONS_URL = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

// The maven metadata lists every published "<mcVersion>-<forgeVersion>"
// combo, so parsing it gives us exactly the set of real, installable
// Forge builds -- no guessing at compatibility.
function parseVersionsXml(xml) {
  const versions = [];
  const re = /<version>([^<]+)<\/version>/g;
  let m;
  while ((m = re.exec(xml))) versions.push(m[1]);
  return versions;
}

function groupByMcVersion(versionStrings) {
  const map = new Map();
  for (const full of versionStrings) {
    const sep = full.indexOf('-');
    if (sep === -1) continue;
    const mcVersion = full.slice(0, sep);
    const forgeVersion = full.slice(sep + 1);
    if (!map.has(mcVersion)) map.set(mcVersion, []);
    map.get(mcVersion).push(forgeVersion);
  }
  return map;
}

async function loadIndex({ forceRefresh = false } = {}) {
  const cachePath = path.join(paths.metaCacheDir(), 'forge-index.json');
  if (!forceRefresh) {
    const cached = readJson(cachePath, null);
    if (cached) return cached;
  }
  const xml = await fetchText(METADATA_URL);
  const versions = parseVersionsXml(xml);
  const grouped = groupByMcVersion(versions);
  const index = {};
  for (const [mcVersion, forgeVersions] of grouped) {
    // Newest (highest build number) first.
    index[mcVersion] = forgeVersions.slice().sort((a, b) => compareForgeVersion(b, a));
  }
  writeJson(cachePath, index);
  return index;
}

function compareForgeVersion(a, b) {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function getForgeVersionsForMinecraft(mcVersion) {
  const index = await loadIndex();
  return index[mcVersion] || [];
}

async function getRecommended(mcVersion) {
  const cachePath = path.join(paths.metaCacheDir(), 'forge-promotions.json');
  let promos;
  try {
    const data = JSON.parse(await fetchText(PROMOTIONS_URL));
    promos = data.promos;
    writeJson(cachePath, promos);
  } catch (_) {
    promos = readJson(cachePath, {});
  }
  return promos[`${mcVersion}-recommended`] || promos[`${mcVersion}-latest`] || null;
}

function installerUrl(mcVersion, forgeVersion) {
  const full = `${mcVersion}-${forgeVersion}`;
  return `https://maven.minecraftforge.net/net/minecraftforge/forge/${full}/forge-${full}-installer.jar`;
}

module.exports = { getForgeVersionsForMinecraft, getRecommended, installerUrl, loadIndex };
