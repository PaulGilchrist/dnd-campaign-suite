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

import { getRuntimeValue, setRuntimeBatch } from '../../hooks/runtime/useRuntimeState.js';
import { BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY } from '../../services/rules/features/boonOfCombatProwess.js';

describe('useInitiativeEffects - batch resets and once-per-turn trackers', () => {
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

    function batchResetCalls() {
        return vi.mocked(setRuntimeBatch).mock.calls;
    }

    function assertBatchResetCalledWithAllFields(expectedFields) {
        const calls = batchResetCalls();
        expect(calls.length).toBe(1);
        const [name, updates, cmpName] = calls[0];
        expect(name).toBe('TestMonk');
        expect(cmpName).toBe(campaignName);
        for (const field of expectedFields) {
            expect(updates).toHaveProperty(field, null);
        }
    }

    describe('setRuntimeBatch once-per-turn trackers', () => {
        it('resets all unconditional batch fields in a single call', () => {
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            assertBatchResetCalledWithAllFields([
                'actionSurgeUsedThisRound',
                'psionicStrikeUsedThisTurn',
                'dreadAmbushUsedThisTurn',
                'hurlThroughHellTurnUsed',
                'portentUsedThisTurn',
                BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY,
                'strokeOfLuckUsed',
            ]);
        });

        it('includes relentlessUsedRound when player has Relentless passive', () => {
            const stats = {
                ...defaultPlayerStats,
                automation: {
                    ...defaultPlayerStats.automation,
                    passives: [
                        { type: 'passive_rule', effect: 'relentless' },
                    ],
                },
            };
            renderHookWithStats(stats);
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const calls = batchResetCalls();
            expect(calls.length).toBe(1);
            expect(calls[0][1]).toHaveProperty('relentlessUsedRound', null);
        });

        it('excludes relentlessUsedRound when player lacks Relentless passive', () => {
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'TestMonk', roll: 15 });
            const calls = batchResetCalls();
            expect(calls.length).toBe(1);
            expect(calls[0][1]).not.toHaveProperty('relentlessUsedRound');
        });

        it('does not call setRuntimeBatch when no updates are needed (no matching character)', () => {
            renderHookWithStats();
            dispatchInitiativeRoll({ characterName: 'OtherPlayer', roll: 15 });
            expect(setRuntimeBatch).not.toHaveBeenCalled();
        });
    });
});
