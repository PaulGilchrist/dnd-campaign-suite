// @maintained-by-ai
// Scoped PATCH coalescing (improvement backlog 2026-11-05 CV): burst arming
// shipped 3 in-flight same-key PATCHes + 3 full-board SSE echoes (CU PT2,
// 62 ms window). Same-(campaign,key) writes issued inside the debounce window
// now merge CLIENT-side into ONE PATCH carrying the last-writer field
// content (one echo per burst); correctness stays exactly the LWW contract
// the server by-name-merge already provides. Windows: quiet 120 ms / hard cap
// 250 ms — <~50 ms spacing coalesces, a 300 ms gap is a separate PATCH, and a
// never-ending stream flushes at the cap (no unbounded deferral). Mock
// strategy mirrors sibling storage.test.js (fetch is the ONLY boundary;
// console.error bytes pinned) with bounded fake-timer advances.
import { describe, it, expect, vi, afterEach } from 'vitest';
import storage from './storage.js';

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

const jsonResponse = (body, ok = true) => ({ ok, json: async () => body });

const arm = (name, targetName) =>
    storage.patch('combatSummary', { creatures: [{ name, targetName }] }, 'test-campaign');

const bodyOf = (call) => JSON.parse(call[1].body);

describe('storage.patch — same-key burst coalescing (CV 2026-11-05)', () => {
    it('three rapid same-key arming patches leave as ONE PATCH carrying the last-writer targetName', async () => {
        vi.useFakeTimers();
        const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, true));

        const results = Promise.all([arm('Bandit', 'Alice'), arm('Bandit', 'Bob'), arm('Bandit', 'Cara')]);
        await vi.advanceTimersByTimeAsync(300);

        expect(spy).toHaveBeenCalledTimes(1); // 1 PATCH → the server echoes the FULL bucket ONCE
        expect(spy.mock.calls[0][0]).toBe('/api/campaigns/test-campaign/combatSummary');
        expect(spy.mock.calls[0][1].method).toBe('PATCH');
        expect(bodyOf(spy.mock.calls[0])).toEqual({ value: { creatures: [{ name: 'Bandit', targetName: 'Cara' }] } });
        await expect(results).resolves.toEqual([true, true, true]); // every caller gets the shared ack
    });

    it('merges field-level content: different creature records both land, same record keeps every field with last-writer per field', async () => {
        vi.useFakeTimers();
        const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, true));

        void storage.patch('combatSummary', { creatures: [{ name: 'Bandit', targetName: 'Alice' }] }, 'test-campaign');
        void storage.patch('combatSummary', { creatures: [{ name: 'Goblin', targetName: 'Bob' }] }, 'test-campaign');
        void storage.patch('combatSummary', { creatures: [{ name: 'Bandit', targetName: 'Cara' }, { name: 'Bandit', lastAttackId: 'atk-9' }] }, 'test-campaign');
        await vi.advanceTimersByTimeAsync(300);

        expect(spy).toHaveBeenCalledTimes(1); // both records ride ONE body — nothing silently dropped
        expect(bodyOf(spy.mock.calls[0])).toEqual({
            value: {
                creatures: [
                    { name: 'Bandit', targetName: 'Cara', lastAttackId: 'atk-9' }, // LWW per FIELD
                    { name: 'Goblin', targetName: 'Bob' },
                ],
            },
        });
    });

    it('never merges different keys, and never merges the same key across campaigns', async () => {
        vi.useFakeTimers();
        const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, true));

        void storage.patch('combatSummary', { creatures: [{ name: 'Bandit', targetName: 'Alice' }] }, 'test-campaign');
        void storage.patch('lastAttack', { weapon: 'Spear' }, 'test-campaign');
        void storage.patch('combatSummary', { creatures: [{ name: 'Bandit', targetName: 'Bob' }] }, 'test-campaign-2');
        await vi.advanceTimersByTimeAsync(300);

        expect(spy).toHaveBeenCalledTimes(3); // one PATCH per (campaign,key) buffer
        const byUrl = Object.fromEntries(spy.mock.calls.map((c) => [c[0], bodyOf(c)]));
        expect(byUrl['/api/campaigns/test-campaign/combatSummary'])
            .toEqual({ value: { creatures: [{ name: 'Bandit', targetName: 'Alice' }] } });
        expect(byUrl['/api/campaigns/test-campaign/lastAttack']).toEqual({ value: { weapon: 'Spear' } });
        expect(byUrl['/api/campaigns/test-campaign-2/combatSummary'])
            .toEqual({ value: { creatures: [{ name: 'Bandit', targetName: 'Bob' }] } });
    });

    it('writes after the window flush as a separate PATCH — a burst followed by a 300 ms gap yields 2 PATCHes', async () => {
        vi.useFakeTimers();
        const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, true));

        void arm('Bandit', 'Alice');
        await vi.advanceTimersByTimeAsync(40); // same window, still buffered
        void arm('Bandit', 'Bob');
        await vi.advanceTimersByTimeAsync(300); // quiet window elapses → burst #1 out
        expect(spy).toHaveBeenCalledTimes(1);

        void arm('Bandit', 'Cara'); // 300 ms after the burst — a NEW window
        await vi.advanceTimersByTimeAsync(300);

        expect(spy).toHaveBeenCalledTimes(2); // no unbounded deferral, no absorption
        expect(bodyOf(spy.mock.calls[0])).toEqual({ value: { creatures: [{ name: 'Bandit', targetName: 'Bob' }] } });
        expect(bodyOf(spy.mock.calls[1])).toEqual({ value: { creatures: [{ name: 'Bandit', targetName: 'Cara' }] } });
    });

    it('caps coalescing at the max-wait even under a continuous sub-window stream', async () => {
        vi.useFakeTimers();
        const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, true));

        void arm('Bandit', 'T0');
        for (let step = 1; step <= 6; step++) { // a write every 40 ms — quiet window alone would defer forever
            await vi.advanceTimersByTimeAsync(40);
            void arm('Bandit', `T${step}`);
        }
        await vi.advanceTimersByTimeAsync(20); // t=260 ≥ the 250 ms hard cap
        expect(spy).toHaveBeenCalledTimes(1); // cap fired despite continuous writes
        expect(bodyOf(spy.mock.calls[0]))
            .toEqual({ value: { creatures: [{ name: 'Bandit', targetName: 'T6' }] } }); // all merged, LWW

        void arm('Bandit', 'T7'); // post-cap writes open a fresh window
        await vi.advanceTimersByTimeAsync(300);
        expect(spy).toHaveBeenCalledTimes(2);
        expect(bodyOf(spy.mock.calls[1]))
            .toEqual({ value: { creatures: [{ name: 'Bandit', targetName: 'T7' }] } });
    });

    it('transport failure resolves FALSE logging [storage:error] and poisons nothing — later bursts still flush', async () => {
        vi.useFakeTimers();
        const err = new TypeError('Failed to fetch');
        const spy = vi.spyOn(globalThis, 'fetch')
            .mockRejectedValueOnce(err)
            .mockResolvedValue(jsonResponse({}, true));
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const pFail = arm('Bandit', 'Alice');
        await vi.advanceTimersByTimeAsync(300);
        await expect(pFail).resolves.toBe(false);
        expect(errorSpy).toHaveBeenCalledWith('[storage:error]', err);

        const pOk = arm('Bandit', 'Bob');
        await vi.advanceTimersByTimeAsync(300);
        await expect(pOk).resolves.toBe(true); // queue + buffer healthy
        expect(spy).toHaveBeenCalledTimes(2);
    });
});
