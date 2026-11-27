// @maintained-by-ai 2026-11-27
/**
 * settlementsService — client-side fetch contract for the settlements collection.
 *
 * Lane of the services/campaign/ block (campaignService opener #1857,
 * factionsService #1860 / notesService #1862 / questsService #1863 precedents):
 * per-test fetch-spied, fail-loud default (unmocked fetch throws — never live,
 * per campaign lockdown), full-shape RequestInit censuses via toEqual (no
 * masked objectContaining bodies), assertion-identical failure faces run as an
 * errorFaces() it.each table per function, every error path pins exactly ONE
 * console.error (non-silent doctrine), 409 conflicts route to console.warn as
 * a distinct no-error pair.
 *
 * THIS file owns /api/campaigns/:campaign/settlements (GET/POST, via
 * createJsonEntityCrud) and /api/campaigns/:campaign/settlements/:id-or-name
 * (GET/DELETE via the factory; PUT via the custom upsert route in
 * server/routes/settlements.js).
 *
 * Response shapes pinned against the CURRENT server, NOT canned JSON
 * (verified 2026-11-27 against settlements.js + jsonEntityCrud.js):
 * server/routes/settlements.js delegates CRUD to server/utils/jsonEntityCrud.js
 * (createJsonEntityRouter('settlements', { idField:'name',
 * pluralDisplayName:'settlements', singularDisplayName:'Settlement',
 * validateList: findDuplicateNameError })):
 *  - GET list  → { settlements: [...] } (responseWrapper envelope — the client
 *    passes it through; Settlements.jsx unwraps via useEntityManagement
 *    responseKey:'settlements', Sessions.jsx via value?.settlements || []).
 *    Collection routes loadOrInit() the file, so a missing
 *    campaign/settlements.json returns { settlements: [] } — this endpoint
 *    family never 404s 'Campaign not found' on the collection leg.
 *  - GET item  → { settlement: entity } (itemWrapper), 404 { error:
 *    'Settlement not found' } — Title-case: settlements.js passes an explicit
 *    singularDisplayName:'Settlement' to the factory (both the file-missing
 *    and name-missing legs).
 *  - PUT (custom upsert by :settlementName) → { success: true,
 *    settlement: stampedSettlement }; 400 'Settlement name is required' or
 *    'A settlement with that name already exists' (rename collision); 409
 *    concurrent-edit AND 409 resurrection-refusal bodies both carry
 *    { conflict: true } — same client shape, one warn path covers both.
 *  - DELETE    → { success: true } only, sent with NO headers. Missing-id
 *    deletes now 404 'Settlement not found' like missing files (run-G
 *    backlog — the old silent-200 idempotency is retired); the 404 face
 *    below is the server truth.
 *  - 500 body  → { error: <message> } via server/utils/asyncHandler.js;
 *    the client's `error || 'Failed to …'` generic fallback is defensive
 *    (server always sends { error }) — pinned as the client's own string.
 *  - The whole lane is GM-gated (refuseUnlessGm, settlements.js:131-142);
 *    the 403 is SERVER-side behavior — the client just extracts body.error,
 *    which the non-2xx table face pins generically.
 *
 * SSE: the server DOES broadcast now — settlement POST/PUT/DELETE publish
 * `settlements-list-<campaign>` (settlements.js:24-34, :112). That is
 * invisible at this client fetch seam (no client reads the channel via these
 * service functions); broadcast behavior is owned by the server route tests.
 *
 * URL encoding is raw-id single-encode (encodeURIComponent on campaign and
 * name at the call site — block-standard %252F double-encode audit: clean).
 * Encoded faces are pinned once per leg-type: collection leg via
 * loadSettlements, item legs via saveSettlement's rename / loadSettlement /
 * deleteSettlement.
 *
 * Consumers (liveness verified 2026-11-27): Settlements.jsx (GM panel,
 * localhost-only management per AGENTS.md) wires loadSettlements /
 * saveSettlement (PUT, incl. rename via oldName) / deleteSettlement via
 * useEntityManagement; loadSettlements also feeds the Sessions.jsx and
 * AiWorldConsole pickers and draftActions.js. loadSettlement is LIVE via
 * seededCampaign.js (seed reroll reads the seeded row). saveSettlement (PUT)
 * also runs through seededCampaign.js and draftActions.js. `saveSettlements`
 * (POST) is a ZERO-CALLER export repo-wide — unpinned per dead-export canon;
 * flagged for source removal (no-legacy-compat policy).
 *
 * No timers, no localStorage game state — pure fetch boundary (server-first
 * state lives in settlements.json via these routes).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveSettlement,
  loadSettlements,
  loadSettlement,
  deleteSettlement,
} from './settlementsService.js';

/**
 * Assertion-identical failure faces shared by every function:
 *  1. non-2xx WITH a server { error } body — the message surfaces verbatim;
 *  2. non-2xx WITHOUT an error field — the client's generic fallback string;
 *  3. network rejection — the original error propagates unchanged.
 * Each face must land exactly one console.error with the function's prefix
 * and never touch console.warn (conflicts are the separate pinned pair).
 */
const errorFaces = ({ generic, serverStatus = 500, serverMessage = 'Server-side failure' }) => [
  {
    title: 'non-2xx with a server { error } body surfaces the server message',
    respond: () => ({
      ok: false,
      status: serverStatus,
      statusText: serverStatus === 404 ? 'Not Found' : 'Internal Server Error',
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
    // LIVE: Settlements.jsx handleSave + seededCampaign.js + draftActions.js
    // (PUT upsert; server answers { success: true, settlement: stamped }).
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

    it('routes a handled 409 PUT-lane conflict to console.warn — never a red ERROR (improve 2026-10-27-H)', async () => {
      // server truth: settlements.js PUT guards (hasUpdateConflict AND
      // isResurrectionAttempt) both answer conflictErrorBody (noun
      // 'Settlement', conflict: true) — the banner owns user feedback;
      // console stays amber.
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

    it.each(
      errorFaces({
        generic: 'Failed to save settlement',
        serverStatus: 400,
        serverMessage: 'A settlement with that name already exists',
      })
    )('$title', async ({ respond, expected }) => {
      fetchSpy.mockImplementation(() => respond());

      await expect(saveSettlement('test-campaign', { name: 'waterdeep' })).rejects.toThrow(expected);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving settlement:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('loadSettlements', () => {
    // LIVE: Settlements.jsx via useEntityManagement(responseKey:'settlements'),
    // Sessions.jsx + AiWorldConsole pickers, draftActions.js.
    it('GETs the encoded collection and passes the server list envelope through', async () => {
      const envelope = { settlements: [{ name: 'Waterdeep', type: 'city', population: 90000 }] };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(envelope),
      });

      const result = await loadSettlements('my campaign/1');

      // passthrough of { settlements } envelope — consumers unwrap it;
      // loadOrInit makes a missing file { settlements: [] }, never 404
      expect(result).toEqual(envelope);
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/my%20campaign%2F1/settlements', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it.each(
      errorFaces({ generic: 'Failed to load settlements', serverMessage: 'Failed to read settlements' })
    )('$title', async ({ respond, expected }) => {
      fetchSpy.mockImplementation(() => respond());

      await expect(loadSettlements('test-campaign')).rejects.toThrow(expected);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading settlements:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('loadSettlement', () => {
    // LIVE: seededCampaign.js reads the seeded row back (reroll lane); server
    // truth: itemWrapper envelope, Title-case 'Settlement not found' 404s.
    it('GETs the item route with campaign and settlement name single-encoded and returns the server envelope', async () => {
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

    it.each(
      errorFaces({
        generic: 'Failed to load settlement',
        serverStatus: 404,
        serverMessage: 'Settlement not found',
      })
    )('$title', async ({ respond, expected }) => {
      fetchSpy.mockImplementation(() => respond());

      await expect(loadSettlement('test-campaign', 'nonexistent')).rejects.toThrow(expected);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading settlement:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('deleteSettlement', () => {
    // LIVE: Settlements.jsx handleDelete → useEntityManagement deleteItem.
    it('sends DELETE with no headers and encoded ids and returns { success: true } only', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await deleteSettlement('campaign/1', 'settlement/abc');

      // server truth: { success: true } only (no deleted-name key)
      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/settlements/settlement%2Fabc',
        { method: 'DELETE' }
      );
    });

    it.each(
      errorFaces({
        generic: 'Failed to delete settlement',
        serverStatus: 404,
        serverMessage: 'Settlement not found',
      })
    )('$title', async ({ respond, expected }) => {
      fetchSpy.mockImplementation(() => respond());

      // server truth (run-G): missing-name deletes 404 like missing files —
      // the old silent-200 idempotency leg is retired
      await expect(deleteSettlement('test-campaign', 'nonexistent')).rejects.toThrow(expected);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting settlement:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});
