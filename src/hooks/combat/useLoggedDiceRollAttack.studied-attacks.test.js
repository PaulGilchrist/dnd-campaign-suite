// @maintained-by-ai: 2026-10-14
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
    getBaitAndSwitchAcBonus: vi.fn(() => 0),
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
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

    // Mirrors the 2024 Psi Warrior Studied Attacks declaration in
    // public/data/2024/classes.json: auto_effect/miss/next_attack_advantage.
    const MISS_PASSIVE = {
        type: 'auto_effect',
        name: 'Studied Attacks',
        trigger: 'miss',
        effect: 'next_attack_advantage',
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

    describe('next_attack_advantage on miss', () => {
        it('grants a vex-channel targetEffect on miss, defaulting duration to until_start_of_next_turn', async () => {
            await createLogAndShow(deps)('Longsword', 0, 'attack', makePassives([MISS_PASSIVE]));

            const calls = targetEffectsCalls();
            expect(calls.length).toBe(1);
            expect(calls[0][1]).toBe('targetEffects');
            expect(calls[0][2]).toContainEqual({
                target: 'TestFighter',
                source: 'Studied Attacks',
                effect: 'next_attack_advantage',
                vexTarget: 'Goblin',
                duration: 'until_start_of_next_turn',
            });
        });

        it('does not add an effect when isAutoMiss is true', async () => {
            await createLogAndShow(deps)('Longsword', 0, 'attack', {
                ...makePassives([MISS_PASSIVE]),
                isAutoMiss: true,
            });

            expect(targetEffectsCalls().length).toBe(0);
        });

        it('does not add an effect for non-matching passive trigger or effect', async () => {
            const passives = [
                { type: 'auto_effect', name: 'Hit Effect', trigger: 'hit', effect: 'knock_prone' },
                { type: 'auto_effect', name: 'Wrong Effect', trigger: 'miss', effect: 'knock_prone' },
            ];

            await createLogAndShow(deps)('Longsword', 0, 'attack', makePassives(passives));

            expect(targetEffectsCalls().length).toBe(0);
            expect(addEntryMock).not.toHaveBeenCalled();
        });

        it('does not add an effect or log when there are no passives (missing automation or empty)', async () => {
            const fn = createLogAndShow(deps);

            await fn('Longsword', 0, 'attack', { playerStats: { name: 'TestFighter' } });
            await fn('Longsword', 0, 'attack', makePassives([]));

            expect(targetEffectsCalls().length).toBe(0);
            expect(addEntryMock).not.toHaveBeenCalled();
        });

        it('grants one effect per matching passive, preserving explicit durations', async () => {
            const passives = [
                MISS_PASSIVE,
                { ...MISS_PASSIVE, name: 'Another Miss Effect', duration: '1_round' },
            ];

            await createLogAndShow(deps)('Longsword', 0, 'attack', makePassives(passives));

            const calls = targetEffectsCalls();
            expect(calls.length).toBe(1);
            expect(calls[0][2]).toContainEqual(
                expect.objectContaining({ source: 'Studied Attacks', duration: 'until_start_of_next_turn' })
            );
            expect(calls[0][2]).toContainEqual(
                expect.objectContaining({ source: 'Another Miss Effect', duration: '1_round' })
            );
        });

        it('preserves existing targetEffects when merging new ones', async () => {
            getRuntimeValue.mockImplementation((scope, key) => {
                if (scope === 'campaign' && key === 'targetEffects') {
                    return [{ target: 'Other', effect: 'old_effect' }];
                }
                return null;
            });

            await createLogAndShow(deps)('Longsword', 0, 'attack', makePassives([MISS_PASSIVE]));

            const calls = targetEffectsCalls();
            expect(calls.length).toBe(1);
            expect(calls[0][2]).toContainEqual(expect.objectContaining({ effect: 'old_effect' }));
            expect(calls[0][2]).toContainEqual(expect.objectContaining({ effect: 'next_attack_advantage' }));
        });

        it('logs an ability_use entry per granted effect on miss', async () => {
            await createLogAndShow(deps)('Longsword', 0, 'attack', makePassives([MISS_PASSIVE]));

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
    });
});
