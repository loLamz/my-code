'use strict';

const Actions = {
  newInstance() {
    openAddInstanceDialog();
  },

  importInstance() {
    (async () => {
      setStatus('Importing instance...');
      const imported = await Api.instances.import();
      if (imported) {
        await refreshInstances();
        selectInstance(imported.id);
        setStatus(`Imported ${imported.name}.`);
      } else {
        setStatus('Ready.');
      }
    })().catch((err) => reportError(err));
  },

  openDetail() {
    if (!State.selectedId) return;
    setView('detail');
  },

  openSettings(tab) {
    openSettingsDialog(tab);
  },

  openAbout() {
    openSettingsDialog('about');
  },

  newGroup() {
    promptDialog({
      title: 'New Group',
      label: 'Group Name',
      placeholder: 'e.g. Survival, Modded, Testing',
      confirmLabel: 'Create',
      onConfirm: async (name) => {
        await Api.groups.create(name);
        await refreshInstances();
        setStatus(`Created group "${name}".`);
      },
    });
  },

  renameGroup(group) {
    promptDialog({
      title: 'Rename Group',
      label: 'Group Name',
      defaultValue: group.name,
      confirmLabel: 'Rename',
      onConfirm: async (name) => {
        await Api.groups.rename(group.id, name);
        await refreshInstances();
      },
    });
  },

  deleteGroup(group) {
    confirmDialog({
      title: 'Delete Group',
      message: `Delete "${escapeHtml(group.name)}"? Instances inside it will move back to the default group -- they will not be deleted.`,
      confirmLabel: 'Delete Group',
      danger: true,
      onConfirm: async () => {
        await Api.groups.delete(group.id);
        await refreshInstances();
      },
    });
  },

  changeGroupSelected() {
    const instance = getSelectedInstance();
    if (instance) changeGroupDialog(instance);
  },

  async installSelected() {
    const instance = getSelectedInstance();
    if (!instance) return;
    try {
      await installInstance(instance);
    } catch (err) {
      reportError(err);
    }
  },

  async launchSelected() {
    const instance = getSelectedInstance();
    if (!instance) return;
    try {
      if (!instance.installed) {
        await installInstance(instance);
      }
      setStatus(`Launching ${instance.name}...`);
      await Api.instances.launch(instance.id);
      State.runningIds.add(instance.id);
      notify();
      setStatus(`${instance.name} is running.`);
      if (State.settings && State.settings.closeLauncherOnLaunch) Api.window.close();
    } catch (err) {
      reportError(err);
    }
  },

  async killSelected() {
    const instance = getSelectedInstance();
    if (!instance) return;
    await Api.instances.kill(instance.id);
    State.runningIds.delete(instance.id);
    notify();
    setStatus(`Killed ${instance.name}.`);
  },

  async openFolderSelected() {
    const instance = getSelectedInstance();
    if (!instance) return;
    await Api.instances.openFolder(instance.id);
  },

  openInstancesRoot() {
    Api.app.openInstancesRoot();
  },

  exportSelected() {
    (async () => {
      const instance = getSelectedInstance();
      if (!instance) return;
      setStatus(`Exporting ${instance.name}...`);
      const result = await Api.instances.export(instance.id);
      setStatus(result ? `Exported ${instance.name}.` : 'Ready.');
    })().catch((err) => reportError(err));
  },

  duplicateSelected() {
    const instance = getSelectedInstance();
    if (!instance) return;
    promptDialog({
      title: 'Duplicate Instance',
      label: 'New Instance Name',
      defaultValue: `${instance.name} Copy`,
      confirmLabel: 'Duplicate',
      onConfirm: async (name) => {
        setStatus(`Duplicating ${instance.name}...`);
        const clone = await Api.instances.duplicate(instance.id, name);
        await refreshInstances();
        selectInstance(clone.id);
        setStatus(`Created ${name}.`);
      },
    });
  },

  createShortcutSelected() {
    (async () => {
      const instance = getSelectedInstance();
      if (!instance) return;
      await Api.instances.createShortcut(instance.id);
      setStatus(`Created a desktop shortcut for ${instance.name}.`);
    })().catch((err) => reportError(err));
  },

  deleteSelected() {
    const instance = getSelectedInstance();
    if (!instance) return;
    confirmDialog({
      title: 'Delete Instance',
      message: `Permanently delete "<b>${escapeHtml(instance.name)}</b>"? This removes its mods, worlds, config and all other data. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        await Api.instances.delete(instance.id);
        if (State.selectedId === instance.id) {
          State.selectedId = null;
          setView('grid');
        }
        await refreshInstances();
        setStatus(`Deleted ${instance.name}.`);
      },
    });
  },
};

async function installInstance(instance) {
  setStatus(`Installing ${instance.name}...`, 0);
  const off = Api.events.onInstallProgress((p) => {
    if (p.instanceId !== instance.id) return;
    const pct = p.total ? Math.round((p.completed / p.total) * 100) : null;
    setStatus(`Installing ${instance.name}: ${p.message || p.phase}`, pct);
  });
  try {
    await Api.instances.install(instance.id);
    await refreshInstances();
    setStatus(`${instance.name} installed.`, null);
  } finally {
    off();
  }
}

function reportError(err) {
  console.error(err);
  setStatus(`Error: ${err.message}`, null);
}

function renderAll() {
  renderMenubar();
  renderSidebar();
  renderInstanceGrid();
  renderInstanceDetailView();
  renderToolbar();
  renderStatusbar();
}

function wireWindowControls() {
  document.getElementById('btn-minimize').addEventListener('click', () => Api.window.minimize());
  document.getElementById('btn-maximize').addEventListener('click', () => Api.window.maximize());
  document.getElementById('btn-close').addEventListener('click', () => Api.window.close());
}

function wireBackendEvents() {
  Api.events.onInstanceLog(({ instanceId, stream, text }) => pushConsoleLine(instanceId, stream, text));
  Api.events.onInstanceExit(({ instanceId }) => {
    State.runningIds.delete(instanceId);
    notify();
    setStatus('Ready.');
  });
}

async function init() {
  subscribe(renderAll);
  wireWindowControls();
  wireBackendEvents();

  try {
    window.__appVersion = await Api.app.getVersion();
  } catch (_) {
    window.__appVersion = '';
  }
  if (IS_MOCK) {
    console.info('CircuitMC: running against the in-browser mock backend (no Electron detected).');
  }

  await refreshSettings();
  await refreshInstances();

  for (const instance of State.instances) {
    try {
      if (await Api.instances.isRunning(instance.id)) State.runningIds.add(instance.id);
    } catch (_) {
      /* ignore */
    }
  }
  notify();
  setStatus('Ready.');
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch((err) => {
    console.error(err);
    setStatus(`Startup error: ${err.message}`);
  });
});
