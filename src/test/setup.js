import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { clearActiveInstances } from '../components/char-sheet/modals/shared/areaEffectModalInstances.js';

// Inert default fetch so tests can never reach a live dev/api server.
// A live server + a real fetch would let the changedata route persist
// public/campaigns/<name>/data/character-change-data.json (creating folders).
// Tests that assert on fetch override this per-test (vi.spyOn / vi.stubGlobal).
const inertResponse = () => ({
    ok: true,
    status: 200,
    text: () => Promise.resolve(''),
    json: () => Promise.resolve({}),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    clone: () => inertResponse(),
    headers: globalThis.Headers ? new globalThis.Headers() : {},
});

function inertFetch() {
    return Promise.resolve(inertResponse());
}

globalThis.fetch = inertFetch;
vi.stubGlobal('fetch', inertFetch);

// Inert EventSource so SSE-connecting components render in jsdom (which lacks EventSource)
class InertEventSource {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
  }
  close() {
    this.readyState = 2;
  }
  addEventListener() {}
  removeEventListener() {}
}
InertEventSource.CONNECTING = 0;
InertEventSource.OPEN = 1;
InertEventSource.CLOSED = 2;
vi.stubGlobal('EventSource', InertEventSource);

// Mock localStorage for all tests
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  clearActiveInstances();
});
