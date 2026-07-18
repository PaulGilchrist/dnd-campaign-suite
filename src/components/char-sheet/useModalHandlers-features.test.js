// @cleaned-by-ai
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

vi.mock('../../services/automation/handlers/combat/bonusAttacksHandler.js', () => ({
    applyFlurryOfBlows: vi.fn(),
}));

import { rollExpression } from '../../services/dice/diceRoller.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { getDistanceFeet } from '../../services/rules/combat/rangeValidation.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { applyConstellationOption } from '../../services/automation/handlers/class-sorcerer/starryFormHandler.js';
import { applyConstellationOption as twinklingApply } from '../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js';

function createDeps(overrides = {}) {
    const playerStats = {
        name: 'TestFighter',
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Strength', bonus: 3 }],
        ...overrides.playerStats,
    };
    const modalState = {
        ...(overrides.modalState || {}),
    };
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
            expect(deps.proceedWithDamage).toHaveBeenCalledWith(
                expect.any(Object),
                '1d4',
                5,
                [5],
                null
            );
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
            expect(deps.proceedWithDamage).toHaveBeenCalledWith(
                expect.any(Object),
                '1d4',
                5,
                [5],
                null
            );
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
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
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
    });

    describe('handleFeatureChoiceConfirm', () => {
        it('stores chosen option and shows popup with rest message for defensive_tactics', () => {
            const deps = createDeps({
                modalState: {
                    featureChoice: {
                        action: { name: 'Defensive Tactics', automation: { type: 'defensive_tactics' } },
                        optionKey: '_DefensiveTactics_choice',
                    },
                },
            });
            const { handleFeatureChoiceConfirm } = useModalHandlers(deps);
            handleFeatureChoiceConfirm('Shield Block');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_DefensiveTactics_choice', 'Shield Block', 'test-campaign');
            expect(deps.setModalState).toHaveBeenCalledWith({ featureChoice: null });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Defensive Tactics'));
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Short or Long Rest'));
        });

        it('shows different message for non-hunter_prey/non-defensive_tactics actions', () => {
            const deps = createDeps({
                modalState: {
                    featureChoice: {
                        action: { name: 'Other Feature', automation: {} },
                        optionKey: 'other_choice',
                    },
                },
            });
            const { handleFeatureChoiceConfirm } = useModalHandlers(deps);
            handleFeatureChoiceConfirm('Option A');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'other_choice', 'Option A', 'test-campaign');
            expect(deps.setModalState).toHaveBeenCalledWith({ featureChoice: null });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('clicking the feature again'));
            expect(deps.setPopupHtml).not.toHaveBeenCalledWith(expect.stringContaining('Short or Long Rest'));
        });

        it('does nothing when no feature choice', () => {
            const deps = createDeps();
            const { handleFeatureChoiceConfirm } = useModalHandlers(deps);
            handleFeatureChoiceConfirm('Option A');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });
    });

    describe('handleFeatureChoiceSkip', () => {
        it('clears feature choice', () => {
            const deps = createDeps();
            const { handleFeatureChoiceSkip } = useModalHandlers(deps);
            handleFeatureChoiceSkip();
            expect(deps.setModalState).toHaveBeenCalledWith({ featureChoice: null });
        });
    });

    describe('handleConstellationSelect', () => {
        it('calls twinkling handler when level >= 10 and sets popup', async () => {
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
            expect(deps.setModalState).toHaveBeenCalledWith({ starryFormConstellationModal: null, twinklingConstellationModal: null });
            expect(deps.setPopupHtml).toHaveBeenCalledWith('Twinkled!');
        });

        it('calls starry handler when level < 10 and sets popup', async () => {
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
            expect(deps.setModalState).toHaveBeenCalledWith({ starryFormConstellationModal: null, twinklingConstellationModal: null });
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
        });
    });

    describe('return value', () => {
        it('returns all expected handler functions', () => {
            const deps = createDeps();
            const handlers = useModalHandlers(deps);
            expect(Object.keys(handlers)).toHaveLength(16);
            expect(Object.keys(handlers)).toEqual([
                'handleMasteryClose',
                'handleWeaponMasteryChoice',
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
                'handleWeaponKindMasteryClose',
                'handleFlurryOfBlowsConfirm',
                'handleFlurryOfBlowsSkip',
            ]);
            for (const handler of Object.values(handlers)) {
                expect(typeof handler).toBe('function');
            }
        });
    });
});
