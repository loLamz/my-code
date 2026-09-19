'use strict';

function menuDefs() {
  const hasSelection = !!State.selectedId;
  const running = State.selectedId && State.runningIds.has(State.selectedId);
  return [
    {
      label: 'File',
      items: [
        { label: 'Add Instance...', action: () => Actions.newInstance(), icon: 'add' },
        { label: 'Import Instance...', action: () => Actions.importInstance(), icon: 'importIcon' },
        { sep: true },
        { label: 'Settings...', action: () => Actions.openSettings(), icon: 'settings' },
        { sep: true },
        { label: 'Exit', action: () => Api.window.close() },
      ],
    },
    {
      label: 'Instance',
      items: [
        { label: 'Launch', action: () => Actions.launchSelected(), disabled: !hasSelection || running, icon: 'play' },
        { label: 'Kill', action: () => Actions.killSelected(), disabled: !running, icon: 'stop' },
        { sep: true },
        { label: 'Edit / Manage...', action: () => Actions.openDetail(), disabled: !hasSelection, icon: 'edit' },
        { label: 'Change Group...', action: () => Actions.changeGroupSelected(), disabled: !hasSelection, icon: 'group' },
        { sep: true },
        { label: 'Open Folder', action: () => Actions.openFolderSelected(), disabled: !hasSelection, icon: 'folder' },
        { label: 'Export...', action: () => Actions.exportSelected(), disabled: !hasSelection, icon: 'exportIcon' },
        { label: 'Duplicate...', action: () => Actions.duplicateSelected(), disabled: !hasSelection, icon: 'copy' },
        { label: 'Create Shortcut', action: () => Actions.createShortcutSelected(), disabled: !hasSelection, icon: 'shortcut' },
        { sep: true },
        { label: 'Delete...', action: () => Actions.deleteSelected(), disabled: !hasSelection, icon: 'trash' },
      ],
    },
    {
      label: 'Account',
      items: [
        { label: 'Manage Accounts...', action: () => Actions.openSettings('accounts'), icon: 'accounts' },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Instance Grid', action: () => setView('grid') },
        { label: 'Refresh', action: () => refreshInstances(), icon: 'refresh' },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'About CircuitMC', action: () => Actions.openAbout(), icon: 'help' },
      ],
    },
  ];
}

let openMenuIndex = null;

function renderMenubar() {
  const bar = document.getElementById('menubar');
  bar.innerHTML = '';
  const defs = menuDefs();

  defs.forEach((menu, index) => {
    const item = document.createElement('div');
    item.className = `menu-item${openMenuIndex === index ? ' open' : ''}`;
    item.textContent = menu.label;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      openMenuIndex = openMenuIndex === index ? null : index;
      renderMenubar();
    });
    bar.appendChild(item);

    if (openMenuIndex === index) {
      const dropdown = document.createElement('div');
      dropdown.className = 'menu-dropdown';
      dropdown.style.left = `${item.offsetLeft}px`;
      for (const entry of menu.items) {
        if (entry.sep) {
          dropdown.appendChild(el('<div class="menu-sep"></div>'));
          continue;
        }
        const row = document.createElement('div');
        row.className = `menu-entry${entry.disabled ? ' disabled' : ''}`;
        row.innerHTML = entry.label;
        if (!entry.disabled) {
          row.addEventListener('click', () => {
            openMenuIndex = null;
            renderMenubar();
            entry.action();
          });
        }
        dropdown.appendChild(row);
      }
      bar.appendChild(dropdown);
    }
  });
}

document.addEventListener('click', () => {
  if (openMenuIndex !== null) {
    openMenuIndex = null;
    renderMenubar();
  }
});
