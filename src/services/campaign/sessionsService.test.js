// @maintained-by-ai
/**
 * sessionsService — client-side fetch contract for the GM sessions family.
 *
 * Sibling of notesService.test.js / factionsService.test.js conventions:
 * per-test fetch-spied, fail-loud default (unmocked fetch throws — never
 * live, per campaign lockdown), exact request shapes, server-truth response
 * envelopes, error-body extraction, and the console lane split from improve
 * 2026-10-27-H: a HANDLED 409 concurrent-edit conflict (server body
 * { conflict: true }, jsonEntityCrud.js conflictErrorBody, noun 'Session'
 * from routes/sessions.js:18) logs at console.warn — the editor banner +
 * "Reload list" affordance own user feedback — while genuine failures
 * (non-conflict 4xx/5xx, network rejection) stay on console.error.
 *
 * Server-truth envelopes (server/routes/sessions.js + jsonEntityCrud):
 *  - GET list    → { sessions: [...] } (responseWrapper passthrough)
 *  - PUT /:name  → { success: true, session: stampedSession } (sessions.js:73)
 *                  400 { error: 'A session with that name already exists' }
 *                  409 { error: conflict copy, conflict: true } (stale stamp
 *                  OR resurrected-after-delete 'created or deleted' leg)
 *  - POST        → { success: true } only (full-array overwrite; the factory
 *                  findConcurrentWrite can also 409)
 *  - DELETE /:name → { success: true } only; 404 { error: 'Session not found' }
 *  No headers on DELETE (family convention).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadSessions, saveSession, saveSessions, deleteSession } from './sessionsService.js';

// conflictErrorBody bytes verbatim shape (jsonEntityCrud.js:88-94).
const CONFLICT_MESSAGE =
  'Session "Session 7" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';

describe('sessionsService', () => {
  let fetchSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    // Fail-loud default: any fetch a test forgets to mock rejects instead of
    // reaching a live server (campaign lockdown — never real /api here).
    fetchSpy.mockImplementation((url) => {
      throw new Error(`unmocked fetch in sessionsService test: ${url}`);
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadSessions', () => {
    it('returns the server list envelope and pins the exact GET request', async () => {
      const envelope = { sessions: [{ name: 'Session 7', date: '2026-10-27' }] };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(envelope),
      });

      const result = await loadSessions('test-campaign');

      expect(result).toEqual(envelope);
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/sessions', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadSessions('test-campaign')).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading sessions:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('saveSession (PUT lane)', () => {
    const session = { name: 'Session 7', date: '2026-10-27', summary: 'Recap' };

    it('PUTs the exact body at the encoded name URL and returns the server PUT envelope', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, session }),
      });

      const result = await saveSession('my campaign/1', session, 'Session 6/7');

      expect(result).toEqual({ success: true, session });
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign%2F1/sessions/Session%206%2F7',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(session),
        }
      );
    });

    it('routes a handled 409 conflict to console.warn — never a red ERROR (improve 2026-10-27-H)', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: () => Promise.resolve({ error: CONFLICT_MESSAGE, conflict: true }),
      });

      const thrown = await saveSession('test-campaign', session).catch((e) => e);

      expect(thrown).toBeInstanceOf(Error);
      expect(thrown.message).toBe(CONFLICT_MESSAGE);
      expect(thrown.conflict).toBe(true); // banner's Reload-list discriminator
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Concurrent-edit conflict saving session:',
        CONFLICT_MESSAGE
      );
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('extracts the server 400 duplicate-name error and logs at error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'A session with that name already exists' }),
      });

      await expect(saveSession('test-campaign', session)).rejects.toThrow(
        'A session with that name already exists'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving session:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('falls back to its own generic message when the error body has no error field', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(saveSession('test-campaign', session)).rejects.toThrow('Failed to save session');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving session:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(saveSession('test-campaign', session)).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving session:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('saveSessions (POST lane)', () => {
    it('POSTs the exact sessions body and returns { success: true } only', async () => {
      const sessions = [{ name: 'Session 7' }];
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await saveSessions('test-campaign', sessions);

      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions }),
      });
    });

    it('routes a handled 409 conflict to console.warn — never a red ERROR (improve 2026-10-27-H)', async () => {
      // factory findConcurrentWrite leg (jsonEntityCrud POST)
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: () => Promise.resolve({ error: CONFLICT_MESSAGE, conflict: true }),
      });

      const thrown = await saveSessions('test-campaign', []).catch((e) => e);

      expect(thrown).toBeInstanceOf(Error);
      expect(thrown.message).toBe(CONFLICT_MESSAGE);
      expect(thrown.conflict).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Concurrent-edit conflict saving sessions:',
        CONFLICT_MESSAGE
      );
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('extracts the server 400 non-array error and logs at error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Expected an array for sessions' }),
      });

      await expect(saveSessions('test-campaign', 'not an array')).rejects.toThrow(
        'Expected an array for sessions'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving sessions:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('rejects and logs on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(saveSessions('test-campaign', [])).rejects.toThrow('ENOTFOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving sessions:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('deleteSession', () => {
    it('sends DELETE with no headers, encoded ids, and returns { success: true }', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await deleteSession('my campaign/1', 'Session 7');

      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign%2F1/sessions/Session%207',
        { method: 'DELETE' }
      );
    });

    it('extracts the server 404 error and logs', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Session not found' }),
      });

      await expect(deleteSession('test-campaign', 'Missing')).rejects.toThrow('Session not found');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting session:', expect.any(Error));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});
