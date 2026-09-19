'use strict';

const State = {
  instances: [],
  groups: [],
  selectedId: null,
  collapsedGroups: new Set(),
  runningIds: new Set(),
  settings: null,
  view: 'grid', // 'grid' | 'detail'
  listeners: new Set(),
};

function subscribe(fn) {
  State.listeners.add(fn);
  return () => State.listeners.delete(fn);
}

function notify() {
  for (const fn of State.listeners) fn(State);
}

async function refreshInstances() {
  State.instances = await Api.instances.list();
  State.groups = await Api.groups.list();
  notify();
}

async function refreshSettings() {
  State.settings = await Api.settings.get();
  notify();
}

function getSelectedInstance() {
  return State.instances.find((i) => i.id === State.selectedId) || null;
}

function selectInstance(id) {
  State.selectedId = id;
  notify();
}

function setView(view) {
  State.view = view;
  notify();
}

function activeAccount() {
  if (!State.settings) return null;
  return State.settings.accounts.find((a) => a.id === State.settings.activeAccountId) || State.settings.accounts[0] || null;
}
