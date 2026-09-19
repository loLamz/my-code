'use strict';

const path = require('path');
const paths = require('./../paths');
const { readJson, writeJson } = require('../store');
const logger = require('../logger');

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

function manifestCachePath() {
  return path.join(paths.metaCacheDir(), 'version_manifest_v2.json');
}

function versionJsonCachePath(id) {
  return path.join(paths.metaCacheDir(), 'version-json', `${id}.json`);
}

// Fetches the Mojang version manifest (every release + snapshot Mojang has
// ever published). Falls back to the last cached copy if offline.
async function getVersionManifest({ forceRefresh = false } = {}) {
  const cachePath = manifestCachePath();
  if (!forceRefresh) {
    const cached = readJson(cachePath, null);
    if (cached) {
      // Refresh in the background but return cached immediately for snappy UI.
      fetchAndCacheManifest().catch(() => {});
      return cached;
    }
  }
  return fetchAndCacheManifest();
}

async function fetchAndCacheManifest() {
  const res = await fetch(MANIFEST_URL);
  if (!res.ok) throw new Error(`Failed to fetch version manifest: HTTP ${res.status}`);
  const data = await res.json();
  writeJson(manifestCachePath(), data);
  return data;
}

async function getVersionJson(versionMeta) {
  // versionMeta: { id, url } as found in the manifest's `versions` array.
  const cachePath = versionJsonCachePath(versionMeta.id);
  const cached = readJson(cachePath, null);
  if (cached) return cached;
  const res = await fetch(versionMeta.url);
  if (!res.ok) throw new Error(`Failed to fetch version json for ${versionMeta.id}: HTTP ${res.status}`);
  const data = await res.json();
  writeJson(cachePath, data);
  return data;
}

async function findVersionMeta(versionId, { forceRefresh = false } = {}) {
  const manifest = await getVersionManifest({ forceRefresh });
  const meta = manifest.versions.find((v) => v.id === versionId);
  if (!meta) throw new Error(`Unknown Minecraft version: ${versionId}`);
  return meta;
}

module.exports = { getVersionManifest, getVersionJson, findVersionMeta };
