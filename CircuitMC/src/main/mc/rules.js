'use strict';

const os = require('os');

function currentOsName() {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'osx';
  return 'linux';
}

function currentArch() {
  const a = os.arch();
  if (a === 'x64') return 'x86_64';
  if (a === 'ia32' || a === 'x32') return 'x86';
  if (a === 'arm64') return 'arm64';
  return a;
}

// Evaluates a Mojang-style `rules` array (used on both libraries and
// individual game/jvm arguments) against the current platform.
function rulesAllow(rules) {
  if (!rules || rules.length === 0) return true;
  let allowed = false;
  for (const rule of rules) {
    const matchesOs = !rule.os || (
      (!rule.os.name || rule.os.name === currentOsName()) &&
      (!rule.os.arch || rule.os.arch === currentArch())
    );
    if (matchesOs) allowed = rule.action === 'allow';
  }
  return allowed;
}

function libraryApplies(library) {
  return rulesAllow(library.rules);
}

module.exports = { currentOsName, currentArch, rulesAllow, libraryApplies };
