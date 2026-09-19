'use strict';

let detailActiveTab = 'overview';
const consoleLines = [];

const DETAIL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'mods', label: 'Mods', kind: 'mods', loaderOnly: true },
  { id: 'resourcepacks', label: 'Resource Packs', kind: 'resourcepacks' },
  { id: 'shaderpacks', label: 'Shaderpacks', kind: 'shaderpacks' },
  { id: 'worlds', label: 'Worlds', kind: 'saves' },
  { id: 'settings', label: 'Java & Memory' },
  { id: 'console', label: 'Console' },
];

function renderInstanceDetailView() {
  const gridView = document.getElementById('grid-view');
  const detailView = document.getElementById('detail-view');

  if (State.view !== 'detail') {
    detailView.classList.add('hidden');
    gridView.classList.remove('hidden');
    return;
  }
  gridView.classList.add('hidden');
  detailView.classList.remove('hidden');

  const instance = getSelectedInstance();
  if (!instance) {
    setView('grid');
    return;
  }

  detailView.innerHTML = '';

  const header = el(`
    <div class="detail-header">
      <button class="back-btn">${iconHtml('back')}</button>
      ${loaderBadgeSvg(instance.icon || instance.loader, 30)}
      <div>
        <div class="detail-title">${escapeHtml(instance.name)}</div>
        <div class="detail-sub">${escapeHtml(instance.mcVersion)} &middot; ${loaderLabel(instance.loader)}${instance.loaderVersion ? ' ' + escapeHtml(instance.loaderVersion) : ''}</div>
      </div>
    </div>
  `);
  header.querySelector('.back-btn').addEventListener('click', () => setView('grid'));
  detailView.appendChild(header);

  const tabsBar = document.createElement('div');
  tabsBar.className = 'tabs';
  const visibleTabs = DETAIL_TABS.filter((t) => !t.loaderOnly || instance.loader !== 'vanilla');
  for (const tab of visibleTabs) {
    const btn = el(`<button class="tab-btn${detailActiveTab === tab.id ? ' active' : ''}">${tab.label}</button>`);
    btn.addEventListener('click', () => {
      detailActiveTab = tab.id;
      renderInstanceDetailView();
    });
    tabsBar.appendChild(btn);
  }
  detailView.appendChild(tabsBar);

  const body = document.createElement('div');
  body.className = 'detail-body';
  detailView.appendChild(body);

  const activeTab = visibleTabs.find((t) => t.id === detailActiveTab) || visibleTabs[0];
  if (activeTab.id === 'overview') renderOverviewTab(body, instance);
  else if (activeTab.id === 'settings') renderJavaSettingsTab(body, instance);
  else if (activeTab.id === 'console') renderConsoleTab(body, instance);
  else renderContentTab(body, instance, activeTab.kind, activeTab.label);
}

function renderOverviewTab(body, instance) {
  const installed = instance.installed;
  body.appendChild(el(`
    <div class="field-row">
      <div class="field">
        <label>Name</label>
        <input type="text" id="ov-name" value="${escapeHtml(instance.name)}" />
      </div>
      <div class="field">
        <label>Group</label>
        <select id="ov-group"></select>
      </div>
    </div>
  `));
  const groupSelect = body.querySelector('#ov-group');
  for (const g of State.groups) {
    const opt = el(`<option value="${g.id}">${escapeHtml(g.name)}</option>`);
    if (g.id === instance.groupId) opt.selected = true;
    groupSelect.appendChild(opt);
  }

  body.appendChild(el(`
    <div class="field-row">
      <div class="field"><label>Minecraft Version</label><div class="chip">${escapeHtml(instance.mcVersion)}</div></div>
      <div class="field"><label>Mod Loader</label><div class="chip">${loaderLabel(instance.loader)}${instance.loaderVersion ? ' ' + escapeHtml(instance.loaderVersion) : ''}</div></div>
      <div class="field"><label>Status</label><div class="chip">${installed ? 'Installed' : 'Not installed'}</div></div>
    </div>
  `));

  body.appendChild(el(`
    <div class="field">
      <label>Notes</label>
      <textarea id="ov-notes" rows="3" placeholder="Anything you want to remember about this instance...">${escapeHtml(instance.notes || '')}</textarea>
    </div>
  `));

  const saveBtn = el(`<button class="btn primary">${iconHtml('check')}<span>Save</span></button>`);
  saveBtn.addEventListener('click', async () => {
    await Api.instances.update(instance.id, {
      name: body.querySelector('#ov-name').value.trim() || instance.name,
      groupId: groupSelect.value,
      notes: body.querySelector('#ov-notes').value,
    });
    await refreshInstances();
    setStatus(`Saved ${instance.name}.`);
    renderInstanceDetailView();
  });
  body.appendChild(saveBtn);

  if (!installed) {
    body.appendChild(el(`
      <div class="hint" style="margin-top:14px;max-width:420px;">
        This instance hasn't been installed yet. Press Launch from the sidebar
        (or Install below) to download the Minecraft files, libraries and mod
        loader it needs.
      </div>
    `));
    const installBtn = el(`<button class="btn" style="margin-top:8px;">${iconHtml('refresh')}<span>Install Now</span></button>`);
    installBtn.addEventListener('click', () => Actions.installSelected());
    body.appendChild(installBtn);
  }
}

function renderJavaSettingsTab(body, instance) {
  body.appendChild(el(`
    <div class="field">
      <label>Java Executable</label>
      <div style="display:flex;gap:8px;">
        <input type="text" id="j-path" value="${escapeHtml(instance.javaPath || '')}" placeholder="Auto-detect (recommended)" style="flex:1" />
        <button class="btn small" id="j-browse">Browse...</button>
      </div>
      <div class="hint">Leave blank to let CircuitMC pick the best installed Java automatically.</div>
    </div>
  `));
  body.querySelector('#j-browse').addEventListener('click', async () => {
    const picked = await Api.java.pickManually();
    if (picked) body.querySelector('#j-path').value = picked;
  });

  body.appendChild(el(`
    <div class="field-row">
      <div class="field">
        <label>Min Memory (MB)</label>
        <input type="number" id="j-min" value="${instance.javaMinMb}" step="256" min="256" />
      </div>
      <div class="field">
        <label>Max Memory (MB)</label>
        <input type="number" id="j-max" value="${instance.javaMaxMb}" step="256" min="512" />
      </div>
    </div>
  `));

  body.appendChild(el(`
    <div class="field">
      <label>Extra JVM Arguments</label>
      <input type="text" id="j-args" value="${escapeHtml(instance.jvmArgs || '')}" placeholder="-XX:+UseG1GC ..." />
    </div>
  `));

  body.appendChild(el(`
    <div class="field-row">
      <div class="field">
        <label>Window Width</label>
        <input type="number" id="j-w" value="${(instance.resolution && instance.resolution.width) || 854}" />
      </div>
      <div class="field">
        <label>Window Height</label>
        <input type="number" id="j-h" value="${(instance.resolution && instance.resolution.height) || 480}" />
      </div>
    </div>
  `));

  const saveBtn = el(`<button class="btn primary">${iconHtml('check')}<span>Save Settings</span></button>`);
  saveBtn.addEventListener('click', async () => {
    await Api.instances.update(instance.id, {
      javaPath: body.querySelector('#j-path').value.trim(),
      javaMinMb: parseInt(body.querySelector('#j-min').value, 10) || 1024,
      javaMaxMb: parseInt(body.querySelector('#j-max').value, 10) || 4096,
      jvmArgs: body.querySelector('#j-args').value,
      resolution: {
        width: parseInt(body.querySelector('#j-w').value, 10) || 854,
        height: parseInt(body.querySelector('#j-h').value, 10) || 480,
      },
    });
    await refreshInstances();
    setStatus('Java & memory settings saved.');
  });
  body.appendChild(saveBtn);
}

async function renderContentTab(body, instance, kind, label) {
  body.appendChild(el(`<div class="hint" style="margin-bottom:8px;">Files in this instance's own <span class="mono">${kind}</span> folder -- separate from every other instance.</div>`));
  const list = el('<div class="item-list"></div>');
  body.appendChild(list);

  const items = await Api.instances.listContent(instance.id, kind);
  if (items.length === 0) {
    list.appendChild(el(`<div class="item-row"><span class="item-name" style="color:var(--text-faint)">No ${label.toLowerCase()} yet. Drop files into the instance folder, or use Folder in the sidebar.</span></div>`));
  }
  for (const item of items) {
    const row = el(`
      <div class="item-row">
        <span class="item-name">${escapeHtml(item.name)}</span>
        <span class="item-tag${item.enabled ? '' : ' warn'}">${item.enabled ? 'enabled' : 'disabled'}</span>
      </div>
    `);
    if (kind === 'mods') {
      const toggleBtn = el(`<button class="btn small">${item.enabled ? 'Disable' : 'Enable'}</button>`);
      toggleBtn.addEventListener('click', async () => {
        await Api.instances.toggleContent(instance.id, kind, item.name);
        renderInstanceDetailView();
      });
      row.appendChild(toggleBtn);
    }
    const delBtn = el(`<button class="btn small danger">${iconHtml('trash')}</button>`);
    delBtn.addEventListener('click', async () => {
      await Api.instances.deleteContent(instance.id, kind, item.name);
      renderInstanceDetailView();
    });
    row.appendChild(delBtn);
    list.appendChild(row);
  }

  const openFolderBtn = el(`<button class="btn" style="margin-top:10px;">${iconHtml('folder')}<span>Open ${label} Folder</span></button>`);
  openFolderBtn.addEventListener('click', () => Actions.openFolderSelected());
  body.appendChild(openFolderBtn);
}

function renderConsoleTab(body, instance) {
  body.style.padding = '0';
  body.style.display = 'flex';
  const view = el('<div class="console-view"></div>');
  for (const line of consoleLines.filter((l) => l.instanceId === instance.id)) {
    view.appendChild(el(`<div class="line ${line.stream}">${escapeHtml(line.text)}</div>`));
  }
  view.scrollTop = view.scrollHeight;
  body.appendChild(view);
}

function pushConsoleLine(instanceId, stream, text) {
  for (const line of text.split(/\r?\n/)) {
    if (line) consoleLines.push({ instanceId, stream, text: line });
  }
  if (consoleLines.length > 4000) consoleLines.splice(0, consoleLines.length - 4000);
  if (State.view === 'detail' && detailActiveTab === 'console' && getSelectedInstance()?.id === instanceId) {
    renderInstanceDetailView();
  }
}
