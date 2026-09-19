'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn } = require('child_process');

const paths = require('../paths');
const logger = require('../logger');
const { readJson, writeJson } = require('../store');
const { downloadFile, downloadAll } = require('./downloader');
const { mavenNameToPath } = require('./maven');
const { libraryApplies, currentOsName, currentArch } = require('./rules');
const versionManifest = require('./versionManifest');
const fabric = require('./fabric');
const forge = require('./forge');
const neoforge = require('./neoforge');

function versionJsonPath(id) {
  return path.join(paths.sharedVersionsDir(), id, `${id}.json`);
}

function saveVersionJson(json) {
  writeJson(versionJsonPath(json.id), json);
}

function loadVersionJson(id) {
  const data = readJson(versionJsonPath(id), null);
  if (!data) throw new Error(`Version "${id}" is not installed (missing version json).`);
  return data;
}

// Walks `inheritsFrom` chains (used by Fabric/Quilt profiles, and by some
// Forge/NeoForge layouts) and merges child-over-parent into one flat json,
// the same way real launchers do.
function resolveVersionChain(id) {
  const chain = [];
  let current = loadVersionJson(id);
  chain.push(current);
  const seen = new Set([id]);
  while (current.inheritsFrom) {
    if (seen.has(current.inheritsFrom)) break;
    seen.add(current.inheritsFrom);
    current = loadVersionJson(current.inheritsFrom);
    chain.push(current);
  }
  // chain[0] is the most specific (leaf); merge from root outward so the
  // leaf's fields win.
  const ordered = chain.slice().reverse();
  let merged = {};
  for (const part of ordered) {
    merged = mergeVersionJson(merged, part);
  }
  return merged;
}

function mergeVersionJson(base, overlay) {
  const merged = { ...base, ...overlay };
  merged.libraries = [...(overlay.libraries || []), ...(base.libraries || [])];
  if (base.arguments || overlay.arguments) {
    merged.arguments = {
      game: [...((base.arguments && base.arguments.game) || []), ...((overlay.arguments && overlay.arguments.game) || [])],
      jvm: [...((base.arguments && base.arguments.jvm) || []), ...((overlay.arguments && overlay.arguments.jvm) || [])],
    };
  }
  merged.minecraftArguments = overlay.minecraftArguments || base.minecraftArguments;
  merged.mainClass = overlay.mainClass || base.mainClass;
  merged.assetIndex = overlay.assetIndex || base.assetIndex;
  merged.assets = overlay.assets || base.assets;
  merged.id = overlay.id || base.id;
  return merged;
}

// ---- Vanilla ------------------------------------------------------------

async function libraryDownloadTasks(libraries) {
  const tasks = [];
  for (const lib of libraries) {
    if (!libraryApplies(lib)) continue;

    if (lib.downloads && lib.downloads.artifact) {
      const art = lib.downloads.artifact;
      tasks.push({
        url: art.url,
        destPath: path.join(paths.sharedLibrariesDir(), art.path),
        sha1: art.sha1,
        size: art.size,
        displayName: lib.name,
      });
    }

    // Legacy natives (<1.19 LWJGL2-era) ship as classifier jars.
    if (lib.natives) {
      const classifierKey = lib.natives[currentOsName()];
      if (classifierKey && lib.downloads && lib.downloads.classifiers) {
        const classifier = classifierKey.replace('${arch}', currentArch() === 'x86_64' ? '64' : '32');
        const art = lib.downloads.classifiers[classifier];
        if (art) {
          tasks.push({
            url: art.url,
            destPath: path.join(paths.sharedLibrariesDir(), art.path),
            sha1: art.sha1,
            size: art.size,
            displayName: `${lib.name} (natives)`,
            isNative: true,
            excludePatterns: (lib.extract && lib.extract.exclude) || [],
          });
        }
      }
    }

    // Fabric/Quilt-style entries: no `downloads`, just a maven coordinate
    // and a repo base url.
    if (!lib.downloads && lib.name && lib.url) {
      const relPath = mavenNameToPath(lib.name);
      tasks.push({
        url: `${lib.url.replace(/\/?$/, '/')}${relPath}`,
        destPath: path.join(paths.sharedLibrariesDir(), relPath),
        displayName: lib.name,
      });
    }
  }
  return tasks;
}

async function installVanilla(mcVersionId, { onProgress, forceRefresh = false } = {}) {
  const report = (phase, extra) => onProgress && onProgress({ phase, ...extra });

  report('locating', { message: `Locating Minecraft ${mcVersionId}...` });
  const meta = await versionManifest.findVersionMeta(mcVersionId, { forceRefresh });
  const json = await versionManifest.getVersionJson(meta);
  saveVersionJson(json);

  report('client-jar', { message: 'Downloading client jar...' });
  const client = json.downloads.client;
  await downloadFile({
    url: client.url,
    destPath: path.join(paths.sharedVersionsDir(), json.id, `${json.id}.jar`),
    sha1: client.sha1,
    size: client.size,
  });

  report('libraries', { message: 'Downloading libraries...' });
  const libTasks = await libraryDownloadTasks(json.libraries || []);
  await downloadAll(libTasks, {
    label: 'libraries',
    onProgress: (p) => report('libraries', { message: `Libraries ${p.completed}/${p.total}`, ...p }),
  });

  report('assets', { message: 'Downloading asset index...' });
  const assetIndexMeta = json.assetIndex;
  const assetIndexPath = path.join(paths.sharedAssetsDir(), 'indexes', `${assetIndexMeta.id}.json`);
  await downloadFile({ url: assetIndexMeta.url, destPath: assetIndexPath, sha1: assetIndexMeta.sha1, size: assetIndexMeta.size });
  const assetIndex = readJson(assetIndexPath, { objects: {} });

  const assetTasks = Object.entries(assetIndex.objects || {}).map(([name, obj]) => {
    const sub = obj.hash.slice(0, 2);
    return {
      url: `https://resources.download.minecraft.net/${sub}/${obj.hash}`,
      destPath: path.join(paths.sharedAssetsDir(), 'objects', sub, obj.hash),
      sha1: obj.hash,
      size: obj.size,
      displayName: name,
    };
  });
  report('assets', { message: `Downloading ${assetTasks.length} asset files...` });
  await downloadAll(assetTasks, {
    label: 'assets',
    concurrency: 24,
    onProgress: (p) => report('assets', { message: `Assets ${p.completed}/${p.total}`, ...p }),
  });

  report('done', { message: `Minecraft ${json.id} installed.` });
  return json.id;
}

// ---- Fabric ---------------------------------------------------------------

async function installFabric(mcVersionId, loaderVersion, { onProgress } = {}) {
  await installVanilla(mcVersionId, { onProgress });

  onProgress && onProgress({ phase: 'fabric', message: 'Fetching Fabric launch profile...' });
  const profile = await fabric.getLaunchProfile(mcVersionId, loaderVersion);
  saveVersionJson(profile);

  onProgress && onProgress({ phase: 'fabric', message: 'Downloading Fabric libraries...' });
  const tasks = await libraryDownloadTasks(profile.libraries || []);
  await downloadAll(tasks, {
    label: 'fabric-libraries',
    onProgress: (p) => onProgress && onProgress({ phase: 'fabric', message: `Fabric libraries ${p.completed}/${p.total}`, ...p }),
  });

  onProgress && onProgress({ phase: 'done', message: `Fabric ${loaderVersion} for ${mcVersionId} installed.` });
  return profile.id;
}

// ---- Forge / NeoForge (headless official installer) -----------------------

function listVersionFolders() {
  try {
    return new Set(fs.readdirSync(paths.sharedVersionsDir()));
  } catch (_) {
    return new Set();
  }
}

async function runInstallerJar(installerJarPath, javaBin, { onLine } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(javaBin, ['-jar', installerJarPath, '--installClient', paths.sharedDir()], {
      cwd: paths.installersCacheDir(),
    });
    const emit = (buf) => {
      const text = buf.toString('utf8');
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) {
          logger.info(`[installer] ${line}`);
          onLine && onLine(line);
        }
      }
    };
    proc.stdout.on('data', emit);
    proc.stderr.on('data', emit);
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Installer exited with code ${code}`));
    });
  });
}

async function installForgeLike(flavor, mcVersionId, loaderVersion, javaBin, { onProgress } = {}) {
  if (!javaBin) throw new Error('No Java installation found to run the Forge/NeoForge installer with.');

  const report = (message, extra) => onProgress && onProgress({ phase: flavor, message, ...extra });

  report(`Preparing ${flavor === 'forge' ? 'Forge' : 'NeoForge'} installer...`);
  await installVanilla(mcVersionId, { onProgress });

  const installerUrl = flavor === 'forge'
    ? forge.installerUrl(mcVersionId, loaderVersion)
    : neoforge.installerUrl(loaderVersion);
  const installerFileName = flavor === 'forge'
    ? `forge-${mcVersionId}-${loaderVersion}-installer.jar`
    : `neoforge-${loaderVersion}-installer.jar`;
  const installerPath = path.join(paths.installersCacheDir(), installerFileName);

  report('Downloading installer...');
  await downloadFile({ url: installerUrl, destPath: installerPath });

  const before = listVersionFolders();
  report('Running installer (this launches a background Java process)...');
  await runInstallerJar(installerPath, javaBin, { onLine: (line) => report(line) });

  const after = listVersionFolders();
  const created = [...after].filter((id) => !before.has(id));
  // Prefer an id that mentions the loader flavor; fall back to whatever's new.
  const newId = created.find((id) => id.toLowerCase().includes(flavor)) || created[0];
  if (!newId) {
    throw new Error(`${flavor} installer finished but no new version was found in ${paths.sharedVersionsDir()}.`);
  }

  report('done', { message: `${flavor === 'forge' ? 'Forge' : 'NeoForge'} ${loaderVersion} installed as ${newId}.` });
  return newId;
}

module.exports = {
  resolveVersionChain,
  saveVersionJson,
  loadVersionJson,
  installVanilla,
  installFabric,
  installForgeLike,
  libraryDownloadTasks,
};
