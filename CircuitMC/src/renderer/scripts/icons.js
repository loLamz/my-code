'use strict';

// Small hand-authored line-icon set (stroke = currentColor) so every icon in
// the app inherits its color from CSS and stays crisp at any size. Kept
// intentionally simple/geometric per the "thin borders, simple icons"
// brief rather than pulling in an icon font or library.
const Icons = (() => {
  const svg = (inner, viewBox = '0 0 24 24') =>
    `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

  return {
    play: svg('<path d="M6 4l14 8-14 8V4z" fill="currentColor" stroke="none"/>'),
    stop: svg('<rect x="5" y="5" width="14" height="14" rx="1" fill="currentColor" stroke="none"/>'),
    edit: svg('<path d="M4 20l1-4.5L15.5 5 19 8.5 8.5 19 4 20z"/><path d="M13 7l4 4"/>'),
    group: svg('<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="8.5" y="13" width="7" height="7" rx="1"/>'),
    folder: svg('<path d="M3 6.5c0-.8.7-1.5 1.5-1.5H9l2 2.2h8.5c.8 0 1.5.7 1.5 1.5V18c0 .8-.7 1.5-1.5 1.5h-15A1.5 1.5 0 013 18V6.5z"/>'),
    exportIcon: svg('<path d="M12 3v11"/><path d="M8 7l4-4 4 4"/><path d="M4 15v3.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V15"/>'),
    importIcon: svg('<path d="M12 14V3"/><path d="M8 10l4 4 4-4"/><path d="M4 15v3.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V15"/>'),
    copy: svg('<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V5.5A1.5 1.5 0 0014.5 4h-9A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16H8"/>'),
    trash: svg('<path d="M4 7h16"/><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"/><path d="M6 7l1 12.5a1.5 1.5 0 001.5 1.5h7a1.5 1.5 0 001.5-1.5L18 7"/><path d="M10 11v6"/><path d="M14 11v6"/>'),
    shortcut: svg('<circle cx="8" cy="17" r="2.6"/><circle cx="17" cy="17" r="2.6"/><path d="M8 14.4V6a1 1 0 011-1h9"/><path d="M15 2l3 3-3 3"/>'),
    add: svg('<path d="M12 5v14"/><path d="M5 12h14"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V19a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1-1.55 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.55-1H4a2 2 0 110-4h.09A1.7 1.7 0 005.64 9a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 009 4.6a1.7 1.7 0 001-1.55V3a2 2 0 114 0v.09c0 .69.4 1.28 1 1.55a1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87c.27.6.86 1 1.55 1H20a2 2 0 110 4h-.09a1.7 1.7 0 00-1.51 1z"/>'),
    help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.3 9.3a2.7 2.7 0 015.2 1c0 1.8-2.5 1.8-2.5 3.7"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/>'),
    accounts: svg('<circle cx="12" cy="8" r="3.4"/><path d="M4.5 20c1-3.6 4-5.5 7.5-5.5s6.5 1.9 7.5 5.5"/>'),
    chevronDown: svg('<path d="M6 9l6 6 6-6"/>'),
    twist: svg('<path d="M9 6l6 6-6 6"/>'),
    twistOpen: svg('<path d="M6 9l6 6 6-6"/>'),
    search: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-5-5"/>'),
    close: svg('<path d="M5 5l14 14M19 5L5 19"/>'),
    java: svg('<path d="M8 3c-2 2-2 4 0 6"/><path d="M13 3c-2 2-2 4 0 6"/><path d="M6 14c3 2 9 2 12 0"/><path d="M6 18c3 2 9 2 12 0"/><ellipse cx="12" cy="10.5" rx="7" ry="2.5"/>'),
    warn: svg('<path d="M12 3l10 17.5H2z"/><path d="M12 9.5v5"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/>'),
    check: svg('<path d="M4 12.5l5.5 5.5L20 6.5"/>'),
    refresh: svg('<path d="M4 12a8 8 0 0113.7-5.7L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 01-13.7 5.7L4 16"/><path d="M4 20v-4h4"/>'),
    console: svg('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M6.5 9l3 3-3 3"/><path d="M12 15h5.5"/>'),
    ram: svg('<rect x="3" y="8" width="18" height="9" rx="1"/><path d="M7 8V5.5"/><path d="M11 8V5.5"/><path d="M15 8V5.5"/><path d="M17.5 8V5.5"/>'),
    resPack: svg('<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 9h16"/><path d="M9 4v5"/>'),
    shader: svg('<path d="M12 3l3 6 6 1-4.5 4.3L17.5 21 12 17.8 6.5 21l1-6.7L3 10l6-1 3-6z"/>'),
    world: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z"/>'),
    mods: svg('<path d="M20.5 12.5l-3-3 1.5-1.5a1.4 1.4 0 000-2 1.4 1.4 0 00-2 0L15.5 7.5l-3-3-1.5 1.5a2.5 2.5 0 01-3.5 0l-1-1-3.5 3.5 1 1a2.5 2.5 0 010 3.5L3.5 14l3 3 1.5-1.5a2.5 2.5 0 013.5 0l1 1-3.5 3.5-1-1a2.5 2.5 0 00-3.5 0"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    dot: svg('<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>'),
    back: svg('<path d="M15 5l-7 7 7 7"/>'),
  };
})();

function iconHtml(name, extraClass = '') {
  const markup = Icons[name] || Icons.warn;
  return `<span class="icon ${extraClass}">${markup}</span>`;
}

// Original, geometric per-loader badge icons for instance tiles. These are
// deliberately not recreations of any project's real logo -- just a simple,
// consistent visual language (rounded tile + symbol) unique to CircuitMC.
const LoaderBadges = {
  vanilla: {
    bg: '#3b4a3d',
    fg: '#8fd19e',
    svg: '<rect x="13" y="13" width="22" height="22" rx="2"/><path d="M13 20h22M20 13v22" stroke-width="1.2"/>',
  },
  fabric: {
    bg: '#1f4d49',
    fg: '#4fd1c5',
    svg: '<path d="M14 34V16l10-4 10 4v18"/><path d="M14 22h20"/><path d="M14 28h20"/>',
  },
  forge: {
    bg: '#5a3a1a',
    fg: '#f0a63c',
    svg: '<path d="M15 30l8-8 3 3-8 8z"/><path d="M23 22l6-6 3 3-6 6z"/><circle cx="31" cy="14" r="2.4"/>',
  },
  neoforge: {
    bg: '#5a2418',
    fg: '#ef7a52',
    svg: '<path d="M24 12l4 8-4 4-4-4z"/><path d="M20 24l4 4 4-4 4 8-8 4-8-4z"/>',
  },
};

function loaderBadgeSvg(loaderKey, size = 42) {
  const spec = LoaderBadges[loaderKey] || LoaderBadges.vanilla;
  return `<svg class="tile-icon" width="${size}" height="${size}" viewBox="0 0 48 48">
    <rect x="1" y="1" width="46" height="46" rx="9" fill="${spec.bg}" stroke="rgba(255,255,255,0.06)"/>
    <g fill="none" stroke="${spec.fg}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${spec.svg}</g>
  </svg>`;
}

function loaderLabel(loaderKey) {
  return { vanilla: 'Vanilla', fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge' }[loaderKey] || 'Vanilla';
}
