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

import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../hooks/runtime/useRuntimeState.js';
import { endInvisibility, endGreaterInvisibility } from '../../services/rules/features/invisibilityService.js';

describe('useInitiativeEffects - invisibility and regenerate clearing', () => {
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

    describe('Invisibility clearing', () => {
        it('calls endInvisibility and clears the key when activeInvisibility is present', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === `_activeInvisibility_TestMonk`) return 'TestMonk';
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(endInvisibility).toHaveBeenCalledWith(
                'TestMonk',
                campaignName,
                'target rolled initiative'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                `_activeInvisibility_TestMonk`,
                null,
                campaignName
            );
        });

        it('does not call endInvisibility when activeInvisibility key is null', () => {
            getRuntimeValue.mockReturnValue(null);
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(endInvisibility).not.toHaveBeenCalled();
        });

        it('does not call endInvisibility when event characterName does not match player name', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === `_activeInvisibility_TestMonk`) return 'TestMonk';
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'OtherPlayer', roll: 15 });
            expect(endInvisibility).not.toHaveBeenCalled();
        });
    });

    describe('Greater Invisibility clearing', () => {
        it('calls endGreaterInvisibility and clears the key when activeGreaterInvisibility is present', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === `_activeGreaterInvisibility_TestMonk`) return 'TestMonk';
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(endGreaterInvisibility).toHaveBeenCalledWith(
                'TestMonk',
                campaignName,
                'target rolled initiative'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                `_activeGreaterInvisibility_TestMonk`,
                null,
                campaignName
            );
        });

        it('does not call endGreaterInvisibility when activeGreaterInvisibility key is null', () => {
            getRuntimeValue.mockReturnValue(null);
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(endGreaterInvisibility).not.toHaveBeenCalled();
        });

        it('does not call endGreaterInvisibility when event characterName does not match player name', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === `_activeGreaterInvisibility_TestMonk`) return 'TestMonk';
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'OtherPlayer', roll: 15 });
            expect(endGreaterInvisibility).not.toHaveBeenCalled();
        });
    });

    describe('Both invisibility effects clearing simultaneously', () => {
        it('clears both regular and greater invisibility when both keys are present', () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === `_activeInvisibility_TestMonk`) return 'TestMonk';
                if (key === `_activeGreaterInvisibility_TestMonk`) return 'TestMonk';
                return null;
            });
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(endInvisibility).toHaveBeenCalledWith(
                'TestMonk',
                campaignName,
                'target rolled initiative'
            );
            expect(endGreaterInvisibility).toHaveBeenCalledWith(
                'TestMonk',
                campaignName,
                'target rolled initiative'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                `_activeInvisibility_TestMonk`,
                null,
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                `_activeGreaterInvisibility_TestMonk`,
                null,
                campaignName
            );
        });
    });

    describe('Regenerate HP restoration', () => {
        it('sets HP to max for all creatures with regenerateActive', () => {
            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'regenerateActive') return true;
                if (prop === 'hitPoints') return 20;
                return null;
            });
            vi.mocked(getAllStoreKeys).mockReturnValue(['TestMonk', 'Goblin', 'Zombie']);
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'currentHitPoints',
                20,
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'currentHitPoints',
                20,
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Zombie',
                'currentHitPoints',
                20,
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'regenerateActive',
                false,
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'regenerateActive',
                false,
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Zombie',
                'regenerateActive',
                false,
                campaignName
            );
        });

        it('skips non-string keys in getAllStoreKeys for regenerate loop', () => {
            getRuntimeValue.mockImplementation((_charKey, prop) => {
                if (prop === 'regenerateActive') return true;
                if (prop === 'hitPoints') return 20;
                return null;
            });
            vi.mocked(getAllStoreKeys).mockReturnValue([123, null]);
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const regenCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'regenerateActive'
            );
            expect(regenCalls.length).toBe(0);
        });

        it('handles mixed valid string keys and non-string keys together', () => {
            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'regenerateActive') return charKey === 'ValidCreature' ? true : false;
                if (prop === 'hitPoints') return 15;
                return null;
            });
            vi.mocked(getAllStoreKeys).mockReturnValue(['ValidCreature', 123, null, 'AnotherNonRegen']);
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ValidCreature',
                'currentHitPoints',
                15,
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ValidCreature',
                'regenerateActive',
                false,
                campaignName
            );
            const nonStringCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[0] === 123 || call[0] === null
            );
            expect(nonStringCalls.length).toBe(0);
        });

        it('does not set currentHitPoints when hitPoints is null', () => {
            getRuntimeValue.mockImplementation((_charKey, prop) => {
                if (prop === 'regenerateActive') return true;
                if (prop === 'hitPoints') return null;
                return null;
            });
            vi.mocked(getAllStoreKeys).mockReturnValue(['TestMonk']);
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'regenerateActive',
                false,
                campaignName
            );
            const hpCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'currentHitPoints'
            );
            expect(hpCalls.length).toBe(0);
        });

        it('sets currentHitPoints to 0 when hitPoints is 0 (falsy but valid)', () => {
            getRuntimeValue.mockImplementation((_charKey, prop) => {
                if (prop === 'regenerateActive') return true;
                if (prop === 'hitPoints') return 0;
                return null;
            });
            vi.mocked(getAllStoreKeys).mockReturnValue(['TestMonk']);
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'currentHitPoints',
                0,
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'regenerateActive',
                false,
                campaignName
            );
        });

        it('does not call setRuntimeValue when getAllStoreKeys returns empty array', () => {
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

        it('does not call setRuntimeValue when no creatures have regenerateActive', () => {
            getRuntimeValue.mockImplementation((_charKey, prop) => {
                if (prop === 'regenerateActive') return false;
                if (prop === 'hitPoints') return 20;
                return null;
            });
            vi.mocked(getAllStoreKeys).mockReturnValue(['TestMonk', 'Goblin']);
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const regenCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'regenerateActive' || call[1] === 'currentHitPoints'
            );
            expect(regenCalls.length).toBe(0);
        });

        it('does not process regenerate when event characterName does not match player name', () => {
            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'regenerateActive') return true;
                if (prop === 'hitPoints') return 20;
                return null;
            });
            vi.mocked(getAllStoreKeys).mockReturnValue(['TestMonk']);
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'OtherPlayer', roll: 15 });
            const regenCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'regenerateActive' || call[1] === 'currentHitPoints'
            );
            expect(regenCalls.length).toBe(0);
        });
    });
});
