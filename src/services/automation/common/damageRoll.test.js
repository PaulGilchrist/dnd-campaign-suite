import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
    getCombatContext: vi.fn(),
    getResistanceNotice: vi.fn(),
    getAttackerTargetName: vi.fn(),
}));

vi.mock('../../maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
    computeRangeEffect: vi.fn(),
    computeMeleeProximityEffect: vi.fn(),
    getDistanceFeet: vi.fn(),
    isHostileNPC: vi.fn(),
    getNearestPlacedItem: vi.fn(),
    rangeToFeet: vi.fn(),
}));

vi.mock('../../rules/combat/coverService.js', () => ({
    computeCover: vi.fn(),
}));

vi.mock('../../npcs/npcsService.js', () => ({
    loadNPCs: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { rollDamageForAction } from './damageRoll.js';
import * as diceRoller from '../../dice/diceRoller.js';

// ── Helpers ────────────────────────────────────────────────────

// ── rollDamageForAction ────────────────────────────────────────

describe('rollDamageForAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        diceRoller.rollExpression.mockReturnValue(null);
        diceRoller.rollExpressionDoubled.mockReturnValue(null);
    });

    describe('dice rolling', () => {
        it('rolls normal damage when isCrit is false', () => {
            const auto = { damage: '2d6+3' };
            const mockResult = { total: 8, rolls: [3, 5], modifier: 3 };
            diceRoller.rollExpression.mockReturnValue(mockResult);

            const result = rollDamageForAction(auto);

            expect(result).toEqual({
                result: mockResult,
                attackContext: {
                    name: '',
                    damage: '2d6+3',
                    damageType: '',
                    saveDc: undefined,
                    saveType: 'DEX',
                    saveSuccess: 0,
                },
            });
        });

        it('rolls doubled damage when isCrit is true', () => {
            const auto = { damage: '2d6+3' };
            const mockResult = { total: 16, rolls: [8, 8], modifier: 3 };
            diceRoller.rollExpressionDoubled.mockReturnValue(mockResult);

            const result = rollDamageForAction(auto, { isCrit: true });

            expect(result.result).toBe(mockResult);
            expect(result.attackContext.damage).toBe('2d6+3');
        });

        it('returns null when dice roll fails', () => {
            const auto = { damage: 'invalid' };
            diceRoller.rollExpression.mockReturnValue(null);

            const result = rollDamageForAction(auto);

            expect(result).toBeNull();
        });

    });

    describe('pre-rolled result', () => {
        it('uses preRolledResult and skips dice rolling', () => {
            const auto = { damage: '2d6+3' };
            const preRolled = { total: 12, rolls: [6, 6], modifier: 0 };

            const result = rollDamageForAction(auto, { preRolledResult: preRolled });

            expect(diceRoller.rollExpression).not.toHaveBeenCalled();
            expect(diceRoller.rollExpressionDoubled).not.toHaveBeenCalled();
            expect(result.result).toBe(preRolled);
        });


    });

    describe('attackContext construction', () => {
        const baseRoll = { total: 5, rolls: [5] };

        beforeEach(() => {
            diceRoller.rollExpression.mockReturnValue(baseRoll);
        });

        it('builds full attackContext from auto object fields', () => {
            const auto = { name: 'Fire Bolt', damage: '1d10', damageType: 'fire', saveDc: 15, saveType: 'DEX' };
            const result = rollDamageForAction(auto);

            expect(result.attackContext).toEqual({
                name: 'Fire Bolt',
                damage: '1d10',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            });
        });

        it('defaults saveType to DEX when not provided', () => {
            const auto = { damage: '1d6' };
            const result = rollDamageForAction(auto);
            expect(result.attackContext.saveType).toBe('DEX');
        });

        it('uses saveType and dcSuccess from auto when provided', () => {
            const auto = { damage: '1d6', saveType: 'CON', dcSuccess: 0.75 };
            const result = rollDamageForAction(auto);
            expect(result.attackContext.saveType).toBe('CON');
            expect(result.attackContext.saveSuccess).toBe(0.75);
        });

        it('defaults saveSuccess to 0.5 for cone shapes', () => {
            const auto = { damage: '1d6', shape: 'cone' };
            const result = rollDamageForAction(auto);
            expect(result.attackContext.saveSuccess).toBe(0.5);
        });

        it('prefers dcSuccess over shape-derived saveSuccess', () => {
            const auto = { damage: '1d6', dcSuccess: 0, shape: 'cone' };
            const result = rollDamageForAction(auto);
            expect(result.attackContext.saveSuccess).toBe(0);
        });
    });
});
