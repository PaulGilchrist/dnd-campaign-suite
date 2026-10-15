// Scoped to rollDamageForAction (pure: diceRoller is the only collaborator).
// buildAttackContextForDamage lanes live in buildAttackContext-map.test.js
// and buildAttackContext-noMap.test.js — keep new tests out of this file.
// @maintained-by-ai

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────
// damageRoll.js imports these service modules at module load; mock the
// whole import graph so rollDamageForAction tests stay side-effect free.

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

// ── rollDamageForAction ────────────────────────────────────────

describe('rollDamageForAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        diceRoller.rollExpression.mockReturnValue(null);
        diceRoller.rollExpressionDoubled.mockReturnValue(null);
    });

    describe('dice rolling', () => {
        it('rolls normal damage when isCrit is false and applies context defaults', () => {
            const auto = { damage: '2d6+3' };
            const mockResult = { total: 8, rolls: [3, 5], modifier: 3 };
            diceRoller.rollExpression.mockReturnValue(mockResult);

            const result = rollDamageForAction(auto);

            expect(diceRoller.rollExpressionDoubled).not.toHaveBeenCalled();
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

            expect(diceRoller.rollExpression).not.toHaveBeenCalled();
            expect(result.result).toBe(mockResult);
        });

        it('returns null when dice roll fails', () => {
            diceRoller.rollExpression.mockReturnValue(null);

            expect(rollDamageForAction({ damage: 'invalid' })).toBeNull();
        });

        it('uses preRolledResult and skips dice rolling', () => {
            const preRolled = { total: 12, rolls: [6, 6], modifier: 0 };

            const result = rollDamageForAction({ damage: '2d6+3' }, { preRolledResult: preRolled });

            expect(diceRoller.rollExpression).not.toHaveBeenCalled();
            expect(diceRoller.rollExpressionDoubled).not.toHaveBeenCalled();
            expect(result.result).toBe(preRolled);
        });
    });

    describe('attackContext construction', () => {
        beforeEach(() => {
            diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
        });

        it('passes auto fields through to attackContext', () => {
            const auto = {
                name: 'Fire Bolt',
                damage: '1d10',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'CON',
                dcSuccess: 0.75,
            };
            const result = rollDamageForAction(auto);

            expect(result.attackContext).toEqual({
                name: 'Fire Bolt',
                damage: '1d10',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'CON',
                saveSuccess: 0.75,
            });
        });

        it('defaults saveSuccess to 0.5 for cone shapes', () => {
            const result = rollDamageForAction({ damage: '1d6', shape: 'cone' });
            expect(result.attackContext.saveSuccess).toBe(0.5);
        });

        it('prefers explicit dcSuccess over shape-derived saveSuccess', () => {
            // Guards the `??` operator: 0 is a meaningful dcSuccess and
            // must not fall through to the cone default of 0.5.
            const result = rollDamageForAction({ damage: '1d6', dcSuccess: 0, shape: 'cone' });
            expect(result.attackContext.saveSuccess).toBe(0);
        });
    });
});
