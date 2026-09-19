'use strict';

function promptDialog({ title, label, placeholder = '', defaultValue = '', confirmLabel = 'OK', onConfirm }) {
  openDialog({
    title,
    render(dialog, close) {
      const body = el('<div class="dialog-body"></div>');
      body.appendChild(el(`
        <div class="field">
          <label>${label}</label>
          <input type="text" id="prompt-input" value="${escapeHtml(defaultValue)}" placeholder="${escapeHtml(placeholder)}" />
        </div>
      `));
      const footer = el('<div class="dialog-footer"></div>');
      const cancel = el('<button class="btn ghost">Cancel</button>');
      cancel.addEventListener('click', close);
      const confirm = el(`<button class="btn primary">${confirmLabel}</button>`);
      const input = body.querySelector('#prompt-input');
      const submit = () => {
        const value = input.value.trim();
        if (!value) return;
        close();
        onConfirm(value);
      };
      confirm.addEventListener('click', submit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
      });
      footer.appendChild(cancel);
      footer.appendChild(confirm);
      dialog.appendChild(body);
      dialog.appendChild(footer);
      setTimeout(() => {
        input.focus();
        input.select();
      }, 0);
    },
  });
}

function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm }) {
  openDialog({
    title,
    render(dialog, close) {
      const body = el(`<div class="dialog-body"><div style="font-size:12.5px;line-height:1.6;">${message}</div></div>`);
      const footer = el('<div class="dialog-footer"></div>');
      const cancel = el('<button class="btn ghost">Cancel</button>');
      cancel.addEventListener('click', close);
      const confirm = el(`<button class="btn ${danger ? 'danger' : 'primary'}">${confirmLabel}</button>`);
      confirm.addEventListener('click', () => {
        close();
        onConfirm();
      });
      footer.appendChild(cancel);
      footer.appendChild(confirm);
      dialog.appendChild(body);
      dialog.appendChild(footer);
    },
  });
}

function changeGroupDialog(instance) {
  openDialog({
    title: `Change Group -- ${instance.name}`,
    render(dialog, close) {
      const body = el('<div class="dialog-body"></div>');
      const list = el('<div class="version-list"></div>');
      for (const g of State.groups) {
        const row = el(`
          <div class="version-row${instance.groupId === g.id ? ' selected' : ''}">
            <span>${escapeHtml(g.name)}</span>
          </div>
        `);
        row.addEventListener('click', async () => {
          await Api.groups.moveInstance(instance.id, g.id);
          close();
          await refreshInstances();
          setStatus(`Moved ${instance.name} to ${g.name}.`);
        });
        list.appendChild(row);
      }
      body.appendChild(list);

      const newGroupBtn = el(`<button class="btn ghost small" style="margin-top:10px;">${iconHtml('plus')}<span>New Group</span></button>`);
      newGroupBtn.addEventListener('click', () => {
        close();
        promptDialog({
          title: 'New Group',
          label: 'Group Name',
          placeholder: 'e.g. Survival, Modded, Testing',
          confirmLabel: 'Create',
          onConfirm: async (name) => {
            const groupId = await Api.groups.create(name);
            await Api.groups.moveInstance(instance.id, groupId);
            await refreshInstances();
            setStatus(`Created group "${name}" and moved ${instance.name} into it.`);
          },
        });
      });
      body.appendChild(newGroupBtn);
      dialog.appendChild(body);
    },
  });
}
