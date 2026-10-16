// @maintained-by-ai
/**
 * PAIR CORE — general enforcement lane of the assertCanAct pair (closer #2069):
 *  - THIS file: turn-lock, enforcement fast path (off/missing both shapes),
 *    economy-exhaustion denial, cannotAct pass-through (silent off / loud on),
 *    blocker targetEffects, and the popup + enforcement_denied audit-log sinks.
 *  - assertCanAct.charge.test.js (#2068): chargeSlot economy + race backstop —
 *    'No actions left this turn.' is pinned THERE; this file pins the distinct
 *    canTakeAction strings ('No action left this turn.', turn-lock, fallbacks).
 *  - canTakeAction.test.js / turnState.test.js: the pure decision and budget math.
 * No charge ctx here; no clocks — turn-seam state only (spend() is disk truth,
 * not a fabricated shape). Locked-down campaign: test-campaign.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const { storeMirror } = vi.hoisted(() => ({ storeMirror: { activeCreatureName: null } }));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    getStore: vi.fn(() => ({ get: (k) => (k === 'activeCreatureName' ? storeMirror.activeCreatureName : null) })),
}));
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(async () => ({})),
}));

import { assertCanAct } from './assertCanAct.js';
import { getRuntimeValue, setRuntimeValue, getStore } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { spend } from './turnState.js';

const ON = { mode: 'on', turnLock: true, actionEconomy: true };

function mockStore(map) {
    getRuntimeValue.mockImplementation((characterKey, key) => map[`${characterKey}.${key}`] ?? null);
}

let consoleErrorSpy;
beforeEach(() => {
    vi.resetAllMocks();
    // Re-establish the store/log seams resetAllMocks just wiped.
    getRuntimeValue.mockImplementation(() => null);
    getStore.mockImplementation(() => ({ get: (k) => (k === 'activeCreatureName' ? storeMirror.activeCreatureName : null) }));
    setRuntimeValue.mockImplementation(() => {});
    addEntry.mockImplementation(async () => ({}));
    storeMirror.activeCreatureName = null;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => consoleErrorSpy.mockRestore());

describe('assertCanAct (L5-001 enforcement core)', () => {
    it('live combat: combatSummary mirror OUTRANKS the stale campaign-key copy (live-boundary fix)', () => {
        mockStore({
            'campaign.enforcement': ON,
            'campaign.activeCreatureName': 'Stale Bob',
            'campaign.turnState': {},
        });
        storeMirror.activeCreatureName = 'Alice';

        const popup = vi.fn();
        // Mirror says Alice is active: she acts; Bob's own-turn claim on the
        // stale campaign key must NOT admit him — the reason names Alice.
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Alice', bucket: 'action', setPopupHtml: popup }))
            .toEqual({ allowed: true, reason: null });
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Bob', bucket: 'action', setPopupHtml: popup }))
            .toEqual({ allowed: false, reason: "It is Alice's turn — Bob cannot act now." });
        expect(popup).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledTimes(1);
        // General enforcement never mutates the economy — charging is charge:true's lane (#2068).
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('mirror empty ⇒ campaign key decides; denial fires popup + exact audit-log envelope', () => {
        mockStore({
            'campaign.enforcement': ON,
            'campaign.activeCreatureName': 'Goblin',
            'campaign.turnState': {},
        });
        storeMirror.activeCreatureName = null;

        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Goblin', bucket: 'action' }))
            .toEqual({ allowed: true, reason: null });
        expect(getStore).toHaveBeenCalledWith('combatSummary');
        expect(addEntry).not.toHaveBeenCalled();

        const popup = vi.fn();
        const r = assertCanAct({
            campaignName: 'test-campaign',
            creatureName: 'Rakan',
            bucket: 'action',
            setPopupHtml: popup,
            source: 'useCharActionsAutomation',
        });
        expect(r).toEqual({ allowed: false, reason: "It is Goblin's turn — Rakan cannot act now." });
        expect(popup).toHaveBeenCalledWith(r.reason);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'enforcement_denied',
            creature: 'Rakan',
            bucket: 'action',
            source: 'useCharActionsAutomation',
            reason: r.reason,
        });
    });

    it('enforcement off OR missing ⇒ allowed fast path, exactly one store read per shape', () => {
        const popup = vi.fn();
        mockStore({});
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', cannotAct: false, setPopupHtml: popup }))
            .toEqual({ allowed: true, reason: null });
        expect(getRuntimeValue).toHaveBeenCalledTimes(1); // flag only — no turnState/active reads

        getRuntimeValue.mockClear();
        mockStore({ 'campaign.enforcement': { mode: 'off' } });
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', cannotAct: false }))
            .toEqual({ allowed: true, reason: null });
        expect(getRuntimeValue).toHaveBeenCalledTimes(1);

        expect(popup).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('cannotAct denies in BOTH enforcement modes — silent off, popup+audit on; default reason pinned', () => {
        mockStore({});
        const offPopup = vi.fn();
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', cannotAct: true, cannotActReason: 'Stunned', setPopupHtml: offPopup }))
            .toEqual({ allowed: false, reason: 'Stunned' });
        // L1–4 UX stays silent when enforcement is off.
        expect(offPopup).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        // Missing caller reason ⇒ assertCanAct's own default string.
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', cannotAct: true }))
            .toEqual({ allowed: false, reason: 'You cannot take actions right now.' });
        expect(addEntry).not.toHaveBeenCalled();

        mockStore({
            'campaign.enforcement': ON,
            'campaign.activeCreatureName': 'Rakan',
            'campaign.turnState': {},
        });
        const onPopup = vi.fn();
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'action', cannotAct: true, cannotActReason: 'Stunned — you cannot take actions.', setPopupHtml: onPopup }))
            .toEqual({ allowed: false, reason: 'Stunned — you cannot take actions.' });
        expect(onPopup).toHaveBeenCalledWith('Stunned — you cannot take actions.');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'enforcement_denied',
            creature: 'Rakan',
            bucket: 'action',
            source: 'action',
            reason: 'Stunned — you cannot take actions.',
        });
    });

    it('economy exhaustion denial — exact string, survives missing popup sink, still audits (sink fold from #2068 open rec)', () => {
        mockStore({
            'campaign.enforcement': ON,
            'campaign.activeCreatureName': 'Rakan',
            'campaign.turnState': spend({}, 'Rakan', 'action').turnState,
        });
        // No setPopupHtml (some call sites have none) — reportDenial must degrade, not throw.
        expect(() => assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'action' })).not.toThrow();
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'action' }))
            .toEqual({ allowed: false, reason: 'No action left this turn.' });
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'enforcement_denied',
            creature: 'Rakan',
            bucket: 'action',
            source: 'action',
            reason: 'No action left this turn.',
        });
    });

    it('blocker targetEffects: action-lane vs reaction-lane scoping, te.reason passthrough, fallback strings', () => {
        const blockAB = { target: 'Rakan', effect: 'no_action_and_bonus_action', reason: "Poisoned by Stinking Cloud (can't take an Action or Bonus Action)" };
        const blockR = { target: 'Rakan', effect: 'no_reactions', reason: "Petrifying Ray: can't take reactions" };
        mockStore({
            'campaign.enforcement': ON,
            'campaign.activeCreatureName': 'Rakan',
            'campaign.turnState': {},
            'campaign.targetEffects': [blockAB, blockR],
        });
        const ctx = (bucket) => assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket });
        expect(ctx('action')).toEqual({ allowed: false, reason: blockAB.reason });
        expect(ctx('bonusAction')).toEqual({ allowed: false, reason: blockAB.reason });
        expect(ctx('reaction')).toEqual({ allowed: false, reason: blockR.reason });
        expect(ctx('free')).toEqual({ allowed: true, reason: null });

        // Blocker without a reason ⇒ lane fallback strings.
        mockStore({
            'campaign.enforcement': ON,
            'campaign.activeCreatureName': 'Rakan',
            'campaign.turnState': {},
            'campaign.targetEffects': [{ target: 'Rakan', effect: 'no_action_and_bonus_action' }],
        });
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'bonusAction' }))
            .toEqual({ allowed: false, reason: "Can't take an Action or Bonus Action" });

        mockStore({
            'campaign.enforcement': ON,
            'campaign.activeCreatureName': 'Rakan',
            'campaign.turnState': {},
            'campaign.targetEffects': [{ target: 'Rakan', effect: 'no_reactions' }],
        });
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'reaction' }))
            .toEqual({ allowed: false, reason: 'A zone effect blocks reactions.' });
    });
});
