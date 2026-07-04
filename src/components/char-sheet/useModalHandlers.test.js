// @improved-by-ai
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
        getCurrentCombatRound.mockReturnValue(1);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        getCombatContext.mockResolvedValue(null);
        getDistanceFeet.mockReturnValue(5);
        globalThis.Math.random = () => 20;
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
                    { name: 'TestFighter', position: { x: 0, y: 0 } },
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

        it('proceeds without cleave target selection when combat context is unavailable or has no creatures', async () => {
            const makeDeps = () => createDeps({
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

            // null combat context
            let deps = makeDeps();
            getRuntimeValue.mockReturnValueOnce([{ effect: 'cleave', target: 'Goblin' }]);
            getCombatContext.mockResolvedValueOnce(null);
            let { handleMasteryClose } = useModalHandlers(deps);
            await handleMasteryClose();
            expect(deps.proceedWithDamage).toHaveBeenCalled();
            expect(deps.setCleaveAttackPending).not.toHaveBeenCalled();

            vi.clearAllMocks();
            getRuntimeValue.mockReturnValueOnce([{ effect: 'cleave', target: 'Goblin' }]);
            getCombatContext.mockResolvedValueOnce({ creatures: [] });
            deps = makeDeps();
            ({ handleMasteryClose } = useModalHandlers(deps));
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
            globalThis.Math.random = () => 10;

            const { handleCleaveAttack } = useModalHandlers(deps);
            await handleCleaveAttack('Goblin');

            expect(deps.rollDamage).toHaveBeenCalledWith(
                'Longbow (Cleave)',
                '1d8+1 + -2 [Strength]',
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
            globalThis.Math.random = () => 1;

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
            const makeDeps = () => createDeps({
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

            // empty creatures list
            let deps = makeDeps();
            getCombatContext.mockResolvedValue({ creatures: [] });
            let { handleCleaveAttack } = useModalHandlers(deps);
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

            vi.clearAllMocks();

            // null combat context
            deps = makeDeps();
            getCombatContext.mockResolvedValueOnce(null);
            ({ handleCleaveAttack } = useModalHandlers(deps));
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
});
