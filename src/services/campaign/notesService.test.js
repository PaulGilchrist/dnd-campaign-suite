// @maintained-by-ai 2026-11-27
/**
 * notesService — client-side fetch contract for the GM campaign-notes family.
 *
 * Lane of the services/campaign/ block (campaignService.test.js opener #2002,
 * factionsService precedent #1860): per-test fetch-spied, fail-loud default
 * (unmocked fetch throws — never live, per campaign lockdown), full-shape
 * RequestInit censuses via toEqual (no masked objectContaining bodies),
 * assertion-identical failure faces run as an errorFaces() it.each table per
 * function, every error path pins exactly ONE console.error (non-silent
 * doctrine), 409 conflicts route to console.warn as a distinct no-error pair.
 *
 * THIS file owns `/api/campaigns/:campaign/notes` (GET list, POST full-array
 * overwrite) and `/api/campaigns/:campaign/notes/:id` (DELETE).
 *
 * Response shapes pinned against the server, NOT canned JSON:
 * server/routes/notes.js delegates to server/utils/jsonEntityCrud.js
 * (createJsonEntityRouter('notes')):
 *  - GET list  → { notes: [...] } (responseWrapper envelope; the client
 *    passes it through — Notes.jsx unwraps via useEntityManagement
 *    responseKey:'notes', Sessions.jsx picker via value?.notes). Collection
 *    routes loadOrInit() the file, so a missing campaign/notes.json returns
 *    { notes: [] } — this leg never 404s 'Campaign not found'. Server-side
 *    localhost filtering of isPrivate lives in routes/notes.test.js.
 *  - POST      → { success: true } only (no savedCount or other keys); 400
 *    { error: 'Expected an array for notes' }; 409 concurrent-edit conflict
 *    body carries { conflict: true } — the editor banner keys its one-click
 *    "Reload list" recovery off this flag.
 *  - DELETE    → { success: true } only (no deleted-id key); DELETE is sent
 *    with NO headers (exact-request census below). 404 { error: 'Note not
 *    found' } (Title-case, jsonEntityCrud singularDisplayName:'Note').
 *  - 500 body  → { error: <message> } via server/utils/asyncHandler.js
 *    ('Failed to read notes' on the collection GET leg). The client's
 *    `error || 'Failed to …'` generics are defensive, client-only strings
 *    (server always sends { error }) — pinned as such.
 *  - Id encoding: the client encodeURIComponent()s raw inputs; production
 *    callers pass raw crypto.randomUUID() ids (Notes.jsx), so the raw-id →
 *    single-encoded pin is the real contract (server decodeURIComponent
 *    round-trips it). Encoded faces are pinned once per leg-type: collection
 *    leg via loadNotes, item leg via deleteNote.
 *
 * Consumers (liveness verified 2026-11-27): src/components/notes/Notes.jsx
 * (GM notes panel) wires loadNotes/saveNotes/deleteNote via
 * useEntityManagement; src/components/sessions/Sessions.jsx loadResourceOptions
 * and src/components/handouts/SessionOnePager.jsx consume loadNotes read-only.
 * `loadNote` (singular) is a ZERO-CALLER export repo-wide — unpinned per dead-
 * export canon; flagged for source removal (no-legacy-compat policy).
 * No SSE consumer: routes/notes.js does NOT pass jsonEntityCrud's `broadcast`
 * option, so notes changes are not pushed — panels reload on mount.
 *
 * No timers, no localStorage game state — pure fetch boundary; notes live
 * server-side in public/campaigns/:campaign/.../notes.json.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadNotes, saveNotes, deleteNote } from './notesService.js';

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

describe('notesService', () => {
  let fetchSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    // Fail-loud default: any fetch a test forgets to mock rejects instead of
    // reaching a live server (campaign lockdown — never real /api here).
    fetchSpy.mockImplementation((url) => {
      throw new Error(`unmocked fetch in notesService test: ${url}`);
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Warn channel is assertable: a handled 409 conflict must land HERE
    // (improve 2026-10-27-H) while genuine failures stay on console.error.
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadNotes', () => {
    it('GETs the collection with the campaign name URL-encoded and passes the server envelope through', async () => {
      const envelope = {
        notes: [
          { id: 'note-1', description: 'Session recap', isPrivate: false },
          { id: 'note-2', description: 'GM secret', isPrivate: true },
        ],
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(envelope),
      });

      const result = await loadNotes('my campaign/1');

      // passthrough of { notes } envelope — Notes.jsx unwraps via responseKey;
      // a missing notes.json is the same branch server-side (loadOrInit → { notes: [] })
      expect(result).toEqual(envelope);
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/my%20campaign%2F1/notes', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it.each(
      errorFaces({ generic: 'Failed to load notes', serverMessage: 'Failed to read notes' })
    )('$title', async ({ respond, expected }) => {
      fetchSpy.mockImplementation(() => respond());

      await expect(loadNotes('test-campaign')).rejects.toThrow(expected);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading notes:', expect.any(Error));
    });
  });

  describe('saveNotes', () => {
    it('POSTs the exact full-array overwrite body and returns the server { success: true } envelope', async () => {
      const notes = [
        { id: 'note-1', description: 'First note', isPrivate: false },
        { id: 'note-2', description: 'GM secret', isPrivate: true },
      ];

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await saveNotes('test-campaign', notes);

      // server answers a full-array overwrite with { success: true } only
      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
    });

    it('routes a handled 409 conflict to console.warn — never a red ERROR (improve 2026-10-27-H)', async () => {
      // server truth: conflictErrorBody (jsonEntityCrud.js:88) — the banner +
      // "Reload list" affordance owns user feedback; console stays amber.
      const conflictMessage =
        'Note "Skull Creek Cave" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: () => Promise.resolve({ error: conflictMessage, conflict: true }),
      });

      const thrown = await saveNotes('test-campaign', []).catch((e) => e);

      expect(thrown).toBeInstanceOf(Error);
      expect(thrown.message).toBe(conflictMessage);
      expect(thrown.conflict).toBe(true); // banner's Reload-list discriminator
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Concurrent-edit conflict saving notes:',
        conflictMessage
      );
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // single warn per rejected save
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it.each(
      errorFaces({
        generic: 'Failed to save notes',
        serverStatus: 400,
        serverMessage: 'Expected an array for notes', // non-array body rejection
      })
    )('$title', async ({ respond, expected }) => {
      fetchSpy.mockImplementation(() => respond());

      await expect(saveNotes('test-campaign', 'not an array')).rejects.toThrow(expected);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving notes:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled(); // only sanctioned 409s reach warn
    });
  });

  describe('deleteNote', () => {
    it('sends DELETE with no headers, campaign and raw note id URL-encoded, and returns { success: true }', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await deleteNote('my campaign/1', 'note/1');

      // server answers with { success: true } only — no deleted-id key
      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/my%20campaign%2F1/notes/note%2F1', {
        method: 'DELETE',
      });
    });

    it.each(
      errorFaces({
        generic: 'Failed to delete note',
        serverStatus: 404,
        serverMessage: 'Note not found', // jsonEntityCrud singularDisplayName
      })
    )('$title', async ({ respond, expected }) => {
      fetchSpy.mockImplementation(() => respond());

      await expect(deleteNote('test-campaign', 'missing-id')).rejects.toThrow(expected);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting note:', expect.any(Error));
    });
  });
});
