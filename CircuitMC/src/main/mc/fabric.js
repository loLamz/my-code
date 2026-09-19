'use strict';

const path = require('path');
const paths = require('../paths');
const { readJson, writeJson } = require('../store');

const META_BASE = 'https://meta.fabricmc.net/v2/versions';

async function getJson(url, cacheName) {
  const cachePath = path.join(paths.metaCacheDir(), cacheName);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    writeJson(cachePath, data);
    return data;
  } catch (err) {
    const cached = readJson(cachePath, null);
    if (cached) return cached;
    throw err;
  }
}

// Every Minecraft version Fabric publishes an intermediary mapping for
// (i.e. every version Fabric can theoretically run on).
async function getSupportedGameVersions() {
  const list = await getJson(`${META_BASE}/game`, 'fabric-game-versions.json');
  return new Set(list.map((v) => v.version));
}

// Loader builds compatible with a specific Minecraft version. The Fabric
// meta server itself filters this list, so whatever comes back is accurate.
async function getLoaderVersionsFor(mcVersion) {
  const url = `${META_BASE}/loader/${encodeURIComponent(mcVersion)}`;
  const list = await getJson(url, `fabric-loader-${mcVersion}.json`);
  return list.map((entry) => ({
    version: entry.loader.version,
    stable: !!entry.loader.stable,
  }));
}

// The ready-to-launch version json (id, inheritsFrom, mainClass, libraries,
// arguments) for a given Minecraft + loader version pair.
async function getLaunchProfile(mcVersion, loaderVersion) {
  const url = `${META_BASE}/loader/${encodeURIComponent(mcVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch Fabric launch profile: HTTP ${res.status}`);
  return res.json();
}

module.exports = { getSupportedGameVersions, getLoaderVersionsFor, getLaunchProfile };
