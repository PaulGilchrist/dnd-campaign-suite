// @maintained-by-ai
// Unit-canonical home for src/services/ui/logService.js — REAL module, never mocked here.
// Contract (verified against server/routes/log.js): the client is a stateless fetch
// wrapper over GET/POST /api/campaigns/:campaign/log. It performs NO batching, NO
// buffering, NO id/timestamp stamping and NO sorting — the server owns id + numeric
// Date.now() stamps, the last-500 cap, disk persistence (1s save-debounce) and SSE
// publish. NO-CLOCK: this client module contains zero timers; all fixture timestamps
// are inert numbers carried verbatim (log-stamp-only category), never windowed/sorted.
// Error law: both wrappers THROW descriptive Errors before reading the body on
// !ok; fetch rejections propagate untouched. Fire-and-forget .catch() chains live
// in consumers (e.g. autoRewardService, applyRuling), not here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as logService from './logService.js';
import { getLog, addEntry } from './logService.js';

// Minimal response stub: the service reads exactly two members — .ok and .json().
// Nothing else (no status/headers) is stubbed: mock-completeness census = 2.
function jsonResponse({ ok = true, data = null } = {}) {
    const json = vi.fn(async () => data);
    return { ok, json };
}

describe('logService', () => {
    let fetchSpy;

    beforeEach(() => {
        fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('exports exactly getLog (arity 1) and addEntry (arity 2), both async', () => {
        expect(Object.keys(logService).sort()).toEqual(['addEntry', 'getLog']);
        expect(getLog).toBeTypeOf('function');
        expect(addEntry).toBeTypeOf('function');
        expect(getLog).toHaveLength(1);
        expect(addEntry).toHaveLength(2); // logService.js:9
    });

    describe('getLog', () => {
        it('GETs the campaign log with no fetch options and resolves the parsed payload verbatim', async () => {
            // Server-truth entry shape: server prepends id + numeric-ms timestamp.
            const payload = [
                { id: 'e1', timestamp: 1700000000000, type: 'roll', name: 'Test roll', total: 17 },
                { id: 'e2', timestamp: 1700000000001, type: 'loot', name: 'Combat', xpPerChar: 0 }
            ];
            fetchSpy.mockReturnValueOnce(jsonResponse({ data: payload }));

            const result = await getLog('test-campaign');

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            // Single-argument call pins GET-by-default: any init object would fail this.
            expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/log');
            // Verbatim passthrough: no client-side slice, sort, dedupe or reshape.
            expect(result).toStrictEqual(payload);

            // Fresh-campaign arm: server returns [] — client resolves [] verbatim.
            fetchSpy.mockReturnValueOnce(jsonResponse({ data: [] }));
            await expect(getLog('test-campaign')).resolves.toStrictEqual([]);
            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('addEntry', () => {
        it('POSTs the entry verbatim and resolves the server-stamped entry', async () => {
            // Real consumer shape (applyRuling.js 'roll'); client must add no keys.
            const entry = { type: 'roll', name: 'AI referee: goblin', total: 17 };
            // Server reply shape (server/routes/log.js addEntry): { id, timestamp, ...entry }.
            const stored = { id: 'e1', timestamp: 1700000000000, ...entry };
            fetchSpy.mockReturnValueOnce(jsonResponse({ data: stored }));

            const result = await addEntry('test-campaign', entry);

            // Exact tuple: body bytes are JSON.stringify(entry) — no client-fabricated
            // id/timestamp keys, entry key order preserved, nothing else in init.
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{"type":"roll","name":"AI referee: goblin","total":17}'
            });
            expect(result).toStrictEqual(stored);
        });
    });

    it('both wrappers throw a descriptive Error on non-ok without reading the body', async () => {
        const getRes = jsonResponse({ ok: false });
        fetchSpy.mockReturnValueOnce(getRes);
        await expect(getLog('test-campaign')).rejects.toThrow(new Error('Failed to fetch log'));
        expect(getRes.json).not.toHaveBeenCalled();

        const addRes = jsonResponse({ ok: false });
        fetchSpy.mockReturnValueOnce(addRes);
        await expect(addEntry('test-campaign', { type: 'roll' })).rejects.toThrow(new Error('Failed to add log entry'));
        expect(addRes.json).not.toHaveBeenCalled();
    });

    it('URI-encodes campaign names on both routes', async () => {
        fetchSpy.mockReturnValue(jsonResponse({ data: [] }));

        await getLog('test campaign!');
        await addEntry('test campaign!', { type: 'roll' });

        expect(fetchSpy).toHaveBeenNthCalledWith(1, '/api/campaigns/test%20campaign!/log');
        expect(fetchSpy).toHaveBeenNthCalledWith(2, '/api/campaigns/test%20campaign!/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{"type":"roll"}'
        });
    });

    it('propagates fetch rejections untouched, attempting each route exactly once (no retry, no swallow)', async () => {
        const networkError = new Error('Network down');
        fetchSpy.mockRejectedValue(networkError);

        await expect(getLog('test-campaign')).rejects.toBe(networkError);
        await expect(addEntry('test-campaign', { type: 'roll' })).rejects.toBe(networkError);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
});
