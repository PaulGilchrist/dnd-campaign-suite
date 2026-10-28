// @maintained-by-ai
// encountersService lane: owns the transport bytes of the encounter-CRUD client —
// exact GET/POST/PUT/DELETE tuples against /api/campaigns/:campaign/encounters[/...],
// campaign AND encounter names encodeURIComponent'd into every URL, exact envelope
// body bytes ({ name, data } / data / { newName }), DELETE with no headers/body,
// ONE fetch per invocation (no retry storms), verbatim response pass-through, and
// honest rejection: server {error} verbatim, per-site generic fallback literal,
// console.error exactly once per rejection, always rethrown (never swallowed).
// Consumers (useEncounterManagement, Sessions, EncounterBuilder*) all MOCK this
// module and verify call-args only; EncounterModal.test runs the REAL
// formatEncounterName but pins one display example ('dragon-lair' → 'Dragon Lair')
// — the full unit contract stays in the table below. Verified against source:
// no timers, no localStorage, no wall-clock state here.
// Old→new map: 6×'custom error message' its + 1×generic + 6×'network failure'
// its → 2 it.each tables + 1 network sweep; 7 success/shape its → 1 request-table;
// 6 formatEncounterName its → 1 table.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadEncounters,
  saveEncounter,
  loadEncounter,
  updateEncounter,
  deleteEncounter,
  renameEncounter,
  formatEncounterName,
} from './encountersService.js';

// Space/#-laden names exercised in EVERY row — pins encodeURIComponent output at
// all six URL sites without separate encode tests.
const CAMPAIGN = 'Campaign #1';
const ENCOUNTER = 'Goblin Ambush';
const COLLECTION_URL = `/api/campaigns/${encodeURIComponent(CAMPAIGN)}/encounters`;
const ITEM_URL = `${COLLECTION_URL}/${encodeURIComponent(ENCOUNTER)}`;
const HEADERS = { 'Content-Type': 'application/json' };

const SAVE_DATA = { monsters: ['goblin'], difficulty: 'easy' };
const UPDATE_DATA = { monsters: ['hobgoblin'], difficulty: 'medium' };

/** Every entry point: exact request tuple + distinct verbatim response payload. */
const REQUESTS = [
  {
    label: 'loadEncounters',
    invoke: () => loadEncounters(CAMPAIGN),
    url: COLLECTION_URL,
    init: { method: 'GET', headers: HEADERS },
    payload: [{ name: 'goblin-ambush' }],
  },
  {
    label: 'saveEncounter',
    invoke: () => saveEncounter(CAMPAIGN, ENCOUNTER, SAVE_DATA),
    url: COLLECTION_URL,
    init: { method: 'POST', headers: HEADERS, body: JSON.stringify({ name: ENCOUNTER, data: SAVE_DATA }) },
    payload: { success: true },
  },
  {
    label: 'loadEncounter',
    invoke: () => loadEncounter(CAMPAIGN, ENCOUNTER),
    url: ITEM_URL,
    init: { method: 'GET', headers: HEADERS },
    payload: { name: ENCOUNTER, monsters: ['goblin'] },
  },
  {
    label: 'updateEncounter',
    invoke: () => updateEncounter(CAMPAIGN, ENCOUNTER, UPDATE_DATA),
    url: ITEM_URL,
    init: { method: 'PUT', headers: HEADERS, body: JSON.stringify(UPDATE_DATA) },
    payload: { success: true },
  },
  {
    // Exact-match deep equality: pins no headers and no body on the DELETE leg.
    label: 'deleteEncounter',
    invoke: () => deleteEncounter(CAMPAIGN, ENCOUNTER),
    url: ITEM_URL,
    init: { method: 'DELETE' },
    payload: { success: true, deleted: ENCOUNTER },
  },
  {
    label: 'renameEncounter',
    invoke: () => renameEncounter(CAMPAIGN, ENCOUNTER, 'Goblin Ambush II'),
    url: `${ITEM_URL}/rename`,
    init: { method: 'PUT', headers: HEADERS, body: JSON.stringify({ newName: 'Goblin Ambush II' }) },
    payload: { success: true },
  },
];

/** Per-site generic fallback literals (distinct bytes at each site). */
const ERROR_PATHS = [
  { label: 'loadEncounters', invoke: () => loadEncounters(CAMPAIGN), generic: 'Failed to load encounters' },
  { label: 'saveEncounter', invoke: () => saveEncounter(CAMPAIGN, ENCOUNTER, SAVE_DATA), generic: 'Failed to save encounter' },
  { label: 'loadEncounter', invoke: () => loadEncounter(CAMPAIGN, ENCOUNTER), generic: 'Failed to load encounter' },
  { label: 'updateEncounter', invoke: () => updateEncounter(CAMPAIGN, ENCOUNTER, UPDATE_DATA), generic: 'Failed to update encounter' },
  { label: 'deleteEncounter', invoke: () => deleteEncounter(CAMPAIGN, ENCOUNTER), generic: 'Failed to delete encounter' },
  { label: 'renameEncounter', invoke: () => renameEncounter(CAMPAIGN, ENCOUNTER, 'new'), generic: 'Failed to rename encounter' },
];

describe('encountersService', () => {
  let fetchSpy;
  let consoleError;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(REQUESTS)(
    '$label sends the exact request tuple and passes the parsed response through verbatim',
    async ({ invoke, url, init, payload }) => {
      fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(payload) });

      const result = await invoke();

      expect(result).toBe(payload); // same reference — bytes untouched
      expect(fetchSpy).toHaveBeenCalledTimes(1); // one call, no retry
      expect(fetchSpy).toHaveBeenCalledWith(url, init);
    }
  );

  it.each(ERROR_PATHS)(
    '$label rejects with the server error verbatim, falls back to its generic literal, logging once per site',
    async ({ invoke, generic }) => {
      fetchSpy.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: 'Server says no' }) });
      await expect(invoke()).rejects.toThrow('Server says no');

      fetchSpy.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) });
      await expect(invoke()).rejects.toThrow(generic);

      expect(fetchSpy).toHaveBeenCalledTimes(2); // one attempt per invocation
      expect(consoleError).toHaveBeenCalledTimes(2); // swallowed loudly, never silently
    }
  );

  it('rethrows network failures verbatim — one attempt and one console.error per site, no retry storms', async () => {
    for (const { label, invoke } of ERROR_PATHS) {
      fetchSpy.mockReset().mockRejectedValueOnce(new Error(`network down: ${label}`)); // determinism re-arm
      consoleError.mockClear();

      await expect(invoke()).rejects.toThrow(`network down: ${label}`);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledTimes(1);
    }
  });

  it('updateEncounter attaches the HTTP status to the rejection (404 = vanished row → EB create-modal fallback)', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({ error: 'Encounter not found' }) });

    await expect(updateEncounter(CAMPAIGN, ENCOUNTER, UPDATE_DATA)).rejects.toMatchObject({
      message: 'Encounter not found',
      status: 404,
    });
    // Still the single-layer fingerprint: one service log, no extra lines.
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['goblin-ambush', 'Goblin Ambush'],
    ['dragon-lair.json', 'Dragon Lair'],
    ['cave-of-7-dragons.JSON', 'Cave Of 7 Dragons'], // case-insensitive strip + digits + multi-hyphen
    ['', ''],
    [null, ''],
  ])('formatEncounterName(%p) → %s', (input, output) => {
    expect(formatEncounterName(input)).toBe(output);
  });
});
