'use strict';

function renderSidebar() {
  const ctx = document.getElementById('sidebar-context');
  ctx.innerHTML = '';

  const instance = getSelectedInstance();
  if (!instance) {
    ctx.appendChild(el(`
      <div class="sidebar-empty-hint">
        Select an instance to see its actions, or create a new one to get started.
      </div>
    `));
    const addBtn = el(`<button class="action-btn primary-action">${iconHtml('add')}<span>Add Instance</span></button>`);
    addBtn.addEventListener('click', () => Actions.newInstance());
    ctx.appendChild(addBtn);
    return;
  }

  const running = State.runningIds.has(instance.id);

  const card = el(`
    <div class="selected-instance-card">
      ${loaderBadgeSvg(instance.icon || instance.loader, 34)}
      <div>
        <div class="name">${escapeHtml(instance.name)}</div>
        <div class="meta">${escapeHtml(instance.mcVersion)} &middot; ${loaderLabel(instance.loader)}</div>
      </div>
    </div>
  `);
  ctx.appendChild(card);

  const list = document.createElement('div');
  list.className = 'action-list';

  function group(buttons) {
    const g = document.createElement('div');
    g.className = 'action-group';
    for (const b of buttons) g.appendChild(b);
    list.appendChild(g);
  }

  function actionBtn(icon, label, handler, opts = {}) {
    const btn = el(`<button class="action-btn${opts.primary ? ' primary-action' : ''}${opts.danger ? ' danger' : ''}">${iconHtml(icon)}<span>${label}</span></button>`);
    if (opts.disabled) btn.disabled = true;
    btn.addEventListener('click', handler);
    return btn;
  }

  group([
    running
      ? actionBtn('stop', 'Kill', () => Actions.killSelected(), { danger: true })
      : actionBtn('play', instance.installed ? 'Launch' : 'Install && Launch', () => Actions.launchSelected(), { primary: true }),
  ]);

  group([
    actionBtn('edit', 'Edit', () => Actions.openDetail()),
    actionBtn('group', 'Change Group', () => Actions.changeGroupSelected()),
  ]);

  group([
    actionBtn('folder', 'Folder', () => Actions.openFolderSelected()),
    actionBtn('exportIcon', 'Export', () => Actions.exportSelected()),
    actionBtn('copy', 'Copy', () => Actions.duplicateSelected()),
  ]);

  group([
    actionBtn('trash', 'Delete', () => Actions.deleteSelected(), { danger: true }),
    actionBtn('shortcut', 'Create Shortcut', () => Actions.createShortcutSelected()),
  ]);

  ctx.appendChild(list);
}
