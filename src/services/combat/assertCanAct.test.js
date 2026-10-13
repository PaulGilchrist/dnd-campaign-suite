import { vi, describe, it, expect, beforeEach } from 'vitest';

const { storeMirror } = vi.hoisted(() => ({ storeMirror: { activeCreatureName: null } }));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    getStore: vi.fn(() => ({ get: (k) => (k === 'activeCreatureName' ? storeMirror.activeCreatureName : null) })),
}));
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(async () => ({})),
}));

import { assertCanAct } from './assertCanAct.js';
import { getRuntimeValue, getStore } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { spend } from './turnState.js';

const ON = { mode: 'on', turnLock: true, actionEconomy: true };

function mockStore(map) {
    getRuntimeValue.mockImplementation((characterKey, key) => map[`${characterKey}.${key}`] ?? null);
}

beforeEach(() => {
    vi.clearAllMocks();
    storeMirror.activeCreatureName = null;
});

describe('assertCanAct (L5-001)', () => {
    it('enforcement on + turn-lock ⇒ combatSummary mirror OUTRANKS the stale campaign-key copy (live-boundary fix)', () => {
        mockStore({
            'campaign.enforcement': ON,
            'campaign.activeCreatureName': 'Stale Bob',
            'campaign.turnState': {},
        });
        storeMirror.activeCreatureName = 'Alice';

        const popup = vi.fn();
        const alice = assertCanAct({ campaignName: 'test-campaign', creatureName: 'Alice', bucket: 'action', setPopupHtml: popup });
        const bob = assertCanAct({ campaignName: 'test-campaign', creatureName: 'Bob', bucket: 'action', setPopupHtml: popup });

        expect(alice.allowed).toBe(true);
        expect(bob.allowed).toBe(false);
        expect(popup).toHaveBeenCalled();
    });

    it('mirror empty (no combat) ⇒ campaign-key fallback still decides', () => {
        mockStore({
            'campaign.enforcement': ON,
            'campaign.activeCreatureName': 'Bob',
            'campaign.turnState': {},
        });
        storeMirror.activeCreatureName = null;

        const r = assertCanAct({ campaignName: 'test-campaign', creatureName: 'Bob', bucket: 'action' });
        expect(r.allowed).toBe(true);
        expect(getStore).toHaveBeenCalledWith('combatSummary');
    });

    it('enforcement absent/off ⇒ allowed with ZERO store reads beyond the flag', () => {
        mockStore({});
        const popup = vi.fn();
        const r = assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', cannotAct: false, setPopupHtml: popup });
        expect(r.allowed).toBe(true);
        expect(popup).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        // Only the enforcement flag was read (fast path — no turnState/active reads).
        expect(getRuntimeValue).toHaveBeenCalledTimes(1);
    });

    it('cannotAct STILL denies while enforcement is off — legacy silent semantics', () => {
        mockStore({});
        const popup = vi.fn();
        const r = assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', cannotAct: true, cannotActReason: 'Stunned', setPopupHtml: popup });
        expect(r.allowed).toBe(false);
        expect(r.reason).toBe('Stunned');
        // Silent (L1–4 UX): no popup, no audit log when enforcement is off.
        expect(popup).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('turn-lock denial: popup + audit log + reason', () => {
        mockStore({
            'campaign.enforcement': ON,
            'campaign.activeCreatureName': 'Goblin',
            'campaign.turnState': {},
        });
        const popup = vi.fn();
        const r = assertCanAct({
            campaignName: 'test-campaign',
            creatureName: 'Rakan',
            bucket: 'action',
            setPopupHtml: popup,
            source: 'useCharActionsAutomation',
        });
        expect(r.allowed).toBe(false);
        expect(r.reason).toMatch(/Goblin's turn/);
        expect(popup).toHaveBeenCalledWith(r.reason);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'enforcement_denied',
            creature: 'Rakan',
            bucket: 'action',
            source: 'useCharActionsAutomation',
        }));
    });

    it('own turn with budget ⇒ allowed, no popup, no log', () => {
        mockStore({
            'campaign.enforcement': ON,
            'campaign.activeCreatureName': 'Rakan',
            'campaign.turnState': {},
        });
        const r = assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan' });
        expect(r.allowed).toBe(true);
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('economy exhaustion denial', () => {
        mockStore({
            'campaign.enforcement': ON,
            'campaign.activeCreatureName': 'Rakan',
            'campaign.turnState': spend({}, 'Rakan', 'action').turnState,
        });
        const r = assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'action' });
        expect(r.allowed).toBe(false);
        expect(r.reason).toMatch(/No action left/);
    });

    it('condition-gate denial passes through unchanged', () => {
        mockStore({
            'campaign.enforcement': ON,
            'campaign.activeCreatureName': 'Rakan',
            'campaign.turnState': {},
        });
        const r = assertCanAct({
            campaignName: 'test-campaign',
            creatureName: 'Rakan',
            cannotAct: true,
            cannotActReason: 'Stunned — you cannot take actions.',
        });
        expect(r.allowed).toBe(false);
        expect(r.reason).toMatch(/Stunned/);
    });

    it('SP-111 store blocker: no_action_and_bonus_action denies actions, spares reactions', () => {
        mockStore({
            'campaign.enforcement': ON,
            'campaign.activeCreatureName': 'Rakan',
            'campaign.turnState': {},
            'campaign.targetEffects': [
                { target: 'Rakan', effect: 'no_action_and_bonus_action', reason: "Poisoned by Stinking Cloud (can't take an Action or Bonus Action)" },
            ],
        });
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'action' }).allowed).toBe(false);
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'bonusAction' }).allowed).toBe(false);
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'reaction' }).allowed).toBe(true);
    });

    it('no_reactions blocker denies only reactions', () => {
        mockStore({
            'campaign.enforcement': ON,
            'campaign.activeCreatureName': 'Rakan',
            'campaign.turnState': {},
            'campaign.targetEffects': [
                { target: 'Rakan', effect: 'no_reactions', reason: 'Petrifying Ray: can\'t take reactions' },
            ],
        });
        const r = assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'reaction' });
        expect(r.allowed).toBe(false);
        expect(r.reason).toMatch(/reactions/);
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'action' }).allowed).toBe(true);
    });

    it('missing setPopupHtml sink does not throw (some call sites have no popup)', () => {
        mockStore({
            'campaign.enforcement': ON,
            'campaign.activeCreatureName': 'Goblin',
            'campaign.turnState': {},
        });
        expect(() => assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan' })).not.toThrow();
    });
});
