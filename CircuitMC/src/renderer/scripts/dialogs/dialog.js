'use strict';

const DialogHost = {
  root: null,
};

function ensureDialogRoot() {
  if (!DialogHost.root) DialogHost.root = document.getElementById('dialog-root');
  return DialogHost.root;
}

// Renders a modal dialog. `render(container)` fills in the dialog body/footer.
// Returns a `close()` function.
function openDialog({ title, wide = false, onClose, render }) {
  const root = ensureDialogRoot();
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const dialog = document.createElement('div');
  dialog.className = `dialog${wide ? ' wide' : ''}`;

  const header = document.createElement('div');
  header.className = 'dialog-header';
  header.innerHTML = `<span class="title">${title}</span>`;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'dialog-close';
  closeBtn.innerHTML = iconHtml('close');
  header.appendChild(closeBtn);

  dialog.appendChild(header);
  overlay.appendChild(dialog);

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKeydown);
    if (onClose) onClose();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKeydown);

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });

  root.appendChild(overlay);
  render(dialog, close);
  return close;
}

// Turns an HTML string into a live node. Templates are expected to have a
// single root element (the common case, and the only case where the
// returned node supports further method calls like .addEventListener); if a
// template accidentally has multiple top-level siblings, warn loudly rather
// than silently dropping everything after the first one.
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  if (t.content.children.length > 1) {
    console.warn('el() template has multiple root elements; only the first will be returned/used as a live node:', html);
  }
  return t.content.firstElementChild;
}
