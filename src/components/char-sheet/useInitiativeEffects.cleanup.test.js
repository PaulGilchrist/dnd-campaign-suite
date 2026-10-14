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

import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

describe('useInitiativeEffects - event listener cleanup', () => {
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

    describe('event listener registration and cleanup on unmount', () => {
        it('registers and removes initiative-rolled event listener on unmount', () => {
            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
            const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
            const { unmount } = renderHookWithStats();
            expect(addEventListenerSpy).toHaveBeenCalledWith(
                'initiative-rolled',
                expect.any(Function)
            );
            unmount();
            expect(removeEventListenerSpy).toHaveBeenCalledWith(
                'initiative-rolled',
                expect.any(Function)
            );
            addEventListenerSpy.mockRestore();
            removeEventListenerSpy.mockRestore();
        });

        it('registers and removes turn-undead-result event listener on unmount', () => {
            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
            const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
            const { unmount } = renderHookWithStats();
            expect(addEventListenerSpy).toHaveBeenCalledWith(
                'turn-undead-result',
                expect.any(Function)
            );
            unmount();
            expect(removeEventListenerSpy).toHaveBeenCalledWith(
                'turn-undead-result',
                expect.any(Function)
            );
            addEventListenerSpy.mockRestore();
            removeEventListenerSpy.mockRestore();
        });

        it('removes both event listeners when both useEffects are mounted', () => {
            const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
            const { unmount } = renderHookWithStats();
            unmount();
            expect(removeEventListenerSpy).toHaveBeenCalledTimes(2);
            const calls = removeEventListenerSpy.mock.calls;
            const eventTypes = calls.map(c => c[0]);
            expect(eventTypes).toContain('initiative-rolled');
            expect(eventTypes).toContain('turn-undead-result');
            removeEventListenerSpy.mockRestore();
        });
    });
});
