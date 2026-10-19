// @maintained-by-ai
/**
 * LANE: chargeEconomy.js — the L5-002 STORE BRIDGE (cloneDeep + persist on the
 * campaign turnState key), not gate decisions, not budget math (charge-trio
 * split discipline #927):
 *  - canTakeAction.test.js (#988): pure gate truth-table canon — gate-decision
 *    faces live THERE only; its header explicitly excludes charge legs
 *    (.charge/chargeEconomy), so this file stays the sole bridge owner.
 *  - assertCanAct.charge.test.js (#984/#2068): assertCanAct charge-on-allow
 *    semantics — bucket classification is classifyBucket.test.js's (#984);
 *    this file never re-classifies buckets, it feeds bucket strings in.
 *  - turnState.test.js: spend/refund/spendMovement math incl. per-creature
 *    isolation (turnState.test.js:66, #988 precedent) — bridge pins one
 *    creature and cites it rather than duplicating multi-actor math.
 * Pinned HERE: off-switch zero-writes (L1–4 guarantee), exact persisted bytes
 * (#829), consume-exact-once + no phantom refund (#744), guard fail-safe
 * zero-writes (#934). State-only seams, no timers, no wall-clock (#app
 * no-timers CANON). Runtime-store boundary mocked (sibling convention — the
 * real hook owns network/SSE); turnState.js unmocked (#791).
 *
 * OLD → NEW MAP (9 → 6):
 *  'enforcement OFF slot' + 'enforcement OFF movement' → 1 (all three fns)
 *  'actionEconomy off' → 2 (+ movementBudget-off leg, distinct flags)
 *  'charges the slot' + 'refuses when exhausted' + refund + 'no phantom'
 *      → 5 (one seam sequence, exact bytes each seam, #787/#744 fold)
 *  'free/special never charge' → 3 (+ refund leg)
 *  'missing campaign/creature' → 4 (was chargeSlot-only; now all three fns)
 *  'charges feet + hasMoved' → 6 (+ junk-feet zero-write leg)
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { chargeSlot, refundSlot, chargeMovement } from './chargeEconomy.js';
import { emptyTurnEntry } from './turnState.js';

const CAMPAIGN = 'test-campaign';
const ON = { mode: 'on', actionEconomy: true, movementBudget: true };
const OFF = { mode: 'off' };
const SLOT = { creatureName: 'Rakan', bucket: 'action', campaignName: CAMPAIGN };
const MOVE = { creatureName: 'Rakan', feet: 15, campaignName: CAMPAIGN };

/** Faithful in-memory store: reads serve from the map, persists write back. */
function bridgeStore(map) {
    getRuntimeValue.mockImplementation((characterKey, key) => map[`${characterKey}.${key}`] ?? null);
    setRuntimeValue.mockImplementation((characterKey, key, value) => {
        map[`${characterKey}.${key}`] = value;
    });
}

beforeEach(() => vi.clearAllMocks());

describe('chargeEconomy store bridge (L5-002)', () => {
    it('enforcement OFF ⇒ charge/refund/movement all no-op, zero writes', () => {
        bridgeStore({
            'campaign.enforcement': OFF,
            // spent state present, yet off-mode must not even un-charge it
            'campaign.turnState': { Rakan: { ...emptyTurnEntry(), actionsUsed: 1 } },
        });
        expect(chargeSlot(SLOT)).toBe(false);
        expect(refundSlot(SLOT)).toBe(false);
        expect(chargeMovement(MOVE)).toBe(0);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('actionEconomy off no-ops slot charge/refund; movementBudget off no-ops movement', () => {
        bridgeStore({
            'campaign.enforcement': { mode: 'on', actionEconomy: false, movementBudget: true },
            'campaign.turnState': { Rakan: { ...emptyTurnEntry(), actionsUsed: 1 } },
        });
        expect(chargeSlot(SLOT)).toBe(false);
        expect(refundSlot(SLOT)).toBe(false);
        bridgeStore({ 'campaign.enforcement': { mode: 'on', actionEconomy: true, movementBudget: false } });
        expect(chargeMovement(MOVE)).toBe(0);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('free/special buckets succeed WITHOUT writing (charge and refund)', () => {
        bridgeStore({ 'campaign.enforcement': ON, 'campaign.turnState': {} });
        for (const bucket of ['free', 'special']) {
            expect(chargeSlot({ ...SLOT, bucket })).toBe(true);
            expect(refundSlot({ ...SLOT, bucket })).toBe(true);
        }
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('missing creature or campaign ⇒ all three refuse, zero writes', () => {
        bridgeStore({ 'campaign.enforcement': ON, 'campaign.turnState': {} });
        expect(chargeSlot({ ...SLOT, creatureName: null })).toBe(false);
        expect(chargeSlot({ ...SLOT, campaignName: null })).toBe(false);
        expect(refundSlot({ ...SLOT, creatureName: null })).toBe(false);
        expect(chargeMovement({ ...MOVE, creatureName: null })).toBe(0);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('action slot seams: charge once, refuse exhausted, refund, refuse phantom — exact bytes (#744)', () => {
        const map = { 'campaign.enforcement': ON, 'campaign.turnState': null }; // null-store must freshen
        bridgeStore(map);

        expect(chargeSlot(SLOT)).toBe(true);
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign', 'turnState',
            { Rakan: { ...emptyTurnEntry(), actionsUsed: 1 } }, CAMPAIGN);

        // consume-exact-once / double-click race backstop: refusals, zero extra writes
        expect(chargeSlot(SLOT)).toBe(false);
        expect(chargeSlot(SLOT)).toBe(false);
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(map['campaign.turnState']).toEqual({ Rakan: { ...emptyTurnEntry(), actionsUsed: 1 } });

        expect(refundSlot(SLOT)).toBe(true);
        expect(setRuntimeValue).toHaveBeenLastCalledWith(
            'campaign', 'turnState',
            { Rakan: { ...emptyTurnEntry(), actionsUsed: 0 } }, CAMPAIGN);

        // no phantom credit when nothing is spent
        expect(refundSlot(SLOT)).toBe(false);
        expect(setRuntimeValue).toHaveBeenCalledTimes(2);
    });

    it('chargeMovement persists feet + hasMoved exact bytes; junk feet charge nothing', () => {
        bridgeStore({ 'campaign.enforcement': ON, 'campaign.turnState': null });
        expect(chargeMovement(MOVE)).toBe(15);
        expect(setRuntimeValue).toHaveBeenLastCalledWith(
            'campaign', 'turnState',
            { Rakan: { ...emptyTurnEntry(), movementUsedFeet: 15, hasMoved: true } }, CAMPAIGN);

        expect(chargeMovement({ ...MOVE, feet: 0 })).toBe(0);
        expect(chargeMovement({ ...MOVE, feet: -20 })).toBe(0);
        expect(chargeMovement({ ...MOVE, feet: 'x' })).toBe(0);
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    });
});
