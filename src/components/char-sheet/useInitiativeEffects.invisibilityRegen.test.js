// @maintained-by-ai
// Lane (#invisibilityRegen): sole owner of clearActiveInvisibility (:225-232),
// clearActiveGreaterInvisibility (:234-241) and restoreRegenerateTargets (:244-256)
// — verified by grep: no sibling asserts end*/regenerateActive/currentHitPoints.
// edgeCases.test.js:31-33 delegates the full regenerate fixtures here.
// NOT restated: name-mismatch/null-stats guards → initiativeRolled.test.js guard
// table (#354, zero-write assertion covers every downstream lane); see-invisibility
// predicate matching → buffClearing.test.js (#348).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useInitiativeEffects from './useInitiativeEffects.js';

// Dead-mock purge: only four named bindings reach this mock — useInitiativeEffects.js:2
// (getRuntimeValue/setRuntimeValue/setRuntimeBatch/getAllStoreKeys) and its loaded
// collaborator boonOfCombatProwess.js:2 (getRuntimeValue/setRuntimeValue). getStore,
// listeners and useSyncedState are never read by any module loaded here.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
    getAllStoreKeys: vi.fn(() => []),
}));

// Each factory supplies every named binding useInitiativeEffects.js imports (:3-9);
// rollExpression/storage/revert* are inert here — the Turn Undead, concentration and
// shapechange lanes never execute (getCombatSummary → null early-return at :191-192).
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
    },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        set: vi.fn(),
    },
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibility: vi.fn(),
    endGreaterInvisibility: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({
    revertPolymorph: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/shapechangeService.js', () => ({
    revertShapechange: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../hooks/runtime/useRuntimeState.js';
import { endInvisibility, endGreaterInvisibility } from '../../services/rules/features/invisibilityService.js';

const INVIS_KEY = 'campaign|_activeInvisibility_TestMonk';
const GREATER_KEY = 'campaign|_activeGreaterInvisibility_TestMonk';

describe('useInitiativeEffects - invisibility clearing and regenerate restoration', () => {
    const campaignName = 'test-campaign';
    const playerStats = {
        name: 'TestMonk',
        level: 15,
        class: { name: 'Monk', class_levels: [] },
        abilities: [],
        automation: { passives: [], actions: [] },
    };

    // Fake store mirroring production semantics (#348 lineage): setRuntimeValue
    // updates what the NEXT getRuntimeValue sees, so sweeps filter fresh data and
    // stale-payload resurrection bugs cannot pass.
    let store;

    beforeEach(() => {
        vi.clearAllMocks();
        store = new Map();
        getRuntimeValue.mockImplementation((charKey, prop) =>
            store.has(`${charKey}|${prop}`) ? store.get(`${charKey}|${prop}`) : null
        );
        setRuntimeValue.mockImplementation((charKey, prop, value) => {
            store.set(`${charKey}|${prop}`, value);
        });
        getAllStoreKeys.mockReturnValue([]);
    });

    function rollInitiative(characterName = 'TestMonk') {
        renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
        window.dispatchEvent(
            new CustomEvent('initiative-rolled', { detail: { characterName, roll: 15 } })
        );
    }

    const invisWrites = () =>
        setRuntimeValue.mock.calls.filter(([, key]) =>
            key === '_activeInvisibility_TestMonk' || key === '_activeGreaterInvisibility_TestMonk'
        );
    const regenWrites = (charKey) =>
        setRuntimeValue.mock.calls.filter(([name, key]) =>
            name === charKey && (key === 'regenerateActive' || key === 'currentHitPoints')
        );

    describe('invisibility clearing', () => {
        it('ends both invisibility effects and nulls both campaign keys at the seam', () => {
            // Distinct truthy caster values prove any caster triggers; exact 4-arg
            // payloads pin the absence of skipSync (these writes originate locally).
            store.set(INVIS_KEY, 'AllyCaster');
            store.set(GREATER_KEY, 'TestMonk');
            rollInitiative();

            expect(endInvisibility).toHaveBeenCalledTimes(1);
            expect(endInvisibility).toHaveBeenCalledWith('TestMonk', campaignName, 'target rolled initiative');
            expect(endGreaterInvisibility).toHaveBeenCalledTimes(1);
            expect(endGreaterInvisibility).toHaveBeenCalledWith('TestMonk', campaignName, 'target rolled initiative');
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_activeInvisibility_TestMonk', null, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_activeGreaterInvisibility_TestMonk', null, campaignName);
            expect(invisWrites()).toHaveLength(2);
            // Final-state canon
            expect(getRuntimeValue('campaign', '_activeInvisibility_TestMonk')).toBeNull();
            expect(getRuntimeValue('campaign', '_activeGreaterInvisibility_TestMonk')).toBeNull();
        });

        it('leaves invisibility alone when no invisibility keys are set', () => {
            // Absence bites: dropping the truthiness guards (:228/:237) would fire
            // end* unconditionally and null-write both keys.
            rollInitiative();

            expect(endInvisibility).not.toHaveBeenCalled();
            expect(endGreaterInvisibility).not.toHaveBeenCalled();
            expect(invisWrites()).toHaveLength(0);
        });
    });

    describe('regenerate restoration', () => {
        it('restores ONLY the roller to max HP — other regen creatures are never swept (per-creature seam law)', () => {
            // Owner ruling 2026-11-10: another creature's Regenerate survives
            // THIS roll; Goblin pins the negative (regen-ready, left intact),
            // Zombie the !regenActive skip.
            getAllStoreKeys.mockReturnValue(['TestMonk', 'Goblin', 'Zombie', 123, null]);
            store.set('TestMonk|regenerateActive', true);
            store.set('TestMonk|hitPoints', 20);
            store.set('Goblin|regenerateActive', true);
            store.set('Goblin|hitPoints', 15);
            store.set('Zombie|regenerateActive', false);
            store.set('Zombie|hitPoints', 30);
            rollInitiative();

            expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'regenerateActive', false, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'currentHitPoints', 20, campaignName);
            expect(regenWrites('Goblin')).toHaveLength(0);
            expect(
                setRuntimeValue.mock.calls.filter(([name, key]) => name === 'Goblin' && key === 'currentHitPoints')
            ).toHaveLength(0);
            expect(regenWrites('Zombie')).toHaveLength(0);
            expect(
                setRuntimeValue.mock.calls.filter(([name]) => typeof name !== 'string')
            ).toHaveLength(0);
            // Final-state canon
            expect(getRuntimeValue('TestMonk', 'currentHitPoints')).toBe(20);
            expect(getRuntimeValue('Goblin', 'regenerateActive')).toBe(true);
            expect(getRuntimeValue('Goblin', 'currentHitPoints')).toBeNull();
            expect(getRuntimeValue('Zombie', 'regenerateActive')).toBe(false);
            expect(getRuntimeValue('Zombie', 'hitPoints')).toBe(30);
        });

        it.each([
            ['null max HP — consume regen, never touch currentHitPoints', null, false],
            ['0 max HP — loose `!= null` check still restores zero', 0, true],
        ])('handles a regen creature with %s', (_label, maxHp, expectHpWrite) => {
            getAllStoreKeys.mockReturnValue(['TestMonk']);
            store.set('TestMonk|regenerateActive', true);
            store.set('TestMonk|hitPoints', maxHp);
            rollInitiative();

            expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'regenerateActive', false, campaignName);
            const hpWrites = setRuntimeValue.mock.calls.filter(
                ([, key]) => key === 'currentHitPoints'
            );
            if (expectHpWrite) {
                expect(hpWrites).toEqual([['TestMonk', 'currentHitPoints', 0, campaignName]]);
            } else {
                expect(hpWrites).toEqual([]);
            }
        });

        it('is driven by the ROLLER name, never a getAllStoreKeys sweep', () => {
            // Per-creature seam law: the lane reads ONLY the rolling character's
            // store. Even with every regen-ready creature enumerated by
            // getAllStoreKeys, nobody but the roller is touched (the old
            // store-list-driven board sweep is retired).
            getAllStoreKeys.mockReturnValue([]);
            store.set('TestMonk|regenerateActive', true);
            store.set('TestMonk|hitPoints', 20);
            store.set('Goblin|regenerateActive', true);
            store.set('Goblin|hitPoints', 15);
            rollInitiative();

            // Empty key list no longer disables the roller's own restore…
            expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'regenerateActive', false, campaignName);
            // …while enumerated-or-not foreign stores stay byte-untouched.
            expect(regenWrites('Goblin')).toHaveLength(0);
            expect(getRuntimeValue('Goblin', 'regenerateActive')).toBe(true);
        });
    });
});
