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

describe('useInitiativeEffects - campaign targetEffects clearing', () => {
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

    function campaignTargetEffectsCalls() {
        return vi.mocked(setRuntimeValue).mock.calls.filter(
            call => call[0] === 'campaign' && call[1] === 'targetEffects'
        );
    }

    describe('Pass Without Trace clearing', () => {
        it('removes pass_without_trace_bonus from targetEffects on initiative', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [
                    { effect: 'pass_without_trace_bonus', source: 'TestMonk' },
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

        it('removes all pass_without_trace_bonus entries when multiple exist', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [
                    { effect: 'pass_without_trace_bonus', source: 'Ally1' },
                    { effect: 'other_effect' },
                    { effect: 'pass_without_trace_bonus', source: 'Ally2' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [{ effect: 'other_effect' }],
                campaignName,
                true
            );
        });

        it('does not call setRuntimeValue when no pass_without_trace_bonus exists', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [{ effect: 'other_effect', source: 'Ally' }];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(campaignTargetEffectsCalls().length).toBe(0);
        });

        it('does not call setRuntimeValue when targetEffects is null', () => {
            getRuntimeValue.mockReturnValue(null);
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(campaignTargetEffectsCalls().length).toBe(0);
        });

        it('does not call setRuntimeValue when targetEffects is empty', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(campaignTargetEffectsCalls().length).toBe(0);
        });
    });

    describe('Blur clearing', () => {
        it('removes blur from targetEffects on initiative', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [
                    { effect: 'blur', target: 'Enemy' },
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

        it('does not call setRuntimeValue when no blur exists', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [{ effect: 'other_effect' }];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(campaignTargetEffectsCalls().length).toBe(0);
        });
    });

    describe('Globe of Invulnerability clearing', () => {
        it('removes globe_barrier from targetEffects on initiative', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [
                    { effect: 'globe_barrier', target: 'Ally' },
                    { effect: 'other_effect' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [{ effect: 'other_effect' }],
                campaignName,
                true
            );
        });

        it('does not call setRuntimeValue when no globe_barrier exists', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [{ effect: 'other_effect' }];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(campaignTargetEffectsCalls().length).toBe(0);
        });
    });

    describe('Forcecage clearing', () => {
        it('removes forcecage from targetEffects on initiative', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [
                    { effect: 'forcecage', target: 'Enemy' },
                    { effect: 'other_effect' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [{ effect: 'other_effect' }],
                campaignName,
                true
            );
        });

        it('does not call setRuntimeValue when no forcecage exists', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [{ effect: 'other_effect' }];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(campaignTargetEffectsCalls().length).toBe(0);
        });
    });

    describe('Antimagic Field clearing', () => {
        it('removes antimagic_field from targetEffects on initiative', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [
                    { effect: 'antimagic_field', target: 'Area' },
                    { effect: 'other_effect' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [{ effect: 'other_effect' }],
                campaignName,
                true
            );
        });

        it('does not call setRuntimeValue when no antimagic_field exists', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [{ effect: 'other_effect' }];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(campaignTargetEffectsCalls().length).toBe(0);
        });
    });

    describe('Regenerate effect clearing', () => {
        it('removes regenerate from targetEffects on initiative', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [
                    { effect: 'regenerate', target: 'Enemy' },
                    { effect: 'other_effect' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [{ effect: 'other_effect' }],
                campaignName,
                true
            );
        });

        it('does not call setRuntimeValue when no regenerate exists', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [{ effect: 'other_effect' }];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(campaignTargetEffectsCalls().length).toBe(0);
        });
    });

    describe('Beacon of Hope clearing', () => {
        it('removes beacon_of_hope from targetEffects on initiative', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [
                    { effect: 'beacon_of_hope', target: 'Party' },
                    { effect: 'other_effect' },
                ];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [{ effect: 'other_effect' }],
                campaignName,
                true
            );
        });

        it('does not call setRuntimeValue when no beacon_of_hope exists', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [{ effect: 'other_effect' }];
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(campaignTargetEffectsCalls().length).toBe(0);
        });
    });
});
