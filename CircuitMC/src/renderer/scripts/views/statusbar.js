'use strict';

const StatusState = { message: 'Ready.', progress: null };

function setStatus(message, progress = null) {
  StatusState.message = message;
  StatusState.progress = progress;
  renderStatusbar();
}

function renderStatusbar() {
  const bar = document.getElementById('statusbar');
  bar.innerHTML = '';

  const msg = el(`<span class="status-message">${escapeHtml(StatusState.message)}</span>`);
  bar.appendChild(msg);

  if (StatusState.progress !== null) {
    const track = el('<div class="status-progress"><div></div></div>');
    track.querySelector('div').style.width = `${Math.max(0, Math.min(100, StatusState.progress))}%`;
    bar.appendChild(track);
  }

  const count = State.instances.length;
  bar.appendChild(el(`<span class="mono">${count} instance${count === 1 ? '' : 's'}</span>`));
  bar.appendChild(el(`<span class="mono">CircuitMC ${window.__appVersion || ''}</span>`));
}
