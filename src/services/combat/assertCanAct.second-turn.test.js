// @maintained-by-ai
/**
 * PAIR CORE — assertCanAct ST-seam read (bug-turnlock-denies-holder-on-own-second-turn,
 * owner ruling 2026-11-09: the `(Second Turn)` twin is the HOLDER's extra turn).
 * readActiveCreature resolves the active combatSummary row through
 * isSecondTurnEntry → holderName ONCE at the shared read, so the holder and
 * their companions pass the turn-lock while the twin is active while a
 * DIFFERENT creature still denies with copy naming the acting twin row.
 * The pure allow/deny matrix lives in canTakeAction.second-turn.test.js;
 * this file pins the impure store-read seam (mirror lookup + passthrough).
 * Harness mirrors assertCanAct.test.js. Locked-down campaign: test-campaign.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const { storeMirror } = vi.hoisted(() => ({
    storeMirror: { activeCreatureName: null, creatures: [] },
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    getStore: vi.fn(() => ({
        get: (k) => (k === 'activeCreatureName' ? storeMirror.activeCreatureName
            : k === 'creatures' ? storeMirror.creatures
                : null),
    })),
}));
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(async () => ({})),
}));

import { assertCanAct } from './assertCanAct.js';
import { getRuntimeValue, getStore } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { registerCompanion } from './turnState.js';

const ON = { mode: 'on', turnLock: true, actionEconomy: false };
const TWIN = 'EvasiveFighter (Second Turn)';
const HOLDER = 'EvasiveFighter';

function mockStore(map) {
    getRuntimeValue.mockImplementation((characterKey, key) => map[`${characterKey}.${key}`] ?? null);
}

let consoleErrorSpy;
beforeEach(() => {
    vi.resetAllMocks();
    getRuntimeValue.mockImplementation(() => null);
    getStore.mockImplementation(() => ({
        get: (k) => (k === 'activeCreatureName' ? storeMirror.activeCreatureName
            : k === 'creatures' ? storeMirror.creatures
                : null),
    }));
    addEntry.mockImplementation(async () => ({}));
    storeMirror.activeCreatureName = null;
    storeMirror.creatures = [];
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => consoleErrorSpy.mockRestore());

const twinBoard = [
    { name: HOLDER, type: 'player', initiative: '20' },
    { name: TWIN, type: 'player', initiative: '10', secondTurn: true, holderName: HOLDER },
    { name: 'ElderPaladin', type: 'player', initiative: '15' },
];

describe('assertCanAct — active-creature ST-seam read (CLA-360)', () => {
    it('twin active ⇒ holder allowed on BOTH action and bonus buckets, zero audit', () => {
        mockStore({ 'campaign.enforcement': ON, 'campaign.turnState': {} });
        storeMirror.activeCreatureName = TWIN;
        storeMirror.creatures = twinBoard;

        const popup = vi.fn();
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: HOLDER, bucket: 'action', setPopupHtml: popup }))
            .toEqual({ allowed: true, reason: null });
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: HOLDER, bucket: 'bonusAction', setPopupHtml: popup }))
            .toEqual({ allowed: true, reason: null });
        expect(popup).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('twin active ⇒ companion whose companionOf is the HOLDER is allowed', () => {
        mockStore({
            'campaign.enforcement': ON,
            'campaign.turnState': registerCompanion({}, 'Wolf 1', HOLDER),
        });
        storeMirror.activeCreatureName = TWIN;
        storeMirror.creatures = twinBoard;

        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Wolf 1', bucket: 'action' }))
            .toEqual({ allowed: true, reason: null });
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('twin active ⇒ a DIFFERENT creature still denies; copy names the twin row; audit rides through', () => {
        mockStore({ 'campaign.enforcement': ON, 'campaign.turnState': {} });
        storeMirror.activeCreatureName = TWIN;
        storeMirror.creatures = twinBoard;

        const popup = vi.fn();
        const r = assertCanAct({
            campaignName: 'test-campaign',
            creatureName: 'ElderPaladin',
            bucket: 'action',
            setPopupHtml: popup,
            source: 'useCharActionsAttackHandlers',
        });
        expect(r).toEqual({ allowed: false, reason: `It is ${TWIN}'s turn — ElderPaladin cannot act now.` });
        expect(popup).toHaveBeenCalledWith(r.reason);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'enforcement_denied',
            creature: 'ElderPaladin',
            bucket: 'action',
            source: 'useCharActionsAttackHandlers',
            reason: r.reason,
        });
    });

    it('non-ST face byte-unchanged: plain active name resolves no holder (deny stands)', () => {
        mockStore({ 'campaign.enforcement': ON, 'campaign.turnState': {} });
        storeMirror.activeCreatureName = 'ElderPaladin';
        storeMirror.creatures = twinBoard;

        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: HOLDER, bucket: 'action' }))
            .toEqual({ allowed: false, reason: `It is ElderPaladin's turn — ${HOLDER} cannot act now.` });
    });

    it('active row without holderName (malformed twin) ⇒ no invented holder pass', () => {
        mockStore({ 'campaign.enforcement': ON, 'campaign.turnState': {} });
        storeMirror.activeCreatureName = TWIN;
        storeMirror.creatures = [{ name: TWIN, type: 'player', initiative: '10', secondTurn: true }];

        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: HOLDER, bucket: 'action' }))
            .toEqual({ allowed: false, reason: `It is ${TWIN}'s turn — ${HOLDER} cannot act now.` });
    });

    it('enforcement OFF ⇒ fast path untouched even with a twin board (no store seam read)', () => {
        mockStore({ 'campaign.enforcement': { mode: 'off' } });
        storeMirror.activeCreatureName = TWIN;
        storeMirror.creatures = twinBoard;

        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Anyone', bucket: 'action' }))
            .toEqual({ allowed: true, reason: null });
        expect(getRuntimeValue).toHaveBeenCalledTimes(1); // enforcement flag only
        expect(addEntry).not.toHaveBeenCalled();
    });
});
