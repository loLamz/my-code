'use strict';

const paths = require('./paths');
const { readJson, writeJson } = require('./store');

const DEFAULTS = {
  theme: 'dark',
  defaultRamMin: 1024,
  defaultRamMax: 4096,
  globalJavaPath: '', // empty = auto-detect per instance
  downloadConcurrency: 12,
  closeLauncherOnLaunch: false,
  keepConsoleOpen: true,
  accounts: [], // { id, type: 'offline' | 'microsoft', username, uuid }
  activeAccountId: null,
  msaClientId: '', // user-supplied Azure AD app id, required for Microsoft sign-in
  lastGroupFilter: null,
};

let cache = null;

function load() {
  if (!cache) {
    cache = { ...DEFAULTS, ...readJson(paths.settingsFile(), {}) };
  }
  return cache;
}

function save(partial) {
  cache = { ...load(), ...partial };
  writeJson(paths.settingsFile(), cache);
  return cache;
}

module.exports = { load, save, DEFAULTS };
