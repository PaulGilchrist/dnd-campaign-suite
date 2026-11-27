// @maintained-by-ai 2026-11-27
/**
 * PAIR SEAM MAP — enforcement home for the action gates (assertCanAct pair):
 *  - THIS file (assertCanAct.charge.test.js): the L5-002 charge-on-allow lane —
 *    ctx.charge semantics in assertCanAct (execute-on-allow charging, defer for
 *    modal-opening sites, the isChargeableBucket guard, the actionEconomy-off
 *    zero-write no-op, and the double-click race backstop at assertCanAct.js
 *    L148–155 / L190–197).
 *  - assertCanAct.test.js: the general-enforcement core (fast path, turn-lock,
 *    economy-exhaustion denial, cannotAct pass-through, blockers).
 *  - canTakeAction.test.js / turnState.test.js / chargeEconomy.test.js: the pure
 *    decision, budget math, and chargeSlot persistence respectively.
 *  - classifyBucket.test.js: the full bucket taxonomy (single source of truth).
 *  - actionGateSites.test.js / useCharActionsAttackHandlers.test.js: call-site
 *    wiring only — the pipeline mechanics are pinned there, not re-run here.
 * No clocks — turn-seam state only (spend() is disk truth, not a fabricated
 * shape). Locked-down campaign: test-campaign.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

const { activeMirror } = vi.hoisted(() => ({ activeMirror: { activeCreatureName: null } }));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    getStore: vi.fn(() => ({ get: (k) => (k === 'activeCreatureName' ? activeMirror.activeCreatureName : null) })),
}));
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(async () => ({})),
}));

import { assertCanAct, bucketForAction } from './assertCanAct.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { spend } from './turnState.js';

// Enforcement ON with the action economy live, turn-lock realistic — the charge
// lane only ever runs in a live combat on the actor's own turn (no off-mode
// shortcuts here; the off fast path itself is assertCanAct.test.js's lane).
const ECONOMY_LIVE = { mode: 'on', turnLock: true, actionEconomy: true };

/** Keyed store mock — answers ONLY the keys a charge-lane call reads. */
function store(map) {
    getRuntimeValue.mockImplementation((characterKey, key) => map[`${characterKey}.${key}`] ?? null);
}

beforeEach(() => {
    vi.clearAllMocks();
    activeMirror.activeCreatureName = 'Rakan'; // own turn — charge sites execute on-allow
});

describe('assertCanAct charge-on-allow (L5-002 §7.2)', () => {
    // The charge lane must be a zero-write no-op whenever the economy is off —
    // mode off (fast path, L1–4 guarantee) and mode on + actionEconomy off
    // (flag guard at assertCanAct.js:190) each keep the store and log untouched.
    it.each([
        ['mode off', { mode: 'off' }],
        ['mode on, actionEconomy off', { mode: 'on', turnLock: true, actionEconomy: false }],
    ])('charge:true is a zero-write no-op when economy is %s (L1–4 guarantee)', (_label, enforcement) => {
        store({ 'campaign.enforcement': enforcement });
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'action', charge: true }))
            .toEqual({ allowed: true, reason: null });
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    // Full chargeable-bucket family: the gate allows AND chargeSlot persists the
    // real spend() result exactly once, campaign-scoped.
    it.each(['action', 'bonusAction'])(
        'live economy + charge on own turn ⇒ allows and charges the %s slot exactly once', (bucket) => {
            store({ 'campaign.enforcement': ECONOMY_LIVE, 'campaign.turnState': {} });
            expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket, charge: true }))
                .toEqual({ allowed: true, reason: null });
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign', 'turnState', spend({}, 'Rakan', bucket).turnState, 'test-campaign');
            expect(addEntry).not.toHaveBeenCalled();
        });

    it('charge omitted ⇒ allows but defers the charge (modal-opening sites charge at their confirm seam)', () => {
        store({ 'campaign.enforcement': ECONOMY_LIVE, 'campaign.turnState': {} });
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'action' }))
            .toEqual({ allowed: true, reason: null });
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    // isChargeableBucket guard: non-chargeable buckets pass the gate and the
    // charge branch never writes (the taxonomy itself is classifyBucket.test.js).
    it.each(['free', 'special', 'passive', 'none'])(
        'bucket %s + charge ⇒ allowed, never charges', (bucket) => {
            store({ 'campaign.enforcement': ECONOMY_LIVE, 'campaign.turnState': {} });
            expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket, charge: true }))
                .toEqual({ allowed: true, reason: null });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

    it('double-click race backstop: gate allowed, but the slot was consumed before charging ⇒ deny, log, never overspend', () => {
        const spent = spend({}, 'Rakan', 'action').turnState;
        let turnStateReads = 0;
        getRuntimeValue.mockImplementation((characterKey, key) => {
            const k = `${characterKey}.${key}`;
            if (k === 'campaign.enforcement') return ECONOMY_LIVE;
            if (k === 'campaign.turnState') {
                // Gate's decision read sees fresh budget; chargeSlot's persist
                // read sees the slot consumed between decision and charge.
                turnStateReads += 1;
                return turnStateReads > 1 ? spent : {};
            }
            return null;
        });
        const popup = vi.fn();
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'action', charge: true, setPopupHtml: popup }))
            .toEqual({ allowed: false, rule: 'actionEconomy', reason: 'No actions left this turn.' });
        expect(turnStateReads).toBe(2); // decision read, then charge read — the race window
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(popup).toHaveBeenCalledWith('No actions left this turn.');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'enforcement_denied',
            creature: 'Rakan',
            bucket: 'action',
            source: 'action',
            rule: 'actionEconomy',
            reason: 'No actions left this turn.',
        });
    });
});

describe('bucketForAction → classifyBucket delegation (single taxonomy)', () => {
    // Only the delegation itself is pinned here — the full lane taxonomy lives
    // in classifyBucket.test.js (the single source, never diverge from it).
    it('routes non-action rows to their lane and defaults plain rows to the action slot', () => {
        expect(bucketForAction({ automation: { action: 'bonus_action' } })).toBe('bonusAction');
        expect(bucketForAction({ name: 'Plain' })).toBe('action');
    });
});
