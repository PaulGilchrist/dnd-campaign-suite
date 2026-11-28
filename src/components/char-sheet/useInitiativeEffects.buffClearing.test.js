// @maintained-by-ai 2026-11-28
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useInitiativeEffects from './useInitiativeEffects.js';

// Lane map: this file owns the buff-clearing MECHANICS of the initiative seam —
// clearBuffByName exact-name matching, clearActiveBuffsWhere predicate matching,
// the starry_form clearSourceEffects campaign lane, the write-only-if-changed
// guard, and the buff-absent no-write negatives (the sibling "active state
// clearing" and "buildInitiativeUpdates batch payload" describes cite this file
// as their owner). Event guard clauses (null playerStats/detail, name mismatch)
// are pinned, with stronger whole-handler negatives, in the "guard clauses"
// describe of useInitiativeEffects.initiativeRolled.test.js; byte-exact
// active-state snapshots + tracker loop in activeStateClearing.test.js; exact
// batch payloads in batchResets.test.js; concentration / invisibility /
// regenerate lanes in their own siblings.
// Deliberate split: the exact-name table below covers the Revelation/Starry/
// Superior Defense/Haste clearBuffByName calls; the 'Awakened Mind' call is
// pinned by the stronger buff+target test in activeStateClearing.test.js and
// must NOT be duplicated here.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    // Exactly the three exports live in this import graph: useInitiativeEffects.js
    // imports getRuntimeValue/setRuntimeValue/setRuntimeBatch and its only real
    // collaborator, boonOfCombatProwess.js, imports getRuntimeValue/setRuntimeValue.
    // Dead-mock purge (#2070/#2138 getAllStoreKeys retirement, bisect-confirmed):
    // no module loaded here imports getAllStoreKeys anymore; getStore/useSyncedState/
    // listeners were purged earlier.
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
}));

// Each factory supplies every named binding useInitiativeEffects.js imports;
// inert defaults keep the non-buff lanes (concentration, invisibility,
// shapechange, regenerate, storage) inert so only the buff seam is observed.
// combatData also exports getCurrentCombatRound (boonOfCombatProwess.js:1) but
// it is never called on this lane, so an undefined binding is honest here.
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

describe('useInitiativeEffects - buff clearing mechanics', () => {
    const campaignName = 'test-campaign';
    const BUFFS_KEY = 'activeBuffs';
    const TE_KEY = 'targetEffects';
    const buff = (name, effect) => ({ name, effect });
    // Prop-distinct survivor so cleared-vs-preserved bytes are distinguishable
    const PRESERVED = buff('Mage Armor', 'mage_armor');
    const OWN_STARRY_TE = { effect: 'starry_form', source: 'TestMonk', target: 'Enemy1' };
    const ALLY_STARRY_TE = { effect: 'starry_form', source: 'Ally', target: 'Enemy2' };

    const playerStats = {
        name: 'TestMonk',
        level: 15,
        class: {
            name: 'Monk',
            class_levels: [{ level: 15, focus_points: 6 }],
        },
        abilities: [{ name: 'Wisdom', bonus: 4 }],
        automation: {
            passives: [],
            actions: [],
        },
        actions: [],
    };

    // Fake store mirroring production semantics: setRuntimeValue updates the
    // value the NEXT getRuntimeValue sees (useRuntimeState.js:99 writes
    // synchronously), so each clear pass in the handler filters fresh data —
    // unlike a static mock, which lets stale payloads pass a resurrection bug.
    let store;

    beforeEach(() => {
        vi.clearAllMocks();
        store = new Map();
        getRuntimeValue.mockImplementation((name, key) =>
            store.has(`${name}|${key}`) ? store.get(`${name}|${key}`) : null
        );
        setRuntimeValue.mockImplementation((name, key, value) => {
            store.set(`${name}|${key}`, value);
        });
    });

    function renderHookWithStats(stats = playerStats) {
        return renderHook(() =>
            useInitiativeEffects(stats, campaignName, vi.fn())
        );
    }

    function rollInitiative() {
        window.dispatchEvent(
            new CustomEvent('initiative-rolled', {
                detail: { characterName: 'TestMonk', roll: 15 },
            })
        );
    }

    const activeBuffs = () => getRuntimeValue('TestMonk', BUFFS_KEY);
    const targetEffects = () => getRuntimeValue('campaign', TE_KEY);
    const activeBuffsWrites = () =>
        setRuntimeValue.mock.calls.filter(
            ([name, key]) => name === 'TestMonk' && key === BUFFS_KEY
        );
    const targetEffectsWrites = () =>
        setRuntimeValue.mock.calls.filter(
            ([name, key]) => name === 'campaign' && key === TE_KEY
        );

    describe('clearBuffByName exact-name matching', () => {
        // One representative single-clear pass; the full set of cleared names
        // (Revelation/Starry/Superior Defense/Haste) is pinned call-site by
        // call-site in the multi-buff final-state test below.
        it('clears an exact-name buff and writes the survivors byte-exactly', () => {
            store.set(`TestMonk|${BUFFS_KEY}`, [buff('Superior Defense', 'superior_defense'), PRESERVED]);
            renderHookWithStats();
            rollInitiative();
            expect(activeBuffsWrites()).toEqual([
                ['TestMonk', BUFFS_KEY, [PRESERVED], campaignName],
            ]);
            expect(activeBuffs()).toEqual([PRESERVED]);
        });

        it('removes every matching entry in one byte-exact write', () => {
            store.set(`TestMonk|${BUFFS_KEY}`, [
                buff('Revelation in Flesh', 'revelation'),
                buff('Revelation in Flesh', 'revelation_stacked'),
                PRESERVED,
            ]);
            renderHookWithStats();
            rollInitiative();
            expect(activeBuffsWrites()).toEqual([
                ['TestMonk', BUFFS_KEY, [PRESERVED], campaignName],
            ]);
        });

        it('matches exactly: every similar name survives untouched and nothing is written', () => {
            const similar = [
                buff('Revelation in Flesh Enhanced', 'unrelated_effect'),
                buff('Starry Form Enhanced', 'unrelated_effect'),
                buff('Haste Enhanced', 'unrelated_effect'),
                buff('Superior Defense Enhanced', 'unrelated_effect'),
                PRESERVED,
            ];
            store.set(`TestMonk|${BUFFS_KEY}`, similar);
            renderHookWithStats();
            rollInitiative();
            expect(activeBuffsWrites()).toHaveLength(0);
            expect(activeBuffs()).toEqual(similar);
        });

        it('writes nothing when activeBuffs is unset (store default null)', () => {
            renderHookWithStats();
            rollInitiative();
            expect(activeBuffsWrites()).toHaveLength(0);
        });

        it('writes a byte-exact empty array when the only buff is cleared', () => {
            store.set(`TestMonk|${BUFFS_KEY}`, [buff('Haste', 'haste')]);
            renderHookWithStats();
            rollInitiative();
            expect(activeBuffsWrites()).toEqual([
                ['TestMonk', BUFFS_KEY, [], campaignName],
            ]);
            expect(activeBuffs()).toEqual([]);
        });
    });

    describe('clearActiveBuffsWhere predicate matching (See Invisibility)', () => {
        it('clears see_invisibility by effect predicate regardless of buff name in one write', () => {
            store.set(`TestMonk|${BUFFS_KEY}`, [
                buff('See Invisibility', 'see_invisibility'),
                buff('Owl Sight', 'see_invisibility'),
                PRESERVED,
            ]);
            renderHookWithStats();
            rollInitiative();
            // The 'Owl Sight' entry passes only under the effect predicate — a
            // name-matching regression would leave it and change these bytes.
            expect(activeBuffsWrites()).toEqual([
                ['TestMonk', BUFFS_KEY, [PRESERVED], campaignName],
            ]);
        });
    });

    describe('starry_form campaign targetEffects (clearSourceEffects)', () => {
        it('clears the buff and caster-sourced starry_form effects, byte-exact via a 4-arg POST write', () => {
            store.set(`TestMonk|${BUFFS_KEY}`, [buff('Starry Form', 'starry_form'), PRESERVED]);
            store.set(`campaign|${TE_KEY}`, [OWN_STARRY_TE, ALLY_STARRY_TE]);
            renderHookWithStats();
            rollInitiative();
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk', BUFFS_KEY, [PRESERVED], campaignName
            );
            // Exact 4-arg tuple: the dead 5th skipSync arg must never reappear
            // (store arity is 4, useRuntimeState.js:78) — local clears POST.
            expect(targetEffectsWrites()).toEqual([
                ['campaign', TE_KEY, [ALLY_STARRY_TE], campaignName],
            ]);
        });

        it.each([
            ['only non-matching rows (other source, other effect)', [ALLY_STARRY_TE, { effect: 'bane_penalty', source: 'TestMonk', target: 'Enemy1' }]],
            ['no stored effects at all', null],
        ])('writes no campaign targetEffects when it holds %s', (_label, stored) => {
            store.set(`TestMonk|${BUFFS_KEY}`, [buff('Starry Form', 'starry_form')]);
            store.set(`campaign|${TE_KEY}`, stored);
            renderHookWithStats();
            rollInitiative();
            expect(targetEffectsWrites()).toHaveLength(0);
            expect(targetEffects()).toEqual(stored);
        });
    });

    describe('multi-buff interaction final state', () => {
        it('clears every initiative-cleared buff type in one event without resurrecting any', () => {
            store.set(`TestMonk|${BUFFS_KEY}`, [
                buff('Revelation in Flesh', 'revelation'),
                buff('Starry Form', 'starry_form'),
                buff('Haste', 'haste'),
                buff('Superior Defense', 'superior_defense'),
                buff('Owl Sight', 'see_invisibility'),
                PRESERVED,
            ]);
            store.set(`campaign|${TE_KEY}`, [OWN_STARRY_TE, ALLY_STARRY_TE]);
            renderHookWithStats();
            rollInitiative();
            // Each pass re-reads the previous write (production store is synchronous),
            // so ONE final-state assertion proves the whole five-clear chain: any
            // dropped clear or stale-write resurrection breaks these bytes.
            expect(activeBuffs()).toEqual([PRESERVED]);
            expect(targetEffects()).toEqual([ALLY_STARRY_TE]);
        });
    });
});
