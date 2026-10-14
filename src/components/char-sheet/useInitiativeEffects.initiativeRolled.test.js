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

describe('useInitiativeEffects - initiative-rolled event', () => {
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
        it('does not call setRuntimeValue when playerStats is null', () => {
            renderHook(() =>
                useInitiativeEffects(null, campaignName, vi.fn())
            );
            dispatchInitiativeRoll({
                characterName: 'TestMonk',
                roll: 15,
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('does not call setRuntimeValue when playerStats is undefined', () => {
            renderHook(() =>
                useInitiativeEffects(undefined, campaignName, vi.fn())
            );
            dispatchInitiativeRoll({
                characterName: 'TestMonk',
                roll: 15,
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('does not call setRuntimeValue when event detail is null', () => {
            renderHookWithStats();
            dispatchInitiativeRoll(null);
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('does not call setRuntimeValue when event detail is undefined', () => {
            renderHookWithStats();
            dispatchInitiativeRoll(undefined);
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('does not call setRuntimeValue when detail has no characterName', () => {
            renderHookWithStats();
            dispatchInitiativeRoll({ roll: 15 });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('does not call setRuntimeValue when characterName is empty string', () => {
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: '', roll: 15 });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('does not call setRuntimeValue when rolling name does not match player name', () => {
            renderHookWithStats();
            dispatchInitiativeRoll({
                characterName: 'OtherPlayer',
                roll: 15,
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('perfect focus (Monk level 15 passive)', () => {
        it('recovers to 4 when current is <= 3 and below max', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'uncannyMetabolismUsed') return null;
                if (key === 'focusPoints') return 2;
                return null;
            });
            const stats = {
                ...defaultPlayerStats,
                automation: {
                    ...defaultPlayerStats.automation,
                    passives: [
                        {
                            type: 'passive_rule',
                            effect: 'perfect_focus',
                        },
                    ],
                },
                class: {
                    ...defaultPlayerStats.class,
                    class_levels: [
                        { level: 15, focus_points: 4 },
                    ],
                },
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({
                characterName: 'TestMonk',
                roll: 15,
            });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'focusPoints',
                4,
                campaignName
            );
        });

        it('recovers to max when max is less than 4', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'uncannyMetabolismUsed') return null;
                if (key === 'focusPoints') return 2;
                return null;
            });
            const stats = {
                ...defaultPlayerStats,
                automation: {
                    ...defaultPlayerStats.automation,
                    passives: [
                        {
                            type: 'passive_rule',
                            effect: 'perfect_focus',
                        },
                    ],
                },
                class: {
                    ...defaultPlayerStats.class,
                    class_levels: [
                        { level: 15, focus_points: 3 },
                    ],
                },
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({
                characterName: 'TestMonk',
                roll: 15,
            });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'focusPoints',
                3,
                campaignName
            );
        });

        it('does not recover when current is above threshold', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'uncannyMetabolismUsed') return null;
                if (key === 'focusPoints') return 4;
                return null;
            });
            const stats = {
                ...defaultPlayerStats,
                automation: {
                    ...defaultPlayerStats.automation,
                    passives: [
                        {
                            type: 'passive_rule',
                            effect: 'perfect_focus',
                        },
                    ],
                },
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({
                characterName: 'TestMonk',
                roll: 15,
            });
            const fpCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'focusPoints'
            );
            expect(fpCalls.length).toBe(0);
        });

        it('does not recover when uncanny metabolism was used', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'uncannyMetabolismUsed') return true;
                if (key === 'focusPoints') return 2;
                return null;
            });
            const stats = {
                ...defaultPlayerStats,
                automation: {
                    ...defaultPlayerStats.automation,
                    passives: [
                        {
                            type: 'passive_rule',
                            effect: 'perfect_focus',
                        },
                    ],
                },
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({
                characterName: 'TestMonk',
                roll: 15,
            });
            const fpCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'focusPoints'
            );
            expect(fpCalls.length).toBe(0);
        });
    });

    describe('initiative_action routing regression', () => {
        it('checks specialActions not actions for initiative_action automations (CLA-013 routing fix)', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildShapeUses') return 0;
                return null;
            });
            const stats = {
                ...defaultPlayerStats,
                level: 20,
                automation: {
                    ...defaultPlayerStats.automation,
                    actions: [],
                    specialActions: [
                        {
                            type: 'initiative_action',
                            effect: 'wild_shape_regen_on_initiative',
                        },
                    ],
                },
                class: {
                    ...defaultPlayerStats.class,
                    class_levels: [
                        { level: 20, wild_shape: 3 },
                    ],
                },
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({
                characterName: 'TestMonk',
                roll: 15,
            });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'wildShapeUses',
                1,
                campaignName
            );
        });

        it('does not find initiative_action when it is only in actions not specialActions', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildShapeUses') return 0;
                return null;
            });
            const stats = {
                ...defaultPlayerStats,
                level: 20,
                automation: {
                    ...defaultPlayerStats.automation,
                    actions: [
                        {
                            type: 'initiative_action',
                            effect: 'wild_shape_regen_on_initiative',
                        },
                    ],
                    specialActions: [],
                },
                class: {
                    ...defaultPlayerStats.class,
                    class_levels: [
                        { level: 20, wild_shape: 3 },
                    ],
                },
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({
                characterName: 'TestMonk',
                roll: 15,
            });
            const wsCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'wildShapeUses'
            );
            expect(wsCalls.length).toBe(0);
        });
    });

    describe('wild shape recovery (Archdruid)', () => {
        it('recovers 1 use when all uses expended', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildShapeUses') return 0;
                return null;
            });
            const stats = {
                ...defaultPlayerStats,
                level: 18,
                automation: {
                    ...defaultPlayerStats.automation,
                    specialActions: [
                        {
                            type: 'initiative_action',
                            effect: 'wild_shape_regen_on_initiative',
                        },
                    ],
                },
                class: {
                    ...defaultPlayerStats.class,
                    class_levels: [
                        { level: 18, wild_shape: 3 },
                    ],
                },
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({
                characterName: 'TestMonk',
                roll: 15,
            });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'wildShapeUses',
                1,
                campaignName
            );
        });

        it('does not recover when uses remain', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildShapeUses') return 1;
                return null;
            });
            const stats = {
                ...defaultPlayerStats,
                level: 18,
                automation: {
                    ...defaultPlayerStats.automation,
                    specialActions: [
                        {
                            type: 'initiative_action',
                            effect: 'wild_shape_regen_on_initiative',
                        },
                    ],
                },
                class: {
                    ...defaultPlayerStats.class,
                    class_levels: [
                        { level: 18, wild_shape: 3 },
                    ],
                },
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({
                characterName: 'TestMonk',
                roll: 15,
            });
            const wsCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'wildShapeUses'
            );
            expect(wsCalls.length).toBe(0);
        });

        it('does not recover when max wild shape is 0', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildShapeUses') return 0;
                return null;
            });
            const stats = {
                ...defaultPlayerStats,
                level: 18,
                automation: {
                    ...defaultPlayerStats.automation,
                    specialActions: [
                        {
                            type: 'initiative_action',
                            effect: 'wild_shape_regen_on_initiative',
                        },
                    ],
                },
                class: {
                    ...defaultPlayerStats.class,
                    class_levels: [
                        { level: 18, wild_shape: 0 },
                    ],
                },
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({
                characterName: 'TestMonk',
                roll: 15,
            });
            const wsCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'wildShapeUses'
            );
            expect(wsCalls.length).toBe(0);
        });

        it('does not recover when no evergreen action exists', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildShapeUses') return 0;
                return null;
            });
            const stats = {
                ...defaultPlayerStats,
                level: 18,
                class: {
                    ...defaultPlayerStats.class,
                    class_levels: [
                        { level: 18, wild_shape: 3 },
                    ],
                },
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({
                characterName: 'TestMonk',
                roll: 15,
            });
            const wsCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'wildShapeUses'
            );
            expect(wsCalls.length).toBe(0);
        });
    });

    describe('bardic inspiration recovery (Superior Inspiration)', () => {
        it('recovers to min target when below target', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'bardicInspirationUses') return 0;
                return null;
            });
            const stats = {
                ...defaultPlayerStats,
                class: {
                    ...defaultPlayerStats.class,
                    name: 'Bard',
                    class_levels: [{ level: 20 }],
                },
                automation: {
                    ...defaultPlayerStats.automation,
                    specialActions: [
                        {
                            type: 'initiative_action',
                            effect:
                                'regain_bardic_inspiration_on_initiative',
                        },
                    ],
                },
                proficiency: 6,
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({
                characterName: 'TestMonk',
                roll: 15,
            });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'bardicInspirationUses',
                2,
                campaignName
            );
        });

        it('caps at max when max is less than target', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'bardicInspirationUses') return 0;
                return null;
            });
            const stats = {
                ...defaultPlayerStats,
                name: 'Bard',
                level: 20,
                class: {
                    ...defaultPlayerStats.class,
                    name: 'Bard',
                    class_levels: [
                        {
                            level: 20,
                            bardic_inspiration_uses: 1,
                        },
                    ],
                },
                automation: {
                    ...defaultPlayerStats.automation,
                    specialActions: [
                        {
                            type: 'initiative_action',
                            effect:
                                'regain_bardic_inspiration_on_initiative',
                        },
                    ],
                },
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({
                characterName: 'Bard',
                roll: 15,
            });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Bard',
                'bardicInspirationUses',
                1,
                campaignName
            );
        });

        it('does not recover when already at or above target', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'bardicInspirationUses') return 2;
                return null;
            });
            const stats = {
                ...defaultPlayerStats,
                class: {
                    ...defaultPlayerStats.class,
                    name: 'Bard',
                    class_levels: [{ level: 20 }],
                },
                automation: {
                    ...defaultPlayerStats.automation,
                    specialActions: [
                        {
                            type: 'initiative_action',
                            effect:
                                'regain_bardic_inspiration_on_initiative',
                        },
                    ],
                },
                proficiency: 6,
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({
                characterName: 'TestMonk',
                roll: 15,
            });
            const biCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'bardicInspirationUses'
            );
            expect(biCalls.length).toBe(0);
        });

        it('does not recover for non-Bard classes', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'bardicInspirationUses') return 0;
                return null;
            });
            const stats = {
                ...defaultPlayerStats,
                class: {
                    ...defaultPlayerStats.class,
                    name: 'Monk',
                },
                automation: {
                    ...defaultPlayerStats.automation,
                    specialActions: [
                        {
                            type: 'initiative_action',
                            effect:
                                'regain_bardic_inspiration_on_initiative',
                        },
                    ],
                },
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({
                characterName: 'TestMonk',
                roll: 15,
            });
            const biCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'bardicInspirationUses'
            );
            expect(biCalls.length).toBe(0);
        });
    });

    describe('superior defense buff clearing', () => {
        it('removes Superior Defense buff from activeBuffs on initiative roll', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Superior Defense', effect: 'damage_resistance' },
                    { name: 'Mage Armor', effect: 'mage_armor' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({
                characterName: 'TestMonk',
                roll: 15,
            });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'activeBuffs',
                [
                    { name: 'Mage Armor', effect: 'mage_armor' },
                ],
                campaignName
            );
        });
    });
});
