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

describe('useInitiativeEffects - buff clearing', () => {
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

    function activeBuffsCalls() {
        return vi.mocked(setRuntimeValue).mock.calls.filter(
            call => call[0] === 'TestMonk' && call[1] === 'activeBuffs'
        );
    }

    describe('Revelation in Flesh buff clearing', () => {
        it('removes Revelation in Flesh from activeBuffs on initiative', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Revelation in Flesh', effect: 'revelation' },
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

        it('removes all Revelation in Flesh entries when multiple exist', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Revelation in Flesh', effect: 'revelation' },
                    { name: 'Revelation in Flesh', effect: 'revelation' },
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

        it('does not clear a buff with a similar but different name', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Revelation in Flesh Enhanced', effect: 'revelation_enhanced' },
                    { name: 'Mage Armor', effect: 'mage_armor' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(activeBuffsCalls().length).toBe(0);
        });

        it('does nothing when no Revelation in Flesh buff is present', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [{ name: 'Mage Armor', effect: 'mage_armor' }];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(activeBuffsCalls().length).toBe(0);
        });

        it('does nothing when activeBuffs is null', () => {
            getRuntimeValue.mockReturnValue(null);
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(activeBuffsCalls().length).toBe(0);
        });

        it('does nothing when activeBuffs is undefined', () => {
            getRuntimeValue.mockReturnValue(undefined);
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(activeBuffsCalls().length).toBe(0);
        });

        it('clears all buffs when only Revelation in Flesh exists', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Revelation in Flesh', effect: 'revelation' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'activeBuffs',
                [],
                campaignName
            );
        });
    });

    describe('Starry Form buff and effect clearing', () => {
        it('removes Starry Form from activeBuffs and starry_form effects from targetEffects on initiative', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Starry Form', effect: 'starry_form' },
                    { name: 'Mage Armor', effect: 'mage_armor' },
                ];
                if (key === 'targetEffects') return [
                    { effect: 'starry_form', source: 'TestMonk', target: 'Enemy1' },
                    { effect: 'other_effect', source: 'Ally', target: 'Enemy2' },
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
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [{ effect: 'other_effect', source: 'Ally', target: 'Enemy2' }],
                campaignName,
                true
            );
        });

        it('preserves starry_form effects from other sources (no setRuntimeValue call when filtered length unchanged)', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Starry Form', effect: 'starry_form' },
                ];
                if (key === 'targetEffects') return [
                    { effect: 'starry_form', source: 'Ally', target: 'Enemy1' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'activeBuffs',
                [],
                campaignName
            );
            // No targetEffects call because the filtered array has the same length as the original
            // (the Ally's starry_form effect is preserved by the filter)
            const teCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[0] === 'campaign' && call[1] === 'targetEffects'
            );
            expect(teCalls.length).toBe(0);
        });

        it('does nothing when no Starry Form buff is present', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [{ name: 'Mage Armor', effect: 'mage_armor' }];
                if (key === 'targetEffects') return [];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(activeBuffsCalls().length).toBe(0);
        });

        it('clears Starry Form buff even when no targetEffects exist', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Starry Form', effect: 'starry_form' },
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
            const teCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[0] === 'campaign' && call[1] === 'targetEffects'
            );
            expect(teCalls.length).toBe(0);
        });

        it('does not call setRuntimeValue for targetEffects when no starry_form effects exist', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Starry Form', effect: 'starry_form' },
                    { name: 'Mage Armor', effect: 'mage_armor' },
                ];
                if (key === 'targetEffects') return [
                    { effect: 'other_effect', source: 'Ally' },
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
            const teCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[0] === 'campaign' && call[1] === 'targetEffects'
            );
            expect(teCalls.length).toBe(0);
        });
    });

    describe('Haste buff clearing', () => {
        it('removes Haste from activeBuffs on initiative', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Haste', effect: 'haste' },
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

        it('removes all Haste entries when multiple exist', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Haste', effect: 'haste' },
                    { name: 'Haste', effect: 'haste' },
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

        it('does nothing when no Haste buff is present', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [{ name: 'Mage Armor', effect: 'mage_armor' }];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(activeBuffsCalls().length).toBe(0);
        });

        it('clears all buffs when only Haste exists', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Haste', effect: 'haste' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'activeBuffs',
                [],
                campaignName
            );
        });
    });

    describe('See Invisibility buff clearing', () => {
        it('removes See Invisibility by effect property on initiative', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'See Invisibility', effect: 'see_invisibility' },
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

        it('removes See Invisibility even when effect differs from name', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Some Other Buff', effect: 'see_invisibility' },
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

        it('does nothing when no See Invisibility effect is present', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Mage Armor', effect: 'mage_armor' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(activeBuffsCalls().length).toBe(0);
        });
    });

    describe('Superior Defense buff clearing', () => {
        it('removes Superior Defense from activeBuffs on initiative', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Superior Defense', effect: 'superior_defense' },
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

        it('does nothing when no Superior Defense buff is present', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [{ name: 'Mage Armor', effect: 'mage_armor' }];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(activeBuffsCalls().length).toBe(0);
        });
    });

    describe('Guard clauses', () => {
        it('does not clear any buffs when event characterName does not match player name', () => {
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'OtherPlayer', roll: 15 });
            expect(activeBuffsCalls().length).toBe(0);
        });

        it('does not clear any buffs when playerStats is null', () => {
            renderHookWithStats(null);
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(activeBuffsCalls().length).toBe(0);
        });
    });

    describe('Multiple buff clearing interactions', () => {
        it('clears both Revelation in Flesh and Starry Form in the same initiative event', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Revelation in Flesh', effect: 'revelation' },
                    { name: 'Starry Form', effect: 'starry_form' },
                    { name: 'Haste', effect: 'haste' },
                    { name: 'Mage Armor', effect: 'mage_armor' },
                ];
                if (key === 'targetEffects') return [
                    { effect: 'starry_form', source: 'TestMonk', target: 'Enemy1' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });

            // Each buff type is cleared in its own filter pass, so setRuntimeValue is called
            // for activeBuffs once per buff type that was found (Revelation, Starry Form, Haste)
            const buffCalls = activeBuffsCalls();
            expect(buffCalls.length).toBe(3);

            // First call: Revelation in Flesh removed from original list
            expect(buffCalls[0][2]).toEqual([
                { name: 'Starry Form', effect: 'starry_form' },
                { name: 'Haste', effect: 'haste' },
                { name: 'Mage Armor', effect: 'mage_armor' },
            ]);

            // Second call: Starry Form removed from original list (mock always returns fresh data)
            expect(buffCalls[1][2]).toEqual([
                { name: 'Revelation in Flesh', effect: 'revelation' },
                { name: 'Haste', effect: 'haste' },
                { name: 'Mage Armor', effect: 'mage_armor' },
            ]);

            // Third call: Haste removed from original list
            expect(buffCalls[2][2]).toEqual([
                { name: 'Revelation in Flesh', effect: 'revelation' },
                { name: 'Starry Form', effect: 'starry_form' },
                { name: 'Mage Armor', effect: 'mage_armor' },
            ]);
        });
    });
});
