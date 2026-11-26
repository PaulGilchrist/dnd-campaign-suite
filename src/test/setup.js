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

// Inert Audio mock for the audio-cue lane (Item 10): jsdom's HTMLAudioElement
// play() is "not implemented" noise. Every constructed element is recorded on
// Audio.instances so cue tests can inspect src/play/pause without each suite
// re-stubbing; suites that want a clean census clear the array themselves.
class MockAudio {
  constructor(src) {
    this.src = src || '';
    this.volume = 1;
    this.loop = false;
    this.paused = true;
    this.currentTime = 0;
    this.play = vi.fn(() => { this.paused = false; this.currentTime = 0; return Promise.resolve(); });
    this.pause = vi.fn(() => { this.paused = true; });
    MockAudio.instances.push(this);
  }
}
MockAudio.instances = [];
vi.stubGlobal('Audio', MockAudio);

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

// jsdom ships no ResizeObserver — the rails' overflow measurement lane
// (hooks/ui/useRailClipped, Item 7 F19) guards on it so effect mounts stay
// inert in tests instead of throwing ReferenceError.
global.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Cleanup after each test
afterEach(() => {
  cleanup();
  clearActiveInstances();
});
