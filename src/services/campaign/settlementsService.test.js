// @maintained-by-ai
/**
 * settlementsService — client-side fetch contract for the settlements collection.
 *
 * Ninth lane of the campaign/ block (queue: travel #2011, weather #2012 close
 * the block). Canonical idiom from campaignService.test.js (#2002): per-test
 * fetch-spied, fail-loud default (unmocked fetch throws — never live, per
 * campaign lockdown), console.error pins on the service's rethrow-with-log
 * swallows, exact request/response shapes.
 *
 * THIS file owns /api/campaigns/:campaign/settlements (GET/POST, via
 * createJsonEntityCrud) and /api/campaigns/:campaign/settlements/:id-or-name
 * (GET/DELETE via the factory; PUT via the custom upsert route in
 * server/routes/settlements.js).
 *
 * Response shapes pinned against the server, NOT canned JSON:
 * server/routes/settlements.js delegates to server/utils/jsonEntityCrud.js
 * (createJsonEntityRouter('settlements', { idField:'name',
 * pluralDisplayName:'settlements', singularDisplayName:'Settlement',
 * validateList: findDuplicateNameError })) — no broadcast option, so no SSE
 * on POST/DELETE; the custom PUT writes directly, also no SSE:
 *  - GET list  → { settlements: [...] } (responseWrapper envelope — the client
 *    passes it through; Settlements.jsx unwraps via useEntityManagement
 *    responseKey:'settlements', Sessions.jsx via value?.settlements || []).
 *    Collection routes loadOrInit() the file, so a missing
 *    campaign/settlements.json returns { settlements: [] } — this endpoint
 *    family never 404s 'Campaign not found' on the collection leg.
 *  - GET item  → { settlement: entity } (itemWrapper), 404 { error:
 *    'Settlement not found' } — Title-case: settlements.js passes an explicit
 *    singularDisplayName:'Settlement' to the factory.
 *  - POST      → { success: true } only (no savedCount), 400 { error:
 *    'Expected an array for settlements' } or the findDuplicateNameError
 *    message 'A settlement with that name already exists'.
 *  - PUT (custom upsert by :settlementName) → { success: true,
 *    settlement: updatedSettlement }; 400 'Settlement name is required' or
 *    'A settlement with that name already exists' (rename collision);
 *    500 { error: 'Failed to update settlement' } via asyncHandler.
 *  - DELETE    → { success: true } only (no deleted-name key), sent with no
 *    headers; idempotent when the file exists but the name is absent —
 *    404 'Settlement not found' on both the file-missing and name-missing legs.
 *  - 500 body  → { error: <message> } via server/utils/asyncHandler.js;
 *    the client's `error || 'Failed to …'` generic fallback is defensive
 *    (server always sends { error }) — pinned as the client's own string.
 *
 * URL encoding is raw-id single-encode (encodeURIComponent on campaign and
 * name at the call site — block-standard %252F double-encode audit: clean).
 *
 * Consumers: Settlements.jsx (GM panel, localhost-only management per
 * AGENTS.md) uses loadSettlements / saveSettlement (PUT, incl. rename via
 * oldName) / deleteSettlement; Sessions.jsx uses loadSettlements for its
 * resource picker. `saveSettlements` (POST) and `loadSettlement` have no
 * production consumer today — kept as endpoint-contract coverage, flagged in
 * the lane report.
 *
 * No timers, no localStorage game state — pure fetch boundary (server-first
 * state lives in settlements.json via these routes).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveSettlement,
  loadSettlements,
  saveSettlements,
  loadSettlement,
  deleteSettlement,
} from './settlementsService.js';

describe('settlementsService', () => {
  let fetchSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    // Fail-loud default: any fetch a test forgets to mock rejects instead of
    // reaching a live server (campaign lockdown — never real /api here).
    fetchSpy.mockImplementation((url) => {
      throw new Error(`unmocked fetch in settlementsService test: ${url}`);
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Warn channel is assertable: a handled 409 conflict must land HERE
    // (improve 2026-10-27-H) while genuine failures stay on console.error.
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveSettlement', () => {
    // LIVE: Settlements.jsx handleSave (PUT upsert; server answers
    // { success: true, settlement: updatedSettlement }).
    it('PUTs the exact settlement body at the name URL and returns the server PUT envelope', async () => {
      const settlement = {
        name: 'Waterdeep',
        type: 'city',
        population: 90000,
        description: 'City of Skilled Hands',
        rumors: ['The Masked Lords still rule in secret.'],
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, settlement }),
      });

      const result = await saveSettlement('test-campaign', settlement);

      expect(result).toEqual({ success: true, settlement });
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/test-campaign/settlements/Waterdeep',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settlement),
        }
      );
    });

    it('rename PUTs at the oldName URL, single-encoded campaign and name', async () => {
      const settlement = { name: 'New Name', type: 'town' };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, settlement }),
      });

      const result = await saveSettlement('campaign/1', settlement, 'Old/Name');

      // oldName addresses the existing entry; new name travels in the body
      expect(result).toEqual({ success: true, settlement });
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/settlements/Old%2FName',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settlement),
        }
      );
    });

    it('extracts the server 400 rename-collision error and logs', async () => {
      // server truth: custom PUT guard mirrors npcs.js — a rename that
      // collides case-insensitively answers 400 with this exact message
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'A settlement with that name already exists' }),
      });

      await expect(
        saveSettlement('test-campaign', { name: 'waterdeep' }, 'Neverwinter')
      ).rejects.toThrow('A settlement with that name already exists');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving settlement:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('routes a handled 409 PUT-lane conflict to console.warn — never a red ERROR (improve 2026-10-27-H)', async () => {
      // server truth: settlements.js PUT guard -> conflictErrorBody (noun
      // 'Settlement') — the banner owns user feedback; console stays amber.
      const conflictMessage =
        'Settlement "Waterdeep" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: () => Promise.resolve({ error: conflictMessage, conflict: true }),
      });

      const thrown = await saveSettlement('test-campaign', { name: 'Waterdeep' }).catch((e) => e);

      expect(thrown).toBeInstanceOf(Error);
      expect(thrown.message).toBe(conflictMessage);
      expect(thrown.conflict).toBe(true); // banner's Reload-list discriminator
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Concurrent-edit conflict saving settlement:',
        conflictMessage
      );
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // single warn per rejected save
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('falls back to its own generic message when the error body has no error field', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(saveSettlement('test-campaign', { name: 'Test' })).rejects.toThrow('Failed to save settlement');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving settlement:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(saveSettlement('test-campaign', { name: 'Test' })).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving settlement:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('loadSettlements', () => {
    // LIVE: Settlements.jsx via useEntityManagement(responseKey:'settlements')
    // and the Sessions.jsx resource picker.
    it('returns the server list envelope and pins the exact GET request', async () => {
      const envelope = {
        settlements: [
          { name: 'Waterdeep', type: 'city', population: 90000 },
          { name: "Baldur's Gate", type: 'city', population: 50000 },
        ],
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(envelope),
      });

      const result = await loadSettlements('test-campaign');

      // passthrough of { settlements } envelope — consumers unwrap it
      expect(result).toEqual(envelope);
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/settlements', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('URL-encodes the campaign name; loadOrInit missing file is { settlements: [] }, never 404', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ settlements: [] }),
      });

      const result = await loadSettlements('my campaign/1');

      expect(result).toEqual({ settlements: [] });
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/my%20campaign%2F1/settlements', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('extracts the server 500 read error and logs', async () => {
      // server truth: jsonEntityCrud read failure surfaces through
      // asyncHandler as 500 { error: 'Failed to read settlements' }
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Failed to read settlements' }),
      });

      await expect(loadSettlements('test-campaign')).rejects.toThrow('Failed to read settlements');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading settlements:', expect.any(Error));
    });

    it('falls back to its own generic message when the error body has no error field', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadSettlements('test-campaign')).rejects.toThrow('Failed to load settlements');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading settlements:', expect.any(Error));
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadSettlements('test-campaign')).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading settlements:', expect.any(Error));
    });
  });

  describe('saveSettlements', () => {
    // No production consumer today (Settlements.jsx saves single via PUT);
    // pinned as the collection-overwrite POST contract against jsonEntityCrud.
    it('POSTs the exact encoded-campaign body and returns { success: true } only', async () => {
      const settlements = [
        { name: 'Waterdeep', type: 'city' },
        { name: "Baldur's Gate", type: 'city' },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await saveSettlements('my campaign/1', settlements);

      // server overwrites the whole array and answers { success: true } only
      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/my%20campaign%2F1/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settlements }),
      });
    });

    it('extracts the server 400 duplicate-name error and logs', async () => {
      // server truth: validateList → findDuplicateNameError(settlements, 'settlement')
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'A settlement with that name already exists' }),
      });

      await expect(
        saveSettlements('test-campaign', [{ name: 'Waterdeep' }, { name: 'waterdeep' }])
      ).rejects.toThrow('A settlement with that name already exists');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving settlements:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('routes a handled 409 POST-lane conflict to console.warn — never a red ERROR (improve 2026-10-27-H)', async () => {
      // server truth: jsonEntityCrud POST findConcurrentWrite → conflictErrorBody
      const conflictMessage =
        'Settlement "Waterdeep" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: () => Promise.resolve({ error: conflictMessage, conflict: true }),
      });

      const thrown = await saveSettlements('test-campaign', []).catch((e) => e);

      expect(thrown).toBeInstanceOf(Error);
      expect(thrown.message).toBe(conflictMessage);
      expect(thrown.conflict).toBe(true); // banner's Reload-list discriminator
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Concurrent-edit conflict saving settlements:',
        conflictMessage
      );
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // single warn per rejected save
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('falls back to its own generic message when the error body has no error field', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(saveSettlements('test-campaign', [])).rejects.toThrow('Failed to save settlements');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving settlements:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(saveSettlements('test-campaign', [])).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving settlements:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('loadSettlement', () => {
    // No production consumer today (panels list via loadSettlements); pinned
    // as the item-route contract against jsonEntityCrud's itemWrapper.
    it('returns the server item envelope and URL-encodes campaign and settlement name', async () => {
      const settlement = {
        name: 'settlement/abc',
        type: 'city',
        population: 90000,
        description: 'City of Skilled Hands',
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ settlement }),
      });

      const result = await loadSettlement('campaign/1', 'settlement/abc');

      expect(result).toEqual({ settlement });
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/settlements/settlement%2Fabc',
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    it('extracts the server 404 error and logs', async () => {
      // server truth: Title-case 'Settlement not found' — settlements.js
      // passes singularDisplayName:'Settlement' to jsonEntityCrud (both the
      // file-missing and id-missing legs)
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Settlement not found' }),
      });

      await expect(loadSettlement('test-campaign', 'nonexistent')).rejects.toThrow('Settlement not found');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading settlement:', expect.any(Error));
    });

    it('falls back to its own generic message when the error body has no error field', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadSettlement('test-campaign', 'Waterdeep')).rejects.toThrow('Failed to load settlement');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading settlement:', expect.any(Error));
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadSettlement('test-campaign', 'Waterdeep')).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading settlement:', expect.any(Error));
    });
  });

  describe('deleteSettlement', () => {
    // LIVE: Settlements.jsx handleDelete → useEntityManagement deleteItem.
    it('sends DELETE with no headers, encoded ids, and returns { success: true } only', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await deleteSettlement('campaign/1', 'settlement/abc');

      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/settlements/settlement%2Fabc',
        { method: 'DELETE' }
      );

      // server truth: DELETE is idempotent when the file exists but the
      // name is absent — filter + rewrite still answers { success: true }
      const missingResult = await deleteSettlement('test-campaign', 'nonexistent');
      expect(missingResult).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenLastCalledWith(
        '/api/campaigns/test-campaign/settlements/nonexistent',
        { method: 'DELETE' }
      );
    });

    it('extracts the server 404 error and logs', async () => {
      // server truth: 404 only on the file-missing leg — lowercase message
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Settlement not found' }),
      });

      await expect(deleteSettlement('test-campaign', 'nonexistent')).rejects.toThrow('Settlement not found');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting settlement:', expect.any(Error));
    });

    it('falls back to its own generic message when the error body has no error field', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(deleteSettlement('test-campaign', 'Waterdeep')).rejects.toThrow('Failed to delete settlement');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting settlement:', expect.any(Error));
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(deleteSettlement('test-campaign', 'Waterdeep')).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting settlement:', expect.any(Error));
    });
  });
});
