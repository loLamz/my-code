'use strict';

// window.circuitmc is injected by src/preload/preload.js inside Electron.
// When this page is opened in a plain browser (dev preview), fall back to
// the in-memory mock so the UI is still fully explorable.
const Api = window.circuitmc || window.__circuitmcMock;
const IS_MOCK = !window.circuitmc;
