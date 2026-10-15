// @maintained-by-ai: 2026-10-15
// Behavior contract tests for the ally-selection helpers (useAllySelection.js),
// exercised against the REAL runtime store (server-first pattern) with only the
// network boundary (fetch) stubbed: get/set round trips through the
// `selectedAllies` key, the self-target default, and the persist-to-server
// delegation. Deterministic — no timers, no DOM, no mocking of the helpers.
//
// Scope split: the runtime store's own transport contract (POST URL shapes,
// encoding, fetch counts, missing-campaign diagnostics, per-key store
// isolation) is pinned by runtime/useRuntimeState.core.test.js — not re-
// asserted here. AllySelectionModal.test.jsx tests the modal UI (props in,
// callbacks out — it never touches the store); consumer suites
// (savePromptUtils, handlers, auras) vi.mock() getAllyList for their own
// isolation and never verify its real behavior, so this file is the only
// direct coverage of the helper behaviour every production consumer relies on.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAllyList, setAllyList } from './useAllySelection.js';
import {
  clearRuntimeState,
  getAllStoreKeys,
  getRuntimeValue,
  getStore,
} from './runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';

let fetchMock;

beforeEach(() => {
  for (const key of getAllStoreKeys()) clearRuntimeState(key);
  fetchMock = vi.fn(() => Promise.resolve());
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('setAllyList → getAllyList round trip', () => {
  it('reads back exactly the allies that were saved', () => {
    setAllyList('Hero', ['Mia', 'Bran'], CAMPAIGN);

    expect(getAllyList('Hero')).toEqual(['Mia', 'Bran']);
  });

  it('falls back to the creature itself after the selection is cleared', () => {
    setAllyList('Hero', ['Mia'], CAMPAIGN);
    setAllyList('Hero', [], CAMPAIGN);

    expect(getAllyList('Hero')).toEqual(['Hero']);
  });
});

describe('getAllyList defaults', () => {
  it('defaults to [creatureName] when nothing has ever been saved', () => {
    expect(getAllyList('Goblin')).toEqual(['Goblin']);
  });

  it('defaults to [creatureName] for stored values that are not a usable array', () => {
    // Seed the store directly: setAllyList would never write junk like this
    // (server-hydrated state could), and the store's value-equality guard
    // could skip some equal-value writes. The null / empty-array shapes are
    // deliberately not repeated here — they are covered by the never-saved
    // default and the cleared-selection round trip above.
    const unusable = ['', 'not-an-array', 0, {}, false];
    for (const stored of unusable) {
      const name = `Creature_${typeof stored}_${String(stored)}`;
      getStore(name).set('selectedAllies', stored);

      expect(getAllyList(name)).toEqual([name]);
    }
  });

  it('exposes selections under the selectedAllies key that consumers read', () => {
    // savePromptUtils.js and auraOfLifeHandler.js read
    // getRuntimeValue(name, 'selectedAllies') directly — the key name is a
    // public contract between these modules.
    setAllyList('Cleric', ['Mia'], CAMPAIGN);

    expect(getRuntimeValue('Cleric', 'selectedAllies')).toEqual(['Mia']);
  });
});

describe('server persistence', () => {
  it('posts the saved selection to the creature endpoint under the campaign', () => {
    setAllyList('Hero', ['Mia', 'Bran'], CAMPAIGN);

    // The only assertion here that the store suite cannot make: that this
    // helper forwards creature + campaign scope and the selection value into
    // the runtime store's POST (its documented "persist to server" half).
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `/api/campaigns/${encodeURIComponent(CAMPAIGN)}/${encodeURIComponent('Hero')}`
    );
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body).value.selectedAllies).toEqual(['Mia', 'Bran']);
  });
});
