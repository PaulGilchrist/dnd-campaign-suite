// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useModalHandlers from './useModalHandlers.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

const mockGetCurrentCombatRound = vi.fn();
vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: () => mockGetCurrentCombatRound(),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
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
import { applyConstellationOption } from '../../services/automation/handlers/class-sorcerer/starryFormHandler.js';
import { applyConstellationOption as twinklingApply } from '../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js';
import { handleRestore } from '../../services/automation/handlers/class-cleric-paladin/elderChampionHandler.js';

function createDeps(overrides = {}) {
    const playerStats = {
        name: 'TestFighter',
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Strength', bonus: 3 }],
        ...overrides.playerStats,
    };
    return {
        playerStats,
        campaignName: 'test-campaign',
        rollDamage: vi.fn(),
        proceedWithDamage: vi.fn(),
        pendingDamageRef: { current: null },
        cleaveAttackPending: null,
        featureChoice: null,
        setDamageTypeChoice: vi.fn(),
        setDivineFuryChoice: vi.fn(),
        setWeaponMasteryModal: vi.fn(),
        setWeaponMasteryChoiceModal: vi.fn(),
        setCleaveAttackPending: vi.fn(),
        setFeatureChoice: vi.fn(),
        setStarryFormConstellationModal: vi.fn(),
        setTwinklingConstellationModal: vi.fn(),
        setPopupHtml: vi.fn(),
        ...overrides,
    };
}

describe('useModalHandlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        mockGetCurrentCombatRound.mockReturnValue(1);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        getCombatContext.mockResolvedValue(null);
        getDistanceFeet.mockReturnValue(5);
    });

    describe('handleMasteryClose', () => {
        it('closes weapon mastery modal and proceeds with pending damage when no cleave effect', async () => {
            const deps = createDeps({
                pendingDamageRef: {
                    current: {
                        attack: { name: 'Longsword' },
                        formula: '1d8+3',
                        total: 10,
                        rolls: [5, 5],
                        modifier: 3,
                    },
                },
                setRuntimeValue: vi.fn(),
            });
            const { handleMasteryClose } = useModalHandlers(deps);
            await handleMasteryClose();
            expect(deps.setWeaponMasteryModal).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith(
                { name: 'Longsword' },
                '1d8+3',
                10,
                [5, 5],
                3
            );
            expect(deps.pendingDamageRef.current).toBeNull();
            expect(deps.setCleaveAttackPending).not.toHaveBeenCalled();
        });

        it('clears cleave effect, proceeds with first attack, and shows cleave target selection when cleave effect exists with valid second targets', async () => {
            const deps = createDeps({
                pendingDamageRef: {
                    current: {
                        attack: { name: 'Longsword' },
                        formula: '1d8+3',
                        total: 10,
                        rolls: [5, 5],
                        modifier: 3,
                        damage: '1d8+3',
                        damageType: 'slashing',
                        abilityName: 'Strength',
                        weaponType: 'melee',
                        properties: [],
                        proficiencyBonus: 3,
                    },
                },
                setRuntimeValue: vi.fn(),
            });
            getRuntimeValue.mockReturnValueOnce([{ effect: 'cleave', target: 'Goblin' }]);
            getCombatContext.mockResolvedValueOnce({
                creatures: [
                    { name: 'Goblin', position: { x: 1, y: 1 } },
                    { name: 'Orc', position: { x: 2, y: 2 } },
                ],
            });
            getDistanceFeet.mockReturnValue(5);

            const { handleMasteryClose } = useModalHandlers(deps);
            await handleMasteryClose();

            expect(deps.setWeaponMasteryModal).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith(
                { name: 'Longsword' },
                '1d8+3',
                10,
                [5, 5],
                3
            );
            expect(deps.pendingDamageRef.current).toBeNull();
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'test-campaign',
                'targetEffects',
                [],
                'test-campaign'
            );
            expect(deps.setCleaveAttackPending).toHaveBeenCalledWith(expect.objectContaining({
                attackName: 'Longsword',
                secondTargets: expect.any(Array),
            }));
        });

        it('proceeds with first attack without cleave target selection when no valid second targets within range', async () => {
            const deps = createDeps({
                pendingDamageRef: {
                    current: {
                        attack: { name: 'Longsword' },
                        formula: '1d8+3',
                        total: 10,
                        rolls: [5, 5],
                        modifier: 3,
                        damage: '1d8+3',
                        damageType: 'slashing',
                        abilityName: 'Strength',
                        weaponType: 'melee',
                        properties: [],
                        proficiencyBonus: 3,
                    },
                },
            });
            getRuntimeValue.mockReturnValueOnce([{ effect: 'cleave', target: 'Goblin' }]);
            getCombatContext.mockResolvedValueOnce({
                creatures: [
                    { name: 'Goblin', position: { x: 1, y: 1 } },
                    { name: 'Orc', position: { x: 20, y: 20 } },
                ],
            });
            getDistanceFeet.mockReturnValue(15);

            const { handleMasteryClose } = useModalHandlers(deps);
            await handleMasteryClose();

            expect(deps.proceedWithDamage).toHaveBeenCalled();
            expect(deps.pendingDamageRef.current).toBeNull();
            expect(deps.setCleaveAttackPending).not.toHaveBeenCalled();
        });

        it('proceeds without cleave target selection when combat context has no creatures', async () => {
            const deps = createDeps({
                pendingDamageRef: {
                    current: {
                        attack: { name: 'Longsword' },
                        formula: '1d8+3',
                        total: 10,
                        rolls: [5, 5],
                        modifier: 3,
                        damage: '1d8+3',
                        damageType: 'slashing',
                        abilityName: 'Strength',
                        weaponType: 'melee',
                        properties: [],
                        proficiencyBonus: 3,
                    },
                },
            });
            getRuntimeValue.mockReturnValueOnce([{ effect: 'cleave', target: 'Goblin' }]);
            getCombatContext.mockResolvedValueOnce({ creatures: [] });

            const { handleMasteryClose } = useModalHandlers(deps);
            await handleMasteryClose();

            expect(deps.proceedWithDamage).toHaveBeenCalled();
            expect(deps.setCleaveAttackPending).not.toHaveBeenCalled();
        });

        it('proceeds without cleave target selection when combat context is null', async () => {
            const deps = createDeps({
                pendingDamageRef: {
                    current: {
                        attack: { name: 'Longsword' },
                        formula: '1d8+3',
                        total: 10,
                        rolls: [5, 5],
                        modifier: 3,
                        damage: '1d8+3',
                        damageType: 'slashing',
                        abilityName: 'Strength',
                        weaponType: 'melee',
                        properties: [],
                        proficiencyBonus: 3,
                    },
                },
            });
            getRuntimeValue.mockReturnValueOnce([{ effect: 'cleave', target: 'Goblin' }]);
            getCombatContext.mockResolvedValueOnce(null);

            const { handleMasteryClose } = useModalHandlers(deps);
            await handleMasteryClose();

            expect(deps.proceedWithDamage).toHaveBeenCalled();
            expect(deps.setCleaveAttackPending).not.toHaveBeenCalled();
        });

        it('does nothing when there is no pending damage', async () => {
            const deps = createDeps();
            const { handleMasteryClose } = useModalHandlers(deps);
            await handleMasteryClose();
            expect(deps.setWeaponMasteryModal).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(deps.setCleaveAttackPending).not.toHaveBeenCalled();
        });
    });

    describe('handleWeaponMasteryChoice', () => {
        it('closes weapon mastery choice modal regardless of the mastery name argument', () => {
            const deps = createDeps();
            const { handleWeaponMasteryChoice } = useModalHandlers(deps);
            handleWeaponMasteryChoice('Mercy');
            expect(deps.setWeaponMasteryChoiceModal).toHaveBeenCalledWith(null);
        });

        it('works with empty string argument', () => {
            const deps = createDeps();
            const { handleWeaponMasteryChoice } = useModalHandlers(deps);
            handleWeaponMasteryChoice('');
            expect(deps.setWeaponMasteryChoiceModal).toHaveBeenCalledWith(null);
        });
    });

    describe('handleCleaveAttack', () => {
        it('clears cleave pending when targetName is falsy', () => {
            const deps = createDeps();
            const { handleCleaveAttack } = useModalHandlers(deps);
            handleCleaveAttack(null);
            expect(deps.setCleaveAttackPending).toHaveBeenCalledWith(null);
        });

        it('returns early without any side effects when there is no pending cleave data', async () => {
            const deps = createDeps({ cleaveAttackPending: null });
            const { handleCleaveAttack } = useModalHandlers(deps);
            await handleCleaveAttack('Goblin');
            expect(deps.setCleaveAttackPending).not.toHaveBeenCalled();
            expect(deps.rollDamage).not.toHaveBeenCalled();
            expect(getCombatContext).not.toHaveBeenCalled();
        });

        it('rolls damage and calls rollDamage on hit with positive ability modifier', async () => {
            const deps = createDeps({
                cleaveAttackPending: {
                    attackName: 'Longsword',
                    damage: '1d8+3',
                    damageType: 'slashing',
                    abilityName: 'Strength',
                    weaponType: 'melee',
                    properties: [],
                    proficiencyBonus: 3,
                    abilities: [{ name: 'Strength', bonus: 3 }],
                    campaignName: 'test-campaign',
                    playerStats: { name: 'TestFighter', level: 5, proficiency: 3, abilities: [{ name: 'Strength', bonus: 3 }] },
                    secondTargets: [],
                },
            });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', ac: 12 }],
            });
            rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 3 });

            const { handleCleaveAttack } = useModalHandlers(deps);
            await handleCleaveAttack('Goblin');

            expect(deps.setCleaveAttackPending).toHaveBeenCalledWith(null);
            expect(deps.rollDamage).toHaveBeenCalledWith(
                'Longsword (Cleave)',
                expect.any(String),
                8,
                [5, 3],
                0,
                expect.objectContaining({
                    targetName: 'Goblin',
                    damageType: 'slashing',
                    attackerName: 'TestFighter',
                })
            );
        });

        it('rolls damage with negative ability modifier in formula when ability is negative', async () => {
            const deps = createDeps({
                cleaveAttackPending: {
                    attackName: 'Longbow',
                    damage: '1d8+1',
                    damageType: 'piercing',
                    abilityName: 'Strength',
                    weaponType: 'melee',
                    properties: [],
                    proficiencyBonus: 3,
                    abilities: [{ name: 'Strength', bonus: -2 }],
                    campaignName: 'test-campaign',
                    playerStats: { name: 'TestFighter', level: 5, proficiency: 3, abilities: [{ name: 'Strength', bonus: -2 }] },
                    secondTargets: [],
                },
            });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', ac: 10 }],
            });
            rollExpression.mockReturnValue({ total: 2, rolls: [2], modifier: 0 });

            const { handleCleaveAttack } = useModalHandlers(deps);
            await handleCleaveAttack('Goblin');

            expect(deps.rollDamage).toHaveBeenCalledWith(
                'Longbow (Cleave)',
                '1d8+1 + -2[Strength]',
                2,
                [2],
                0,
                expect.objectContaining({
                    targetName: 'Goblin',
                    damageType: 'piercing',
                    attackerName: 'TestFighter',
                })
            );
        });

        it('calls rollDamage with auto miss when d20 roll misses', async () => {
            const deps = createDeps({
                cleaveAttackPending: {
                    attackName: 'Longsword',
                    damage: '1d8+3',
                    damageType: 'slashing',
                    abilityName: 'Strength',
                    weaponType: 'melee',
                    properties: [],
                    proficiencyBonus: 3,
                    abilities: [{ name: 'Strength', bonus: 3 }],
                    campaignName: 'test-campaign',
                    playerStats: { name: 'TestFighter', level: 5, proficiency: 3, abilities: [{ name: 'Strength', bonus: 3 }] },
                    secondTargets: [],
                },
            });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', ac: 20 }],
            });
            rollExpression.mockReturnValue(null);

            const { handleCleaveAttack } = useModalHandlers(deps);
            await handleCleaveAttack('Goblin');

            expect(deps.rollDamage).toHaveBeenCalledWith(
                'Longsword (Cleave)',
                '1d8+3',
                0,
                [],
                0,
                expect.objectContaining({
                    targetName: 'Goblin',
                    damageType: 'slashing',
                    attackerName: 'TestFighter',
                    isAutoMiss: true,
                })
            );
        });

        it('uses ac of 0 when target is not found — always hits since attackBonus > 0', async () => {
            const deps = createDeps({
                cleaveAttackPending: {
                    attackName: 'Longsword',
                    damage: '1d8+3',
                    damageType: 'slashing',
                    abilityName: 'Strength',
                    weaponType: 'melee',
                    properties: [],
                    proficiencyBonus: 3,
                    abilities: [{ name: 'Strength', bonus: 3 }],
                    campaignName: 'test-campaign',
                    playerStats: { name: 'TestFighter', level: 5, proficiency: 3, abilities: [{ name: 'Strength', bonus: 3 }] },
                    secondTargets: [],
                },
            });
            getCombatContext.mockResolvedValue({
                creatures: [],
            });

            const { handleCleaveAttack } = useModalHandlers(deps);
            await handleCleaveAttack('Goblin');

            expect(deps.rollDamage).toHaveBeenCalled();
            expect(deps.rollDamage).toHaveBeenLastCalledWith(
                'Longsword (Cleave)',
                expect.any(String),
                expect.any(Number),
                expect.any(Array),
                0,
                expect.objectContaining({
                    targetName: 'Goblin',
                    damageType: 'slashing',
                    attackerName: 'TestFighter',
                })
            );
        });

        it('uses ac of 0 when combat context is null', async () => {
            const deps = createDeps({
                cleaveAttackPending: {
                    attackName: 'Longsword',
                    damage: '1d8+3',
                    damageType: 'slashing',
                    abilityName: 'Strength',
                    weaponType: 'melee',
                    properties: [],
                    proficiencyBonus: 3,
                    abilities: [{ name: 'Strength', bonus: 3 }],
                    campaignName: 'test-campaign',
                    playerStats: { name: 'TestFighter', level: 5, proficiency: 3, abilities: [{ name: 'Strength', bonus: 3 }] },
                    secondTargets: [],
                },
            });
            getCombatContext.mockResolvedValueOnce(null);

            const { handleCleaveAttack } = useModalHandlers(deps);
            await handleCleaveAttack('Goblin');

            expect(deps.rollDamage).toHaveBeenCalled();
        });

        it('uses ability bonus of 0 when ability is not found', async () => {
            const deps = createDeps({
                cleaveAttackPending: {
                    attackName: 'Longsword',
                    damage: '1d8+3',
                    damageType: 'slashing',
                    abilityName: 'Dexterity',
                    weaponType: 'melee',
                    properties: [],
                    proficiencyBonus: 3,
                    abilities: [{ name: 'Strength', bonus: 3 }],
                    campaignName: 'test-campaign',
                    playerStats: { name: 'TestFighter', level: 5, proficiency: 3, abilities: [{ name: 'Strength', bonus: 3 }] },
                    secondTargets: [],
                },
            });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', ac: 15 }],
            });

            const { handleCleaveAttack } = useModalHandlers(deps);
            await handleCleaveAttack('Goblin');

            expect(deps.rollDamage).toHaveBeenCalled();
        });
    });

    describe('handleCleaveSkip', () => {
        it('clears cleave attack pending', () => {
            const deps = createDeps();
            const { handleCleaveSkip } = useModalHandlers(deps);
            handleCleaveSkip();
            expect(deps.setCleaveAttackPending).toHaveBeenCalledWith(null);
        });
    });

    describe('handleDivineFuryDamageType', () => {
        it('applies chosen damage type, records used round, and proceeds', () => {
            const deps = createDeps({
                pendingDamageRef: {
                    current: {
                        attack: { name: 'Fury of the Gods' },
                        formula: '1d8',
                        total: 5,
                        rolls: [5],
                        modifier: 0,
                        bonusExpr: '1d8',
                        bonusTotal: 4,
                        bonusRolls: [4],
                    },
                },
            });
            const { handleDivineFuryDamageType } = useModalHandlers(deps);
            handleDivineFuryDamageType('Radiant');
            expect(deps.setDivineFuryChoice).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith(
                expect.any(Object),
                '1d8 + 1d8[Radiant]',
                9,
                [5, 4],
                0
            );
            expect(deps.pendingDamageRef.current).toBeNull();
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
            expect(deps.setDivineFuryChoice).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleDivineFurySkip', () => {
        it('proceeds with original damage when skipping', () => {
            const deps = createDeps({
                pendingDamageRef: {
                    current: {
                        attack: { name: 'Fury of the Gods' },
                        formula: '1d8',
                        total: 5,
                        rolls: [5],
                        modifier: 0,
                    },
                },
            });
            const { handleDivineFurySkip } = useModalHandlers(deps);
            handleDivineFurySkip();
            expect(deps.setDivineFuryChoice).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith(
                { name: 'Fury of the Gods' },
                '1d8',
                5,
                [5],
                0
            );
            expect(deps.pendingDamageRef.current).toBeNull();
        });

        it('returns early when no pending damage', () => {
            const deps = createDeps();
            const { handleDivineFurySkip } = useModalHandlers(deps);
            handleDivineFurySkip();
            expect(deps.setDivineFuryChoice).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(deps.pendingDamageRef.current).toBeNull();
        });
    });

    describe('handleGenericDamageTypeChoice', () => {
        it('applies chosen damage type with oncePerTurnKey', () => {
            const deps = createDeps({
                pendingDamageRef: {
                    current: {
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
                },
            });
            const { handleGenericDamageTypeChoice } = useModalHandlers(deps);
            handleGenericDamageTypeChoice('Thunder');
            expect(deps.setDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_DivineStrike_usedRound',
                1,
                'test-campaign'
            );
            expect(deps.proceedWithDamage).toHaveBeenCalledWith(
                expect.any(Object),
                '1d8 + 1d8[Thunder]',
                9,
                [5, 4],
                0
            );
            expect(deps.pendingDamageRef.current).toBeNull();
        });

        it('proceeds without oncePerTurnKey when not present', () => {
            const deps = createDeps({
                pendingDamageRef: {
                    current: {
                        attack: { name: 'Extra Damage' },
                        formula: '1d6',
                        total: 5,
                        rolls: [5],
                        modifier: 0,
                        bonusExpr: '1d6',
                        bonusTotal: 3,
                        bonusRolls: [3],
                    },
                },
            });
            const { handleGenericDamageTypeChoice } = useModalHandlers(deps);
            handleGenericDamageTypeChoice('Fire');
            expect(deps.setDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns early when no pending damage', () => {
            const deps = createDeps();
            const { handleGenericDamageTypeChoice } = useModalHandlers(deps);
            handleGenericDamageTypeChoice('Fire');
            expect(deps.setDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleGenericDamageTypeSkip', () => {
        it('proceeds with original damage when skipping', () => {
            const deps = createDeps({
                pendingDamageRef: {
                    current: {
                        attack: { name: 'Extra Damage' },
                        formula: '1d6',
                        total: 5,
                        rolls: [5],
                        modifier: 0,
                    },
                },
            });
            const { handleGenericDamageTypeSkip } = useModalHandlers(deps);
            handleGenericDamageTypeSkip();
            expect(deps.setDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith(
                { name: 'Extra Damage' },
                '1d6',
                5,
                [5],
                0
            );
            expect(deps.pendingDamageRef.current).toBeNull();
        });

        it('returns early when no pending damage', () => {
            const deps = createDeps();
            const { handleGenericDamageTypeSkip } = useModalHandlers(deps);
            handleGenericDamageTypeSkip();
            expect(deps.setDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(deps.pendingDamageRef.current).toBeNull();
        });
    });

    describe('handleDamageTypeModifierChoice', () => {
        it('applies chosen damage type to attack and records used round', () => {
            const deps = createDeps({
                pendingDamageRef: {
                    current: {
                        attack: { name: 'Empowered Strikes', damageType: 'slashing' },
                        formula: '1d8',
                        total: 5,
                        rolls: [5],
                        modifier: 0,
                        _damageTypeModifier: { name: 'Empowered Strikes' },
                    },
                },
            });
            const { handleDamageTypeModifierChoice } = useModalHandlers(deps);
            handleDamageTypeModifierChoice('radiant');
            expect(deps.setDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(deps.pendingDamageRef.current).toBeNull();
            expect(deps.proceedWithDamage).toHaveBeenCalled();
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_Empowered_Strikes_usedRound',
                1,
                'test-campaign'
            );
        });

        it('returns early when no pending damage', () => {
            const deps = createDeps();
            const { handleDamageTypeModifierChoice } = useModalHandlers(deps);
            handleDamageTypeModifierChoice('radiant');
            expect(deps.setDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleDamageTypeModifierSkip', () => {
        it('proceeds with original damage and records used round when skip', () => {
            const deps = createDeps({
                pendingDamageRef: {
                    current: {
                        attack: { name: 'Empowered Strikes' },
                        formula: '1d8',
                        total: 5,
                        rolls: [5],
                        modifier: 0,
                        _damageTypeModifier: { name: 'Empowered Strikes' },
                    },
                },
            });
            const { handleDamageTypeModifierSkip } = useModalHandlers(deps);
            handleDamageTypeModifierSkip();
            expect(deps.setDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(deps.pendingDamageRef.current).toBeNull();
            expect(deps.proceedWithDamage).toHaveBeenCalled();
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_Empowered_Strikes_usedRound',
                1,
                'test-campaign'
            );
        });

        it('returns early when no pending damage', () => {
            const deps = createDeps();
            const { handleDamageTypeModifierSkip } = useModalHandlers(deps);
            handleDamageTypeModifierSkip();
            expect(deps.setDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleEnhancedUnarmedChoice', () => {
        it('applies damage bonus rider when chosen option has damage_bonus', () => {
            const deps = createDeps({
                pendingDamageRef: {
                    current: {
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
                },
            });
            rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });
            const { handleEnhancedUnarmedChoice } = useModalHandlers(deps);
            handleEnhancedUnarmedChoice('Damage Bonus');
            expect(deps.setDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(deps.pendingDamageRef.current).toBeNull();
            expect(deps.proceedWithDamage).toHaveBeenCalledWith(
                expect.any(Object),
                expect.stringContaining('1d4'),
                expect.any(Number),
                expect.any(Array),
                null
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_Unarmed_Fighting_usedRound',
                1,
                'test-campaign'
            );
        });

        it('proceeds without rider when option does not have damage_bonus', () => {
            const deps = createDeps({
                pendingDamageRef: {
                    current: {
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
                },
                setRuntimeValue: vi.fn(),
            });
            const { handleEnhancedUnarmedChoice } = useModalHandlers(deps);
            handleEnhancedUnarmedChoice('Other Option');
            expect(deps.setDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(deps.pendingDamageRef.current).toBeNull();
            expect(deps.proceedWithDamage).toHaveBeenCalledWith(
                expect.any(Object),
                '1d4',
                5,
                [5],
                null
            );
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('proceeds without rider when option is not found in options list', () => {
            const deps = createDeps({
                pendingDamageRef: {
                    current: {
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
                },
            });
            const { handleEnhancedUnarmedChoice } = useModalHandlers(deps);
            handleEnhancedUnarmedChoice('Nonexistent Option');
            expect(deps.setDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith(
                expect.any(Object),
                '1d4',
                5,
                [5],
                null
            );
        });

        it('returns early when no pending damage', () => {
            const deps = createDeps();
            const { handleEnhancedUnarmedChoice } = useModalHandlers(deps);
            handleEnhancedUnarmedChoice('Any Option');
            expect(deps.setDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('proceeds with original damage when rollExpression returns null for damage_bonus', () => {
            const deps = createDeps({
                pendingDamageRef: {
                    current: {
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
                },
                setRuntimeValue: vi.fn(),
            });
            rollExpression.mockReturnValue(null);
            const { handleEnhancedUnarmedChoice } = useModalHandlers(deps);
            handleEnhancedUnarmedChoice('Damage Bonus');
            expect(deps.setDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith(
                expect.any(Object),
                '1d4',
                5,
                [5],
                null
            );
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('uses damageType same_as_weapon when not specified on option', () => {
            const deps = createDeps({
                pendingDamageRef: {
                    current: {
                        attack: { name: 'Unarmed Strike' },
                        formula: '1d4',
                        total: 5,
                        rolls: [5],
                        modifier: 0,
                        rider: null,
                        _attackRider: {
                            name: 'Unarmed Fighting',
                            options: [{ name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d4' }],
                        },
                    },
                },
            });
            rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });
            const { handleEnhancedUnarmedChoice } = useModalHandlers(deps);
            handleEnhancedUnarmedChoice('Damage Bonus');
            expect(deps.proceedWithDamage).toHaveBeenCalledWith(
                expect.any(Object),
                expect.stringContaining('same_as_weapon'),
                expect.any(Number),
                expect.any(Array),
                null
            );
        });
    });

    describe('handleEnhancedUnarmedSkip', () => {
        it('proceeds with original damage and records used round when skipping', () => {
            const deps = createDeps({
                pendingDamageRef: {
                    current: {
                        attack: { name: 'Unarmed Strike' },
                        formula: '1d4',
                        total: 5,
                        rolls: [5],
                        modifier: 0,
                        rider: null,
                        _attackRider: { name: 'Unarmed Fighting' },
                    },
                },
            });
            const { handleEnhancedUnarmedSkip } = useModalHandlers(deps);
            handleEnhancedUnarmedSkip();
            expect(deps.setDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(deps.pendingDamageRef.current).toBeNull();
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
            expect(deps.setDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleFeatureChoiceConfirm', () => {
        it('stores chosen option and shows popup for hunter_prey automation type', () => {
            const deps = createDeps({
                featureChoice: {
                    action: { name: "Hunter's Prey", automation: { type: 'hunter_prey' } },
                    optionKey: "_Hunter's_Prey_choice",
                },
            });
            const { handleFeatureChoiceConfirm } = useModalHandlers(deps);
            handleFeatureChoiceConfirm("Colossus Slayer");
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', "_Hunter's_Prey_choice", "Colossus Slayer", 'test-campaign');
            expect(deps.setFeatureChoice).toHaveBeenCalledWith(null);
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining("Hunter's Prey"));
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Short or Long Rest'));
        });

        it('stores chosen option and shows popup for defensive_tactics automation type', () => {
            const deps = createDeps({
                featureChoice: {
                    action: { name: 'Defensive Tactics', automation: { type: 'defensive_tactics' } },
                    optionKey: '_DefensiveTactics_choice',
                },
            });
            const { handleFeatureChoiceConfirm } = useModalHandlers(deps);
            handleFeatureChoiceConfirm('Shield Block');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_DefensiveTactics_choice', 'Shield Block', 'test-campaign');
            expect(deps.setFeatureChoice).toHaveBeenCalledWith(null);
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Defensive Tactics'));
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Short or Long Rest'));
        });

        it('shows different message for non-hunter_prey/non-defensive_tactics actions', () => {
            const deps = createDeps({
                featureChoice: {
                    action: { name: 'Other Feature', automation: {} },
                    optionKey: 'other_choice',
                },
            });
            const { handleFeatureChoiceConfirm } = useModalHandlers(deps);
            handleFeatureChoiceConfirm('Option A');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'other_choice', 'Option A', 'test-campaign');
            expect(deps.setFeatureChoice).toHaveBeenCalledWith(null);
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('clicking the feature again'));
            expect(deps.setPopupHtml).not.toHaveBeenCalledWith(expect.stringContaining('Short or Long Rest'));
        });

        it('does nothing when no feature choice', () => {
            const deps = createDeps();
            const { handleFeatureChoiceConfirm } = useModalHandlers(deps);
            handleFeatureChoiceConfirm('Option A');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(deps.setFeatureChoice).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });
    });

    describe('handleFeatureChoiceSkip', () => {
        it('clears feature choice', () => {
            const deps = createDeps();
            const { handleFeatureChoiceSkip } = useModalHandlers(deps);
            handleFeatureChoiceSkip();
            expect(deps.setFeatureChoice).toHaveBeenCalledWith(null);
        });
    });

    describe('handleConstellationSelect', () => {
        it('calls twinkling handler when level >= 10', async () => {
            const deps = createDeps();
            const payload = {
                action: { name: 'Starry Form' },
                playerStats: { level: 12 },
                campaignName: 'test-campaign',
            };
            twinklingApply.mockResolvedValue({ payload: 'Twinkled!' });
            const { handleConstellationSelect } = useModalHandlers(deps);
            await handleConstellationSelect(payload, 'Twinkling Constellation');
            expect(twinklingApply).toHaveBeenCalled();
            expect(applyConstellationOption).not.toHaveBeenCalled();
            expect(deps.setStarryFormConstellationModal).toHaveBeenCalledWith(null);
            expect(deps.setTwinklingConstellationModal).toHaveBeenCalledWith(null);
            expect(deps.setPopupHtml).toHaveBeenCalledWith('Twinkled!');
        });

        it('calls starry handler when level < 10', async () => {
            const deps = createDeps();
            const payload = {
                action: { name: 'Starry Form' },
                playerStats: { level: 6 },
                campaignName: 'test-campaign',
            };
            applyConstellationOption.mockResolvedValue({ payload: 'Starry!' });
            const { handleConstellationSelect } = useModalHandlers(deps);
            await handleConstellationSelect(payload, 'Starry Form');
            expect(applyConstellationOption).toHaveBeenCalled();
            expect(twinklingApply).not.toHaveBeenCalled();
            expect(deps.setStarryFormConstellationModal).toHaveBeenCalledWith(null);
            expect(deps.setTwinklingConstellationModal).toHaveBeenCalledWith(null);
            expect(deps.setPopupHtml).toHaveBeenCalledWith('Starry!');
        });

        it('does not set popup when result is null', async () => {
            const deps = createDeps();
            const payload = {
                action: { name: 'Starry Form' },
                playerStats: { level: 6 },
                campaignName: 'test-campaign',
            };
            applyConstellationOption.mockResolvedValue(null);
            const { handleConstellationSelect } = useModalHandlers(deps);
            await handleConstellationSelect(payload, 'Starry Form');
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
            expect(deps.setStarryFormConstellationModal).toHaveBeenCalledWith(null);
            expect(deps.setTwinklingConstellationModal).toHaveBeenCalledWith(null);
        });

        it('sets popup with undefined when result has no payload', async () => {
            const deps = createDeps();
            const payload = {
                action: { name: 'Starry Form' },
                playerStats: { level: 6 },
                campaignName: 'test-campaign',
            };
            applyConstellationOption.mockResolvedValue({});
            const { handleConstellationSelect } = useModalHandlers(deps);
            await handleConstellationSelect(payload, 'Starry Form');
            expect(deps.setPopupHtml).toHaveBeenCalledWith(undefined);
        });
    });

    describe('handleElderChampionRestore', () => {
        it('calls handleRestore and sets popup', async () => {
            const deps = createDeps();
            const payload = {
                action: { name: 'Elder Champion' },
                playerStats: { level: 10 },
                campaignName: 'test-campaign',
            };
            handleRestore.mockResolvedValue({ payload: 'Restored!' });
            const { handleElderChampionRestore } = useModalHandlers(deps);
            await handleElderChampionRestore(payload);
            expect(handleRestore).toHaveBeenCalled();
            expect(deps.setPopupHtml).toHaveBeenCalledWith('Restored!');
        });

        it('does not set popup when result is null', async () => {
            const deps = createDeps();
            const payload = {
                action: { name: 'Elder Champion' },
                playerStats: { level: 10 },
                campaignName: 'test-campaign',
            };
            handleRestore.mockResolvedValue(null);
            const { handleElderChampionRestore } = useModalHandlers(deps);
            await handleElderChampionRestore(payload);
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('sets popup with undefined when result has no payload', async () => {
            const deps = createDeps();
            const payload = {
                action: { name: 'Elder Champion' },
                playerStats: { level: 10 },
                campaignName: 'test-campaign',
            };
            handleRestore.mockResolvedValue({});
            const { handleElderChampionRestore } = useModalHandlers(deps);
            await handleElderChampionRestore(payload);
            expect(deps.setPopupHtml).toHaveBeenCalledWith(undefined);
        });
    });

    describe('return value', () => {
        it('returns all expected handler functions', () => {
            const deps = createDeps();
            const handlers = useModalHandlers(deps);
            expect(typeof handlers.handleMasteryClose).toBe('function');
            expect(typeof handlers.handleWeaponMasteryChoice).toBe('function');
            expect(typeof handlers.handleCleaveAttack).toBe('function');
            expect(typeof handlers.handleCleaveSkip).toBe('function');
            expect(typeof handlers.handleDivineFuryDamageType).toBe('function');
            expect(typeof handlers.handleDivineFurySkip).toBe('function');
            expect(typeof handlers.handleGenericDamageTypeChoice).toBe('function');
            expect(typeof handlers.handleGenericDamageTypeSkip).toBe('function');
            expect(typeof handlers.handleDamageTypeModifierChoice).toBe('function');
            expect(typeof handlers.handleDamageTypeModifierSkip).toBe('function');
            expect(typeof handlers.handleEnhancedUnarmedChoice).toBe('function');
            expect(typeof handlers.handleEnhancedUnarmedSkip).toBe('function');
            expect(typeof handlers.handleFeatureChoiceConfirm).toBe('function');
            expect(typeof handlers.handleFeatureChoiceSkip).toBe('function');
            expect(typeof handlers.handleConstellationSelect).toBe('function');
            expect(typeof handlers.handleElderChampionRestore).toBe('function');
        });

        it('returns exactly 16 handler functions', () => {
            const deps = createDeps();
            const handlers = useModalHandlers(deps);
            const handlerKeys = Object.keys(handlers);
            expect(handlerKeys).toHaveLength(16);
            expect(handlerKeys).toEqual([
                'handleMasteryClose',
                'handleWeaponMasteryChoice',
                'handleCleaveAttack',
                'handleCleaveSkip',
                'handleDivineFuryDamageType',
                'handleDivineFurySkip',
                'handleGenericDamageTypeChoice',
                'handleGenericDamageTypeSkip',
                'handleDamageTypeModifierChoice',
                'handleDamageTypeModifierSkip',
                'handleEnhancedUnarmedChoice',
                'handleEnhancedUnarmedSkip',
                'handleFeatureChoiceConfirm',
                'handleFeatureChoiceSkip',
                'handleConstellationSelect',
                'handleElderChampionRestore',
            ]);
        });
    });
});
