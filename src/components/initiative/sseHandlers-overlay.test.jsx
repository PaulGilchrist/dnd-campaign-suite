// @maintained-by-ai
// LANE: sseHandlers-overlay — createOverlayHandler BODY: setOverlays semantics for
// spell-overlay SSE events (sseHandlers.js:10-45), behind the app's ONE shared SSE
// connection (#app mandate). Owned elsewhere: delegate/routing byte + excluded-keys
// tick (sseHandlers-main.test.jsx #872); Subscriber registration, mount fetch, and
// overlay UI (initiative.overlays.test.jsx / container #865).
//
// Event → behavior (this file's contract):
//   null event / no key / non-overlay prefix → zero writes (:12)
//   spell-overlay-<foreign campaign>         → zero writes; own campaign writes (:13)
//   add    → dedupe by id, append exact payload objects; updater returns prev when nothing new (:16-24)
//   update → replace by id with the exact payload object, untouched otherwise (:25-32)
//   remove → drop EVERY overlay with id === overlayId (:33-37)
//   clear  → setOverlays([]) literal (:38-40)
//   empty/missing overlays, missing overlayId, unknown/missing/null action → zero writes
//
// Old→new map (16→7): null-event + no-key + wrong-prefix→T1 · foreign-campaign→T2(+own-campaign
// positive control) · add-unique + dedupe→T3(+prev-bailout) · update-replace + no-match→T4 ·
// remove-one + remove-all-dupes→T5 · clear + clear-empty→T6(clear ignores prev) ·
// remove-from-empty→cut(vacuous, same path as T5) · all guard tests→T7.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOverlayHandler } from './sseHandlers.js';

// Stub sseHandlers.js transitive imports so no real dice/log/fetch chain is reachable
// from this lane (zero-network, #872 mock hygiene). The overlay body touches none of them.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(),
    getCombatSummary: vi.fn(),
    setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({
    expireStaleEffects: vi.fn(),
    applyTurnStartEffects: vi.fn(),
    applyTurnEndConditionRemoval: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityUtils.js', () => ({
    applyCommanderStrikeTurnEnd: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';
const overlayKey = `spell-overlay-${campaignName}`;

describe('createOverlayHandler', () => {
    let handler;
    let state;
    let setOverlays;

    const event = (data) => ({ key: overlayKey, data });

    beforeEach(() => {
        state = [];
        // Stateful fake mirroring React setState: accepts an updater fn or a literal,
        // applies it to the current state, and records the call.
        setOverlays = vi.fn((update) => {
            state = typeof update === 'function' ? update(state) : update;
        });
        handler = createOverlayHandler(campaignName);
    });

    it('ignores events that are not the spell-overlay channel', () => {
        handler(null, setOverlays);
        handler({ data: { action: 'clear' } }, setOverlays);
        handler({ key: `change-${campaignName}-combatSummary`, data: { action: 'clear' } }, setOverlays);
        expect(setOverlays).not.toHaveBeenCalled();
        expect(state).toEqual([]);
    });

    it('writes only for its own campaign overlay key', () => {
        const addPayload = { action: 'add', overlays: [{ id: 'x', label: 'X' }] };
        handler({ key: 'spell-overlay-other-campaign', data: addPayload }, setOverlays);
        expect(setOverlays).not.toHaveBeenCalled();

        handler(event(addPayload), setOverlays);
        expect(setOverlays).toHaveBeenCalledTimes(1);
        expect(state).toEqual([{ id: 'x', label: 'X' }]);
    });

    it('adds only new ids, appends the exact payload objects, and returns prev when nothing is new', () => {
        state = [{ id: 'a', label: 'A' }];
        const fresh = { id: 'b', label: 'B' };
        const dup = { id: 'a', label: 'A overwritten' };

        handler(event({ action: 'add', overlays: [dup, fresh] }), setOverlays);
        expect(state).toEqual([{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]);
        expect(state[1]).toBe(fresh); // exact payload literal, not recomputed
        expect(state[0]).not.toBe(dup); // existing entry wins over the duplicate

        const before = state;
        handler(event({ action: 'add', overlays: [{ id: 'a', label: 'again' }] }), setOverlays);
        expect(state).toBe(before); // updater bails out on identity — no re-render churn
    });

    it('replaces matching ids with the exact payload object and leaves others untouched', () => {
        state = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
        const updatedA = { id: 'a', label: 'A updated' };

        handler(event({ action: 'update', overlays: [updatedA, { id: 'z', label: 'Z' }] }), setOverlays);
        expect(state).toEqual([{ id: 'a', label: 'A updated' }, { id: 'b', label: 'B' }]);
        expect(state[0]).toBe(updatedA); // exact payload literal, not recomputed
        expect(state.some((o) => o.id === 'z')).toBe(false); // unknown update id never lands
    });

    it('removes every overlay matching overlayId', () => {
        state = [{ id: 'a' }, { id: 'b', label: 'B' }, { id: 'c' }, { id: 'b', label: 'B dup' }];

        handler(event({ action: 'remove', overlayId: 'b' }), setOverlays);
        expect(state).toEqual([{ id: 'a' }, { id: 'c' }]);
    });

    it('clears to a literal empty array regardless of existing state', () => {
        state = [{ id: 'a' }, { id: 'b' }];

        handler(event({ action: 'clear' }), setOverlays);
        expect(setOverlays).toHaveBeenCalledTimes(1);
        expect(setOverlays).toHaveBeenCalledWith([]);
        expect(state).toEqual([]);
    });

    it('never writes for malformed payloads', () => {
        state = [{ id: 'a', label: 'A' }];
        [
            null,                          // data null → action undefined
            {},                            // no action
            { action: 'unknown' },
            { action: 'add', overlays: [] },
            { action: 'add' },             // missing overlays
            { action: 'update', overlays: [] },
            { action: 'update' },         // missing overlays
            { action: 'remove' },         // missing overlayId
        ].forEach((data) => handler(event(data), setOverlays));
        expect(setOverlays).not.toHaveBeenCalled();
        expect(state).toEqual([{ id: 'a', label: 'A' }]);
    });
});
