// @maintained-by-ai 2026-11-27
/**
 * factionsService — client-side fetch contract for the factions collection.
 *
 * Lane of the services/campaign/ block; canonical idiom from
 * campaignService.test.js (block opener): per-suite fetch-spied with a
 * fail-loud default (unmocked fetch throws — never live, per campaign
 * lockdown), full-shape RequestInit censuses via toEqual (no masked
 * objectContaining bodies), assertion-identical failure faces run as
 * it.each tables, every error path pins exactly ONE console.error
 * (non-silent doctrine).
 *
 * THIS file owns `/api/campaigns/:campaign/factions`,
 * `/api/campaigns/:campaign/factions/standings` and
 * `/api/campaigns/:campaign/factions/:id` (GET/POST list, GET/DELETE item,
 * GET standings).
 *
 * Response shapes pinned against the server, NOT canned JSON:
 * server/routes/factions.js delegates CRUD to server/utils/jsonEntityCrud.js:
 *  - GET list  → { factions: [...] } envelope, passed through untouched
 *    (Factions.jsx unwraps via useEntityManagement responseKey:'factions').
 *  - GET item  → { faction: entity }, 404 { error: 'Faction not found' }.
 *  - POST      → { success: true } only; 400 duplicate-name / 409
 *    concurrent-edit bodies.
 *  - DELETE    → { success: true } only; DELETE is sent with NO headers.
 *  - GET standings (factions.js:65) → { factions: whitelisted rows }; the
 *    field-whitelist and draft-filtering are SERVER-side behavior (pinned by
 *    server route tests) — this lane pins only the client's unwrap-to-array
 *    and its `|| []` missing-key fallback.
 *  - Error bodies arrive as { error } via asyncHandler; the client's
 *    `error || 'Failed to …'` generic fallback is defensive — pinned as the
 *    client's own string.
 *
 * Consumers: Factions.jsx (GM panel) wires load/save/delete; QuestBoard.jsx
 * wires the read-only loadFactionStandings. Favor/influence math is
 * server-owned — no client-side arithmetic to pin here.
 *
 * No timers, no localStorage — pure fetch boundary.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadFactions,
  saveFactions,
  loadFactionStandings,
  loadFaction,
  deleteFaction,
} from './factionsService.js';

/**
 * Assertion-identical failure faces shared by every function:
 *  1. non-2xx WITH a server { error } body — the message surfaces verbatim;
 *  2. non-2xx WITHOUT an error field — the client's generic fallback string;
 *  3. network rejection — the original error propagates unchanged.
 * Each face must land exactly one console.error with the function's prefix.
 */
const errorFaces = ({ generic, serverStatus = 500, serverMessage = 'Server-side failure' }) => [
  {
    title: 'non-2xx with a server { error } body surfaces the server message',
    respond: () => ({
      ok: false,
      status: serverStatus,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ error: serverMessage }),
    }),
    expected: serverMessage,
  },
  {
    title: 'non-2xx body without an error field falls back to the generic client message',
    respond: () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({}),
    }),
    expected: generic,
  },
  {
    title: 'network rejection propagates the original error',
    respond: () => Promise.reject(new Error('ENOTFOUND')),
    expected: 'ENOTFOUND',
  },
];

describe('factionsService', () => {
  let fetchSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    // Fail-loud default: any fetch a test forgets to mock rejects instead of
    // reaching a live server (campaign lockdown — never real /api here).
    fetchSpy.mockImplementation((url) => {
      throw new Error(`unmocked fetch in factionsService test: ${url}`);
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Warn channel is assertable: a handled 409 conflict must land HERE
    // (improve 2026-10-27-H) while genuine failures stay on console.error.
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadFactions', () => {
    it('GETs the collection and passes the server envelope through (campaign name URL-encoded)', async () => {
      const envelope = {
        factions: [
          { id: 'f-1', name: 'Harpers', description: 'Secret society', influence: 5 },
          { id: 'f-2', name: 'Order of the Gauntlet', description: 'Holy knights', influence: 7 },
        ],
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(envelope),
      });

      const result = await loadFactions('my campaign/1');

      // passthrough of { factions } envelope — Factions.jsx unwraps via responseKey
      expect(result).toEqual(envelope);
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/my%20campaign%2F1/factions', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it.each(errorFaces({ generic: 'Failed to load Factions', serverMessage: 'Failed to read Factions' }))(
      '$title',
      async ({ respond, expected }) => {
        fetchSpy.mockImplementation(() => respond());

        await expect(loadFactions('test-campaign')).rejects.toThrow(expected);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading Factions:', expect.any(Error));
      }
    );
  });

  describe('saveFactions', () => {
    it('POSTs the exact full-array overwrite body and returns the server { success: true } envelope', async () => {
      const factions = [{ id: 'f-1', name: 'Harpers', influence: 5 }];

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await saveFactions('test-campaign', factions);

      // server posts a full-array overwrite and answers { success: true } only
      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/factions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factions }),
      });
    });

    it('routes a handled 409 conflict to console.warn — never a red ERROR (improve 2026-10-27-H)', async () => {
      // server truth: conflictErrorBody (jsonEntityCrud.js:88) — the banner +
      // "Reload list" affordance owns user feedback; console stays amber.
      const conflictMessage =
        'Faction "Harpers" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: () => Promise.resolve({ error: conflictMessage, conflict: true }),
      });

      const thrown = await saveFactions('test-campaign', []).catch((e) => e);

      expect(thrown).toBeInstanceOf(Error);
      expect(thrown.message).toBe(conflictMessage);
      expect(thrown.conflict).toBe(true); // banner's Reload-list discriminator
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Concurrent-edit conflict saving Factions:',
        conflictMessage
      );
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // single warn per rejected save
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it.each(errorFaces({
      generic: 'Failed to save Factions',
      serverStatus: 400,
      serverMessage: 'A faction with that name already exists', // validateList → findDuplicateNameError
    }))('$title', async ({ respond, expected }) => {
      fetchSpy.mockImplementation(() => respond());

      await expect(saveFactions('test-campaign', [{ name: 'Harpers' }])).rejects.toThrow(expected);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving Factions:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled(); // only sanctioned 409s reach warn
    });
  });

  describe('loadFactionStandings', () => {
    // Player quest-board lane (QuestBoard.jsx) — read-only; the field
    // whitelist / draft-drop is server-side, pinned by server route tests.
    it('GETs the standings lane and unwraps the envelope to a plain array', async () => {
      const rows = [
        { id: 'f-1', name: 'Harpers', influence: 5 },
        { id: 'f-2', name: 'Zhentarim', influence: 3 },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ factions: rows }),
      });

      const result = await loadFactionStandings('test-campaign');

      expect(result).toEqual(rows); // array, NOT the { factions } envelope
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/factions/standings', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('returns [] when a success body omits the factions key', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      await expect(loadFactionStandings('test-campaign')).resolves.toEqual([]);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it.each(errorFaces({ generic: 'Failed to load faction standings' }))('$title', async ({ respond, expected }) => {
      fetchSpy.mockImplementation(() => respond());

      await expect(loadFactionStandings('test-campaign')).rejects.toThrow(expected);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading faction standings:', expect.any(Error));
    });
  });

  describe('loadFaction', () => {
    // No production consumer today (Factions.jsx lists via loadFactions);
    // pinned as the item-route contract against jsonEntityCrud's itemWrapper.
    it('GETs the item route and passes the { faction } envelope through (campaign and id both URL-encoded)', async () => {
      const faction = { id: 'faction/1', name: 'Harpers', description: 'Secret society' };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ faction }),
      });

      const result = await loadFaction('my campaign/1', 'faction/1');

      expect(result).toEqual({ faction });
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign%2F1/factions/faction%2F1',
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    it.each(errorFaces({ generic: 'Failed to load Faction', serverStatus: 404, serverMessage: 'Faction not found' }))(
      '$title',
      async ({ respond, expected }) => {
        fetchSpy.mockImplementation(() => respond());

        await expect(loadFaction('test-campaign', 'f-1')).rejects.toThrow(expected);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading Faction:', expect.any(Error));
      }
    );
  });

  describe('deleteFaction', () => {
    it('sends DELETE with no headers, encoded ids, and returns { success: true }', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await deleteFaction('my campaign/1', 'faction/1');

      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign%2F1/factions/faction%2F1',
        { method: 'DELETE' }
      );
    });

    it.each(errorFaces({ generic: 'Failed to delete Faction', serverStatus: 404, serverMessage: 'Faction not found' }))(
      '$title',
      async ({ respond, expected }) => {
        fetchSpy.mockImplementation(() => respond());

        await expect(deleteFaction('test-campaign', 'f-1')).rejects.toThrow(expected);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting Faction:', expect.any(Error));
      }
    );
  });
});
