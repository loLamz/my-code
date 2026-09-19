'use strict';

const { ipcMain, dialog, shell, app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const paths = require('../paths');
const logger = require('../logger');
const settings = require('../settings');
const instanceManager = require('../instances/instanceManager');
const versionManifest = require('../mc/versionManifest');
const fabric = require('../mc/fabric');
const forge = require('../mc/forge');
const neoforge = require('../mc/neoforge');
const javaFinder = require('../mc/javaFinder');
const installer = require('../mc/installer');
const launcher = require('../mc/launcher');
const auth = require('../mc/auth');

function sendToAll(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (err) {
      logger.error(`${channel} failed: ${err.stack || err.message}`);
      return { ok: false, error: err.message };
    }
  });
}

function registerIpcHandlers() {
  // -- App / window -----------------------------------------------------
  handle('app:getVersion', () => app.getVersion());
  handle('app:getPaths', () => ({ root: paths.root(), instances: paths.instancesDir() }));
  handle('app:openInstancesRoot', async () => {
    fs.mkdirSync(paths.instancesDir(), { recursive: true });
    await shell.openPath(paths.instancesDir());
    return true;
  });

  ipcMain.on('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
  ipcMain.on('window:maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return;
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.on('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());

  // -- Settings -----------------------------------------------------------
  handle('settings:get', () => settings.load());
  handle('settings:save', (partial) => settings.save(partial));

  // -- Instances ------------------------------------------------------------
  handle('instances:list', () => instanceManager.listInstances());
  handle('instances:get', (id) => instanceManager.getInstance(id));
  handle('instances:create', (opts) => instanceManager.createInstance(opts));
  handle('instances:update', (id, patch) => instanceManager.updateInstance(id, patch));
  handle('instances:delete', (id) => instanceManager.deleteInstance(id));
  handle('instances:duplicate', (id, newName) => instanceManager.duplicateInstance(id, newName));
  handle('instances:isRunning', (id) => launcher.isRunning(id));

  handle('instances:openFolder', async (id) => {
    const dir = paths.instanceGameDir(id);
    fs.mkdirSync(dir, { recursive: true });
    await shell.openPath(dir);
    return true;
  });

  handle('instances:createShortcut', async (id) => {
    const instance = instanceManager.getInstance(id);
    const desktop = app.getPath('desktop');
    const shortcutPath = path.join(desktop, `${instance.name}.lnk`);
    if (process.platform === 'win32') {
      const exePath = process.execPath;
      const ok = shell.writeShortcutLink(shortcutPath, {
        target: exePath,
        args: `--launch-instance="${id}"`,
        icon: exePath,
        iconIndex: 0,
        description: `Launch ${instance.name} with CircuitMC`,
      });
      return ok;
    }
    throw new Error('Shortcuts are only created on Windows.');
  });

  handle('instances:export', async (id) => {
    const instance = instanceManager.getInstance(id);
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Instance',
      defaultPath: `${instance.name}.circuitmc.zip`,
      filters: [{ name: 'CircuitMC Instance', extensions: ['zip'] }],
    });
    if (canceled || !filePath) return null;
    return instanceManager.exportInstance(id, filePath);
  });

  handle('instances:import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Instance',
      properties: ['openFile'],
      filters: [{ name: 'CircuitMC Instance', extensions: ['zip'] }],
    });
    if (canceled || !filePaths[0]) return null;
    const name = path.basename(filePaths[0]).replace(/\.circuitmc\.zip$|\.zip$/i, '');
    return instanceManager.importInstance(filePaths[0], name);
  });

  // -- Groups ---------------------------------------------------------------
  handle('groups:list', () => instanceManager.listGroups());
  handle('groups:create', (name) => instanceManager.createGroup(name));
  handle('groups:rename', (id, name) => instanceManager.renameGroup(id, name));
  handle('groups:delete', (id) => instanceManager.deleteGroup(id));
  handle('groups:moveInstance', (instanceId, groupId) => instanceManager.moveInstanceToGroup(instanceId, groupId));
  handle('groups:reorderInstances', (orderedIds) => instanceManager.reorderInstances(orderedIds));

  // -- Instance content (mods / resource packs / shaderpacks / worlds) -----
  handle('instances:listContent', (id, kind) => instanceManager.listContentFolder(id, kind));
  handle('instances:toggleContent', (id, kind, name) => instanceManager.toggleContentItem(id, kind, name));
  handle('instances:deleteContent', (id, kind, name) => instanceManager.deleteContentItem(id, kind, name));

  // -- Minecraft version metadata ------------------------------------------
  handle('mc:versionManifest', (opts) => versionManifest.getVersionManifest(opts || {}));
  handle('mc:fabricLoaders', (mcVersion) => fabric.getLoaderVersionsFor(mcVersion));
  handle('mc:fabricSupported', async () => Array.from(await fabric.getSupportedGameVersions()));
  handle('mc:forgeVersions', (mcVersion) => forge.getForgeVersionsForMinecraft(mcVersion));
  handle('mc:forgeRecommended', (mcVersion) => forge.getRecommended(mcVersion));
  handle('mc:neoforgeVersions', (mcVersion) => neoforge.getNeoForgeVersionsForMinecraft(mcVersion));
  handle('mc:neoforgeSupported', (mcVersion) => neoforge.isSupported(mcVersion));

  // -- Java -------------------------------------------------------------------
  handle('java:findAll', () => javaFinder.findAllJavaInstalls());
  handle('java:recommend', (mcVersion) => javaFinder.recommendedJavaMajor(mcVersion));
  handle('java:pickManually', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select javaw.exe',
      properties: ['openFile'],
      filters: [{ name: 'Java executable', extensions: process.platform === 'win32' ? ['exe'] : ['*'] }],
    });
    if (canceled || !filePaths[0]) return null;
    return filePaths[0];
  });

  // -- Install / launch (long running; progress streamed as events) --------
  handle('instances:install', async (id) => {
    const instance = instanceManager.getInstance(id);
    const onProgress = (payload) => sendToAll('install-progress', { instanceId: id, ...payload });
    let versionId;
    const javaBin = await resolveJavaForInstall(instance);

    if (instance.loader === 'vanilla' || !instance.loader) {
      versionId = await installer.installVanilla(instance.mcVersion, { onProgress });
    } else if (instance.loader === 'fabric') {
      versionId = await installer.installFabric(instance.mcVersion, instance.loaderVersion, { onProgress });
    } else if (instance.loader === 'forge') {
      versionId = await installer.installForgeLike('forge', instance.mcVersion, instance.loaderVersion, javaBin, { onProgress });
    } else if (instance.loader === 'neoforge') {
      versionId = await installer.installForgeLike('neoforge', instance.mcVersion, instance.loaderVersion, javaBin, { onProgress });
    } else {
      throw new Error(`Unknown mod loader: ${instance.loader}`);
    }

    return instanceManager.updateInstance(id, { installed: true, versionId });
  });

  handle('instances:launch', async (id) => {
    const instance = instanceManager.getInstance(id);
    if (!instance.installed || !instance.versionId) {
      throw new Error('This instance has not finished installing yet.');
    }
    const account = getActiveAccountOrThrow();
    const javaBin = instance.javaPath || (await resolveJavaForInstall(instance));

    const pid = await launcher.launch(
      { ...instance, javaPath: javaBin },
      {
        account,
        onLog: (stream, text) => sendToAll('instance-log', { instanceId: id, stream, text }),
        onExit: (code) => sendToAll('instance-exit', { instanceId: id, code }),
      }
    );
    instanceManager.updateInstance(id, { lastPlayed: Date.now() });
    return pid;
  });

  handle('instances:kill', (id) => launcher.kill(id));

  // -- Accounts ---------------------------------------------------------------
  handle('accounts:createOffline', (username) => {
    const account = auth.createOfflineAccount(username);
    const s = settings.load();
    settings.save({ accounts: [...s.accounts, account], activeAccountId: s.activeAccountId || account.id });
    return account;
  });
  handle('accounts:remove', (accountId) => {
    const s = settings.load();
    const accounts = s.accounts.filter((a) => a.id !== accountId);
    const activeAccountId = s.activeAccountId === accountId ? (accounts[0]?.id || null) : s.activeAccountId;
    settings.save({ accounts, activeAccountId });
    return true;
  });
  handle('accounts:setActive', (accountId) => settings.save({ activeAccountId: accountId }));
  handle('accounts:startMicrosoftSignIn', async () => {
    const s = settings.load();
    return auth.startDeviceCodeFlow(s.msaClientId);
  });
  handle('accounts:pollMicrosoftSignIn', async (deviceCode) => {
    const s = settings.load();
    const result = await auth.pollDeviceCodeFlow(s.msaClientId, deviceCode);
    if (result.pending) return { pending: true };
    const account = await auth.xboxLiveAndMinecraftAuth(result.tokens.access_token);
    settings.save({ accounts: [...s.accounts, account], activeAccountId: account.id });
    return { pending: false, account };
  });

  logger.onLine((entry) => sendToAll('log-line', entry));
}

function getActiveAccountOrThrow() {
  const s = settings.load();
  const account = s.accounts.find((a) => a.id === s.activeAccountId) || s.accounts[0];
  if (!account) throw new Error('No account configured. Add an offline or Microsoft account in Accounts.');
  return account;
}

async function resolveJavaForInstall(instance) {
  if (instance.javaPath) return instance.javaPath;
  const s = settings.load();
  if (s.globalJavaPath) return s.globalJavaPath;
  const installs = await javaFinder.findAllJavaInstalls();
  const best = await javaFinder.pickBestJavaFor(instance.mcVersion, installs);
  if (!best) throw new Error('No Java installation found. Install a JDK or select one manually in Settings.');
  return path.join(best.javaHome, 'bin', process.platform === 'win32' ? 'javaw.exe' : 'java');
}

module.exports = { registerIpcHandlers };
