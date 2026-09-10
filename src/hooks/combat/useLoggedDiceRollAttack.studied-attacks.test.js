// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { setRuntimeValue, getRuntimeValue } from '../runtime/useRuntimeState.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
    DEBUG_FORCE_CRIT: false,
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
    findCreatureByName: vi.fn(() => null),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 2, newHp: 8 })),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
    clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
    clearHuntersMarkConcentration: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(),
    getUnbreakableMajestySaveDc: vi.fn(),
    hasAttackerTriggeredMajesty: vi.fn(),
    markAttackerTriggeredMajesty: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../services/combat/automation/automationPassives.js', () => ({
    isResilientSphereActive: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationDefense: vi.fn(),
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
  getSlowAcPenalty: () => 0,
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(),
    getShieldOfFaithAcBonus: vi.fn(),
    getWardingBondAcBonus: vi.fn(() => 0),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/automation/handlers/spells/forcecageHandler.js', () => ({
    isForcecageBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/mazeHandler.js', () => ({
    isMazeBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/banishmentHandler.js', () => ({
    isBanishmentBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/imprisonmentHandler.js', () => ({
    isImprisonmentBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/prismaticSprayHandler.js', () => ({
    isPrismaticSprayBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/sanctuaryHandler.js', () => ({
    endSanctuary: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/automation/common/damageRollback.js', () => ({
    addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/compelledDuelHandler.js', () => ({
    checkCompelledDuelAttackExpiry: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    getManeuversForRules: vi.fn(),
}));

import { addEntry as addEntryMock } from '../../services/ui/logService.js';

describe('createLogAndShow - auto_effect miss trigger (Studied Attacks)', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        autoDamageSourceRef: { current: null },
    };

    function makePassives(passiveList) {
        return {
            targetName: 'Goblin',
            playerStats: {
                name: 'TestFighter',
                automation: { passives: passiveList },
            },
        };
    }

    function targetEffectsCalls() {
        return setRuntimeValue.mock.calls.filter(
            (call) => call[1] === 'targetEffects'
        );
    }

    beforeEach(() => {
        vi.clearAllMocks();
        setRuntimeValue.mockReturnValue(Promise.resolve());
        getRuntimeValue.mockReturnValue(null);
    });

    function createFn() {
        return createLogAndShow(deps);
    }

    describe('next_attack_advantage on miss', () => {
        it('adds a targetEffect when the attack misses and a matching passive exists', async () => {
            const missPassive = {
                type: 'auto_effect',
                name: 'Studied Attacks',
                trigger: 'miss',
                effect: 'next_attack_advantage',
                duration: 'until_start_of_next_turn',
            };

            const fn = createFn();
            await fn('Longsword', 0, 'attack', makePassives([missPassive]));

            const calls = targetEffectsCalls();
            expect(calls.length).toBeGreaterThan(0);
            const effect = calls[0][2];
            expect(effect).toContainEqual(
                expect.objectContaining({
                    target: 'TestFighter',
                    source: 'Studied Attacks',
                    effect: 'next_attack_advantage',
                    vexTarget: 'Goblin',
                    duration: 'until_start_of_next_turn',
                })
            );
        });

        it('defaults duration to until_start_of_next_turn when not specified', async () => {
            const missPassive = {
                type: 'auto_effect',
                name: 'Studied Attacks',
                trigger: 'miss',
                effect: 'next_attack_advantage',
            };

            const fn = createFn();
            await fn('Longsword', 0, 'attack', makePassives([missPassive]));

            const calls = targetEffectsCalls();
            expect(calls.length).toBeGreaterThan(0);
            expect(calls[0][2]).toContainEqual(
                expect.objectContaining({
                    duration: 'until_start_of_next_turn',
                })
            );
        });

        it('does not add an effect when isAutoMiss is true', async () => {
            const missPassive = {
                type: 'auto_effect',
                name: 'Studied Attacks',
                trigger: 'miss',
                effect: 'next_attack_advantage',
            };

            const fn = createFn();
            await fn('Longsword', 0, 'attack', {
                ...makePassives([missPassive]),
                isAutoMiss: true,
            });

            expect(targetEffectsCalls().length).toBe(0);
        });

        it('does not add an effect when no passives exist', async () => {
            const fn = createFn();
            await fn('Longsword', 0, 'attack', {
                playerStats: { name: 'TestFighter' },
            });

            expect(targetEffectsCalls().length).toBe(0);
        });

        it('does not add an effect when passives array is empty', async () => {
            const fn = createFn();
            await fn('Longsword', 0, 'attack', makePassives([]));

            expect(targetEffectsCalls().length).toBe(0);
        });

        it('does not add an effect when passive trigger is "hit" instead of "miss"', async () => {
            const hitPassive = {
                type: 'auto_effect',
                name: 'Hit Effect',
                trigger: 'hit',
                effect: 'knock_prone',
            };

            const fn = createFn();
            await fn('Longsword', 0, 'attack', makePassives([hitPassive]));

            expect(targetEffectsCalls().length).toBe(0);
        });

        it('does not add an effect when passive effect is different from next_attack_advantage', async () => {
            const missPassive = {
                type: 'auto_effect',
                name: 'Wrong Effect',
                trigger: 'miss',
                effect: 'knock_prone',
            };

            const fn = createFn();
            await fn('Longsword', 0, 'attack', makePassives([missPassive]));

            expect(targetEffectsCalls().length).toBe(0);
        });

        it('adds effects for all matching passives when multiple match', async () => {
            const passives = [
                {
                    type: 'auto_effect',
                    name: 'Studied Attacks',
                    trigger: 'miss',
                    effect: 'next_attack_advantage',
                    duration: 'until_start_of_next_turn',
                },
                {
                    type: 'auto_effect',
                    name: 'Another Miss Effect',
                    trigger: 'miss',
                    effect: 'next_attack_advantage',
                    duration: '1_round',
                },
            ];

            const fn = createFn();
            await fn('Longsword', 0, 'attack', makePassives(passives));

            const calls = targetEffectsCalls();
            expect(calls.length).toBeGreaterThan(0);
            expect(calls[0][2].length).toBe(2);
        });

        it('preserves existing targetEffects when merging new ones', async () => {
            getRuntimeValue.mockImplementation((scope, key) => {
                if (scope === 'campaign' && key === 'targetEffects') {
                    return [{ target: 'Other', effect: 'old_effect' }];
                }
                return null;
            });

            const missPassive = {
                type: 'auto_effect',
                name: 'Studied Attacks',
                trigger: 'miss',
                effect: 'next_attack_advantage',
            };

            const fn = createFn();
            await fn('Longsword', 0, 'attack', makePassives([missPassive]));

            const calls = targetEffectsCalls();
            expect(calls.length).toBeGreaterThan(0);
            const effects = calls[0][2];
            expect(effects.length).toBe(2);
            expect(effects).toContainEqual(
                expect.objectContaining({ effect: 'old_effect' })
            );
            expect(effects).toContainEqual(
                expect.objectContaining({ effect: 'next_attack_advantage' })
            );
        });

        it('calls addEntry to record the ability use on miss', async () => {
            const missPassive = {
                type: 'auto_effect',
                name: 'Studied Attacks',
                trigger: 'miss',
                effect: 'next_attack_advantage',
            };

            const fn = createFn();
            await fn('Longsword', 0, 'attack', makePassives([missPassive]));

            expect(addEntryMock).toHaveBeenCalledWith(
                'test-campaign',
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestFighter',
                    abilityName: 'Studied Attacks',
                    description: expect.stringContaining('Studied Attacks'),
                    targetName: 'Goblin',
                })
            );
        });

        it('does not call addEntry when no matching passives exist', async () => {
            const fn = createFn();
            await fn('Longsword', 0, 'attack', makePassives([]));

            expect(addEntryMock).not.toHaveBeenCalled();
        });
    });
});
