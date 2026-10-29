// @maintained-by-ai
// Regression: bug-eb-join-swallowed-network-fail-phantom-row — storage.set for
// 'combatSummary' swallowed POST failures into a RESOLVED promise (and was
// never awaited), so EB Join logged a phantom `encounter/joined` row over a
// board that never reached the server. New awaited-writer contract: the
// combatSummary queue branch resolves TRUE only on an ok response and FALSE on
// network failure / HTTP error, while the queue chain itself NEVER rejects —
// fire-and-forget writers keep the old silent behaviour and one failed write
// cannot poison later ones. Mock strategy mirrors sibling storage.test.js
// (fetch is the ONLY boundary; console.error bytes pinned; no clocks).

import { describe, it, expect, vi, afterEach } from 'vitest';
import storage from './storage.js';

afterEach(() => {
    vi.restoreAllMocks();
});

const jsonResponse = (body, ok = true) => ({ ok, json: async () => body });

describe('storage.set — combatSummary awaited-writer status', () => {
    it('resolves TRUE when the server acks the board write', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, true));

        await expect(
            storage.set('combatSummary', { round: 1, creatures: [] }, 'test-campaign')
        ).resolves.toBe(true);
    });

    it('resolves FALSE on a not-ok HTTP response — the write never persisted', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ error: 'boom' }, false));

        await expect(
            storage.set('combatSummary', { round: 1 }, 'test-campaign')
        ).resolves.toBe(false);
    });

    it('network failure resolves FALSE logging [storage:error], and later writes still run and ack (queue never poisoned)', async () => {
        const err = new TypeError('Failed to fetch');
        const spy = vi.spyOn(globalThis, 'fetch')
            .mockRejectedValueOnce(err)
            .mockResolvedValue(jsonResponse({}, true));
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(
            storage.set('combatSummary', { round: 1 }, 'test-campaign')
        ).resolves.toBe(false);
        expect(errorSpy).toHaveBeenCalledWith('[storage:error]', err);

        // Pre-fix, a rejection landed on queue.pending and stalled every later
        // board write for the campaign; with the swallow preserved HERE (queue
        // alive) only the AWAITED caller learns of this one failure.
        await expect(
            storage.set('combatSummary', { round: 2 }, 'test-campaign')
        ).resolves.toBe(true);
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it('generic (non-combatSummary) keys keep the historical fire-and-forget bytes: rejection resolves undefined logging [storage:error]', async () => {
        const err = new TypeError('Failed to fetch');
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(err);
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(storage.set('activeCreatureName', 'Goblin', 'test-campaign')).resolves.toBeUndefined();
        expect(errorSpy).toHaveBeenCalledWith('[storage:error]', err);
    });
});
