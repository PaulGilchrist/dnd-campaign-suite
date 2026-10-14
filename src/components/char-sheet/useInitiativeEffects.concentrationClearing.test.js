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
import { getCombatSummary } from '../../services/encounters/combatData.js';
import * as storageService from '../../services/ui/storage.js';

describe('useInitiativeEffects - concentration clearing', () => {
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

    describe('concentration clearing - general behavior', () => {
        it('clears concentration and persists combat summary when creature has concentration', () => {
            mockCombatSummary('Bane');
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
        });

        it('clears concentration but skips spell-specific effects when spell is undefined', () => {
            vi.mocked(getCombatSummary).mockReturnValue({
                creatures: [
                    {
                        name: 'TestMonk',
                        concentration: {},
                    },
                ],
            });
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
            const targetEffectCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[0] === 'campaign' && call[1] === 'targetEffects'
            );
            expect(targetEffectCalls.length).toBe(0);
        });

        it('does nothing when creature has no concentration', () => {
            mockCombatSummary(null);
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(storageService.default.set).not.toHaveBeenCalled();
        });

        it('does nothing when combat summary is null', () => {
            vi.mocked(getCombatSummary).mockReturnValue(null);
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(storageService.default.set).not.toHaveBeenCalled();
        });

        it('does nothing when creature not found in combat summary', () => {
            vi.mocked(getCombatSummary).mockReturnValue({
                creatures: [{ name: 'OtherPlayer', concentration: { spell: 'Bane' } }],
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(storageService.default.set).not.toHaveBeenCalled();
        });
    });

    describe('Bane concentration clearing', () => {
        it('removes bane_penalty targetEffect from campaign', () => {
            mockCombatSummary('Bane');
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [
                    { effect: 'bane_penalty', source: 'TestMonk' },
                    { effect: 'other_effect', source: 'Ally' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [{ effect: 'other_effect', source: 'Ally' }],
                campaignName,
                true
            );
        });

        it('does nothing when no bane_penalty effect exists', () => {
            mockCombatSummary('Bane');
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [{ effect: 'other_effect', source: 'Ally' }];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const targetEffectCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[0] === 'campaign' && call[1] === 'targetEffects'
            );
            expect(targetEffectCalls.length).toBe(0);
        });
    });

    describe('Blade Ward concentration clearing', () => {
        it('removes bane_penalty targetEffect from campaign (Blade Ward uses same key)', () => {
            mockCombatSummary('Blade Ward');
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [
                    { effect: 'bane_penalty', source: 'TestMonk' },
                    { effect: 'other_effect', source: 'Ally' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [{ effect: 'other_effect', source: 'Ally' }],
                campaignName,
                true
            );
        });

        it('does nothing when no bane_penalty effect exists', () => {
            mockCombatSummary('Blade Ward');
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [{ effect: 'other_effect', source: 'Ally' }];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const targetEffectCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[0] === 'campaign' && call[1] === 'targetEffects'
            );
            expect(targetEffectCalls.length).toBe(0);
        });
    });

    describe('Bless concentration clearing', () => {
        it('removes bless_bonus targetEffect from campaign', () => {
            mockCombatSummary('Bless');
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [
                    { effect: 'bless_bonus', source: 'TestMonk' },
                    { effect: 'other_effect', source: 'Ally' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [{ effect: 'other_effect', source: 'Ally' }],
                campaignName,
                true
            );
        });

        it('does nothing when no bless_bonus effect exists', () => {
            mockCombatSummary('Bless');
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [{ effect: 'other_effect', source: 'Ally' }];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const targetEffectCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[0] === 'campaign' && call[1] === 'targetEffects'
            );
            expect(targetEffectCalls.length).toBe(0);
        });
    });

    describe('Ray of Enfeeblement concentration clearing', () => {
        it('removes ray_of_enfeeble_debuff targetEffect from campaign', () => {
            mockCombatSummary('Ray of Enfeeblement');
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [
                    { effect: 'ray_of_enfeeble_debuff', source: 'TestMonk' },
                    { effect: 'other_effect', source: 'Ally' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [{ effect: 'other_effect', source: 'Ally' }],
                campaignName,
                true
            );
        });

        it('does nothing when no ray_of_enfeeble_debuff effect exists', () => {
            mockCombatSummary('Ray of Enfeeblement');
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [{ effect: 'other_effect', source: 'Ally' }];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const targetEffectCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[0] === 'campaign' && call[1] === 'targetEffects'
            );
            expect(targetEffectCalls.length).toBe(0);
        });
    });

    describe('Compelled Duel concentration clearing', () => {
        it('removes compelled_duel targetEffect from campaign', () => {
            mockCombatSummary('Compelled Duel');
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [
                    { effect: 'compelled_duel', source: 'TestMonk' },
                    { effect: 'other_effect', source: 'Ally' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [{ effect: 'other_effect', source: 'Ally' }],
                campaignName,
                true
            );
        });

        it('does nothing when no compelled_duel effect exists', () => {
            mockCombatSummary('Compelled Duel');
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [{ effect: 'other_effect', source: 'Ally' }];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const targetEffectCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[0] === 'campaign' && call[1] === 'targetEffects'
            );
            expect(targetEffectCalls.length).toBe(0);
        });
    });

    describe('Resistance concentration clearing', () => {
        it('removes resistance_damage_reduction targetEffect from campaign', () => {
            mockCombatSummary('Resistance');
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [
                    { effect: 'resistance_damage_reduction', source: 'TestMonk' },
                    { effect: 'other_effect', source: 'Ally' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [{ effect: 'other_effect', source: 'Ally' }],
                campaignName,
                true
            );
        });

        it('does nothing when no resistance_damage_reduction effect exists', () => {
            mockCombatSummary('Resistance');
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [{ effect: 'other_effect', source: 'Ally' }];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const targetEffectCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[0] === 'campaign' && call[1] === 'targetEffects'
            );
            expect(targetEffectCalls.length).toBe(0);
        });
    });

    describe('Protection from Energy concentration clearing', () => {
        it('removes Protection from Energy buff from all creatures', () => {
            mockCombatSummary('Protection from Energy');
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Protection from Energy', effect: 'protection_energy' },
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
            expect(storageService.default.set).toHaveBeenCalledWith(
                'combatSummary',
                expect.objectContaining({
                    creatures: expect.arrayContaining([
                        expect.objectContaining({ concentration: null }),
                    ]),
                }),
                campaignName
            );
        });

        it('does nothing when no Protection from Energy buff exists on any creature', () => {
            mockCombatSummary('Protection from Energy');
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [{ name: 'Mage Armor', effect: 'mage_armor' }];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const buffCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'activeBuffs'
            );
            expect(buffCalls.length).toBe(0);
        });

        it('handles empty creatures array gracefully', () => {
            vi.mocked(getCombatSummary).mockReturnValue({
                creatures: [],
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(storageService.default.set).not.toHaveBeenCalled();
        });

        it('handles creature with no activeBuffs gracefully', () => {
            vi.mocked(getCombatSummary).mockReturnValue({
                creatures: [{ name: 'TestMonk', concentration: { spell: 'Protection from Energy' } }],
            });
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return undefined;
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const buffCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'activeBuffs'
            );
            expect(buffCalls.length).toBe(0);
        });
    });
});
