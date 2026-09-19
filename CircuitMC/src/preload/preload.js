'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function invoke(channel) {
  return async (...args) => {
    const result = await ipcRenderer.invoke(channel, ...args);
    if (!result.ok) throw new Error(result.error);
    return result.data;
  };
}

function on(channel) {
  return (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  };
}

contextBridge.exposeInMainWorld('circuitmc', {
  app: {
    getVersion: invoke('app:getVersion'),
    getPaths: invoke('app:getPaths'),
    openInstancesRoot: invoke('app:openInstancesRoot'),
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    onMaximizedChange: on('window:maximized'),
  },
  settings: {
    get: invoke('settings:get'),
    save: invoke('settings:save'),
  },
  instances: {
    list: invoke('instances:list'),
    get: invoke('instances:get'),
    create: invoke('instances:create'),
    update: invoke('instances:update'),
    delete: invoke('instances:delete'),
    duplicate: invoke('instances:duplicate'),
    install: invoke('instances:install'),
    launch: invoke('instances:launch'),
    kill: invoke('instances:kill'),
    isRunning: invoke('instances:isRunning'),
    openFolder: invoke('instances:openFolder'),
    createShortcut: invoke('instances:createShortcut'),
    export: invoke('instances:export'),
    import: invoke('instances:import'),
    listContent: invoke('instances:listContent'),
    toggleContent: invoke('instances:toggleContent'),
    deleteContent: invoke('instances:deleteContent'),
  },
  groups: {
    list: invoke('groups:list'),
    create: invoke('groups:create'),
    rename: invoke('groups:rename'),
    delete: invoke('groups:delete'),
    moveInstance: invoke('groups:moveInstance'),
    reorderInstances: invoke('groups:reorderInstances'),
  },
  mc: {
    versionManifest: invoke('mc:versionManifest'),
    fabricLoaders: invoke('mc:fabricLoaders'),
    fabricSupported: invoke('mc:fabricSupported'),
    forgeVersions: invoke('mc:forgeVersions'),
    forgeRecommended: invoke('mc:forgeRecommended'),
    neoforgeVersions: invoke('mc:neoforgeVersions'),
    neoforgeSupported: invoke('mc:neoforgeSupported'),
  },
  java: {
    findAll: invoke('java:findAll'),
    recommend: invoke('java:recommend'),
    pickManually: invoke('java:pickManually'),
  },
  accounts: {
    createOffline: invoke('accounts:createOffline'),
    remove: invoke('accounts:remove'),
    setActive: invoke('accounts:setActive'),
    startMicrosoftSignIn: invoke('accounts:startMicrosoftSignIn'),
    pollMicrosoftSignIn: invoke('accounts:pollMicrosoftSignIn'),
  },
  events: {
    onInstallProgress: on('install-progress'),
    onInstanceLog: on('instance-log'),
    onInstanceExit: on('instance-exit'),
    onLogLine: on('log-line'),
  },
});
