// @maintained-by-ai 2026-11-27
/**
 * questsService — client-side fetch contract for the campaign-quests family.
 *
 * Lane of the services/campaign/ block (campaignService opener #1857,
 * factionsService precedent #1860, notesService precedent #1862): per-test
 * fetch-spied, fail-loud default (unmocked fetch throws — never live, per
 * campaign lockdown), full-shape RequestInit censuses via toEqual (no masked
 * objectContaining bodies), assertion-identical failure faces run as an
 * errorFaces() it.each table per function, every error path pins exactly ONE
 * console.error (non-silent doctrine), 409 conflicts route to console.warn as
 * a distinct no-error pair.
 *
 * THIS file owns `/api/campaigns/:campaign/quests` (GET list, POST full-array
 * overwrite), `/api/campaigns/:campaign/quests/board` (GET, player-facing) and
 * `/api/campaigns/:campaign/quests/:id` (DELETE).
 *
 * Response shapes pinned against the server, NOT canned JSON:
 * server/routes/quests.js delegates CRUD to server/utils/jsonEntityCrud.js
 * (createJsonEntityRouter('quests')) — pure CRUD, NO custom legs (no status
 * transition / completion / assign-to-session routes; quest `status` is a
 * client form field persisted through the full-array POST):
 *  - GET list  → { quests: [...] } (responseWrapper envelope). UNLIKE the
 *    notes/factions siblings, the client UNWRAPS here: loadQuests resolves to
 *    the ARRAY (data.quests || []). Quests.jsx consumes it via
 *    useEntityManagement with NO responseKey (array contract);
 *    AiWorldConsole/Sessions pickers, applyWorldProposal.js, draftActions.js
 *    and seededCampaign.js all rely on the bare-array contract. Collection
 *    routes loadEntityList() the file (missing file → seeded []), so this leg
 *    never 404s 'Campaign not found'.
 *  - GET board (quests.js, mounted BEFORE the GM gate — the ONLY
 *    visitor-open door on this path) → { quests: whitelisted rows }; the
 *    field-whitelist (GM `notes` never leave the server) and draft-drop are
 *    SERVER-side behavior (pinned by server route tests) — this lane pins
 *    only the client's unwrap-to-array and its `|| []` missing-key fallback,
 *    pinned SEPARATELY from the GM CRUD unwraps (player quest-board lane:
 *    QuestBoard.jsx, FirstSessionChecklist.jsx; read-only, never paired
 *    with a write).
 *  - POST      → { success: true } only; the client returns UNDEFINED
 *    (unlike notesService.saveNotes' envelope passthrough). 400 { error:
 *    'A quest with that name already exists' } via
 *    validateList → findDuplicateNameError(quests, 'quest'); 409
 *    concurrent-edit body carries { conflict: true } — the editor banner
 *    keys its one-click "Reload list" recovery off this flag.
 *  - DELETE    → { success: true } only (no deleted-id key); client returns
 *    UNDEFINED; DELETE is sent with NO headers (exact-request census below).
 *  - GM-only lane gate: refuseUnlessGm wraps the whole factory lane (reads
 *    AND writes) — non-localhost origins get 403 { error: 'Access denied:
 *    GM-only feature' } before any CRUD leg runs. Client-side this is just
 *    another { error } body surfaced verbatim by the serverMessage face.
 *  - 500 body  → { error: <message> } via server/utils/asyncHandler.js
 *    ('Failed to read quests' on the collection GET leg). The client's
 *    `error || 'Failed to …'` generics are defensive, client-only strings
 *    (server always sends { error }) — pinned as such.
 *  - Id encoding: the client encodeURIComponent()s raw ids; production
 *    callers pass raw crypto.randomUUID() ids (Quests.jsx deletes by
 *    raw quest.id), so the raw-id → single-encoded pin is the real contract
 *    (server decodeURIComponent round-trips it). Encoded faces are pinned
 *    once per leg-type: collection GET via loadQuests, collection POST via
 *    saveQuests, board GET via loadQuestBoard, item DELETE via deleteQuest.
 *
 * Consumers (liveness verified 2026-11-27, export-by-export): Quests.jsx
 * (GM quest panel) wires loadQuests/saveQuests/deleteQuest via
 * useEntityManagement; Sessions.jsx picker + AiWorldConsole.jsx consume
 * loadQuests; draftActions.js/seededCampaign.js use the CRUD trio for the
 * draft-approval and seeding lanes; applyWorldProposal.js appends onto
 * loadQuests then saveQuests; QuestBoard.jsx + FirstSessionChecklist.jsx
 * consume loadQuestBoard read-only. `loadQuest` (singular) is a
 * ZERO-CALLER export repo-wide — unpinned per dead-export canon (notes'
 * loadNote precedent); flagged for source removal (no-legacy-compat policy).
 * SSE: routes/quests.js DOES pass jsonEntityCrud a `broadcast` option
 * (broadcastQuestsList → `quests-list-<campaign>` events) — that is a
 * consumer re-fetch concern pinned by Quests.sse-sync.test.jsx, not part of
 * this fetch-boundary lane.
 *
 * No timers, no localStorage game state — pure fetch boundary; quests live
 * server-side in public/campaigns/:campaign/data/quests.json.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadQuests, saveQuests, loadQuestBoard, deleteQuest } from './questsService.js';

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

describe('questsService', () => {
  let fetchSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    // Fail-loud default: any fetch a test forgets to mock rejects instead of
    // reaching a live server (campaign lockdown — never real /api here).
    fetchSpy.mockImplementation((url) => {
      throw new Error(`unmocked fetch in questsService test: ${url}`);
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Warn channel is assertable: a handled 409 conflict must land HERE
    // (improve 2026-10-27-H) while genuine failures stay on console.error.
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadQuests', () => {
    it('unwraps the server list envelope to an array and pins the exact GET request', async () => {
      // server truth: jsonEntityCrud responseWrapper 'quests'; the client
      // UNWRAPS to the array Quests.jsx/useEntityManagement (no responseKey),
      // AiWorldConsole/Sessions pickers and applyWorldProposal/draftActions/
      // seededCampaign consume. GET is fetch(url) — no init, no headers.
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

    it('URL-encodes the campaign name; defensively returns [] when the success body omits the quests key (server always sends { quests })', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const result = await loadQuests('my campaign/1');

      expect(result).toEqual([]);
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/my%20campaign%2F1/quests');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it.each(errorFaces({ generic: 'Failed to load quests', serverMessage: 'Failed to read quests' }))(
      '$title',
      async ({ respond, expected }) => {
        fetchSpy.mockImplementation(() => respond());

        await expect(loadQuests('test-campaign')).rejects.toThrow(expected);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading quests:', expect.any(Error));
      }
    );
  });

  describe('saveQuests', () => {
    it('POSTs the exact full-array overwrite body (campaign name URL-encoded) and returns undefined (server answers { success: true } only)', async () => {
      const quests = [
        { id: '3f9a1c2e-0000-4a7b-9d3e-000000000001', name: 'The Lost Artifact', status: 'active', description: 'Recover the artifact', rewards: '100 gp', notes: '' },
      ];

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await saveQuests('my campaign/1', quests);

      // full-array overwrite, GUID-keyed — no per-entity PUT (Quests.jsx /
      // applyWorldProposal.js / draftActions.js lane); client resolves
      // undefined, not the envelope
      expect(result).toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/my%20campaign%2F1/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quests }),
      });
    });

    it('routes a handled 409 conflict to console.warn — never a red ERROR (improve 2026-10-27-H)', async () => {
      // server truth: conflictErrorBody (jsonEntityCrud.js) — the banner +
      // "Reload list" affordance owns user feedback; console stays amber.
      const conflictMessage =
        'Quest "The Lost Artifact" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: () => Promise.resolve({ error: conflictMessage, conflict: true }),
      });

      const thrown = await saveQuests('test-campaign', []).catch((e) => e);

      expect(thrown).toBeInstanceOf(Error);
      expect(thrown.message).toBe(conflictMessage);
      expect(thrown.conflict).toBe(true); // banner's Reload-list discriminator
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Concurrent-edit conflict saving quests:',
        conflictMessage
      );
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // single warn per rejected save
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it.each(errorFaces({
      generic: 'Failed to save quests',
      serverStatus: 400,
      serverMessage: 'A quest with that name already exists', // validateList → findDuplicateNameError
    }))('$title', async ({ respond, expected }) => {
      fetchSpy.mockImplementation(() => respond());

      await expect(saveQuests('test-campaign', [{ name: 'QA Dup' }])).rejects.toThrow(expected);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving quests:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled(); // only sanctioned 409s reach warn
    });
  });

  describe('loadQuestBoard', () => {
    // Player quest-board lane (QuestBoard.jsx, FirstSessionChecklist.jsx) —
    // the ONLY visitor-open door on /quests; the field whitelist / draft-drop
    // is server-side, pinned by server route tests. Pinned separately from
    // the GM CRUD lanes: this unwrap must survive even if the GM legs move.
    it('GETs the board lane and unwraps the envelope to a plain array (campaign name URL-encoded)', async () => {
      const rows = [
        { id: 'q-1', name: 'The Lost Artifact', status: 'active', description: 'Recover it', rewards: '100 gp' },
        { id: 'q-2', name: 'Defeat the Giant Eagle', status: 'completed', description: '', rewards: '' },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ quests: rows }),
      });

      const result = await loadQuestBoard('my campaign/1');

      expect(result).toEqual(rows); // array, NOT the { quests } envelope
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/my%20campaign%2F1/quests/board');
    });

    it('returns [] when a success body omits the quests key', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      await expect(loadQuestBoard('test-campaign')).resolves.toEqual([]);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it.each(errorFaces({ generic: 'Failed to load quest board' }))('$title', async ({ respond, expected }) => {
      fetchSpy.mockImplementation(() => respond());

      await expect(loadQuestBoard('test-campaign')).rejects.toThrow(expected);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading quest board:', expect.any(Error));
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

    it.each(errorFaces({ generic: 'Failed to delete quest', serverStatus: 404, serverMessage: 'Quest not found' }))(
      '$title',
      async ({ respond, expected }) => {
        fetchSpy.mockImplementation(() => respond());

        await expect(deleteQuest('test-campaign', 'quest-1')).rejects.toThrow(expected);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting quest:', expect.any(Error));
      }
    );
  });
});
