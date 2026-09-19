'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const paths = require('../paths');
const logger = require('../logger');
const { readJson } = require('../store');
const { resolveVersionChain } = require('./installer');
const { mavenNameToPath } = require('./maven');
const { libraryApplies, currentOsName, currentArch } = require('./rules');
const { extractZip } = require('./zip');

const running = new Map(); // instanceId -> { child, startedAt }

function classpathEntries(libraries) {
  const entries = [];
  for (const lib of libraries) {
    if (!libraryApplies(lib)) continue;
    if (isNativesOnlyLibrary(lib)) continue;
    let relPath;
    if (lib.downloads && lib.downloads.artifact) relPath = lib.downloads.artifact.path;
    else if (lib.name) relPath = mavenNameToPath(lib.name);
    if (!relPath) continue;
    const full = path.join(paths.sharedLibrariesDir(), relPath);
    entries.push(full);
  }
  return entries;
}

function isNativesOnlyLibrary(lib) {
  if (lib.natives) return true; // legacy LWJGL2 scheme, handled separately
  const parts = (lib.name || '').split(':');
  return parts[3] && parts[3].startsWith('natives-');
}

function nativesLibraryTasks(libraries) {
  const tasks = [];
  for (const lib of libraries) {
    if (!libraryApplies(lib)) continue;
    if (lib.natives) {
      const classifierKey = lib.natives[currentOsName()];
      if (!classifierKey) continue;
      const classifier = classifierKey.replace('${arch}', currentArch() === 'x86_64' ? '64' : '32');
      const art = lib.downloads && lib.downloads.classifiers && lib.downloads.classifiers[classifier];
      if (art) tasks.push({ relPath: art.path, exclude: (lib.extract && lib.extract.exclude) || ['META-INF/'] });
    } else if (isNativesOnlyLibrary(lib)) {
      const relPath = lib.downloads && lib.downloads.artifact ? lib.downloads.artifact.path : mavenNameToPath(lib.name);
      tasks.push({ relPath, exclude: ['META-INF/'] });
    }
  }
  return tasks;
}

async function extractNatives(libraries, destDir) {
  await fsp.rm(destDir, { recursive: true, force: true });
  await fsp.mkdir(destDir, { recursive: true });
  for (const task of nativesLibraryTasks(libraries)) {
    const jarPath = path.join(paths.sharedLibrariesDir(), task.relPath);
    if (!fs.existsSync(jarPath)) {
      logger.warn(`Missing native library jar: ${jarPath}`);
      continue;
    }
    extractZip(jarPath, destDir, { excludePatterns: task.exclude });
  }
  return destDir;
}

function tokenize(entry) {
  // Newer version jsons store arguments as either plain strings or
  // {rules, value} objects (value can itself be a string or string[]).
  if (typeof entry === 'string') return [entry];
  if (!libraryApplies({ rules: entry.rules })) return [];
  return Array.isArray(entry.value) ? entry.value : [entry.value];
}

function substitute(str, vars) {
  return str.replace(/\$\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : `\${${key}}`));
}

function buildArgs(merged, vars) {
  let gameArgs;
  let jvmArgs;
  if (merged.arguments) {
    gameArgs = (merged.arguments.game || []).flatMap(tokenize);
    jvmArgs = (merged.arguments.jvm || []).flatMap(tokenize);
  } else {
    // Pre-1.13 legacy scheme: a single space-separated string + sane JVM defaults.
    gameArgs = (merged.minecraftArguments || '').split(' ').filter(Boolean);
    jvmArgs = [
      '-Djava.library.path=${natives_directory}',
      '-cp',
      '${classpath}',
    ];
  }
  return {
    game: gameArgs.map((a) => substitute(a, vars)),
    jvm: jvmArgs.map((a) => substitute(a, vars)),
  };
}

function classpathSeparator() {
  return process.platform === 'win32' ? ';' : ':';
}

async function launch(instance, { account, onLog, onExit } = {}) {
  const merged = resolveVersionChain(instance.versionId);
  const gameDir = paths.instanceGameDir(instance.id);
  const nativesDir = path.join(paths.instanceDir(instance.id), 'natives');

  await fsp.mkdir(gameDir, { recursive: true });
  await extractNatives(merged.libraries || [], nativesDir);

  // Loader profiles (Fabric always; Forge/NeoForge from ~1.17 onward) don't
  // ship their own client jar -- they inherit the vanilla one.
  const clientJar = path.join(paths.sharedVersionsDir(), merged.id, `${merged.id}.jar`);
  const actualClientJar = fs.existsSync(clientJar)
    ? clientJar
    : path.join(paths.sharedVersionsDir(), instance.mcVersion, `${instance.mcVersion}.jar`);

  const cp = [...classpathEntries(merged.libraries || []), actualClientJar];

  const assetsDir = paths.sharedAssetsDir();
  const assetsIndexName = merged.assets || (merged.assetIndex && merged.assetIndex.id) || instance.mcVersion;

  const vars = {
    auth_player_name: account.username,
    version_name: merged.id,
    game_directory: gameDir,
    assets_root: assetsDir,
    assets_index_name: assetsIndexName,
    auth_uuid: account.uuid,
    auth_access_token: account.accessToken || '0',
    auth_xuid: account.type === 'microsoft' ? account.uuid.replace(/-/g, '') : '0',
    clientid: crypto.randomUUID(),
    user_type: account.type === 'microsoft' ? 'msa' : 'legacy',
    user_properties: '{}',
    version_type: merged.type || 'release',
    natives_directory: nativesDir,
    launcher_name: 'CircuitMC',
    launcher_version: require('../../../package.json').version,
    classpath: cp.join(classpathSeparator()),
    classpath_separator: classpathSeparator(),
    library_directory: paths.sharedLibrariesDir(),
    resolution_width: String(instance.resolution?.width || 854),
    resolution_height: String(instance.resolution?.height || 480),
  };

  const { game, jvm } = buildArgs(merged, vars);

  const ramMin = instance.javaMinMb || 1024;
  const ramMax = instance.javaMaxMb || 4096;
  const extraJvmArgs = (instance.jvmArgs || '').split(' ').filter(Boolean);

  const finalArgs = [
    `-Xms${ramMin}M`,
    `-Xmx${ramMax}M`,
    ...extraJvmArgs,
    ...(jvm.includes('-cp') ? [] : ['-cp', vars.classpath]),
    ...jvm,
    merged.mainClass,
    ...game,
  ];

  const javaBin = instance.javaPath || 'java';
  logger.info(`Launching ${instance.name}: ${javaBin} ${finalArgs.join(' ')}`);

  const child = spawn(javaBin, finalArgs, { cwd: gameDir, detached: process.platform !== 'win32' });
  running.set(instance.id, { child, startedAt: Date.now() });

  child.stdout.on('data', (buf) => onLog && onLog('stdout', buf.toString('utf8')));
  child.stderr.on('data', (buf) => onLog && onLog('stderr', buf.toString('utf8')));
  child.on('exit', (code) => {
    running.delete(instance.id);
    onExit && onExit(code);
  });

  return child.pid;
}

function isRunning(instanceId) {
  return running.has(instanceId);
}

function kill(instanceId) {
  const entry = running.get(instanceId);
  if (!entry) return false;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(entry.child.pid), '/f', '/t']);
    } else {
      process.kill(-entry.child.pid, 'SIGTERM');
    }
  } catch (_) {
    entry.child.kill();
  }
  return true;
}

module.exports = { launch, isRunning, kill, resolveVersionChain };
