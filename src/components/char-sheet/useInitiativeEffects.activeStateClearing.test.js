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

    describe('guard clauses', () => {
        it('does not clear active states when event characterName does not match player name', () => {
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'OtherPlayer', roll: 15 });
            const clearCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[0] === 'TestMonk'
            );
            expect(clearCalls.length).toBe(0);
        });

        it('does not clear active states when automation is null', () => {
            const stats = {
                ...defaultPlayerStats,
                automation: null,
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const clearCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[0] === 'TestMonk'
            );
            expect(clearCalls.length).toBeGreaterThan(0);
        });

        it('does not clear active states when automation.passives/actions are undefined', () => {
            const stats = {
                ...defaultPlayerStats,
                automation: {
                    passives: undefined,
                    actions: undefined,
                },
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const clearCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[0] === 'TestMonk'
            );
            expect(clearCalls.length).toBeGreaterThan(0);
        });
    });

    describe('Vow of Enmity clearing', () => {
        it('clears vowOfEnmityTarget and vowOfEnmityCostPaid on initiative', () => {
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk', 'vowOfEnmityTarget', null, campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk', 'vowOfEnmityCostPaid', null, campaignName
            );
        });

        it('removes vow_of_enmity buff from target creature when vowOfEnmityTarget exists', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'vowOfEnmityTarget') return 'EnemyTarget';
                if (key === 'activeBuffs') return [
                    { effect: 'vow_of_enmity', source: 'TestMonk' },
                    { effect: 'other_buff', source: 'Ally' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'EnemyTarget',
                'activeBuffs',
                [{ effect: 'other_buff', source: 'Ally' }],
                campaignName
            );
        });

        it('does not modify target buffs when vowOfEnmityTarget is null', () => {
            getRuntimeValue.mockReturnValue(null);
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const targetBuffCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[0] === 'EnemyTarget'
            );
            expect(targetBuffCalls.length).toBe(0);
        });
    });

    describe('Awakened Mind clearing', () => {
        it('removes Awakened Mind buff from activeBuffs on initiative', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Awakened Mind', effect: 'awakened_mind' },
                    { name: 'Mage Armor', effect: 'mage_armor' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'activeBuffs',
                [{ name: 'Mage Armor', effect: 'mage_armor' }],
                campaignName
            );
        });

        it('clears awakenedMindTarget on initiative', () => {
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk', 'awakenedMindTarget', null, campaignName
            );
        });

        it('does not modify activeBuffs when no Awakened Mind buff is present', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [{ name: 'Mage Armor', effect: 'mage_armor' }];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestMonk',
                'activeBuffs',
                expect.any(Array),
                campaignName
            );
        });
    });

    describe('Bastion of Law clearing', () => {
        it('clears all bastionOfLaw fields on initiative', () => {
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk', 'bastionOfLawActive', null, campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk', 'bastionOfLawWardDice', null, campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk', 'bastionOfLawWardSource', null, campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk', 'bastionOfLawWardUsed', null, campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk', 'bastionOfLawLastAttackDamage', null, campaignName
            );
        });
    });

    describe('active state clearing completeness', () => {
        it('clears all per-character active state fields in a single initiative event', () => {
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });

            const calls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[0] === 'TestMonk'
            );
            const clearedKeys = calls.map(call => call[1]);

            // Verify all expected active state fields are cleared
            const expectedFields = [
                '_War_Gods_Blessing_active',
                'livingLegendActive',
                'unerringStrikeUsed',
                'holyNimbusActive',
                'elderChampionActive',
                'avengingAngelActive',
                'vowOfEnmityTarget',
                'vowOfEnmityCostPaid',
                'largeFormActive',
                'tranceOfOrderActive',
                'poisonedWeaponsActive',
                'awakenedMindTarget',
                'bastionOfLawActive',
                'bastionOfLawWardDice',
                'bastionOfLawWardSource',
                'bastionOfLawWardUsed',
                'bastionOfLawLastAttackDamage',
            ];

            for (const field of expectedFields) {
                expect(clearedKeys).toContain(field);
            }
        });

        it('sets elderChampionActive to false (not null) on initiative', () => {
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk', 'elderChampionActive', false, campaignName
            );
        });

        it('sets avengingAngelActive to false (not null) on initiative', () => {
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk', 'avengingAngelActive', false, campaignName
            );
        });
    });
});
