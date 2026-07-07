// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useModalHandlers from './useModalHandlers.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-sorcerer/starryFormHandler.js', () => ({
    applyConstellationOption: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js', () => ({
    applyConstellationOption: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-cleric-paladin/elderChampionHandler.js', () => ({
    handleRestore: vi.fn(),
}));

import { rollExpression } from '../../services/dice/diceRoller.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { getDistanceFeet } from '../../services/rules/combat/rangeValidation.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

function createDeps(overrides = {}) {
    const playerStats = {
        name: 'TestFighter',
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Strength', bonus: 3 }],
        ...overrides.playerStats,
    };
    const modalState = {};
    return {
        playerStats,
        campaignName: 'test-campaign',
        rollDamage: vi.fn(),
        proceedWithDamage: vi.fn(),
        pendingDamage: null,
        setPendingDamage: vi.fn(),
        modalState,
        setModalState: vi.fn((updates) => {
            if (typeof updates === 'function') {
                return updates(modalState);
            }
            Object.assign(modalState, updates);
        }),
        setPopupHtml: vi.fn(),
        ...overrides,
    };
}

describe('useModalHandlers - damage type handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        getCurrentCombatRound.mockReturnValue(1);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        getCombatContext.mockResolvedValue(null);
        getDistanceFeet.mockReturnValue(5);
    });

    describe('handleDivineFuryDamageType', () => {
        it('applies chosen damage type, records used round, and proceeds', () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Fury of the Gods' },
                    formula: '1d8',
                    total: 5,
                    rolls: [5],
                    modifier: 0,
                    bonusExpr: '1d8',
                    bonusTotal: 4,
                    bonusRolls: [4],
                },
            });
            const { handleDivineFuryDamageType } = useModalHandlers(deps);
            handleDivineFuryDamageType('Radiant');
            expect(deps.setModalState).toHaveBeenCalledWith({ divineFuryChoice: null });
            expect(deps.proceedWithDamage).toHaveBeenCalledWith(
                expect.any(Object),
                '1d8 + 1d8 [Radiant]',
                9,
                [5, 4],
                0
            );
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_divineFuryUsedRound',
                1,
                'test-campaign'
            );
        });
    });

    describe('handleGenericDamageTypeChoice', () => {
        it('applies chosen damage type with oncePerTurnKey', () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Divine Strike' },
                    formula: '1d8',
                    total: 5,
                    rolls: [5],
                    modifier: 0,
                    bonusExpr: '1d8',
                    bonusTotal: 4,
                    bonusRolls: [4],
                    oncePerTurnKey: '_DivineStrike_usedRound',
                },
            });
            const { handleGenericDamageTypeChoice } = useModalHandlers(deps);
            handleGenericDamageTypeChoice('Thunder');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_DivineStrike_usedRound',
                1,
                'test-campaign'
            );
            expect(deps.proceedWithDamage).toHaveBeenCalledWith(
                expect.any(Object),
                '1d8 + 1d8 [Thunder]',
                9,
                [5, 4],
                0
            );
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
        });

        it('proceeds without oncePerTurnKey when not present', () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Extra Damage' },
                    formula: '1d6',
                    total: 5,
                    rolls: [5],
                    modifier: 0,
                    bonusExpr: '1d6',
                    bonusTotal: 3,
                    bonusRolls: [3],
                },
            });
            const { handleGenericDamageTypeChoice } = useModalHandlers(deps);
            handleGenericDamageTypeChoice('Fire');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.proceedWithDamage).toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleGenericDamageTypeSkip', () => {
        it('proceeds with original damage when skipping', () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Extra Damage' },
                    formula: '1d6',
                    total: 5,
                    rolls: [5],
                    modifier: 0,
                },
            });
            const { handleGenericDamageTypeSkip } = useModalHandlers(deps);
            handleGenericDamageTypeSkip();
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.proceedWithDamage).toHaveBeenCalledWith(
                { name: 'Extra Damage' },
                '1d6',
                5,
                [5],
                0
            );
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
        });
    });

    describe('handleDamageTypeModifierChoice', () => {
        it('applies chosen damage type to attack and records used round', () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Empowered Strikes', damageType: 'slashing' },
                    formula: '1d8',
                    total: 5,
                    rolls: [5],
                    modifier: 0,
                    _damageTypeModifier: { name: 'Empowered Strikes' },
                },
            });
            const { handleDamageTypeModifierChoice } = useModalHandlers(deps);
            const attack = deps.pendingDamage.attack;
            handleDamageTypeModifierChoice('radiant');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(attack.damageType).toBe('radiant');
            expect(deps.proceedWithDamage).toHaveBeenCalled();
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_Empowered_Strikes_usedRound',
                1,
                'test-campaign'
            );
        });
    });
});
