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

// Captured at module load (before any test can install fake timers) so the
// drain below always uses the real macrotask queue.
const realSetTimeout = globalThis.setTimeout;

// Cleanup after each test. The final await drains one real macrotask tick:
// effect cleanups that RTL's cleanup() triggers can schedule 0ms fallbacks
// (e.g. useOverlayEntranceFocus's close-restore re-check) whose ids are never
// captured. Without the drain those callbacks may fire after this file's jsdom
// environment tears down, surfacing as an unhandled `ReferenceError: document
// is not defined`. Draining here runs them while jsdom still exists; the
// stranded-only, idempotent, never-fighting restore is safe against an emptied
// DOM (its anchor.isConnected guard fails and it becomes a no-op). Same-task
// timers queued before the drain fire first (FIFO), so one tick is enough.
afterEach(async () => {
  cleanup();
  clearActiveInstances();
  await new Promise(resolve => realSetTimeout(resolve, 0));
});
