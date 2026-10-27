// @maintained-by-ai
/**
 * notesService — client-side fetch contract for the GM campaign-notes family.
 *
 * Lane of the services/campaign/ block (campaignService.test.js map #2002,
 * factionsService precedent #2003, inventoryService precedent #2004):
 * per-test fetch-spied, fail-loud default (unmocked fetch throws — never
 * live, per campaign lockdown), exact request shapes, server-truth response
 * envelopes, error-body extraction vs the client's own generic fallbacks,
 * console.error pins on every rethrow-with-log swallow.
 *
 * THIS file owns `/api/campaigns/:campaign/notes` (GET list, POST full-array
 * overwrite) and `/api/campaigns/:campaign/notes/:id` (GET item, DELETE).
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
 *  - GET item  → { note: entity } (itemWrapper), 404 { error: 'Note not
 *    found' } (Title-case, jsonEntityCrud singularDisplayName:'Note') when
 *    the file or id is missing; 403 { error: 'Access denied: private note' }
 *    via authorizeRead/forbiddenMessage — the notes family's own flavor.
 *  - POST      → { success: true } only (no savedCount or other keys); 400
 *    { error: 'Expected an array for notes' }.
 *  - DELETE    → { success: true } only (no deleted-id key); DELETE is sent
 *    with NO headers (exact-request pin below).
 *  - 500 body  → { error: <message> } via server/utils/asyncHandler.js
 *    ('Failed to read notes'/'Failed to save notes' on collection legs).
 *    The client's `error || 'Failed to …'` generics are defensive,
 *    client-only strings (server always sends { error }) — pinned as such.
 *  - Id encoding: the client encodeURIComponent()s raw ids; production
 *    callers pass raw crypto.randomUUID() ids (Notes.jsx), so the raw-id →
 *    single-encoded pin is the real contract (server decodeURIComponent
 *    round-trips it). Pre-encoded inputs double-encode — not the contract.
 *
 * Consumers (liveness verified): src/components/notes/Notes.jsx (GM notes
 * panel, localhost-only management per AGENTS.md) wires load/save/delete via
 * useEntityManagement; src/components/sessions/Sessions.jsx loadResourceOptions
 * lists notes for the session planner. `loadNote` has no production consumer
 * today — kept as item-route contract coverage, flagged in the lane report.
 * No SSE consumer: routes/notes.js does NOT pass jsonEntityCrud's `broadcast`
 * option, so notes changes are not pushed — panels reload on mount.
 *
 * No timers, no localStorage game state — pure fetch boundary; notes live
 * server-side in public/campaigns/:campaign/.../notes.json.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadNotes, saveNotes, loadNote, deleteNote } from './notesService.js';

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
    it('returns the server list envelope and pins the exact GET request', async () => {
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

      const result = await loadNotes('test-campaign');

      // passthrough of { notes } envelope — Notes.jsx unwraps via responseKey
      expect(result).toEqual(envelope);
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/notes', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('URL-encodes the campaign name; empty collection passes through as { notes: [] }', async () => {
      // server truth: loadOrInit() answer for a missing campaign/notes.json
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ notes: [] }),
      });

      const result = await loadNotes('my campaign/1');

      expect(result).toEqual({ notes: [] });
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/my%20campaign%2F1/notes', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('extracts the server 500 error and logs', async () => {
      // server truth: jsonEntityCrud read failure surfaces through
      // asyncHandler as 500 { error: 'Failed to read notes' }
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Failed to read notes' }),
      });

      await expect(loadNotes('test-campaign')).rejects.toThrow('Failed to read notes');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading notes:', expect.any(Error));
    });

    it('falls back to its own generic message when the error body has no error field', async () => {
      // defensive client branch — the server always sends { error }
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadNotes('test-campaign')).rejects.toThrow('Failed to load notes');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading notes:', expect.any(Error));
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadNotes('test-campaign')).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading notes:', expect.any(Error));
    });
  });

  describe('saveNotes', () => {
    it('POSTs the exact notes body and returns the server { success: true } envelope', async () => {
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

    it('URL-encodes the campaign name; empty-array overwrite sends the exact body', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      await saveNotes('my campaign/1', []);

      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/my%20campaign%2F1/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: [] }),
      });
    });

    it('extracts the server 400 non-array error and logs', async () => {
      // server truth: 400 { error: 'Expected an array for notes' }
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Expected an array for notes' }),
      });

      await expect(saveNotes('test-campaign', 'not an array')).rejects.toThrow(
        'Expected an array for notes'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving notes:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
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
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('falls back to its own generic message when the error body has no error field', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(saveNotes('test-campaign', [])).rejects.toThrow('Failed to save notes');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving notes:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(saveNotes('test-campaign', [])).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving notes:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('loadNote', () => {
    // No production consumer today (Notes.jsx lists via loadNotes and edits
    // in-memory); pinned as the item-route contract against jsonEntityCrud's
    // itemWrapper. Raw ids are what production callers pass (crypto.randomUUID).
    it('returns the server item envelope, URL-encoding campaign and raw note id', async () => {
      const note = { id: 'note/1', description: 'Session notes', isPrivate: false };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ note }),
      });

      const result = await loadNote('my campaign/1', 'note/1');

      expect(result).toEqual({ note });
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign%2F1/notes/note%2F1',
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    it('extracts the server 404 error and logs', async () => {
      // server truth: { error: 'Note not found' } (Title-case singularDisplayName)
      // for both file-missing and id-missing (jsonEntityCrud GET :id)
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Note not found' }),
      });

      await expect(loadNote('test-campaign', 'missing-id')).rejects.toThrow('Note not found');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading note:', expect.any(Error));
    });

    it('extracts the server 403 private-note error and logs', async () => {
      // server truth: notes' own authorizeRead flavor — 403 { error:
      // 'Access denied: private note' } for non-localhost reads of private notes
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ error: 'Access denied: private note' }),
      });

      await expect(loadNote('test-campaign', 'note-secret')).rejects.toThrow(
        'Access denied: private note'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading note:', expect.any(Error));
    });

    it('falls back to its own generic message when the error body has no error field', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadNote('test-campaign', 'note-1')).rejects.toThrow('Failed to load note');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading note:', expect.any(Error));
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadNote('test-campaign', 'note-1')).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading note:', expect.any(Error));
    });
  });

  describe('deleteNote', () => {
    it('sends DELETE with no headers, encoded ids, and returns { success: true }', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await deleteNote('my campaign/1', 'note/1');

      // server answers with { success: true } only — no deleted-id key
      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign%2F1/notes/note%2F1',
        { method: 'DELETE' }
      );
    });

    it('extracts the server 404 error and logs', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Note not found' }),
      });

      await expect(deleteNote('test-campaign', 'missing-id')).rejects.toThrow('Note not found');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting note:', expect.any(Error));
    });

    it('falls back to its own generic message when the error body has no error field', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(deleteNote('test-campaign', 'note-1')).rejects.toThrow('Failed to delete note');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting note:', expect.any(Error));
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(deleteNote('test-campaign', 'note-1')).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting note:', expect.any(Error));
    });
  });
});
