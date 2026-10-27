// @maintained-by-ai
/**
 * factionsService — client-side fetch contract for the factions collection.
 *
 * Lane of the services/campaign/ block (queue #2012, second lane of this
 * block); canonical idiom from campaignService.test.js (#2002): per-test
 * fetch-spied, fail-loud default (unmocked fetch throws — never live, per
 * campaign lockdown), console.error pins on the service's rethrow-with-log
 * swallows, exact request/response shapes.
 *
 * THIS file owns `/api/campaigns/:campaign/factions` and
 * `/api/campaigns/:campaign/factions/:id` (GET/POST list, GET/DELETE item).
 *
 * Response shapes pinned against the server, NOT canned JSON:
 * server/routes/factions.js delegates to server/utils/jsonEntityCrud.js
 * (createJsonEntityRouter('factions')):
 *  - GET list  → { factions: [...] }  (responseWrapper envelope — the client
 *    passes it through; Factions.jsx unwraps via useEntityManagement
 *    responseKey:'factions'). Collection routes loadOrInit() the file, so a
 *    missing campaign/factions.json returns { factions: [] } — this endpoint
 *    family never 404s 'Campaign not found' on the collection leg.
 *  - GET item  → { faction: entity }  (itemWrapper), 404 { error:
 *    'Faction not found' } when the file or the id is missing.
 *  - POST      → { success: true } only (no extra keys), 400 { error:
 *    'Expected an array for factions' } or the findDuplicateNameError
 *    message from server/utils/nameUniqueness.js.
 *  - DELETE    → { success: true } only; DELETE is sent with no headers.
 *  - 500 body  → { error: <message> } via server/utils/asyncHandler.js;
 *    the client's `error || 'Failed to …'` generic fallback is defensive
 *    (server always sends { error }) — pinned as the client's own string.
 *
 * Consumers: src/components/factions/Factions.jsx (GM factions panel,
 * localhost-only management per AGENTS.md) wires load/save/delete into
 * useEntityManagement. `loadFaction` has no production consumer today —
 * kept as endpoint-contract coverage, flagged in the lane report.
 *
 * No timers, no localStorage game state — pure fetch boundary (server-first
 * state lives in factions.json via these routes).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadFactions, saveFactions, loadFaction, deleteFaction } from './factionsService.js';

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
    it('returns the server list envelope and pins the exact GET request', async () => {
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

      const result = await loadFactions('test-campaign');

      // passthrough of { factions } envelope — Factions.jsx unwraps via responseKey
      expect(result).toEqual({ factions: envelope.factions });
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/factions', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('URL-encodes the campaign name; empty collection passes through as { factions: [] }', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ factions: [] }),
      });

      const result = await loadFactions('my campaign/1');

      expect(result).toEqual({ factions: [] });
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/my%20campaign%2F1/factions', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('extracts the server error message and logs on a failed response', async () => {
      // server truth: jsonEntityCrud read failure surfaces through
      // asyncHandler as 500 { error: 'Failed to read Factions' }
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Failed to read Factions' }),
      });

      await expect(loadFactions('test-campaign')).rejects.toThrow('Failed to read Factions');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading Factions:', expect.any(Error));
    });

    it('falls back to its own generic message when the error body has no error field', async () => {
      // defensive client branch — the server always sends { error }
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadFactions('test-campaign')).rejects.toThrow('Failed to load Factions');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading Factions:', expect.any(Error));
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadFactions('test-campaign')).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading Factions:', expect.any(Error));
    });
  });

  describe('saveFactions', () => {
    it('POSTs the exact factions body and returns the server { success: true } envelope', async () => {
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

    it('URL-encodes the campaign name; empty-array overwrite sends exact body', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      await saveFactions('my campaign/1', []);

      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/my%20campaign%2F1/factions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factions: [] }),
      });
    });

    it('extracts the server 400 duplicate-name error and logs', async () => {
      // server truth: validateList → findDuplicateNameError(factions, 'faction')
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'A faction with that name already exists' }),
      });

      await expect(
        saveFactions('test-campaign', [{ name: 'Harpers' }, { name: 'harpers' }])
      ).rejects.toThrow('A faction with that name already exists');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving Factions:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
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
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('falls back to its own generic message when the error body has no error field', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(saveFactions('test-campaign', [])).rejects.toThrow('Failed to save Factions');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving Factions:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(saveFactions('test-campaign', [])).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving Factions:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('loadFaction', () => {
    // No production consumer today (Factions.jsx lists via loadFactions);
    // pinned as the item-route contract against jsonEntityCrud's itemWrapper.
    it('returns the server item envelope and URL-encodes campaign and faction id', async () => {
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

    it('extracts the server 404 error and logs', async () => {
      // server truth: { error: 'Faction not found' } for file-missing and
      // id-missing (jsonEntityCrud GET :id)
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Faction not found' }),
      });

      await expect(loadFaction('test-campaign', 'missing-id')).rejects.toThrow('Faction not found');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading Faction:', expect.any(Error));
    });

    it('falls back to its own generic message when the error body has no error field', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadFaction('test-campaign', 'f-1')).rejects.toThrow('Failed to load Faction');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading Faction:', expect.any(Error));
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadFaction('test-campaign', 'f-1')).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading Faction:', expect.any(Error));
    });
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

    it('extracts the server 404 error and logs', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Faction not found' }),
      });

      await expect(deleteFaction('test-campaign', 'missing-id')).rejects.toThrow('Faction not found');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting Faction:', expect.any(Error));
    });

    it('falls back to its own generic message when the error body has no error field', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(deleteFaction('test-campaign', 'f-1')).rejects.toThrow('Failed to delete Faction');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting Faction:', expect.any(Error));
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(deleteFaction('test-campaign', 'f-1')).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting Faction:', expect.any(Error));
    });
  });
});
