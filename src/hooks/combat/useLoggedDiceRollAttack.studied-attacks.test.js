// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
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

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
    clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
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

vi.mock('./loggedDiceRollUtils.js', () => ({
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(),
    getShieldOfFaithAcBonus: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { rollD20 } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import {
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
    applyMinDamageAdjustment,
} from './loggedDiceRollUtils.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';
import {
    isUnbreakableMajestyActive,
    hasAttackerTriggeredMajesty,
} from '../../services/combat/auras/unbreakableMajesty.js';

describe('createLogAndShow - auto_effect miss trigger (Studied Attacks)', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        autoDamageSourceRef: { current: null },
    };

    const studiedAttackPassives = [
        {
            type: 'auto_effect',
            name: 'Studied Attacks',
            trigger: 'miss',
            effect: 'next_attack_advantage',
            duration: 'until_start_of_next_turn',
        },
    ];

    const baseContext = {
        targetName: 'Goblin',
        playerStats: {
            name: 'TestFighter',
            automation: {
                passives: studiedAttackPassives,
            },
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        rollD20.mockReturnValue(15);
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 20 }] });
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getRuntimeValue.mockReturnValue(null);
        getShieldAcBonus.mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReturnValue(0);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        utils.getName.mockImplementation((n) => n);
        hasIgnoreResistance.mockReturnValue(false);
    });

    function createFn() {
        return createLogAndShow(deps);
    }

    function isTargetEffectsCall(call) {
        return call[1] === 'targetEffects';
    }

    describe('auto_effect with trigger miss and effect next_attack_advantage', () => {
        it('applies next_attack_advantage effect when attack misses and feature has miss trigger', async () => {
            const fn = createFn();
            await fn('Longsword', 0, 'attack', baseContext);

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(isTargetEffectsCall);
            expect(targetEffectsCalls.length).toBe(1);
            expect(targetEffectsCalls[0]).toEqual([
                'test-campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'TestFighter',
                        source: 'Studied Attacks',
                        effect: 'next_attack_advantage',
                        vexTarget: 'Goblin',
                        duration: 'until_start_of_next_turn',
                    }),
                ]),
                'test-campaign',
            ]);
        });

        it('uses default duration when not specified on the effect', async () => {
            const fn = createFn();
            await fn('Longsword', 0, 'attack', {
                ...baseContext,
                playerStats: {
                    ...baseContext.playerStats,
                    automation: {
                        passives: [
                            {
                                type: 'auto_effect',
                                name: 'Studied Attacks',
                                trigger: 'miss',
                                effect: 'next_attack_advantage',
                            },
                        ],
                    },
                },
            });

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(isTargetEffectsCall);
            expect(targetEffectsCalls.length).toBe(1);
            expect(targetEffectsCalls[0][2]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        duration: 'until_start_of_next_turn',
                    }),
                ])
            );
        });

        it('does not apply effect when attack hits', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', baseContext);

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(isTargetEffectsCall);
            expect(targetEffectsCalls.length).toBe(0);
        });

        it('does not apply effect when isAutoMiss is true', async () => {
            const fn = createFn();
            await fn('Longsword', 0, 'attack', {
                ...baseContext,
                isAutoMiss: true,
            });

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(isTargetEffectsCall);
            expect(targetEffectsCalls.length).toBe(0);
        });

        it('does not apply effect when no target', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            const fn = createFn();
            await fn('Longsword', 0, 'attack', {
                ...baseContext,
                targetName: null,
            });

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(isTargetEffectsCall);
            expect(targetEffectsCalls.length).toBe(0);
        });

        it('does not apply effect when playerStats has no automation passives', async () => {
            const fn = createFn();
            await fn('Longsword', 0, 'attack', {
                ...baseContext,
                playerStats: {
                    name: 'TestFighter',
                },
            });

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(isTargetEffectsCall);
            expect(targetEffectsCalls.length).toBe(0);
        });

        it('does not apply effect for non-miss triggers', async () => {
            const fn = createFn();
            await fn('Longsword', 0, 'attack', {
                ...baseContext,
                playerStats: {
                    ...baseContext.playerStats,
                    automation: {
                        passives: [
                            {
                                type: 'auto_effect',
                                name: 'Some Other Effect',
                                trigger: 'hit',
                                effect: 'knock_prone',
                            },
                        ],
                    },
                },
            });

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(isTargetEffectsCall);
            expect(targetEffectsCalls.length).toBe(0);
        });

        it('does not apply effect for non-next_attack_advantage effects on miss', async () => {
            const fn = createFn();
            await fn('Longsword', 0, 'attack', {
                ...baseContext,
                playerStats: {
                    ...baseContext.playerStats,
                    automation: {
                        passives: [
                            {
                                type: 'auto_effect',
                                name: 'Some Other Effect',
                                trigger: 'miss',
                                effect: 'knock_prone',
                            },
                        ],
                    },
                },
            });

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(isTargetEffectsCall);
            expect(targetEffectsCalls.length).toBe(0);
        });
    });
});
