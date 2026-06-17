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

describe('useModalHandlers', () => {
    const mockPlayerStats = {
        name: 'TestFighter',
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Strength', bonus: 3 }],
    };

    const mockCampaignName = 'test-campaign';
    const mockRollDamage = vi.fn();
    const mockProceedWithDamage = vi.fn();
    const mockPendingDamageRef = { current: null };
    let mockCleaveAttackPending = null;
    const featureChoiceRef = { current: null };
    const mockSetDamageTypeChoice = vi.fn();
    const mockSetDivineFuryChoice = vi.fn();
    const mockSetWeaponMasteryModal = vi.fn();
    const mockSetWeaponMasteryChoiceModal = vi.fn();
    const mockSetCleaveAttackPending = vi.fn();
    const mockSetFeatureChoice = vi.fn();
    const mockSetStarryFormConstellationModal = vi.fn();
    const mockSetTwinklingConstellationModal = vi.fn();
    const mockSetPopupHtml = vi.fn();

    const commonDeps = {
        playerStats: mockPlayerStats,
        campaignName: mockCampaignName,
        rollDamage: mockRollDamage,
        proceedWithDamage: mockProceedWithDamage,
        pendingDamageRef: mockPendingDamageRef,
        cleaveAttackPending: mockCleaveAttackPending,
        featureChoice: featureChoiceRef.current,
        setDamageTypeChoice: mockSetDamageTypeChoice,
        setDivineFuryChoice: mockSetDivineFuryChoice,
        setWeaponMasteryModal: mockSetWeaponMasteryModal,
        setWeaponMasteryChoiceModal: mockSetWeaponMasteryChoiceModal,
        setCleaveAttackPending: mockSetCleaveAttackPending,
        setFeatureChoice: mockSetFeatureChoice,
        setStarryFormConstellationModal: mockSetStarryFormConstellationModal,
        setTwinklingConstellationModal: mockSetTwinklingConstellationModal,
        setPopupHtml: mockSetPopupHtml,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        getCurrentCombatRound.mockReturnValue(1);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        getCombatContext.mockResolvedValue(null);
        getDistanceFeet.mockReturnValue(5);
    });

    function UseModalHandlers() {
        return useModalHandlers(commonDeps);
    }

    describe('handleMasteryClose', () => {
        it('closes weapon mastery modal', async () => {
            const { handleMasteryClose } = UseModalHandlers();
            await handleMasteryClose();
            expect(mockSetWeaponMasteryModal).toHaveBeenCalledWith(null);
        });

        it('proceeds with pending damage when no cleave effect', async () => {
            mockPendingDamageRef.current = {
                attack: { name: 'Longsword' },
                formula: '1d8+3',
                total: 10,
                rolls: [5, 5],
                modifier: 3,
            };
            const { handleMasteryClose } = UseModalHandlers();
            await handleMasteryClose();
            expect(mockProceedWithDamage).toHaveBeenCalledWith(
                { name: 'Longsword' },
                '1d8+3',
                10,
                [5, 5],
                3
            );
            expect(mockPendingDamageRef.current).toBeNull();
        });

        it('shows cleave target selection when cleave effect exists', async () => {
            mockPendingDamageRef.current = {
                attack: { name: 'Longsword' },
                formula: '1d8+3',
                total: 10,
                rolls: [5, 5],
                modifier: 3,
            };
            getRuntimeValue.mockReturnValueOnce([{ effect: 'cleave', target: 'Goblin' }]);
            getCombatContext.mockResolvedValueOnce({
                creatures: [
                    { name: 'Goblin', position: { x: 1, y: 1 } },
                    { name: 'Orc', position: { x: 2, y: 2 } },
                ],
            });
            getDistanceFeet.mockReturnValue(5);
            const { handleMasteryClose } = UseModalHandlers();
            await handleMasteryClose();
            expect(mockSetCleaveAttackPending).toHaveBeenCalledWith(expect.objectContaining({
                attackName: 'Longsword',
            }));
        });
    });

    describe('handleWeaponMasteryChoice', () => {
        it('closes weapon mastery choice modal', () => {
            const { handleWeaponMasteryChoice } = UseModalHandlers();
            handleWeaponMasteryChoice('Mercy');
            expect(mockSetWeaponMasteryChoiceModal).toHaveBeenCalledWith(null);
        });
    });

    describe('handleCleaveAttack', () => {
        it('clears cleave pending when targetName is falsy', () => {
            const { handleCleaveAttack } = UseModalHandlers();
            handleCleaveAttack(null);
            expect(mockSetCleaveAttackPending).toHaveBeenCalledWith(null);
        });

        it('clears cleave pending when no pending data', async () => {
            mockCleaveAttackPending = null;
            const { handleCleaveAttack } = UseModalHandlers();
            await handleCleaveAttack('Goblin');
            // handleCleaveAttack returns early without calling setCleaveAttackPending when data is null
            // because the function returns without doing anything
        });

        it('rolls damage and calls rollDamage on hit', async () => {
            commonDeps.cleaveAttackPending = {
                attackName: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                abilityName: 'Strength',
                weaponType: 'melee',
                properties: [],
                proficiencyBonus: 3,
                abilities: [{ name: 'Strength', bonus: 3 }],
                campaignName: 'test-campaign',
                playerStats: mockPlayerStats,
                secondTargets: [],
            };
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', ac: 12 }],
            });
            rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 3 });
            const { handleCleaveAttack } = UseModalHandlers();
            await handleCleaveAttack('Goblin');
            expect(mockRollDamage).toHaveBeenCalledWith(
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

        it('calls rollDamage with auto miss on miss', async () => {
            commonDeps.cleaveAttackPending = {
                attackName: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                abilityName: 'Strength',
                weaponType: 'melee',
                properties: [],
                proficiencyBonus: 3,
                abilities: [{ name: 'Strength', bonus: 3 }],
                campaignName: 'test-campaign',
                playerStats: mockPlayerStats,
                secondTargets: [],
            };
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', ac: 20 }],
            });
            rollExpression.mockReturnValue(null);
            const { handleCleaveAttack } = UseModalHandlers();
            await handleCleaveAttack('Goblin');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword (Cleave)',
                '1d8+3',
                0,
                [],
                0,
                expect.objectContaining({
                    targetName: 'Goblin',
                    isAutoMiss: true,
                })
            );
        });
    });

    describe('handleCleaveSkip', () => {
        it('clears cleave attack pending', () => {
            const { handleCleaveSkip } = UseModalHandlers();
            handleCleaveSkip();
            expect(mockSetCleaveAttackPending).toHaveBeenCalledWith(null);
        });
    });

    describe('handleDivineFuryDamageType', () => {
        it('applies chosen damage type and proceeds', () => {
            mockPendingDamageRef.current = {
                attack: { name: 'Fury of the Gods' },
                formula: '1d8',
                total: 5,
                rolls: [5],
                modifier: 0,
                bonusExpr: '1d8',
                bonusTotal: 4,
                bonusRolls: [4],
            };
            const { handleDivineFuryDamageType } = UseModalHandlers();
            handleDivineFuryDamageType('Radiant');
            expect(mockSetDivineFuryChoice).toHaveBeenCalledWith(null);
            expect(mockProceedWithDamage).toHaveBeenCalledWith(
                expect.any(Object),
                '1d8 + 1d8[Radiant]',
                expect.any(Number),
                expect.any(Array),
                0
            );
        });

        it('returns early when no pending damage', () => {
            const { handleDivineFuryDamageType } = UseModalHandlers();
            handleDivineFuryDamageType('Radiant');
            expect(mockSetDivineFuryChoice).toHaveBeenCalledWith(null);
            expect(mockProceedWithDamage).not.toHaveBeenCalled();
        });
    });

    describe('handleDivineFurySkip', () => {
        it('proceeds with original damage when skipping', () => {
            mockPendingDamageRef.current = {
                attack: { name: 'Fury of the Gods' },
                formula: '1d8',
                total: 5,
                rolls: [5],
                modifier: 0,
            };
            const { handleDivineFurySkip } = UseModalHandlers();
            handleDivineFurySkip();
            expect(mockSetDivineFuryChoice).toHaveBeenCalledWith(null);
            expect(mockProceedWithDamage).toHaveBeenCalledWith(
                { name: 'Fury of the Gods' },
                '1d8',
                5,
                [5],
                0
            );
        });

        it('returns early when no pending damage', () => {
            const { handleDivineFurySkip } = UseModalHandlers();
            handleDivineFurySkip();
            expect(mockSetDivineFuryChoice).toHaveBeenCalledWith(null);
            expect(mockProceedWithDamage).not.toHaveBeenCalled();
        });
    });

    describe('handleGenericDamageTypeChoice', () => {
        it('applies chosen damage type with oncePerTurnKey', () => {
            mockPendingDamageRef.current = {
                attack: { name: 'Divine Strike' },
                formula: '1d8',
                total: 5,
                rolls: [5],
                modifier: 0,
                bonusExpr: '1d8',
                bonusTotal: 4,
                bonusRolls: [4],
                oncePerTurnKey: '_DivineStrike_usedRound',
            };
            const { handleGenericDamageTypeChoice } = UseModalHandlers();
            handleGenericDamageTypeChoice('Thunder');
            expect(mockSetDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_DivineStrike_usedRound', 1, 'test-campaign');
            expect(mockProceedWithDamage).toHaveBeenCalled();
        });

        it('proceeds without oncePerTurnKey when not present', () => {
            mockPendingDamageRef.current = {
                attack: { name: 'Extra Damage' },
                formula: '1d6',
                total: 5,
                rolls: [5],
                modifier: 0,
                bonusExpr: '1d6',
                bonusTotal: 3,
                bonusRolls: [3],
            };
            const { handleGenericDamageTypeChoice } = UseModalHandlers();
            handleGenericDamageTypeChoice('Fire');
            expect(mockProceedWithDamage).toHaveBeenCalled();
        });

        it('returns early when no pending damage', () => {
            const { handleGenericDamageTypeChoice } = UseModalHandlers();
            handleGenericDamageTypeChoice('Fire');
            expect(mockSetDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(mockProceedWithDamage).not.toHaveBeenCalled();
        });
    });

    describe('handleGenericDamageTypeSkip', () => {
        it('proceeds with original damage when skipping', () => {
            mockPendingDamageRef.current = {
                attack: { name: 'Extra Damage' },
                formula: '1d6',
                total: 5,
                rolls: [5],
                modifier: 0,
            };
            const { handleGenericDamageTypeSkip } = UseModalHandlers();
            handleGenericDamageTypeSkip();
            expect(mockSetDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(mockProceedWithDamage).toHaveBeenCalledWith(
                { name: 'Extra Damage' },
                '1d6',
                5,
                [5],
                0
            );
        });

        it('returns early when no pending damage', () => {
            const { handleGenericDamageTypeSkip } = UseModalHandlers();
            handleGenericDamageTypeSkip();
            expect(mockSetDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(mockProceedWithDamage).not.toHaveBeenCalled();
        });
    });

    describe('handleDamageTypeModifierChoice', () => {
        it('applies chosen damage type to attack', () => {
            mockPendingDamageRef.current = {
                attack: { name: 'Empowered Strikes', damageType: 'slashing' },
                formula: '1d8',
                total: 5,
                rolls: [5],
                modifier: 0,
                _damageTypeModifier: { name: 'Empowered Strikes' },
            };
            const { handleDamageTypeModifierChoice } = UseModalHandlers();
            handleDamageTypeModifierChoice('radiant');
            expect(mockSetDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(mockProceedWithDamage).toHaveBeenCalled();
        });

        it('returns early when no pending damage', () => {
            const { handleDamageTypeModifierChoice } = UseModalHandlers();
            handleDamageTypeModifierChoice('radiant');
            expect(mockSetDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(mockProceedWithDamage).not.toHaveBeenCalled();
        });
    });

    describe('handleDamageTypeModifierSkip', () => {
        it('proceeds with original damage when skipping', () => {
            mockPendingDamageRef.current = {
                attack: { name: 'Empowered Strikes' },
                formula: '1d8',
                total: 5,
                rolls: [5],
                modifier: 0,
                _damageTypeModifier: { name: 'Empowered Strikes' },
            };
            const { handleDamageTypeModifierSkip } = UseModalHandlers();
            handleDamageTypeModifierSkip();
            expect(mockSetDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(mockProceedWithDamage).toHaveBeenCalled();
        });

        it('returns early when no pending damage', () => {
            const { handleDamageTypeModifierSkip } = UseModalHandlers();
            handleDamageTypeModifierSkip();
            expect(mockSetDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(mockProceedWithDamage).not.toHaveBeenCalled();
        });
    });

    describe('handleEnhancedUnarmedChoice', () => {
        it('applies damage bonus rider when chosen option has damage_bonus', () => {
            mockPendingDamageRef.current = {
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
            };
            rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });
            const { handleEnhancedUnarmedChoice } = UseModalHandlers();
            handleEnhancedUnarmedChoice('Damage Bonus');
            expect(mockSetDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(mockProceedWithDamage).toHaveBeenCalledWith(
                expect.any(Object),
                expect.stringContaining('1d4'),
                expect.any(Number),
                expect.any(Array),
                null
            );
        });

        it('proceeds without rider when option does not have damage_bonus', () => {
            mockPendingDamageRef.current = {
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
            };
            const { handleEnhancedUnarmedChoice } = UseModalHandlers();
            handleEnhancedUnarmedChoice('Other Option');
            expect(mockSetDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(mockProceedWithDamage).toHaveBeenCalledWith(
                expect.any(Object),
                '1d4',
                5,
                [5],
                null
            );
        });

        it('returns early when no pending damage', () => {
            const { handleEnhancedUnarmedChoice } = UseModalHandlers();
            handleEnhancedUnarmedChoice('Any Option');
            expect(mockSetDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(mockProceedWithDamage).not.toHaveBeenCalled();
        });
    });

    describe('handleEnhancedUnarmedSkip', () => {
        it('proceeds with original damage when skipping', () => {
            mockPendingDamageRef.current = {
                attack: { name: 'Unarmed Strike' },
                formula: '1d4',
                total: 5,
                rolls: [5],
                modifier: 0,
                rider: null,
                _attackRider: { name: 'Unarmed Fighting' },
            };
            const { handleEnhancedUnarmedSkip } = UseModalHandlers();
            handleEnhancedUnarmedSkip();
            expect(mockSetDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(mockProceedWithDamage).toHaveBeenCalled();
        });

        it('returns early when no pending damage', () => {
            const { handleEnhancedUnarmedSkip } = UseModalHandlers();
            handleEnhancedUnarmedSkip();
            expect(mockSetDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(mockProceedWithDamage).not.toHaveBeenCalled();
        });
    });

    describe('handleFeatureChoiceConfirm', () => {
        it('stores chosen option and shows popup', () => {
            const featureChoice = {
                action: { name: "Hunter's Prey", automation: { type: 'hunter_prey' } },
                optionKey: "_Hunter's_Prey_choice",
            };
            const hookDeps = { ...commonDeps, featureChoice };
            const { handleFeatureChoiceConfirm } = useModalHandlers(hookDeps);
            handleFeatureChoiceConfirm("Colossus Slayer");
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', "_Hunter's_Prey_choice", "Colossus Slayer", 'test-campaign');
            expect(mockSetFeatureChoice).toHaveBeenCalledWith(null);
            expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining("Hunter's Prey"));
            expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Short or Long Rest'));
        });

        it('shows different message for non-hunter_prey actions', () => {
            const featureChoice = {
                action: { name: 'Other Feature', automation: {} },
                optionKey: 'other_choice',
            };
            const hookDeps = { ...commonDeps, featureChoice };
            const { handleFeatureChoiceConfirm } = useModalHandlers(hookDeps);
            handleFeatureChoiceConfirm('Option A');
            expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('clicking the feature again'));
        });

        it('does nothing when no feature choice', () => {
            const { handleFeatureChoiceConfirm } = UseModalHandlers();
            handleFeatureChoiceConfirm('Option A');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(mockSetFeatureChoice).not.toHaveBeenCalled();
        });
    });

    describe('handleFeatureChoiceSkip', () => {
        it('clears feature choice', () => {
            const { handleFeatureChoiceSkip } = UseModalHandlers();
            handleFeatureChoiceSkip();
            expect(mockSetFeatureChoice).toHaveBeenCalledWith(null);
        });
    });

    describe('handleConstellationSelect', () => {
        it('calls twinkling handler when level >= 10', async () => {
            const { handleConstellationSelect } = UseModalHandlers();
            const payload = {
                action: { name: 'Starry Form' },
                playerStats: { level: 12 },
                campaignName: 'test-campaign',
            };
            const { applyConstellationOption: twinklingApply } = await import('../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js');
            twinklingApply.mockResolvedValue({ payload: 'Twinkled!' });
            await handleConstellationSelect(payload, 'Twinkling Constellation');
            expect(twinklingApply).toHaveBeenCalled();
            expect(mockSetStarryFormConstellationModal).toHaveBeenCalledWith(null);
            expect(mockSetTwinklingConstellationModal).toHaveBeenCalledWith(null);
        });

        it('calls starry handler when level < 10', async () => {
            const { handleConstellationSelect } = UseModalHandlers();
            const payload = {
                action: { name: 'Starry Form' },
                playerStats: { level: 6 },
                campaignName: 'test-campaign',
            };
            const { applyConstellationOption: starryApply } = await import('../../services/automation/handlers/class-sorcerer/starryFormHandler.js');
            starryApply.mockResolvedValue({ payload: 'Starry!' });
            await handleConstellationSelect(payload, 'Starry Form');
            expect(starryApply).toHaveBeenCalled();
            expect(mockSetPopupHtml).toHaveBeenCalledWith('Starry!');
        });

        it('does not set popup when result is null', async () => {
            const { handleConstellationSelect } = UseModalHandlers();
            const payload = {
                action: { name: 'Starry Form' },
                playerStats: { level: 6 },
                campaignName: 'test-campaign',
            };
            const { applyConstellationOption: starryApply } = await import('../../services/automation/handlers/class-sorcerer/starryFormHandler.js');
            starryApply.mockResolvedValue(null);
            await handleConstellationSelect(payload, 'Starry Form');
            expect(mockSetPopupHtml).not.toHaveBeenCalled();
        });
    });

    describe('handleElderChampionRestore', () => {
        it('calls handleRestore and sets popup', async () => {
            const { handleElderChampionRestore } = UseModalHandlers();
            const payload = {
                action: { name: 'Elder Champion' },
                playerStats: { level: 10 },
                campaignName: 'test-campaign',
            };
            const { handleRestore } = await import('../../services/automation/handlers/class-cleric-paladin/elderChampionHandler.js');
            handleRestore.mockResolvedValue({ payload: 'Restored!' });
            await handleElderChampionRestore(payload);
            expect(handleRestore).toHaveBeenCalled();
            expect(mockSetPopupHtml).toHaveBeenCalledWith('Restored!');
        });

        it('does not set popup when result is null', async () => {
            const { handleElderChampionRestore } = UseModalHandlers();
            const payload = {
                action: { name: 'Elder Champion' },
                playerStats: { level: 10 },
                campaignName: 'test-campaign',
            };
            const { handleRestore } = await import('../../services/automation/handlers/class-cleric-paladin/elderChampionHandler.js');
            handleRestore.mockResolvedValue(null);
            await handleElderChampionRestore(payload);
            expect(mockSetPopupHtml).not.toHaveBeenCalled();
        });
    });

    describe('return value', () => {
        it('returns all expected handler functions', () => {
            const handlers = useModalHandlers(commonDeps);
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
    });
});
