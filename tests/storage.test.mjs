import test from 'node:test';
import assert from 'node:assert/strict';
import { storageGet, storageSet, storageRemove } from '../lib/safe-storage.js';

test('blocked browser storage degrades quietly (Safari privacy modes can throw on access)', () => {
  globalThis.window = Object.defineProperty({}, 'localStorage', {
    get() {
      throw new DOMException('denied', 'SecurityError');
    },
  });
  try {
    assert.equal(storageGet('key'), null);
    assert.equal(storageSet('key', 'value'), false);
    assert.doesNotThrow(() => storageRemove('key'));
  } finally {
    delete globalThis.window;
  }
});

test('working storage round-trips values and a full store reports failure instead of throwing', () => {
  const data = new Map();
  const working = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
  const full = {
    ...working,
    setItem() {
      throw new DOMException('full', 'QuotaExceededError');
    },
  };
  globalThis.window = { localStorage: working, sessionStorage: full };
  try {
    assert.equal(storageSet('mode', 'live'), true);
    assert.equal(storageGet('mode'), 'live');
    storageRemove('mode');
    assert.equal(storageGet('mode'), null);
    assert.equal(storageSet('report', 'data', 'sessionStorage'), false);
  } finally {
    delete globalThis.window;
  }
});
