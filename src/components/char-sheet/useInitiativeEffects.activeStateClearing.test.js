// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useInitiativeEffects from './useInitiativeEffects.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
    getAllStoreKeys: vi.fn(() => []),
}));

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
// clearActiveBuffsWhere mechanics (incl. "no buff -> no write" negatives) in
// useInitiativeEffects.buffClearing.test.js; setRuntimeBatch fields in
// useInitiativeEffects.batchResets.test.js; concentration / invisibility /
// regenerate lanes in their own siblings. This file owns the byte-exact
// per-character active-state setRuntimeValue writes of the initiative seam —
// including the ONCE_PER_TURN_TRACKER_KEYS loop, which no sibling pins.
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

    it.each([
        { label: 'null', automation: null },
        { label: '{ passives: undefined, actions: undefined }', automation: { passives: undefined, actions: undefined } },
    ])('still clears active states when automation is $label', ({ automation }) => {
        renderHookWithStats({ ...defaultPlayerStats, automation });
        dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });

        // Handler completes past the automation optional-chaining guards in
        // buildInitiativeUpdates/recover* and still clears active state.
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

    it('clears the full per-character active-state set byte-exactly and writes no other store keys', () => {
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
        expect(Object.fromEntries(calls.map(([, key, value]) => [key, value]))).toEqual({
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
    });

    it('clears Living Legend exactly once per initiative roll (single setRuntimeValue per key)', () => {
        renderHookWithStats();
        dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });

        // Regression pin: the handler once invoked clearLivingLegend twice in
        // the same straight-line pass (copy-paste seam from 1c54eb4f2, folded
        // into two identical clearLivingLegend calls by 0bf564099), doubling
        // these writes and their SSE broadcast. Exactly one of each, byte-exact.
        const legendWrites = allWrites().filter(
            ([, key]) => key === 'livingLegendActive'
        );
        const strikeWrites = allWrites().filter(
            ([, key]) => key === 'unerringStrikeUsed'
        );
        expect(legendWrites).toHaveLength(1);
        expect(strikeWrites).toHaveLength(1);
        expect(legendWrites[0]).toEqual(['TestMonk', 'livingLegendActive', null, campaignName]);
        expect(strikeWrites[0]).toEqual(['TestMonk', 'unerringStrikeUsed', null, campaignName]);
    });

    it('removes vow_of_enmity from the target creature and clears vow state', () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'vowOfEnmityTarget' && name === 'TestMonk') return 'EnemyTarget';
            if (key === 'activeBuffs' && name === 'EnemyTarget') return [
                { effect: 'vow_of_enmity', source: 'TestMonk' },
                { effect: 'other_buff', source: 'Ally' },
            ];
            return null;
        });
        renderHookWithStats();
        dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });

        // Vow buff stripped, prop-distinct Ally buff preserved byte-exactly.
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'EnemyTarget',
            'activeBuffs',
            [{ effect: 'other_buff', source: 'Ally' }],
            campaignName
        );
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestMonk', 'vowOfEnmityTarget', null, campaignName
        );
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestMonk', 'vowOfEnmityCostPaid', null, campaignName
        );
        // Player has no buffs here — the vow lane must not invent writes
        // against the player's own activeBuffs.
        expect(allWrites().some(
            ([target, key]) => target === 'TestMonk' && key === 'activeBuffs'
        )).toBe(false);
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

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestMonk',
            'activeBuffs',
            [{ name: 'Mage Armor', effect: 'mage_armor' }],
            campaignName
        );
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestMonk', 'awakenedMindTarget', null, campaignName
        );
    });
});
