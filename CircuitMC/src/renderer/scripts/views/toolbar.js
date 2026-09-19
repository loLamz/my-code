'use strict';

let accountsMenuOpen = false;

function renderToolbar() {
  const bar = document.getElementById('toolbar');
  bar.innerHTML = '';

  const addBtn = el(`<button class="toolbar-btn">${iconHtml('add')}<span>Add Instance</span></button>`);
  addBtn.addEventListener('click', () => Actions.newInstance());

  const foldersBtn = el(`<button class="toolbar-btn">${iconHtml('folder')}<span>Folders</span></button>`);
  foldersBtn.addEventListener('click', () => Actions.openInstancesRoot());

  const settingsBtn = el(`<button class="toolbar-btn">${iconHtml('settings')}<span>Settings</span></button>`);
  settingsBtn.addEventListener('click', () => Actions.openSettings());

  const helpBtn = el(`<button class="toolbar-btn">${iconHtml('help')}<span>Help</span></button>`);
  helpBtn.addEventListener('click', () => Actions.openAbout());

  bar.appendChild(addBtn);
  bar.appendChild(foldersBtn);
  bar.appendChild(settingsBtn);
  bar.appendChild(helpBtn);

  const spacer = el('<div class="toolbar-spacer"></div>');
  bar.appendChild(spacer);

  bar.appendChild(buildAccountsControl());
}

function buildAccountsControl() {
  const wrap = document.createElement('div');
  wrap.style.position = 'relative';

  const account = activeAccount();
  const label = account ? account.username : 'No Account';
  const btn = el(`<button class="toolbar-btn">${iconHtml('accounts')}<span>${escapeHtml(label)}</span>${iconHtml('chevronDown')}</button>`);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    accountsMenuOpen = !accountsMenuOpen;
    renderToolbar();
  });
  wrap.appendChild(btn);

  if (accountsMenuOpen) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.position = 'absolute';
    menu.style.bottom = '32px';
    menu.style.right = '0';

    const accounts = (State.settings && State.settings.accounts) || [];
    if (accounts.length === 0) {
      menu.appendChild(el('<div class="menu-entry" style="color:var(--text-faint)">No accounts yet</div>'));
    }
    for (const acc of accounts) {
      const row = el(`<div class="menu-entry">${acc.id === State.settings.activeAccountId ? iconHtml('check') : '<span class="icon"></span>'} ${escapeHtml(acc.username)} <span class="item-tag" style="margin-left:6px">${acc.type}</span></div>`);
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '6px';
      row.addEventListener('click', async () => {
        await Api.accounts.setActive(acc.id);
        accountsMenuOpen = false;
        await refreshSettings();
        renderToolbar();
      });
      menu.appendChild(row);
    }
    menu.appendChild(el('<div class="menu-sep"></div>'));
    const manage = el(`<div class="menu-entry">${iconHtml('settings')} Manage Accounts...</div>`);
    manage.style.display = 'flex';
    manage.style.gap = '6px';
    manage.addEventListener('click', () => {
      accountsMenuOpen = false;
      renderToolbar();
      Actions.openSettings('accounts');
    });
    menu.appendChild(manage);

    wrap.appendChild(menu);
  }

  return wrap;
}

document.addEventListener('click', () => {
  if (accountsMenuOpen) {
    accountsMenuOpen = false;
    renderToolbar();
  }
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
