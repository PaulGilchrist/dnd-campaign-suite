// @improved-by-ai
// Behavior tests for the ally-selection helpers, exercised against the REAL
// runtime store (server-first pattern) with only the network boundary (fetch)
// stubbed. This verifies the observable contract — persist/read round trips
// through the `selectedAllies` key, the self-target default, per-creature
// isolation, and the server POST — instead of asserting mock delegation args,
// which passed even when the store path itself was never exercised.
//
// Coverage scan: AllySelectionModal.test.jsx tests the modal UI (props in,
// callbacks out — it never touches the store); the SavePromptModal/handler
// suites vi.mock() these helpers for their own isolation and never verify
// their behavior; savePromptUtils.test.js exercises getAllyList only as a
// collaborator of its own selectors. Nothing there duplicates the direct
// helper behavior asserted here.
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

  it('honours a saved single-ally selection instead of the self-target default', () => {
    setAllyList('Hero', ['Mia'], CAMPAIGN);

    expect(getAllyList('Hero')).toEqual(['Mia']);
    expect(getAllyList('Hero')).not.toEqual(['Hero']);
  });

  it('falls back to the creature itself after the selection is cleared', () => {
    setAllyList('Hero', ['Mia'], CAMPAIGN);
    setAllyList('Hero', [], CAMPAIGN);

    expect(getAllyList('Hero')).toEqual(['Hero']);
  });

  it('keeps selections isolated per creature', () => {
    setAllyList('Hero', ['Mia'], CAMPAIGN);

    expect(getAllyList('Hero')).toEqual(['Mia']);
    expect(getAllyList('Orc')).toEqual(['Orc']);
  });
});

describe('getAllyList defaults', () => {
  it('defaults to [creatureName] when nothing has ever been saved', () => {
    expect(getAllyList('Goblin')).toEqual(['Goblin']);
  });

  it('defaults to [creatureName] for stored values that are not a usable array', () => {
    // Seed the store directly: setAllyList would never write junk like this,
    // and the store's value-equality guard could skip some equal-value writes.
    const unusable = [null, [], '', 'not-an-array', 0, {}, false];
    for (const stored of unusable) {
      const name = `Creature_${typeof stored}_${stored === null ? 'null' : String(stored)}`;
      getStore(name).set('selectedAllies', stored);

      expect(getAllyList(name)).toEqual([name]);
    }
  });

  it('exposes selections under the selectedAllies key that consumers read', () => {
    // savePromptUtils.js reads getRuntimeValue(grantorName, 'selectedAllies')
    // directly — the key name is a public contract between these modules.
    setAllyList('Cleric', ['Mia'], CAMPAIGN);

    expect(getRuntimeValue('Cleric', 'selectedAllies')).toEqual(['Mia']);
  });
});

describe('server persistence', () => {
  it('posts the saved selection to the creature endpoint under the campaign', () => {
    setAllyList('Hero', ['Mia', 'Bran'], CAMPAIGN);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `/api/campaigns/${encodeURIComponent(CAMPAIGN)}/${encodeURIComponent('Hero')}`
    );
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body).value.selectedAllies).toEqual(['Mia', 'Bran']);
  });

  it('still saves the selection locally when campaignName is omitted', () => {
    // The runtime store logs the missing campaign scope loudly; this test
    // silences that diagnostic and pins only the hook's own behavior.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    setAllyList('Hero', ['Mia']);

    expect(getAllyList('Hero')).toEqual(['Mia']);
  });
});
