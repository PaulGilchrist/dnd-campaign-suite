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

describe('useModalHandlers - features & constellation', () => {
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

        it('proceeds with original damage when damage_bonus is not applicable', () => {
            const makeDeps = (options) => createDeps({
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
                            options,
                        },
                    },
                },
            });

            // Option found but no damage_bonus effect
            let deps = makeDeps([{ name: 'Other Option', effect: 'other' }]);
            const { handleEnhancedUnarmedChoice: handler } = useModalHandlers(deps);
            handler('Other Option');
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

            vi.clearAllMocks();
            getRuntimeValue.mockReturnValue(null);
            setRuntimeValue.mockReturnValue(undefined);
            getCurrentCombatRound.mockReturnValue(1);

            // Option not found in list
            deps = makeDeps([{ name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d4', damageType: 'force' }]);
            const { handleEnhancedUnarmedChoice: handler2 } = useModalHandlers(deps);
            handler2('Nonexistent Option');
            expect(deps.setDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith(
                expect.any(Object),
                '1d4',
                5,
                [5],
                null
            );
            expect(setRuntimeValue).not.toHaveBeenCalled();

            vi.clearAllMocks();
            getRuntimeValue.mockReturnValue(null);
            setRuntimeValue.mockReturnValue(undefined);
            getCurrentCombatRound.mockReturnValue(1);

            // rollExpression returns null for damage_bonus
            deps = makeDeps([{ name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d4', damageType: 'force' }]);
            rollExpression.mockReturnValue(null);
            const { handleEnhancedUnarmedChoice: handler3 } = useModalHandlers(deps);
            handler3('Damage Bonus');
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

        it('returns early when no pending damage', () => {
            const deps = createDeps();
            const { handleEnhancedUnarmedChoice } = useModalHandlers(deps);
            handleEnhancedUnarmedChoice('Any Option');
            expect(deps.setDamageTypeChoice).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
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
        it('stores chosen option and shows popup with rest message for hunter_prey and defensive_tactics', () => {
            const makePayload = (automationType) => ({
                action: { name: automationType === 'hunter_prey' ? "Hunter's Prey" : 'Defensive Tactics', automation: { type: automationType } },
                optionKey: automationType === 'hunter_prey' ? "_Hunter's_Prey_choice" : '_DefensiveTactics_choice',
            });

            // hunter_prey
            let deps = createDeps({ featureChoice: makePayload('hunter_prey') });
            const { handleFeatureChoiceConfirm } = useModalHandlers(deps);
            handleFeatureChoiceConfirm("Colossus Slayer");
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', "_Hunter's_Prey_choice", "Colossus Slayer", 'test-campaign');
            expect(deps.setFeatureChoice).toHaveBeenCalledWith(null);
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining("Hunter's Prey"));
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Short or Long Rest'));

            vi.clearAllMocks();
            getRuntimeValue.mockReturnValue(null);
            setRuntimeValue.mockReturnValue(undefined);

            // defensive_tactics
            deps = createDeps({ featureChoice: makePayload('defensive_tactics') });
            const { handleFeatureChoiceConfirm: handler2 } = useModalHandlers(deps);
            handler2('Shield Block');
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
        it('calls correct handler based on level and sets popup', async () => {
            // level >= 10: twinkling handler
            const deps = createDeps();
            const twinklingPayload = {
                action: { name: 'Starry Form' },
                playerStats: { level: 12 },
                campaignName: 'test-campaign',
            };
            twinklingApply.mockResolvedValue({ payload: 'Twinkled!' });
            const { handleConstellationSelect } = useModalHandlers(deps);
            await handleConstellationSelect(twinklingPayload, 'Twinkling Constellation');
            expect(twinklingApply).toHaveBeenCalled();
            expect(applyConstellationOption).not.toHaveBeenCalled();
            expect(deps.setStarryFormConstellationModal).toHaveBeenCalledWith(null);
            expect(deps.setTwinklingConstellationModal).toHaveBeenCalledWith(null);
            expect(deps.setPopupHtml).toHaveBeenCalledWith('Twinkled!');

            vi.clearAllMocks();
            getRuntimeValue.mockReturnValue(null);
            setRuntimeValue.mockReturnValue(undefined);

            // level < 10: starry handler
            const starryPayload = {
                action: { name: 'Starry Form' },
                playerStats: { level: 6 },
                campaignName: 'test-campaign',
            };
            applyConstellationOption.mockResolvedValue({ payload: 'Starry!' });
            const { handleConstellationSelect: handler2 } = useModalHandlers(deps);
            await handler2(starryPayload, 'Starry Form');
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

        it('handles null and empty results', async () => {
            const payload = {
                action: { name: 'Elder Champion' },
                playerStats: { level: 10 },
                campaignName: 'test-campaign',
            };

            // null result: no popup
            const deps1 = createDeps();
            handleRestore.mockResolvedValue(null);
            const { handleElderChampionRestore: handler1 } = useModalHandlers(deps1);
            await handler1(payload);
            expect(deps1.setPopupHtml).not.toHaveBeenCalled();

            vi.clearAllMocks();
            getRuntimeValue.mockReturnValue(null);
            setRuntimeValue.mockReturnValue(undefined);

            // empty object result: popup set to undefined
            const deps2 = createDeps();
            handleRestore.mockResolvedValue({});
            const { handleElderChampionRestore: handler2 } = useModalHandlers(deps2);
            await handler2(payload);
            expect(deps2.setPopupHtml).toHaveBeenCalledWith(undefined);
        });
    });

    describe('return value', () => {
        it('returns all expected handler functions', () => {
            const deps = createDeps();
            const handlers = useModalHandlers(deps);
            expect(Object.keys(handlers)).toHaveLength(17);
            expect(Object.keys(handlers)).toEqual([
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
                'handleWeaponKindMasteryClose',
            ]);
            for (const handler of Object.values(handlers)) {
                expect(typeof handler).toBe('function');
            }
        });
    });
});
