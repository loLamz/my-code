'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const paths = require('../paths');
const { readJson, writeJson } = require('../store');
const { zipDirectory, extractZipAll } = require('../mc/zip');

const SUBFOLDERS = ['mods', 'config', 'resourcepacks', 'shaderpacks', 'saves', 'screenshots'];

function defaultIndex() {
  return { order: [], groups: [{ id: 'default', name: 'Instances', order: 0 }], instanceGroup: {} };
}

function loadIndex() {
  return readJson(paths.instancesIndexFile(), defaultIndex());
}

function saveIndex(index) {
  writeJson(paths.instancesIndexFile(), index);
}

function slugify(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug || 'instance';
}

function instanceJsonPath(id) {
  return path.join(paths.instanceDir(id), 'instance.json');
}

function listInstances() {
  const index = loadIndex();
  const instances = [];
  for (const id of index.order) {
    const data = readJson(instanceJsonPath(id), null);
    if (data) instances.push({ ...data, groupId: index.instanceGroup[id] || 'default' });
  }
  return instances;
}

function getInstance(id) {
  const data = readJson(instanceJsonPath(id), null);
  if (!data) throw new Error(`Instance not found: ${id}`);
  const index = loadIndex();
  return { ...data, groupId: index.instanceGroup[id] || 'default' };
}

function saveInstance(instance) {
  const { groupId, ...rest } = instance;
  writeJson(instanceJsonPath(instance.id), rest);
}

function createInstance({ name, mcVersion, loader, loaderVersion, groupId, icon }) {
  const id = `${slugify(name)}-${crypto.randomBytes(3).toString('hex')}`;
  const now = Date.now();
  const instance = {
    id,
    name,
    icon: icon || loader || 'vanilla',
    mcVersion,
    loader: loader || 'vanilla', // 'vanilla' | 'fabric' | 'forge' | 'neoforge'
    loaderVersion: loaderVersion || null,
    versionId: null, // set once installed to the resolved launch version id
    installed: false,
    createdAt: now,
    lastPlayed: null,
    totalPlaytimeMs: 0,
    javaPath: '',
    javaMinMb: 1024,
    javaMaxMb: 4096,
    jvmArgs: '',
    resolution: { width: 854, height: 480 },
    notes: '',
  };

  for (const sub of SUBFOLDERS) {
    fs.mkdirSync(path.join(paths.instanceGameDir(id), sub), { recursive: true });
  }
  saveInstance(instance);

  const index = loadIndex();
  index.order.push(id);
  index.instanceGroup[id] = groupId || 'default';
  saveIndex(index);

  return { ...instance, groupId: groupId || 'default' };
}

function updateInstance(id, patch) {
  const current = getInstance(id);
  const merged = { ...current, ...patch, id: current.id };
  const { groupId, ...toSave } = merged;
  saveInstance(toSave);
  if (patch.groupId) moveInstanceToGroup(id, patch.groupId);
  return getInstance(id);
}

async function deleteInstance(id) {
  await fsp.rm(paths.instanceDir(id), { recursive: true, force: true });
  const index = loadIndex();
  index.order = index.order.filter((x) => x !== id);
  delete index.instanceGroup[id];
  saveIndex(index);
}

async function duplicateInstance(id, newName) {
  const source = getInstance(id);
  const newId = `${slugify(newName)}-${crypto.randomBytes(3).toString('hex')}`;
  await fsp.cp(paths.instanceDir(id), paths.instanceDir(newId), { recursive: true });
  const clone = { ...source, id: newId, name: newName, createdAt: Date.now(), lastPlayed: null, totalPlaytimeMs: 0 };
  delete clone.groupId;
  saveInstance(clone);

  const index = loadIndex();
  index.order.push(newId);
  index.instanceGroup[newId] = source.groupId || 'default';
  saveIndex(index);
  return getInstance(newId);
}

async function exportInstance(id, destZipPath) {
  const instance = getInstance(id);
  const count = zipDirectory(paths.instanceDir(id), destZipPath);
  return { fileCount: count, name: instance.name };
}

async function importInstance(zipPath, newName) {
  const id = `${slugify(newName)}-${crypto.randomBytes(3).toString('hex')}`;
  const dir = paths.instanceDir(id);
  fs.mkdirSync(dir, { recursive: true });
  extractZipAll(zipPath, dir);

  const importedJsonPath = path.join(dir, 'instance.json');
  const importedData = readJson(importedJsonPath, {});
  const instance = {
    ...importedData,
    id,
    name: newName,
    installed: !!importedData.versionId,
    createdAt: Date.now(),
    lastPlayed: null,
  };
  saveInstance(instance);

  const index = loadIndex();
  index.order.push(id);
  index.instanceGroup[id] = 'default';
  saveIndex(index);
  return getInstance(id);
}

// ---- Groups ---------------------------------------------------------------

function listGroups() {
  return loadIndex().groups;
}

function createGroup(name) {
  const index = loadIndex();
  const id = `group-${crypto.randomBytes(3).toString('hex')}`;
  index.groups.push({ id, name, order: index.groups.length });
  saveIndex(index);
  return id;
}

function renameGroup(groupId, name) {
  const index = loadIndex();
  const group = index.groups.find((g) => g.id === groupId);
  if (group) group.name = name;
  saveIndex(index);
}

function deleteGroup(groupId) {
  if (groupId === 'default') return;
  const index = loadIndex();
  index.groups = index.groups.filter((g) => g.id !== groupId);
  for (const [instanceId, gid] of Object.entries(index.instanceGroup)) {
    if (gid === groupId) index.instanceGroup[instanceId] = 'default';
  }
  saveIndex(index);
}

function moveInstanceToGroup(instanceId, groupId) {
  const index = loadIndex();
  index.instanceGroup[instanceId] = groupId;
  saveIndex(index);
}

function reorderInstances(orderedIds) {
  const index = loadIndex();
  index.order = orderedIds;
  saveIndex(index);
}

const CONTENT_KINDS = new Set(['mods', 'resourcepacks', 'shaderpacks', 'saves']);

function contentFolderPath(id, kind) {
  if (!CONTENT_KINDS.has(kind)) throw new Error(`Unknown content kind: ${kind}`);
  return path.join(paths.instanceGameDir(id), kind);
}

function listContentFolder(id, kind) {
  const dir = contentFolderPath(id, kind);
  fs.mkdirSync(dir, { recursive: true });
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() || e.isDirectory())
    .map((e) => {
      const full = path.join(dir, e.name);
      const stat = fs.statSync(full);
      return {
        name: e.name,
        isDirectory: e.isDirectory(),
        sizeBytes: e.isDirectory() ? null : stat.size,
        enabled: !e.name.endsWith('.disabled'),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function toggleContentItem(id, kind, name) {
  const dir = contentFolderPath(id, kind);
  const from = path.join(dir, name);
  const to = name.endsWith('.disabled') ? path.join(dir, name.slice(0, -'.disabled'.length)) : `${from}.disabled`;
  fs.renameSync(from, to);
  return path.basename(to);
}

async function deleteContentItem(id, kind, name) {
  await fsp.rm(path.join(contentFolderPath(id, kind), name), { recursive: true, force: true });
}

module.exports = {
  listInstances,
  getInstance,
  createInstance,
  updateInstance,
  deleteInstance,
  duplicateInstance,
  exportInstance,
  importInstance,
  listGroups,
  createGroup,
  renameGroup,
  deleteGroup,
  moveInstanceToGroup,
  reorderInstances,
  listContentFolder,
  toggleContentItem,
  deleteContentItem,
};
