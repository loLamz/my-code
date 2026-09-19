'use strict';

function openSettingsDialog(initialTab = 'general') {
  let activeTab = initialTab;

  openDialog({
    title: 'Settings',
    wide: true,
    render(dialog) {
      const wrap = el('<div class="settings-body-wrap"></div>');
      const tabsCol = el('<div class="settings-tabs"></div>');
      const panel = el('<div class="settings-panel"></div>');
      wrap.appendChild(tabsCol);
      wrap.appendChild(panel);
      dialog.appendChild(wrap);

      const tabs = [
        { id: 'general', label: 'General' },
        { id: 'java', label: 'Java & Memory' },
        { id: 'accounts', label: 'Accounts' },
        { id: 'about', label: 'About' },
      ];

      function renderTabs() {
        tabsCol.innerHTML = '';
        for (const t of tabs) {
          const btn = el(`<button class="action-btn${activeTab === t.id ? ' primary-action' : ''}">${t.label}</button>`);
          btn.addEventListener('click', () => {
            activeTab = t.id;
            renderTabs();
            renderPanel();
          });
          tabsCol.appendChild(btn);
        }
      }

      function renderPanel() {
        panel.innerHTML = '';
        if (activeTab === 'general') renderGeneralPanel(panel);
        else if (activeTab === 'java') renderJavaPanel(panel);
        else if (activeTab === 'accounts') renderAccountsPanel(panel);
        else renderAboutPanel(panel);
      }

      renderTabs();
      renderPanel();
    },
  });
}

function renderGeneralPanel(panel) {
  const s = State.settings;
  panel.appendChild(el(`
    <div class="field-row">
      <div class="field">
        <label>Default Min Memory (MB)</label>
        <input type="number" id="s-min" value="${s.defaultRamMin}" step="256" />
      </div>
      <div class="field">
        <label>Default Max Memory (MB)</label>
        <input type="number" id="s-max" value="${s.defaultRamMax}" step="256" />
      </div>
    </div>
  `));
  panel.appendChild(el(`
    <div>
      <label class="checkbox-row"><input type="checkbox" id="s-keep-console" ${s.keepConsoleOpen ? 'checked' : ''}/> Keep console output for launched instances</label>
      <label class="checkbox-row"><input type="checkbox" id="s-close-on-launch" ${s.closeLauncherOnLaunch ? 'checked' : ''}/> Close CircuitMC after launching a game</label>
    </div>
  `));
  panel.appendChild(el(`
    <div class="field">
      <label>Microsoft Sign-In Client ID <span class="hint">(optional, advanced)</span></label>
      <input type="text" id="s-msa" value="${escapeHtml(s.msaClientId || '')}" placeholder="Paste your own registered Azure AD app client ID" />
      <div class="hint">CircuitMC ships without a bundled Microsoft app registration. Offline accounts work out of the box; real Microsoft/Xbox sign-in needs your own Azure AD client ID here.</div>
    </div>
  `));

  const saveBtn = el(`<button class="btn primary">${iconHtml('check')}<span>Save</span></button>`);
  saveBtn.addEventListener('click', async () => {
    await Api.settings.save({
      defaultRamMin: parseInt(panel.querySelector('#s-min').value, 10) || 1024,
      defaultRamMax: parseInt(panel.querySelector('#s-max').value, 10) || 4096,
      keepConsoleOpen: panel.querySelector('#s-keep-console').checked,
      closeLauncherOnLaunch: panel.querySelector('#s-close-on-launch').checked,
      msaClientId: panel.querySelector('#s-msa').value.trim(),
    });
    await refreshSettings();
    setStatus('Settings saved.');
  });
  panel.appendChild(saveBtn);
}

async function renderJavaPanel(panel) {
  const s = State.settings;
  panel.appendChild(el(`
    <div>
      <div class="field">
        <label>Global Java Override</label>
        <div style="display:flex;gap:8px;">
          <input type="text" id="s-java" value="${escapeHtml(s.globalJavaPath || '')}" placeholder="Auto-detect (recommended)" style="flex:1" />
          <button class="btn small" id="s-java-browse">Browse...</button>
        </div>
        <div class="hint">Individual instances can still override this in their own Java &amp; Memory tab.</div>
      </div>
      <div class="field"><label>Detected Java Installations</label><div class="item-list" id="s-java-list"></div></div>
    </div>
  `));

  panel.querySelector('#s-java-browse').addEventListener('click', async () => {
    const picked = await Api.java.pickManually();
    if (picked) panel.querySelector('#s-java').value = picked;
  });

  const saveBtn = el(`<button class="btn primary">${iconHtml('check')}<span>Save</span></button>`);
  saveBtn.addEventListener('click', async () => {
    await Api.settings.save({ globalJavaPath: panel.querySelector('#s-java').value.trim() });
    await refreshSettings();
    setStatus('Java settings saved.');
  });
  panel.appendChild(saveBtn);

  const list = panel.querySelector('#s-java-list');
  list.innerHTML = '<div class="item-row"><span class="item-name">Scanning for Java installs...</span></div>';
  const installs = await Api.java.findAll();
  list.innerHTML = '';
  if (installs.length === 0) {
    list.appendChild(el('<div class="item-row"><span class="item-name" style="color:var(--text-faint)">None found -- install a JDK, or set a path manually above.</span></div>'));
  }
  for (const info of installs) {
    list.appendChild(el(`
      <div class="item-row">
        ${iconHtml('java')}
        <span class="item-name">${escapeHtml(info.javaHome)}</span>
        <span class="item-tag">Java ${info.major}</span>
      </div>
    `));
  }
}

function renderAccountsPanel(panel) {
  const s = State.settings;
  panel.appendChild(el('<div class="field"><label>Accounts</label></div>'));
  const list = el('<div class="item-list"></div>');
  for (const acc of s.accounts) {
    const row = el(`
      <div class="item-row">
        ${iconHtml('accounts')}
        <span class="item-name">${escapeHtml(acc.username)}</span>
        <span class="item-tag">${acc.type}</span>
        ${acc.id === s.activeAccountId ? '<span class="item-tag" style="color:var(--accent);border-color:var(--accent-dim);">active</span>' : ''}
      </div>
    `);
    if (acc.id !== s.activeAccountId) {
      const useBtn = el('<button class="btn small">Use</button>');
      useBtn.addEventListener('click', async () => {
        await Api.accounts.setActive(acc.id);
        await refreshSettings();
        renderAccountsPanel(panel);
      });
      row.appendChild(useBtn);
    }
    const delBtn = el(`<button class="btn small danger">${iconHtml('trash')}</button>`);
    delBtn.addEventListener('click', async () => {
      await Api.accounts.remove(acc.id);
      await refreshSettings();
      panel.innerHTML = '';
      renderAccountsPanel(panel);
    });
    row.appendChild(delBtn);
    list.appendChild(row);
  }
  panel.appendChild(list);

  panel.appendChild(el(`
    <div class="field" style="margin-top:14px;">
      <label>Add Offline Account</label>
      <div style="display:flex;gap:8px;">
        <input type="text" id="acc-username" placeholder="Username" style="flex:1" />
        <button class="btn" id="acc-add">${iconHtml('add')}<span>Add</span></button>
      </div>
      <div class="hint">Offline accounts work immediately -- no sign-in required -- and let Minecraft launch with any username you choose.</div>
    </div>
  `));
  panel.querySelector('#acc-add').addEventListener('click', async () => {
    const input = panel.querySelector('#acc-username');
    const name = input.value.trim();
    if (!name) return;
    await Api.accounts.createOffline(name);
    await refreshSettings();
    panel.innerHTML = '';
    renderAccountsPanel(panel);
  });

  panel.appendChild(el(`
    <div class="field" style="margin-top:16px;">
      <label>Microsoft Account</label>
      <button class="btn" id="acc-msa">${iconHtml('accounts')}<span>Sign in with Microsoft...</span></button>
      <div class="hint" id="acc-msa-hint">Requires a Microsoft Sign-In Client ID under Settings &gt; General.</div>
    </div>
  `));
  panel.querySelector('#acc-msa').addEventListener('click', () => startMicrosoftSignInFlow(panel));
}

async function startMicrosoftSignInFlow(panel) {
  const hint = panel.querySelector('#acc-msa-hint');
  try {
    const device = await Api.accounts.startMicrosoftSignIn();
    hint.innerHTML = `Go to <b>${escapeHtml(device.verification_uri)}</b> and enter code <b class="mono">${escapeHtml(device.user_code)}</b>. Waiting for sign-in...`;
    const interval = setInterval(async () => {
      try {
        const result = await Api.accounts.pollMicrosoftSignIn(device.device_code);
        if (!result.pending) {
          clearInterval(interval);
          hint.textContent = `Signed in as ${result.account.username}.`;
          await refreshSettings();
        }
      } catch (err) {
        clearInterval(interval);
        hint.textContent = `Sign-in failed: ${err.message}`;
      }
    }, (device.interval || 5) * 1000);
  } catch (err) {
    hint.textContent = err.message;
  }
}

function renderAboutPanel(panel) {
  panel.appendChild(el(`
    <div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        <img src="assets/app-icon.png" width="48" height="48" />
        <div>
          <div style="font-size:15px;font-weight:700;">CircuitMC</div>
          <div class="hint">A from-scratch Minecraft instance launcher.</div>
        </div>
      </div>
      <div class="hint" style="max-width:420px;line-height:1.7;">
        Every instance keeps its own Minecraft version, mod loader, mods, worlds,
        resource packs, shaderpacks and Java settings, completely isolated from
        every other instance. Built with Electron.
      </div>
    </div>
  `));
}
