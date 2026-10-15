// @maintained-by-ai: 2026-10-14
// Owns the graze-damage consumption lane of createLogAndShow: the REAL
// attackPostProcessing.js processGrazeDamage path (ability-mod damage applied
// on a genuine miss, graze log + popup content, default 'Slashing' type,
// non-positive-mod and hit skips). The veer-homing-graze sibling mocks
// processAttackAfterResult and only checks the seam wiring; the graze
// context BUILD (grazeDamage/grazeAbilityMod computation from mastery
// passives) is owned by contextBuilder-sync and MonsterCardModal suites —
// no pure-math coverage duplicated here.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n),
        guid: vi.fn(() => 'test-guid-1234'),
    },
    DEBUG_FORCE_CRIT: false,
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
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 2, newHp: 8, damageReduced: 0 })),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn().mockResolvedValue({ creatures: [] }),
    getCurrentCombatRound: () => 1,
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

import { rollD20 } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
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

describe('createLogAndShow - Graze Damage', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        autoDamageSourceRef: { current: null },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        rollD20.mockReturnValue(15);
        // d20 15 + bonus 2 = 17 vs AC 20 → clean miss (no auto-miss)
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getRuntimeValue.mockReturnValue(null);
        getShieldAcBonus.mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReturnValue(0);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        utils.getName.mockImplementation((n) => n);
        applyDamageToTarget.mockReturnValue({ finalDamage: 2, newHp: 8, damageReduced: 0 });
    });

    const grazeLogs = () => deps.logEntry.mock.calls.filter((c) => c[0].rollType === 'graze-damage');
    const grazePopups = () => deps.setPopupHtml.mock.calls.filter((c) => c[0].type === 'graze-damage');

    it('applies ability-mod damage, logs, and pops a graze card on a miss with grazeAbilityMod > 0', async () => {
        await createLogAndShow(deps)('Longsword', 2, 'attack', {
            targetName: 'Goblin',
            grazeDamage: true,
            grazeAbilityMod: 3,
            damageType: 'slashing',
        });

        expect(applyDamageToTarget).toHaveBeenCalledWith(
            expect.any(Object),
            'Goblin',
            3,
            ['slashing'],
            { campaignName: 'test-campaign', characters: deps.characters, ignoreResistance: false, attackerName: 'TestFighter' }
        );

        expect(grazeLogs()).toHaveLength(1);
        expect(grazeLogs()[0][0]).toEqual(
            expect.objectContaining({
                type: 'roll',
                characterName: 'TestFighter',
                rollType: 'graze-damage',
                name: 'Longsword',
                note: 'Graze: ability modifier damage on miss',
                damageType: 'slashing',
                targetName: 'Goblin',
                total: 3,
                rolls: [3],
                formula: '3 [Graze]',
                finalDamage: 2,
            })
        );

        expect(grazePopups()).toHaveLength(1);
        expect(grazePopups()[0][0]).toEqual(
            expect.objectContaining({
                type: 'graze-damage',
                name: 'Longsword (Graze)',
                formula: '3 [Graze]',
                rolls: [3],
                total: 3,
                damageType: 'slashing',
                targetName: 'Goblin',
                targetCurrentHp: 8,
                damageApplied: true,
                finalDamage: 2,
                damageReduced: 0,
            })
        );

        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Graze',
            })
        );
    });

    it('defaults graze damage type to Slashing when not provided', async () => {
        await createLogAndShow(deps)('Longsword', 2, 'attack', {
            targetName: 'Goblin',
            grazeDamage: true,
            grazeAbilityMod: 3,
        });

        expect(applyDamageToTarget).toHaveBeenCalledWith(
            expect.any(Object),
            'Goblin',
            3,
            ['Slashing'],
            expect.any(Object)
        );
        expect(grazeLogs()[0][0].damageType).toBe('Slashing');
        expect(grazePopups()[0][0].damageType).toBe('Slashing');
    });

    it('skips graze entirely when grazeAbilityMod is zero or negative', async () => {
        const fn = createLogAndShow(deps);
        for (const grazeAbilityMod of [0, -2]) {
            vi.clearAllMocks();
            await fn('Longsword', 2, 'attack', {
                targetName: 'Goblin',
                grazeDamage: true,
                grazeAbilityMod,
                damageType: 'slashing',
            });

            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(grazeLogs()).toHaveLength(0);
            expect(grazePopups()).toHaveLength(0);
        }
    });

    it('skips graze when the attack hits', async () => {
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });

        await createLogAndShow(deps)('Longsword', 5, 'attack', {
            targetName: 'Goblin',
            grazeDamage: true,
            grazeAbilityMod: 3,
            damageType: 'slashing',
        });

        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(grazeLogs()).toHaveLength(0);
        expect(grazePopups()).toHaveLength(0);
    });
});
