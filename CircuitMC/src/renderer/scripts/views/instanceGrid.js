'use strict';

let draggedInstanceId = null;

function renderInstanceGrid() {
  const scroll = document.getElementById('instance-scroll');
  scroll.innerHTML = '';

  if (State.instances.length === 0) {
    scroll.appendChild(el(`
      <div class="empty-state">
        <div>No instances yet.</div>
        <div>Create your first Minecraft instance to get started -- pick a version, a mod loader, and CircuitMC handles the rest.</div>
        <button class="btn primary" id="empty-add-btn">${iconHtml('add')}<span>Add Instance</span></button>
      </div>
    `));
    scroll.querySelector('#empty-add-btn').addEventListener('click', () => Actions.newInstance());
    return;
  }

  const topRow = el('<div style="display:flex;justify-content:flex-end;margin-bottom:6px;"></div>');
  const newGroupBtn = el(`<button class="btn ghost small">${iconHtml('plus')}<span>New Group</span></button>`);
  newGroupBtn.addEventListener('click', () => Actions.newGroup());
  topRow.appendChild(newGroupBtn);
  scroll.appendChild(topRow);

  const groups = State.groups.slice().sort((a, b) => a.order - b.order);
  for (const group of groups) {
    const members = State.instances.filter((i) => i.groupId === group.id);
    if (members.length === 0 && group.id !== 'default') continue;

    const collapsed = State.collapsedGroups.has(group.id);
    const section = document.createElement('div');
    section.className = 'group-section';

    const header = el(`
      <div class="group-header" data-group="${group.id}">
        <span class="twist">${iconHtml(collapsed ? 'twist' : 'twistOpen')}</span>
        <span>${escapeHtml(group.name)}</span>
        <span class="count">(${members.length})</span>
      </div>
    `);
    header.addEventListener('click', () => {
      if (collapsed) State.collapsedGroups.delete(group.id);
      else State.collapsedGroups.add(group.id);
      renderInstanceGrid();
    });
    header.addEventListener('dragover', (e) => {
      if (!draggedInstanceId) return;
      e.preventDefault();
      header.classList.add('drop-target');
    });
    header.addEventListener('dragleave', () => header.classList.remove('drop-target'));
    header.addEventListener('drop', async (e) => {
      e.preventDefault();
      header.classList.remove('drop-target');
      if (draggedInstanceId) {
        await Api.groups.moveInstance(draggedInstanceId, group.id);
        draggedInstanceId = null;
        await refreshInstances();
      }
    });
    header.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showGroupContextMenu(e.clientX, e.clientY, group);
    });
    section.appendChild(header);

    const tileGrid = document.createElement('div');
    tileGrid.className = `tile-grid${collapsed ? ' collapsed' : ''}`;
    for (const instance of members) {
      tileGrid.appendChild(buildTile(instance));
    }
    section.appendChild(tileGrid);
    scroll.appendChild(section);
  }
}

function buildTile(instance) {
  const running = State.runningIds.has(instance.id);
  const tile = document.createElement('div');
  tile.className = `instance-tile${State.selectedId === instance.id ? ' selected' : ''}`;
  tile.draggable = true;
  tile.innerHTML = `
    <div class="tile-icon-wrap">
      ${loaderBadgeSvg(instance.icon || instance.loader, 42)}
      ${running ? '<span class="running-dot"></span>' : ''}
    </div>
    <div class="tile-name">${escapeHtml(instance.name)}</div>
    <div class="tile-sub">${escapeHtml(instance.mcVersion)}</div>
  `;
  tile.addEventListener('click', () => selectInstance(instance.id));
  tile.addEventListener('dblclick', () => {
    selectInstance(instance.id);
    Actions.launchSelected();
  });
  tile.addEventListener('dragstart', (e) => {
    draggedInstanceId = instance.id;
    e.dataTransfer.effectAllowed = 'move';
  });
  tile.addEventListener('dragend', () => {
    draggedInstanceId = null;
  });
  tile.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    selectInstance(instance.id);
    showInstanceContextMenu(e.clientX, e.clientY, instance);
  });
  return tile;
}

function showInstanceContextMenu(x, y, instance) {
  const running = State.runningIds.has(instance.id);
  const entries = [
    running
      ? { label: 'Kill', icon: 'stop', action: () => Actions.killSelected() }
      : { label: 'Launch', icon: 'play', action: () => Actions.launchSelected() },
    { label: 'Edit', icon: 'edit', action: () => Actions.openDetail() },
    { sep: true },
    { label: 'Open Folder', icon: 'folder', action: () => Actions.openFolderSelected() },
    { label: 'Duplicate...', icon: 'copy', action: () => Actions.duplicateSelected() },
    { label: 'Export...', icon: 'exportIcon', action: () => Actions.exportSelected() },
    { label: 'Move to Group...', icon: 'group', action: () => Actions.changeGroupSelected() },
    { label: 'Create Shortcut', icon: 'shortcut', action: () => Actions.createShortcutSelected() },
    { sep: true },
    { label: 'Delete...', icon: 'trash', danger: true, action: () => Actions.deleteSelected() },
  ];
  showContextMenu(x, y, entries);
}

function showGroupContextMenu(x, y, group) {
  const entries = [
    { label: 'Rename Group...', icon: 'edit', action: () => Actions.renameGroup(group) },
  ];
  if (group.id !== 'default') {
    entries.push({ label: 'Delete Group', icon: 'trash', danger: true, action: () => Actions.deleteGroup(group) });
  }
  showContextMenu(x, y, entries);
}

function showContextMenu(x, y, entries) {
  const existing = document.querySelector('.context-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  for (const entry of entries) {
    if (entry.sep) {
      menu.appendChild(el('<div class="menu-sep"></div>'));
      continue;
    }
    const row = el(`<div class="menu-entry${entry.danger ? ' danger' : ''}">${iconHtml(entry.icon)}<span style="margin-left:8px">${entry.label}</span></div>`);
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.addEventListener('click', () => {
      menu.remove();
      entry.action();
    });
    menu.appendChild(row);
  }
  document.getElementById('context-menu-root').appendChild(menu);

  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(x, window.innerWidth - rect.width - 8)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - rect.height - 8)}px`;

  const closeOnClick = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('mousedown', closeOnClick);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', closeOnClick), 0);
}
