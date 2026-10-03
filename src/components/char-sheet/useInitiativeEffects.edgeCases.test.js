// @improved-by-ai
// @cleaned-by-ai
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

import { getRuntimeValue, setRuntimeValue, setRuntimeBatch, getAllStoreKeys } from '../../hooks/runtime/useRuntimeState.js';
import { BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY } from '../../services/rules/features/boonOfCombatProwess.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import * as storageService from '../../services/ui/storage.js';

describe('useInitiativeEffects - edge cases and missing coverage', () => {
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

    function mockCombatSummary(concentrationSpell) {
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [
                {
                    name: 'TestMonk',
                    concentration: concentrationSpell ? { spell: concentrationSpell } : null,
                },
            ],
        });
    }

    describe('Perfect Focus edge cases', () => {
        it('does not recover focus when class level lookup fails (level mismatch)', () => {
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
                        { type: 'passive_rule', effect: 'perfect_focus' },
                    ],
                },
                class: {
                    ...defaultPlayerStats.class,
                    class_levels: [{ level: 20, focus_points: 6 }],
                },
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const fpCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'focusPoints'
            );
            expect(fpCalls.length).toBe(0);
        });

        it('does not recover focus when maxFP is 0', () => {
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
                        { type: 'passive_rule', effect: 'perfect_focus' },
                    ],
                },
                class: {
                    ...defaultPlayerStats.class,
                    class_levels: [{ level: 15, focus_points: 0 }],
                },
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const fpCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'focusPoints'
            );
            expect(fpCalls.length).toBe(0);
        });

        it('does not recover when focusPoints equals maxFP (already at max)', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'uncannyMetabolismUsed') return null;
                if (key === 'focusPoints') return 3;
                return null;
            });
            const stats = {
                ...defaultPlayerStats,
                automation: {
                    ...defaultPlayerStats.automation,
                    passives: [
                        { type: 'passive_rule', effect: 'perfect_focus' },
                    ],
                },
                class: {
                    ...defaultPlayerStats.class,
                    class_levels: [{ level: 15, focus_points: 3 }],
                },
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const fpCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'focusPoints'
            );
            expect(fpCalls.length).toBe(0);
        });
    });

    describe('Wild Shape recovery edge cases', () => {
        it('does not recover when druid level lookup fails (level mismatch)', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildShapeUses') return 0;
                return null;
            });
            const stats = {
                ...defaultPlayerStats,
                level: 20,
                automation: {
                    ...defaultPlayerStats.automation,
                    specialActions: [
                        { type: 'initiative_action', effect: 'wild_shape_regen_on_initiative' },
                    ],
                },
                class: {
                    ...defaultPlayerStats.class,
                    class_levels: [{ level: 25, wild_shape: 3 }],
                },
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const wsCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'wildShapeUses'
            );
            expect(wsCalls.length).toBe(0);
        });
    });

    describe('Bardic Inspiration edge cases', () => {
        it('recovers to 0 when class level lookup fails and no proficiency fallback', () => {
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
                    class_levels: [{ level: 25, bardic_inspiration_uses: 5 }],
                },
                automation: {
                    ...defaultPlayerStats.automation,
                    specialActions: [
                        { type: 'initiative_action', effect: 'regain_bardic_inspiration_on_initiative' },
                    ],
                },
                proficiency: undefined,
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({ characterName: 'Bard', roll: 15 });
            const biCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'bardicInspirationUses'
            );
            expect(biCalls.length).toBe(1);
            expect(biCalls[0][2]).toBe(0);
        });
    });

    describe('Calm Emotions - suppressed conditions edge cases', () => {
        it('does not restore conditions when mode is not immunity', () => {
            mockCombatSummary('Calm Emotions');
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [
                    {
                        effect: 'calm_emotions',
                        source: 'TestMonk',
                        mode: 'suppressed',
                        suppressedConditions: ['Frightened'],
                        target: 'Enemy1',
                    },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const condCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'activeConditions'
            );
            expect(condCalls.length).toBe(0);
            // targetEffects should still be cleaned up
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [],
                campaignName,
                true
            );
        });

        it('does not restore conditions that are already present on target (case-insensitive)', () => {
            mockCombatSummary('Calm Emotions');
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [
                    {
                        effect: 'calm_emotions',
                        source: 'TestMonk',
                        mode: 'immunity',
                        suppressedConditions: ['frightened'],
                        target: 'Enemy1',
                    },
                ];
                if (key === 'activeConditions') return ['Frightened'];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const condCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'activeConditions'
            );
            expect(condCalls.length).toBe(0);
        });

        it('handles empty suppressedConditions array', () => {
            mockCombatSummary('Calm Emotions');
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [
                    {
                        effect: 'calm_emotions',
                        source: 'TestMonk',
                        mode: 'immunity',
                        suppressedConditions: [],
                        target: 'Enemy1',
                    },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [],
                campaignName,
                true
            );
        });
    });

    describe('Concentration clearing for unhandled spells', () => {
        it('clears concentration via storage but does not touch targetEffects for unhandled spells', () => {
            mockCombatSummary('Shield');
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(storageService.default.set).toHaveBeenCalledWith(
                'combatSummary',
                expect.objectContaining({
                    creatures: expect.arrayContaining([
                        expect.objectContaining({ concentration: null }),
                    ]),
                }),
                campaignName
            );
            const effCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[0] === 'campaign' && call[1] === 'targetEffects'
            );
            expect(effCalls.length).toBe(0);
        });
    });

    describe('Regenerate clearing edge cases', () => {
        it('skips regenerate loop when getAllStoreKeys returns empty array', () => {
            getRuntimeValue.mockImplementation((_charKey, prop) => {
                if (prop === 'regenerateActive') return true;
                if (prop === 'hitPoints') return 20;
                return null;
            });
            vi.mocked(getAllStoreKeys).mockReturnValue([]);
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const regenCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'regenerateActive'
            );
            expect(regenCalls.length).toBe(0);
        });

        it('skips non-string keys and handles mixed valid/invalid keys', () => {
            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'regenerateActive') return charKey === 'ValidCreature' ? true : false;
                if (prop === 'hitPoints') return 20;
                return null;
            });
            vi.mocked(getAllStoreKeys).mockReturnValue(['ValidCreature', 123, null, 'AnotherCreature']);
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const regenCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'regenerateActive'
            );
            expect(regenCalls.length).toBe(1);
            expect(regenCalls).toContainEqual(['ValidCreature', 'regenerateActive', false, campaignName]);
        });
    });

    describe('playerStats.automation null/undefined safety', () => {
        it('does not throw when automation property is missing', () => {
            getRuntimeValue.mockReturnValue(null);
            const stats = {
                ...defaultPlayerStats,
                automation: undefined,
            };
            expect(() => {
                renderHookWithStats(stats);
                dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            }).not.toThrow();
        });

        it('does not throw when passives/actions are undefined', () => {
            getRuntimeValue.mockReturnValue(null);
            const stats = {
                ...defaultPlayerStats,
                automation: {
                    passives: undefined,
                    actions: undefined,
                },
            };
            expect(() => {
                renderHookWithStats(stats);
                dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            }).not.toThrow();
        });
    });

    describe('FT-007: Boon of Combat Prowess round latch + Stroke of Luck reset on initiative', () => {
        it('batches the Boon round latch clear on initiative', () => {
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const calls = vi.mocked(setRuntimeBatch).mock.calls;
            const boonCall = calls.find(([, updates]) => BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY in updates);
            expect(boonCall).toBeDefined();
            expect(boonCall[1][BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY]).toBeNull();
        });

        it('batches the strokeOfLuckUsed clear on initiative', () => {
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const calls = vi.mocked(setRuntimeBatch).mock.calls;
            const strokeCall = calls.find(([, updates]) => 'strokeOfLuckUsed' in updates);
            expect(strokeCall).toBeDefined();
            expect(strokeCall[1].strokeOfLuckUsed).toBeNull();
        });
    });

    describe('getCombatSummary when creature has no concentration property', () => {
        it('does not attempt to clear concentration when property is absent', () => {
            vi.mocked(getCombatSummary).mockReturnValue({
                creatures: [
                    { name: 'TestMonk' },
                ],
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const concCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'concentration'
            );
            expect(concCalls.length).toBe(0);
        });

        it('does not attempt to clear concentration when value is undefined', () => {
            vi.mocked(getCombatSummary).mockReturnValue({
                creatures: [
                    { name: 'TestMonk', concentration: undefined },
                ],
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const concCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'concentration'
            );
            expect(concCalls.length).toBe(0);
        });
    });
});
