'use strict';

const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// All CircuitMC data lives under the OS user-data directory, e.g. on Windows:
//   %APPDATA%\CircuitMC\
// Shared caches (libraries/assets/versions) are deduplicated across instances,
// exactly like real Minecraft launchers do; only per-instance user data
// (mods, config, worlds, resource/shader packs, screenshots) lives inside
// each instance's own folder, which is what actually needs to be isolated.
function root() {
  return app.getPath('userData');
}

function instancesDir() {
  return path.join(root(), 'instances');
}

function instanceDir(instanceId) {
  return path.join(instancesDir(), instanceId);
}

function instanceGameDir(instanceId) {
  return path.join(instanceDir(instanceId), 'minecraft');
}

function sharedDir() {
  return path.join(root(), 'shared');
}

function sharedVersionsDir() {
  return path.join(sharedDir(), 'versions');
}

function sharedLibrariesDir() {
  return path.join(sharedDir(), 'libraries');
}

function sharedAssetsDir() {
  return path.join(sharedDir(), 'assets');
}

function cacheDir() {
  return path.join(root(), 'cache');
}

function installersCacheDir() {
  return path.join(cacheDir(), 'installers');
}

function metaCacheDir() {
  return path.join(cacheDir(), 'meta');
}

function settingsFile() {
  return path.join(root(), 'settings.json');
}

function instancesIndexFile() {
  return path.join(instancesDir(), 'index.json');
}

function ensureDirs() {
  const dirs = [
    root(),
    instancesDir(),
    sharedDir(),
    sharedVersionsDir(),
    sharedLibrariesDir(),
    sharedAssetsDir(),
    path.join(sharedAssetsDir(), 'objects'),
    path.join(sharedAssetsDir(), 'indexes'),
    cacheDir(),
    installersCacheDir(),
    metaCacheDir(),
  ];
  for (const d of dirs) fs.mkdirSync(d, { recursive: true });
}

module.exports = {
  root,
  instancesDir,
  instanceDir,
  instanceGameDir,
  sharedDir,
  sharedVersionsDir,
  sharedLibrariesDir,
  sharedAssetsDir,
  cacheDir,
  installersCacheDir,
  metaCacheDir,
  settingsFile,
  instancesIndexFile,
  ensureDirs,
};
