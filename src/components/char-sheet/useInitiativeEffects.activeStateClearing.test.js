// @maintained-by-ai 2026-11-28
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useInitiativeEffects from './useInitiativeEffects.js';

// Dead-mock purge (#2100 bisect recipe, #2070 getAllStoreKeys retirement):
// the only bindings live in this import graph are the three useInitiativeEffects.js:2
// imports — boonOfCombatProwess.js (the sole unmocked collaborator) reads only
// getRuntimeValue/setRuntimeValue. getAllStoreKeys/getStore/useSyncedState/listeners
// were never touched here; removing them keeps tests green.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
}));

// Each factory supplies every named binding useInitiativeEffects.js imports;
// inert defaults keep non-owned lanes (Turn Undead dice, concentration,
// invisibility, shapechange) silent so only the active-state seam is observed.
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

// Lane map: event guard clauses (null playerStats/detail, name mismatch) are
// pinned in useInitiativeEffects.initiativeRolled.test.js; clearBuffByName /
// clearActiveBuffsWhere mechanics (incl. buff-absent no-write negatives) in
// useInitiativeEffects.buffClearing.test.js; setRuntimeBatch fields in
// useInitiativeEffects.batchResets.test.js; the 7-key campaign sweep in
// effectClearing.test.js; concentration / invisibility / regenerate lanes in
// their own siblings. This file owns the byte-exact per-character active-state
// setRuntimeValue writes of the initiative seam — including the
// ONCE_PER_TURN_TRACKER_KEYS loop, which no sibling pins — the Vow of Enmity
// target-strip lane (exactly one clearBuffByName('Awakened Mind') call also
// lives nowhere else), and the automation-null robustness leg edgeCases
// delegates here.
describe('useInitiativeEffects - active state clearing', () => {
    const campaignName = 'test-campaign';
    const defaultPlayerStats = {
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

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    function renderHookWithStats(stats = defaultPlayerStats) {
        return renderHook(() =>
            useInitiativeEffects(stats, campaignName, vi.fn())
        );
    }

    function dispatchInitiativeRoll(detail) {
        window.dispatchEvent(
            new CustomEvent('initiative-rolled', { detail })
        );
    }

    function allWrites() {
        return vi.mocked(setRuntimeValue).mock.calls;
    }

    it('clears the full per-character active-state set byte-exactly, exactly once per key, and writes no other store keys', () => {
        renderHookWithStats();
        dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });

        const calls = allWrites();
        // With an empty store: campaign targetEffects, buff and regenerate
        // lanes are no-ops, and the if(vowTarget) guard must not resolve a
        // missing target — so every write targets exactly this character,
        // on the real campaign.
        expect(calls.length).toBeGreaterThan(0);
        for (const [target, , , campaign] of calls) {
            expect(target).toBe('TestMonk');
            expect(campaign).toBe(campaignName);
        }

        // Exact snapshot: any extra, missing, or misvalued clear fails here.
        // elderChampionActive/avengingAngelActive reset to false, not null.
        const snapshot = Object.fromEntries(
            calls.map(([, key, value]) => [key, value])
        );
        expect(snapshot).toEqual({
            '_War_Gods_Blessing_active': null,
            'livingLegendActive': null,
            'unerringStrikeUsed': null,
            'holyNimbusActive': null,
            'elderChampionActive': false,
            'avengingAngelActive': false,
            'vowOfEnmityTarget': null,
            'vowOfEnmityCostPaid': null,
            'largeFormActive': null,
            'tranceOfOrderActive': null,
            'poisonedWeaponsActive': null,
            'awakenedMindTarget': null,
            'bastionOfLawActive': null,
            'bastionOfLawWardDice': null,
            'bastionOfLawWardSource': null,
            'bastionOfLawWardUsed': null,
            'bastionOfLawLastAttackDamage': null,
            // once-per-turn tracker loop
            '_Charge_Attack_usedRound': null,
            '_FastHands_usedRound': null,
            '_CunningAction_usedRound': null,
            '_Cleave_UsedRound': null,
            '_Nick_UsedRound': null,
            'surgeUsedRound': null,
            'illusoryRealityUsedRound': null,
            '_BrutalStrike_usedRound': null,
            '_fortifiedHealth_usedRound': null,
            '_Shield_Bash_usedRound': null,
            'piercerPunctureUsedThisTurn': null,
            '_Savage_Attacker_usedRound': null,
            '_Hamstring_usedRound': null,
            'resistanceUsedThisTurn': null,
        });
        // One write per snapshot key — the count closes the duplicate blind
        // spot of Object.fromEntries. Regression pin: clearLivingLegend once
        // ran twice in the same pass (copy-paste seam from 1c54eb4f2, folded
        // by 0bf564099), doubling livingLegendActive/unerringStrikeUsed writes
        // and their SSE broadcasts.
        expect(calls.length).toBe(Object.keys(snapshot).length);
    });

    it.each([
        { label: 'null', automation: null },
        { label: '{ passives: undefined, actions: undefined }', automation: { passives: undefined, actions: undefined } },
    ])('still clears active states when automation is $label', ({ automation }) => {
        renderHookWithStats({ ...defaultPlayerStats, automation });
        dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });

        // Handler completes past the automation optional-chaining guards in
        // buildInitiativeUpdates/recover* and still clears active state.
        // Row 1 kills a dropped `?.` (null.passives throws); row 2 kills a
        // dropped `?? []` (undefined.some throws).
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestMonk', '_War_Gods_Blessing_active', null, campaignName
        );
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestMonk', 'vowOfEnmityTarget', null, campaignName
        );
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestMonk', 'elderChampionActive', false, campaignName
        );
    });

    // Map-backed store so unchanged-pass final-state bytes are observable
    // (#348 production-faithful fake-store pattern). Also logs the vow lane's
    // read/write order so fresh-read sequencing is observable.
    function mountVowStore(entries) {
        const store = new Map(entries);
        const vowEvents = [];
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'EnemyTarget' && key === 'activeBuffs') vowEvents.push('read');
            return store.has(`${name}|${key}`) ? store.get(`${name}|${key}`) : null;
        });
        setRuntimeValue.mockImplementation((name, key, value) => {
            if (name === 'TestMonk' && key === 'vowOfEnmityTarget') vowEvents.push('vowClear');
            if (name === 'EnemyTarget' && key === 'activeBuffs') vowEvents.push('write');
            store.set(`${name}|${key}`, value);
        });
        return { store, vowEvents };
    }

    const VOW_STRIPPED = [{ effect: 'other_buff', source: 'Ally' }];
    const enemyBuffWrites = () =>
        allWrites().filter(
            ([name, key]) => name === 'EnemyTarget' && key === 'activeBuffs'
        );

    it('strips the vow buff once in clear-then-read-then-write order; every later roll neither reads nor writes the target', () => {
        const { store, vowEvents } = mountVowStore([
            ['TestMonk|vowOfEnmityTarget', 'EnemyTarget'],
            ['TestMonk|vowOfEnmityCostPaid', true],
            ['EnemyTarget|activeBuffs', [
                { effect: 'vow_of_enmity', source: 'TestMonk' },
                ...VOW_STRIPPED,
            ]],
        ]);
        renderHookWithStats();

        // Changed-pass (first clear): owner vow state clears FIRST, then the
        // lane reads the target's CURRENT buffs adjacent to its single
        // byte-exact write — never hoisted to a stale loop-start snapshot
        // (fix#86/#111 family). Prop-distinct Ally buff preserved byte-exact.
        dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
        expect(vowEvents).toEqual(['vowClear', 'read', 'write']);
        expect(enemyBuffWrites()).toEqual([
            ['EnemyTarget', 'activeBuffs', VOW_STRIPPED, campaignName],
        ]);

        // Second roll: vow state already null, so the if(vowTarget) guard skips
        // the target lane ENTIRELY — not one extra read or write, only the
        // unconditional owner clears fire again (fix#26: local clears POST).
        dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 12 });
        expect(vowEvents).toEqual(['vowClear', 'read', 'write', 'vowClear']);
        expect(store.get('EnemyTarget|activeBuffs')).toEqual(VOW_STRIPPED);
        expect(store.get('TestMonk|vowOfEnmityTarget')).toBe(null);
        expect(store.get('TestMonk|vowOfEnmityCostPaid')).toBe(null);
    });

    it('writes nothing to the vow target when its activeBuffs hold no vow_of_enmity buff', () => {
        // Only-if-changed churn pin (run2#346 warn): the lane once re-stamped the
        // byte-identical filtered array on EVERY own initiative roll — SSE echo
        // churn plus a stale-copy clobber of any concurrent buff write landing
        // between the lane's read and write (fix#86 merged-write / fix#111
        // fresh-read family). Guard mirrors sibling clearActiveBuffsWhere
        // (useInitiativeEffects.js:126): filtered.length !== buffs.length.
        const allyBuffs = [...VOW_STRIPPED];
        const { store } = mountVowStore([
            ['TestMonk|vowOfEnmityTarget', 'EnemyTarget'],
            ['TestMonk|vowOfEnmityCostPaid', true],
            ['EnemyTarget|activeBuffs', allyBuffs],
        ]);
        renderHookWithStats();
        dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });

        // Unchanged-pass: the lane READS but writes ZERO target activeBuffs...
        expect(enemyBuffWrites()).toHaveLength(0);
        // ...and Ally's buffs survive byte-exact (same array, untouched).
        expect(store.get('EnemyTarget|activeBuffs')).toBe(allyBuffs);
        // Vow owner-state still clears unconditionally at the seam (fix#26:
        // local-origin clears POST).
        expect(store.get('TestMonk|vowOfEnmityTarget')).toBe(null);
        expect(store.get('TestMonk|vowOfEnmityCostPaid')).toBe(null);
    });

    it('clears the Awakened Mind buff and target together on initiative', () => {
        getRuntimeValue.mockImplementation((_name, key) =>
            key === 'activeBuffs'
                ? [
                    { name: 'Awakened Mind', effect: 'awakened_mind' },
                    { name: 'Mage Armor', effect: 'mage_armor' },
                ]
                : null
        );
        renderHookWithStats();
        dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });

        // Sole pin that the seam's clearBuffByName('Awakened Mind') call exists
        // (the name is absent from buffClearing's exact-name table). Exactly
        // one changed-pass write (#1348 write-count canon); the unconditional
        // awakenedMindTarget clear is pinned by the snapshot above.
        expect(allWrites().filter(
            ([name, key]) => name === 'TestMonk' && key === 'activeBuffs'
        )).toEqual([
            ['TestMonk', 'activeBuffs', [{ name: 'Mage Armor', effect: 'mage_armor' }], campaignName],
        ]);
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestMonk', 'awakenedMindTarget', null, campaignName
        );
    });
});
