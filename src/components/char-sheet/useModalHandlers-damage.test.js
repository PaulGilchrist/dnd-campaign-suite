// @improved-by-ai
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
    handle: vi.fn(),
    applyConstellationOption: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js', () => ({
    handle: vi.fn(),
    applyConstellationOption: vi.fn(),
}));

vi.mock('../../services/automation/handlers/combat/bonusAttacksHandler.js', () => ({
    handle: vi.fn(),
    applyFlurryOfBlows: vi.fn(),
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
        it('applies chosen damage type, records used round, and proceeds with combined damage', () => {
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
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: expect.any(Object),
                formula: '1d8 + 1d8 [radiant]',
                total: 9,
                rolls: [5, 4],
                modifier: 0,
            });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_divineFuryUsedRound',
                1,
                'test-campaign'
            );
        });

        it('returns early when no pending damage', () => {
            const deps = createDeps();
            const { handleDivineFuryDamageType } = useModalHandlers(deps);
            handleDivineFuryDamageType('Radiant');
            expect(deps.setModalState).toHaveBeenCalledWith({ divineFuryChoice: null });
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(deps.setPendingDamage).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('uses round from getCurrentCombatRound and player name from playerStats', () => {
            const deps = createDeps({
                playerStats: { name: 'PaladinOne' },
                pendingDamage: {
                    attack: { name: 'Fury' },
                    formula: '2d6',
                    total: 7,
                    rolls: [3, 4],
                    modifier: 1,
                    bonusExpr: '1d6',
                    bonusTotal: 3,
                    bonusRolls: [3],
                },
            });
            getCurrentCombatRound.mockReturnValue(3);
            const { handleDivineFuryDamageType } = useModalHandlers(deps);
            handleDivineFuryDamageType('Thunder');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'PaladinOne',
                '_divineFuryUsedRound',
                3,
                'test-campaign'
            );
            expect(deps.proceedWithDamage).toHaveBeenLastCalledWith({
                    attack: expect.any(Object),
                    formula: '2d6 + 1d6 [thunder]',
                    total: 10,
                    rolls: [3, 4, 3],
                    modifier: 1,
                });
        });
    });

    describe('handleDivineFurySkip', () => {
        it('proceeds with original damage without bonus when skipping', () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Fury of the Gods' },
                    formula: '1d8+3',
                    total: 10,
                    rolls: [5, 5],
                    modifier: 3,
                    bonusExpr: '1d8',
                    bonusTotal: 4,
                    bonusRolls: [4],
                },
            });
            const { handleDivineFurySkip } = useModalHandlers(deps);
            handleDivineFurySkip();
            expect(deps.setModalState).toHaveBeenCalledWith({ divineFuryChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: { name: 'Fury of the Gods' },
                formula: '1d8+3',
                total: 10,
                rolls: [5, 5],
                modifier: 3,
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns early when no pending damage', () => {
            const deps = createDeps();
            const { handleDivineFurySkip } = useModalHandlers(deps);
            handleDivineFurySkip();
            expect(deps.setModalState).toHaveBeenCalledWith({ divineFuryChoice: null });
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(deps.setPendingDamage).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleGenericDamageTypeChoice', () => {
        it('returns early when no pending damage', () => {
            const deps = createDeps();
            const { handleGenericDamageTypeChoice } = useModalHandlers(deps);
            handleGenericDamageTypeChoice('Fire');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(deps.setPendingDamage).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

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
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: expect.any(Object),
                formula: '1d8 + 1d8 [thunder]',
                total: 9,
                rolls: [5, 4],
                modifier: 0,
            });
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
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: expect.any(Object),
                formula: '1d6 + 1d6 [fire]',
                total: 8,
                rolls: [5, 3],
                modifier: 0,
            });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('records the current combat round from getCurrentCombatRound', () => {
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
            getCurrentCombatRound.mockReturnValue(5);
            const { handleGenericDamageTypeChoice } = useModalHandlers(deps);
            handleGenericDamageTypeChoice('Acid');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_DivineStrike_usedRound',
                5,
                'test-campaign'
            );
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
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: { name: 'Extra Damage' },
                formula: '1d6',
                total: 5,
                rolls: [5],
                modifier: 0,
            });
        });

        it('returns early when no pending damage', () => {
            const deps = createDeps();
            const { handleGenericDamageTypeSkip } = useModalHandlers(deps);
            handleGenericDamageTypeSkip();
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(deps.setPendingDamage).not.toHaveBeenCalled();
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
            expect(attack.damageType).toBe('radiant');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalled();
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_Empowered_Strikes_usedRound',
                1,
                'test-campaign'
            );
        });

        it('replaces the first damage type annotation in the formula string', () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Unarmed Strike', damageType: 'bludgeoning' },
                    formula: '1d12+3 [bludgeoning] + 3d6 [fire]',
                    total: 31,
                    rolls: [31],
                    modifier: 3,
                    _damageTypeModifier: { name: 'Empowered Strikes' },
                },
            });
            const { handleDamageTypeModifierChoice } = useModalHandlers(deps);
            handleDamageTypeModifierChoice('Force');
            expect(deps.pendingDamage.attack.damageType).toBe('force');
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: deps.pendingDamage.attack,
                formula: '1d12+3 [force] + 3d6 [fire]',
                total: 31,
                rolls: [31],
                modifier: 3,
            });
        });

        it('returns early when no pending damage', () => {
            const deps = createDeps();
            const { handleDamageTypeModifierChoice } = useModalHandlers(deps);
            handleDamageTypeModifierChoice('radiant');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(deps.setPendingDamage).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('does not mutate attack.damageType when _damageTypeModifier is absent', () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Some Attack', damageType: 'fire' },
                    formula: '1d6',
                    total: 5,
                    rolls: [5],
                    modifier: 0,
                },
            });
            const { handleDamageTypeModifierChoice } = useModalHandlers(deps);
            handleDamageTypeModifierChoice('cold');
            expect(deps.pendingDamage.attack.damageType).toBe('fire');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('uses current combat round for the runtime value', () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Test Feature', damageType: 'fire' },
                    formula: '1d6',
                    total: 5,
                    rolls: [5],
                    modifier: 0,
                    _damageTypeModifier: { name: 'Test Feature' },
                },
            });
            getCurrentCombatRound.mockReturnValue(7);
            const { handleDamageTypeModifierChoice } = useModalHandlers(deps);
            handleDamageTypeModifierChoice('cold');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_Test_Feature_usedRound',
                7,
                'test-campaign'
            );
        });
    });

    describe('handleDamageTypeModifierSkip', () => {
        it('proceeds with original damage and records used round when _damageTypeModifier exists', () => {
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
            const { handleDamageTypeModifierSkip } = useModalHandlers(deps);
            handleDamageTypeModifierSkip();
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalled();
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_Empowered_Strikes_usedRound',
                1,
                'test-campaign'
            );
            expect(deps.pendingDamage.attack.damageType).toBe('slashing');
        });

        it('does not record used round when _damageTypeModifier is absent', () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Some Attack', damageType: 'fire' },
                    formula: '1d8',
                    total: 5,
                    rolls: [5],
                    modifier: 0,
                },
            });
            const { handleDamageTypeModifierSkip } = useModalHandlers(deps);
            handleDamageTypeModifierSkip();
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns early when no pending damage', () => {
            const deps = createDeps();
            const { handleDamageTypeModifierSkip } = useModalHandlers(deps);
            handleDamageTypeModifierSkip();
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(deps.setPendingDamage).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleEnhancedUnarmedChoice', () => {
        it('applies damage bonus rider when chosen option has damage_bonus', () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Unarmed Strike' },
                    formula: '1d4',
                    total: 5,
                    rolls: [5],
                    modifier: 0,
                    rider: null,
                    _attackRider: {
                        name: 'Unarmed Fighting',
                        options: [{ name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d4', damageType: 'force' }],
                    },
                },
            });
            rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });
            const { handleEnhancedUnarmedChoice } = useModalHandlers(deps);
            handleEnhancedUnarmedChoice('Damage Bonus');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: expect.any(Object),
                formula: expect.stringContaining('1d4'),
                total: expect.any(Number),
                rolls: expect.any(Array),
                modifier: null,
            });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_Unarmed_Fighting_usedRound',
                1,
                'test-campaign'
            );
        });

        it('proceeds with original damage when option is found but has no damage_bonus effect', () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Unarmed Strike' },
                    formula: '1d4',
                    total: 5,
                    rolls: [5],
                    modifier: 0,
                    rider: null,
                    _attackRider: {
                        name: 'Unarmed Fighting',
                        options: [{ name: 'Other Option', effect: 'other' }],
                    },
                },
            });
            const { handleEnhancedUnarmedChoice } = useModalHandlers(deps);
            handleEnhancedUnarmedChoice('Other Option');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: expect.any(Object),
                formula: '1d4',
                total: 5,
                rolls: [5],
                modifier: null,
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('proceeds with original damage when option is not found in rider options', () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Unarmed Strike' },
                    formula: '1d4',
                    total: 5,
                    rolls: [5],
                    modifier: 0,
                    rider: null,
                    _attackRider: {
                        name: 'Unarmed Fighting',
                        options: [{ name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d4', damageType: 'force' }],
                    },
                },
            });
            const { handleEnhancedUnarmedChoice } = useModalHandlers(deps);
            handleEnhancedUnarmedChoice('Nonexistent Option');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: expect.any(Object),
                formula: '1d4',
                total: 5,
                rolls: [5],
                modifier: null,
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('proceeds with original damage when rollExpression returns null for damage_bonus', () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Unarmed Strike' },
                    formula: '1d4',
                    total: 5,
                    rolls: [5],
                    modifier: 0,
                    rider: null,
                    _attackRider: {
                        name: 'Unarmed Fighting',
                        options: [{ name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d4', damageType: 'force' }],
                    },
                },
            });
            rollExpression.mockReturnValue(null);
            const { handleEnhancedUnarmedChoice } = useModalHandlers(deps);
            handleEnhancedUnarmedChoice('Damage Bonus');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: expect.any(Object),
                formula: '1d4',
                total: 5,
                rolls: [5],
                modifier: null,
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns early when no pending damage', () => {
            const deps = createDeps();
            const { handleEnhancedUnarmedChoice } = useModalHandlers(deps);
            handleEnhancedUnarmedChoice('Any Option');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('passes rider value as the last argument to proceedWithDamage when damage_bonus is applied', () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Unarmed Strike' },
                    formula: '1d4',
                    total: 5,
                    rolls: [5],
                    modifier: 0,
                    rider: 'some-rider-value',
                    _attackRider: {
                        name: 'Unarmed Fighting',
                        options: [{ name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d4', damageType: 'force' }],
                    },
                },
            });
            rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });
            const { handleEnhancedUnarmedChoice } = useModalHandlers(deps);
            handleEnhancedUnarmedChoice('Damage Bonus');
            expect(deps.proceedWithDamage).toHaveBeenLastCalledWith({
                    attack: expect.any(Object),
                    formula: expect.stringContaining('1d4'),
                    total: 8,
                    rolls: [5, 3],
                    modifier: 'some-rider-value',
                });
        });
    });

    describe('handleEnhancedUnarmedSkip', () => {
        it('proceeds with original damage and records used round when skipping', () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Unarmed Strike' },
                    formula: '1d4',
                    total: 5,
                    rolls: [5],
                    modifier: 0,
                    rider: null,
                    _attackRider: { name: 'Unarmed Fighting' },
                },
            });
            const { handleEnhancedUnarmedSkip } = useModalHandlers(deps);
            handleEnhancedUnarmedSkip();
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalled();
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_Unarmed_Fighting_usedRound',
                1,
                'test-campaign'
            );
        });

        it('returns early when no pending damage', () => {
            const deps = createDeps();
            const { handleEnhancedUnarmedSkip } = useModalHandlers(deps);
            handleEnhancedUnarmedSkip();
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('does not record used round when _attackRider is absent', () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Unarmed Strike' },
                    formula: '1d4',
                    total: 5,
                    rolls: [5],
                    modifier: 0,
                    rider: 'no-rider',
                },
            });
            const { handleEnhancedUnarmedSkip } = useModalHandlers(deps);
            handleEnhancedUnarmedSkip();
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });
});
