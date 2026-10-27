// @maintained-by-ai
/**
 * questsService — client-side fetch contract for the GM campaign-quests family.
 *
 * Lane of the services/campaign/ block (campaignService.test.js map #2002,
 * factionsService precedent #2003, notesService precedent #2005): per-test
 * fetch-spied, fail-loud default (unmocked fetch throws — never live, per
 * campaign lockdown), exact request shapes, server-truth response envelopes,
 * error-body extraction vs the client's own generic fallbacks, console.error
 * pins on every rethrow-with-log swallow.
 *
 * THIS file owns `/api/campaigns/:campaign/quests` (GET list, POST full-array
 * overwrite) and `/api/campaigns/:campaign/quests/:id` (GET item, DELETE).
 *
 * Response shapes pinned against the server, NOT canned JSON:
 * server/routes/quests.js delegates to server/utils/jsonEntityCrud.js
 * (createJsonEntityRouter('quests')) — pure CRUD, NO custom legs (no status
 * transition / completion / assign-to-session routes; quest `status` is a
 * client form field persisted through the full-array POST):
 *  - GET list  → { quests: [...] } (responseWrapper envelope). UNLIKE the
 *    notes family, the client UNWRAPS here: loadQuests resolves to the
 *    ARRAY (data.quests || []). Quests.jsx consumes it via useEntityManagement
 *    with NO responseKey (array contract); applyWorldProposal.js appends onto
 *    it. Collection routes loadOrInit() the file, so a missing
 *    campaign/quests.json returns { quests: [] } — this leg never 404s
 *    'Campaign not found'. Server-side localhost transformList/authorizeRead
 *    lives in server/routes/quests.test.js + quests-duplicate-name.test.js.
 *  - GET item  → { quest: entity } (itemWrapper), 404 { error: 'Quest not
 *    found' } (Title-case, jsonEntityCrud singularDisplayName:'Quest') when
 *    the file or id is missing; 403 { error: 'Access denied: GM-only
 *    feature' } via authorizeRead/forbiddenMessage — quests' own flavor.
 *    authorizeRead is NOT wired on the DELETE leg (server-truth).
 *  - POST      → { success: true } only; the client returns UNDEFINED
 *    (unlike notesService.saveNotes' envelope passthrough). 400 { error:
 *    'Expected an array for quests' } and 400 { error: 'A quest with that
 *    name already exists' } via validateList → nameUniqueness.js.
 *  - DELETE    → { success: true } only (no deleted-id key); client returns
 *    UNDEFINED; DELETE is sent with NO headers (exact-request pin below).
 *  - 500 body  → { error: <message> } via server/utils/asyncHandler.js
 *    ('Failed to read quests' collection leg, 'Failed to read quest'
 *    singular on the item leg). The client's `error || 'Failed to …'`
 *    generics are defensive, client-only strings (server always sends
 *    { error }) — pinned as such.
 *  - Id encoding: the client encodeURIComponent()s raw ids; production
 *    callers pass raw crypto.randomUUID() ids (Quests.jsx), so the raw-id →
 *    single-encoded pin is the real contract (server decodeURIComponent
 *    round-trips it). Pre-encoded inputs double-encode (%252F) — not the
 *    contract; the #2005 anti-pattern was removed here.
 *
 * Consumers (liveness verified): src/components/quests/Quests.jsx (GM quest
 * panel, localhost-only management per AGENTS.md) wires load/save/delete via
 * useEntityManagement and deletes by raw quest.id; src/components/sessions/
 * Sessions.jsx loadResourceOptions lists quests for the session-planner
 * linked-resources picker (quests↔sessions cross-reference — planner lane
 * #2008, cited not absorbed); src/services/ai/applyWorldProposal.js
 * quest_draft → loadQuests → append → saveQuests CRUD lane (own test file).
 * `loadQuest` has no production consumer today — kept as item-route contract
 * coverage, flagged in the lane report.
 * No SSE consumer: routes/quests.js does NOT pass jsonEntityCrud's
 * `broadcast` option (default null), so quest changes are not pushed —
 * panels reload on mount.
 *
 * No timers, no localStorage game state — pure fetch boundary; quests live
 * server-side in public/campaigns/:campaign/data/quests.json.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadQuests, saveQuests, loadQuest, deleteQuest } from './questsService.js';

describe('questsService', () => {
  let fetchSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    // Fail-loud default: any fetch a test forgets to mock rejects instead of
    // reaching a live server (campaign lockdown — never real /api here).
    fetchSpy.mockImplementation((url) => {
      throw new Error(`unmocked fetch in questsService test: ${url}`);
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadQuests', () => {
    it('unwraps the server list envelope to an array and pins the exact GET request', async () => {
      // server truth: jsonEntityCrud responseWrapper 'quests'; the client
      // UNWRAPS to the array Quests.jsx/useEntityManagement (no responseKey)
      // and applyWorldProposal.js consume. GET is fetch(url) — no headers.
      const envelope = {
        quests: [
          { id: '3f9a1c2e-0000-4a7b-9d3e-000000000001', name: 'The Lost Artifact', status: 'active', description: 'Recover the artifact', rewards: '100 gp', notes: '' },
          { id: '3f9a1c2e-0000-4a7b-9d3e-000000000002', name: 'Defeat the Giant Eagle', status: 'completed', description: '', rewards: '', notes: 'done' },
        ],
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(envelope),
      });

      const result = await loadQuests('test-campaign');

      expect(result).toEqual(envelope.quests);
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/quests');
    });

    it('URL-encodes the campaign name; empty collection passes through as []', async () => {
      // server truth: loadOrInit() answer for a missing campaign/quests.json
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ quests: [] }),
      });

      const result = await loadQuests('my campaign/1');

      expect(result).toEqual([]);
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/my%20campaign%2F1/quests');
    });

    it('defensively returns [] when the envelope has no quests key (server always sends { quests })', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      await expect(loadQuests('test-campaign')).resolves.toEqual([]);
    });

    it('extracts the server 500 error and logs', async () => {
      // server truth: read failure surfaces through asyncHandler as
      // 500 { error: 'Failed to read quests' } (pluralDisplayName)
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Failed to read quests' }),
      });

      await expect(loadQuests('test-campaign')).rejects.toThrow('Failed to read quests');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading quests:', expect.any(Error));
    });

    it('falls back to its own generic message when the error body has no error field', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadQuests('test-campaign')).rejects.toThrow('Failed to load quests');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading quests:', expect.any(Error));
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadQuests('test-campaign')).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading quests:', expect.any(Error));
    });
  });

  describe('saveQuests', () => {
    it('POSTs the exact quests body and returns undefined (server answers { success: true } only)', async () => {
      const quests = [
        { id: '3f9a1c2e-0000-4a7b-9d3e-000000000001', name: 'The Lost Artifact', status: 'active', description: 'Recover the artifact', rewards: '100 gp', notes: '' },
      ];

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await saveQuests('test-campaign', quests);

      // full-array overwrite, GUID-keyed — no per-entity PUT (Quests.jsx /
      // applyWorldProposal.js lane); client resolves undefined, not the envelope
      expect(result).toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quests }),
      });
    });

    it('URL-encodes the campaign name; empty-array overwrite sends the exact body', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      await saveQuests('my campaign/1', []);

      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/my%20campaign%2F1/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quests: [] }),
      });
    });

    it('extracts the server 400 duplicate-name error and logs', async () => {
      // server truth: validateList → findDuplicateNameError(quests, 'quest')
      // → 400 { error: 'A quest with that name already exists' }
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'A quest with that name already exists' }),
      });

      await expect(saveQuests('test-campaign', [
        { id: 'id-1', name: 'QA Dup' },
        { id: 'id-2', name: 'qa dup' },
      ])).rejects.toThrow('A quest with that name already exists');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving quests:', expect.any(Error));
    });

    it('falls back to its own generic message when the error body has no error field', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(saveQuests('test-campaign', [])).rejects.toThrow('Failed to save quests');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving quests:', expect.any(Error));
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(saveQuests('test-campaign', [])).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving quests:', expect.any(Error));
    });
  });

  describe('loadQuest', () => {
    // No production consumer today (Quests.jsx lists via loadQuests and edits
    // in-memory); pinned as the item-route contract against jsonEntityCrud's
    // itemWrapper. Raw ids are what production callers pass (crypto.randomUUID).
    it('unwraps the server item envelope and pins the exact GET with raw id single-encoded', async () => {
      const quest = { id: 'quest/1', name: 'The Lost Artifact', status: 'active' };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ quest }),
      });

      const result = await loadQuest('my campaign/1', 'quest/1');

      // raw id → single-encoded; server decodeURIComponent round-trips it
      expect(result).toEqual(quest);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign%2F1/quests/quest%2F1'
      );
    });

    it('defensively passes through a missing or null quest key (server itemWrapper always sends { quest })', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
      await expect(loadQuest('test-campaign', 'quest-1')).resolves.toBeUndefined();

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ quest: null }),
      });
      await expect(loadQuest('test-campaign', 'quest-1')).resolves.toBeNull();
    });

    it('extracts the server 404 error and logs', async () => {
      // server truth: { error: 'Quest not found' } (Title-case singularDisplayName)
      // for both file-missing and id-missing (jsonEntityCrud GET :id)
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Quest not found' }),
      });

      await expect(loadQuest('test-campaign', 'missing-id')).rejects.toThrow('Quest not found');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading quest:', expect.any(Error));
    });

    it('extracts the server 403 GM-only error and logs', async () => {
      // server truth: quests' own authorizeRead flavor — 403 { error:
      // 'Access denied: GM-only feature' } for non-localhost item reads
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ error: 'Access denied: GM-only feature' }),
      });

      await expect(loadQuest('test-campaign', 'quest-1')).rejects.toThrow(
        'Access denied: GM-only feature'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading quest:', expect.any(Error));
    });

    it('falls back to its own generic message when the error body has no error field', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadQuest('test-campaign', 'quest-1')).rejects.toThrow('Failed to load quest');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading quest:', expect.any(Error));
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadQuest('test-campaign', 'quest-1')).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading quest:', expect.any(Error));
    });
  });

  describe('deleteQuest', () => {
    it('sends DELETE with no headers, encoded raw id, and returns undefined', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await deleteQuest('my campaign/1', 'quest/1');

      // raw quest.id (crypto.randomUUID) → single-encoded; server answers
      // { success: true } only — no deleted-id key; client resolves undefined
      expect(result).toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign%2F1/quests/quest%2F1',
        { method: 'DELETE' }
      );
    });

    it('extracts the server 404 error and logs', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Quest not found' }),
      });

      await expect(deleteQuest('test-campaign', 'missing-id')).rejects.toThrow('Quest not found');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting quest:', expect.any(Error));
    });

    it('falls back to its own generic message when the error body has no error field', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(deleteQuest('test-campaign', 'quest-1')).rejects.toThrow('Failed to delete quest');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting quest:', expect.any(Error));
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(deleteQuest('test-campaign', 'quest-1')).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting quest:', expect.any(Error));
    });
  });
});
