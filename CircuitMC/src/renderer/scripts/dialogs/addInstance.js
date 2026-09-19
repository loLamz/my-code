'use strict';

const WIZARD_STEPS = ['name', 'version', 'loader', 'loaderVersion', 'review'];

function openAddInstanceDialog() {
  const wizard = {
    name: '',
    groupId: (State.groups[0] && State.groups[0].id) || 'default',
    mcVersion: null,
    loader: 'vanilla',
    loaderVersion: null,
    stepIndex: 0,
    showSnapshots: false,
    versions: [],
  };

  let closeDialog;
  closeDialog = openDialog({
    title: 'Add Instance',
    wide: true,
    render(dialog) {
      const stepsBar = el('<div class="wizard-steps"></div>');
      const body = el('<div class="dialog-body"></div>');
      const footer = el('<div class="dialog-footer"></div>');
      dialog.appendChild(stepsBar);
      dialog.appendChild(body);
      dialog.appendChild(footer);

      function activeSteps() {
        if (wizard.loader === 'vanilla') return WIZARD_STEPS.filter((s) => s !== 'loaderVersion');
        return WIZARD_STEPS;
      }

      function renderAll() {
        renderStepsBar();
        renderStepBody();
        renderFooter();
      }

      function renderStepsBar() {
        stepsBar.innerHTML = '';
        const steps = activeSteps();
        const labels = { name: 'Name', version: 'MC Version', loader: 'Mod Loader', loaderVersion: 'Loader Version', review: 'Install' };
        steps.forEach((s, i) => {
          const cls = i === wizard.stepIndex ? 'active' : i < wizard.stepIndex ? 'done' : '';
          stepsBar.appendChild(el(`<div class="step ${cls}">${i + 1}. ${labels[s]}</div>`));
        });
      }

      function renderStepBody() {
        body.innerHTML = '';
        const step = activeSteps()[wizard.stepIndex];
        if (step === 'name') renderNameStep(body, wizard);
        else if (step === 'version') renderVersionStep(body, wizard);
        else if (step === 'loader') renderLoaderStep(body, wizard);
        else if (step === 'loaderVersion') renderLoaderVersionStep(body, wizard);
        else if (step === 'review') renderReviewStep(body, wizard, closeDialog, () => { refreshInstances(); });
      }

      function canProceed() {
        const step = activeSteps()[wizard.stepIndex];
        if (step === 'name') return wizard.name.trim().length > 0;
        if (step === 'version') return !!wizard.mcVersion;
        if (step === 'loader') return !!wizard.loader;
        if (step === 'loaderVersion') return !!wizard.loaderVersion;
        return true;
      }

      function renderFooter() {
        footer.innerHTML = '';
        const steps = activeSteps();
        const isReview = steps[wizard.stepIndex] === 'review';

        if (wizard.stepIndex > 0 && !isReview) {
          const back = el('<button class="btn">Back</button>');
          back.addEventListener('click', () => {
            wizard.stepIndex--;
            renderAll();
          });
          footer.appendChild(back);
        }
        const cancel = el('<button class="btn ghost">Cancel</button>');
        cancel.addEventListener('click', () => closeDialog());
        footer.appendChild(cancel);

        if (!isReview) {
          const next = el(`<button class="btn primary">${wizard.stepIndex === steps.length - 2 ? 'Review' : 'Next'}</button>`);
          next.disabled = !canProceed();
          next.addEventListener('click', () => {
            wizard.stepIndex++;
            renderAll();
          });
          footer.appendChild(next);
        }
      }

      // Re-render body whenever wizard fields change, via a shared callback.
      wizard._rerender = renderAll;
      renderAll();
    },
  });
}

function renderNameStep(body, wizard) {
  body.appendChild(el(`
    <div class="field">
      <label>Instance Name</label>
      <input type="text" id="wiz-name" value="${escapeHtml(wizard.name)}" placeholder="e.g. Horror Project, Vanilla Survival..." />
    </div>
  `));
  const input = body.querySelector('#wiz-name');
  input.addEventListener('input', () => {
    wizard.name = input.value;
    wizard._rerender();
  });
  setTimeout(() => input.focus(), 0);

  body.appendChild(el(`
    <div class="field">
      <label>Group</label>
      <select id="wiz-group"></select>
    </div>
  `));
  const groupSelect = body.querySelector('#wiz-group');
  for (const g of State.groups) {
    const opt = el(`<option value="${g.id}">${escapeHtml(g.name)}</option>`);
    if (g.id === wizard.groupId) opt.selected = true;
    groupSelect.appendChild(opt);
  }
  groupSelect.addEventListener('change', () => (wizard.groupId = groupSelect.value));
}

async function renderVersionStep(body, wizard) {
  body.appendChild(el(`
    <div>
      <div class="version-filter-row">
        <input type="search" id="wiz-filter" placeholder="Filter versions (e.g. 1.20)" />
        <label class="checkbox-row" style="margin:0;"><input type="checkbox" id="wiz-snapshots" ${wizard.showSnapshots ? 'checked' : ''}/> Show snapshots</label>
      </div>
      <div class="version-list" id="wiz-version-list"><div class="hint" style="padding:10px;">Loading versions...</div></div>
    </div>
  `));

  let manifest;
  try {
    manifest = await Api.mc.versionManifest();
  } catch (err) {
    const listEl = body.querySelector('#wiz-version-list');
    listEl.innerHTML = '';
    listEl.appendChild(el(`<div class="hint" style="padding:10px;color:var(--danger);">Could not load the Minecraft version list: ${escapeHtml(err.message)}</div>`));
    const retryBtn = el('<button class="btn small" style="margin:0 10px 10px;">Retry</button>');
    retryBtn.addEventListener('click', () => {
      body.innerHTML = '';
      renderVersionStep(body, wizard);
    });
    listEl.parentElement.appendChild(retryBtn);
    return;
  }
  wizard.versions = manifest.versions;

  const listEl = body.querySelector('#wiz-version-list');
  const filterInput = body.querySelector('#wiz-filter');
  const snapshotCheck = body.querySelector('#wiz-snapshots');

  function renderList() {
    const filter = filterInput.value.trim().toLowerCase();
    wizard.showSnapshots = snapshotCheck.checked;
    const filtered = wizard.versions.filter((v) => {
      if (!wizard.showSnapshots && v.type !== 'release') return false;
      if (filter && !v.id.toLowerCase().includes(filter)) return false;
      return true;
    });
    listEl.innerHTML = '';
    if (filtered.length === 0) {
      listEl.appendChild(el('<div class="hint" style="padding:10px;">No versions match.</div>'));
      return;
    }
    for (const v of filtered.slice(0, 300)) {
      const row = el(`
        <div class="version-row${wizard.mcVersion === v.id ? ' selected' : ''}">
          <span>${escapeHtml(v.id)}</span>
          <span class="v-type">${v.type}</span>
        </div>
      `);
      row.addEventListener('click', () => {
        wizard.mcVersion = v.id;
        wizard.loaderVersion = null;
        wizard._rerender();
      });
      listEl.appendChild(row);
    }
  }

  filterInput.addEventListener('input', renderList);
  snapshotCheck.addEventListener('change', renderList);
  renderList();
}

function renderLoaderStep(body, wizard) {
  const picker = el('<div class="loader-picker"></div>');
  const loaders = [
    { key: 'vanilla', label: 'Vanilla', tag: 'No mods' },
    { key: 'fabric', label: 'Fabric', tag: 'Lightweight' },
    { key: 'forge', label: 'Forge', tag: 'Most mods' },
    { key: 'neoforge', label: 'NeoForge', tag: '1.20.1+' },
  ];
  for (const loader of loaders) {
    const option = el(`
      <div class="loader-option${wizard.loader === loader.key ? ' selected' : ''}">
        ${loaderBadgeSvg(loader.key, 30)}
        <span class="loader-label">${loader.label}</span>
        <span class="loader-tag">${loader.tag}</span>
      </div>
    `);
    option.addEventListener('click', () => {
      wizard.loader = loader.key;
      wizard.loaderVersion = null;
      wizard._rerender();
    });
    picker.appendChild(option);
  }
  body.appendChild(picker);
  body.appendChild(el(`<div class="hint" style="margin-top:12px;">CircuitMC will only show mod loader builds that are actually compatible with Minecraft ${escapeHtml(wizard.mcVersion || '')}.</div>`));
}

async function renderLoaderVersionStep(body, wizard) {
  body.appendChild(el('<div class="hint" style="padding:8px 0;">Loading compatible builds...</div>'));

  let versions = [];
  let recommended = null;
  try {
    if (wizard.loader === 'fabric') {
      versions = (await Api.mc.fabricLoaders(wizard.mcVersion)).map((v) => v.version);
    } else if (wizard.loader === 'forge') {
      versions = await Api.mc.forgeVersions(wizard.mcVersion);
      recommended = await Api.mc.forgeRecommended(wizard.mcVersion);
    } else if (wizard.loader === 'neoforge') {
      versions = await Api.mc.neoforgeVersions(wizard.mcVersion);
    }
  } catch (err) {
    body.innerHTML = `<div class="hint" style="color:var(--danger)">Could not load ${loaderLabel(wizard.loader)} versions: ${escapeHtml(err.message)}</div>`;
    return;
  }

  body.innerHTML = '';
  if (versions.length === 0) {
    body.appendChild(el(`<div class="hint" style="color:var(--amber)">No ${loaderLabel(wizard.loader)} builds are published for Minecraft ${escapeHtml(wizard.mcVersion)}. Try a different loader or version.</div>`));
    return;
  }

  const list = el('<div class="version-list"></div>');
  for (const v of versions) {
    const isRecommended = v === recommended;
    const row = el(`
      <div class="version-row${wizard.loaderVersion === v ? ' selected' : ''}">
        <span>${escapeHtml(v)}</span>
        ${isRecommended ? '<span class="v-type" style="color:var(--accent)">recommended</span>' : ''}
      </div>
    `);
    row.addEventListener('click', () => {
      wizard.loaderVersion = v;
      wizard._rerender();
    });
    list.appendChild(row);
  }
  body.appendChild(list);

  if (!wizard.loaderVersion && recommended) {
    wizard.loaderVersion = recommended;
    wizard._rerender();
  }
}

function renderReviewStep(body, wizard, closeDialog, onDone) {
  body.innerHTML = `
    <div class="field-row">
      <div class="field"><label>Name</label><div class="chip">${escapeHtml(wizard.name)}</div></div>
      <div class="field"><label>Version</label><div class="chip">${escapeHtml(wizard.mcVersion)}</div></div>
      <div class="field"><label>Loader</label><div class="chip">${loaderLabel(wizard.loader)}${wizard.loaderVersion ? ' ' + escapeHtml(wizard.loaderVersion) : ''}</div></div>
    </div>
  `;

  const startBtn = el(`<button class="btn primary" style="margin-top:6px;">${iconHtml('add')}<span>Create &amp; Install</span></button>`);
  body.appendChild(startBtn);

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    body.innerHTML = `
      <div class="install-progress-view">
        <div style="font-size:13px;font-weight:600;">Creating ${escapeHtml(wizard.name)}...</div>
        <div class="progress-track"><div id="wiz-progress-bar"></div></div>
        <div class="progress-label" id="wiz-progress-label">Starting...</div>
        <div class="progress-detail" id="wiz-progress-detail"></div>
      </div>
    `;
    const bar = body.querySelector('#wiz-progress-bar');
    const label = body.querySelector('#wiz-progress-label');
    const detail = body.querySelector('#wiz-progress-detail');

    const instance = await Api.instances.create({
      name: wizard.name,
      mcVersion: wizard.mcVersion,
      loader: wizard.loader,
      loaderVersion: wizard.loaderVersion,
      groupId: wizard.groupId,
    });

    const off = Api.events.onInstallProgress((p) => {
      if (p.instanceId !== instance.id) return;
      label.textContent = p.message || p.phase;
      if (typeof p.completed === 'number' && typeof p.total === 'number' && p.total > 0) {
        bar.style.width = `${Math.round((p.completed / p.total) * 100)}%`;
        detail.textContent = `${p.completed} / ${p.total}`;
      }
      setStatus(`Installing ${wizard.name}: ${p.message || p.phase}`, p.total ? Math.round((p.completed / p.total) * 100) : null);
    });

    try {
      await Api.instances.install(instance.id);
      label.textContent = 'Done!';
      bar.style.width = '100%';
      setStatus(`${wizard.name} installed.`, null);
      onDone();
      setTimeout(() => closeDialog(), 500);
    } catch (err) {
      label.textContent = `Failed: ${err.message}`;
      label.style.color = 'var(--danger)';
      setStatus(`Failed to install ${wizard.name}.`, null);
      onDone();
    } finally {
      off();
    }
  });
}
