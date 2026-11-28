// @maintained-by-ai 2026-11-28
// Lane (#invisibilityRegen): sole owner of clearActiveInvisibility,
// clearActiveGreaterInvisibility and restoreRegenerateTarget — verified by grep:
// no sibling asserts end*/regenerateActive/currentHitPoints at this seam.
// edgeCases.test.js delegates the full regenerate fixtures here.
// NOT restated: name-mismatch/null-stats guards → initiativeRolled.test.js guard
// table (#354, zero-write assertion covers every downstream lane); see-invisibility
// predicate matching → buffClearing.test.js (#348); the 7-key targetEffects sweep
// + batch seam → effectClearing.test.js (#2069, regen-restore removed there as
// subsumed by "restores ONLY the roller" below — this lane owns the restore face).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useInitiativeEffects from './useInitiativeEffects.js';

// Only the bindings actually imported by modules loaded here reach the mock:
// useInitiativeEffects.js:2 (getRuntimeValue/setRuntimeValue/setRuntimeBatch)
// and its loaded collaborator boonOfCombatProwess.js (getRuntimeValue/
// setRuntimeValue). getAllStoreKeys is no longer imported — the store-list
// driven regenerate sweep was retired with the per-creature seam law.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
}));

// Each factory supplies every named binding useInitiativeEffects.js imports;
// rollExpression/storage/revert* are inert here — the Turn Undead, concentration and
// shapechange lanes never execute (getCombatSummary → null early-return).
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

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { endInvisibility, endGreaterInvisibility } from '../../services/rules/features/invisibilityService.js';

const INVIS_KEY = '_activeInvisibility_TestMonk';
const GREATER_KEY = '_activeGreaterInvisibility_TestMonk';

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
    });

    function rollInitiative() {
        renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
        window.dispatchEvent(
            new CustomEvent('initiative-rolled', { detail: { characterName: 'TestMonk', roll: 15 } })
        );
    }

    const invisWrites = () =>
        setRuntimeValue.mock.calls.filter(([, key]) => key === INVIS_KEY || key === GREATER_KEY);
    const regenWrites = (charKey) =>
        setRuntimeValue.mock.calls.filter(([name, key]) =>
            name === charKey && (key === 'regenerateActive' || key === 'currentHitPoints')
        );

    describe('invisibility clearing', () => {
        it('ends both invisibility effects and nulls both campaign keys at the seam', () => {
            // Distinct truthy caster values prove any caster triggers; exact 4-arg
            // payloads pin the absence of skipSync (these writes originate locally).
            store.set(`campaign|${INVIS_KEY}`, 'AllyCaster');
            store.set(`campaign|${GREATER_KEY}`, 'TestMonk');
            rollInitiative();

            expect(endInvisibility).toHaveBeenCalledTimes(1);
            expect(endInvisibility).toHaveBeenCalledWith('TestMonk', campaignName, 'target rolled initiative');
            expect(endGreaterInvisibility).toHaveBeenCalledTimes(1);
            expect(endGreaterInvisibility).toHaveBeenCalledWith('TestMonk', campaignName, 'target rolled initiative');
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', INVIS_KEY, null, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', GREATER_KEY, null, campaignName);
            expect(invisWrites()).toHaveLength(2);
            // Final-state canon
            expect(getRuntimeValue('campaign', INVIS_KEY)).toBeNull();
            expect(getRuntimeValue('campaign', GREATER_KEY)).toBeNull();
        });

        it('leaves invisibility alone when no invisibility keys are set', () => {
            // Absence bites: dropping the truthiness guards would fire end*
            // unconditionally and null-write both keys.
            rollInitiative();

            expect(endInvisibility).not.toHaveBeenCalled();
            expect(endGreaterInvisibility).not.toHaveBeenCalled();
            expect(invisWrites()).toHaveLength(0);
        });
    });

    describe('regenerate restoration', () => {
        it('restores ONLY the roller to max HP — other regen creatures are never swept (per-creature seam law)', () => {
            // Owner ruling 2026-11-10: another creature's Regenerate survives
            // THIS roll; Goblin pins the negative (regen-ready, left intact).
            store.set('TestMonk|regenerateActive', true);
            store.set('TestMonk|hitPoints', 20);
            store.set('Goblin|regenerateActive', true);
            store.set('Goblin|hitPoints', 15);
            rollInitiative();

            expect(regenWrites('TestMonk')).toEqual([
                ['TestMonk', 'regenerateActive', false, campaignName],
                ['TestMonk', 'currentHitPoints', 20, campaignName],
            ]);
            expect(regenWrites('Goblin')).toHaveLength(0);
            // Final-state canon
            expect(getRuntimeValue('TestMonk', 'currentHitPoints')).toBe(20);
            expect(getRuntimeValue('Goblin', 'regenerateActive')).toBe(true);
        });

        it.each([
            ['inactive regen — the seam writes nothing', false, 20, []],
            ['null max HP — regen consumed, currentHitPoints untouched', true, null,
                [['TestMonk', 'regenerateActive', false, campaignName]]],
            ['0 max HP — loose `!= null` check still restores zero', true, 0,
                [['TestMonk', 'regenerateActive', false, campaignName],
                    ['TestMonk', 'currentHitPoints', 0, campaignName]]],
        ])('handles a regen creature with %s', (_label, regenActive, maxHp, expectedWrites) => {
            store.set('TestMonk|regenerateActive', regenActive);
            store.set('TestMonk|hitPoints', maxHp);
            rollInitiative();

            // Exact write sequence: skip guard (false regen), null-skip, and the
            // loose `!= null` zero-restore are each discriminated.
            expect(regenWrites('TestMonk')).toEqual(expectedWrites);
        });
    });
});
