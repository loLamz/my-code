'use strict';

// Tiny logger that both prints to the terminal (useful when running from
// source) and keeps a ring buffer that the UI status bar / log console can
// subscribe to over IPC.

const MAX_LINES = 2000;
const lines = [];
const listeners = new Set();

function push(level, message) {
  const entry = { level, message: String(message), time: Date.now() };
  lines.push(entry);
  if (lines.length > MAX_LINES) lines.shift();
  const tag = `[${level.toUpperCase()}]`;
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  out(tag, entry.message);
  for (const fn of listeners) {
    try {
      fn(entry);
    } catch (_) {
      /* listener errors must not break logging */
    }
  }
  return entry;
}

module.exports = {
  info: (msg) => push('info', msg),
  warn: (msg) => push('warn', msg),
  error: (msg) => push('error', msg),
  onLine(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getBuffer() {
    return lines.slice();
  },
};
