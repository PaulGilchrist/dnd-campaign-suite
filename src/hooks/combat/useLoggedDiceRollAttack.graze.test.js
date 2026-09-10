// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
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
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getRuntimeValue.mockReturnValue(null);
        getShieldAcBonus.mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReturnValue(0);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        utils.getName.mockImplementation((n) => n);
        hasIgnoreResistance.mockReturnValue(false);
        applyDamageToTarget.mockReturnValue({ finalDamage: 2, newHp: 8, damageReduced: 0 });
    });

    function createFn() {
        return createLogAndShow(deps);
    }

    describe('graze damage on miss', () => {
        it('applies graze damage when attack misses, grazeDamage is true, and grazeAbilityMod > 0', async () => {
            const fn = createFn();
            await fn('Longsword', 2, 'attack', {
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
                expect.any(String),
                expect.any(Array),
                false,
                'TestFighter'
            );

            const grazeLogs = deps.logEntry.mock.calls.filter(
                (call) => call[0].rollType === 'graze-damage'
            );
            expect(grazeLogs).toHaveLength(1);
            expect(grazeLogs[0][0]).toEqual(
                expect.objectContaining({
                    rollType: 'graze-damage',
                    note: 'Graze: ability modifier damage on miss',
                    damageType: 'slashing',
                    total: 3,
                    formula: '3 [Graze]',
                })
            );

            const grazePopups = deps.setPopupHtml.mock.calls.filter(
                (call) => call[0].type === 'graze-damage'
            );
            expect(grazePopups).toHaveLength(1);
            expect(grazePopups[0][0]).toEqual(
                expect.objectContaining({
                    type: 'graze-damage',
                    formula: '3 [Graze]',
                    damageType: 'slashing',
                    targetName: 'Goblin',
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

        it('uses default damage type when damageType is not provided', async () => {
            const fn = createFn();
            await fn('Longsword', 2, 'attack', {
                targetName: 'Goblin',
                grazeDamage: true,
                grazeAbilityMod: 3,
            });

            const grazeLogs = deps.logEntry.mock.calls.filter(
                (call) => call[0].rollType === 'graze-damage'
            );
            expect(grazeLogs).toHaveLength(1);
            expect(grazeLogs[0][0].damageType).toBe('Slashing');

            const grazePopups = deps.setPopupHtml.mock.calls.filter(
                (call) => call[0].type === 'graze-damage'
            );
            expect(grazePopups).toHaveLength(1);
            expect(grazePopups[0][0].damageType).toBe('Slashing');
        });

        it('skips graze when grazeAbilityMod is zero', async () => {
            const fn = createFn();
            await fn('Longsword', 2, 'attack', {
                targetName: 'Goblin',
                grazeDamage: true,
                grazeAbilityMod: 0,
                damageType: 'slashing',
            });

            expect(applyDamageToTarget).not.toHaveBeenCalled();
            const grazeLogs = deps.logEntry.mock.calls.filter(
                (call) => call[0].rollType === 'graze-damage'
            );
            expect(grazeLogs).toHaveLength(0);
        });

        it('skips graze when grazeAbilityMod is negative', async () => {
            const fn = createFn();
            await fn('Longsword', 2, 'attack', {
                targetName: 'Goblin',
                grazeDamage: true,
                grazeAbilityMod: -2,
                damageType: 'slashing',
            });

            expect(applyDamageToTarget).not.toHaveBeenCalled();
            const grazeLogs = deps.logEntry.mock.calls.filter(
                (call) => call[0].rollType === 'graze-damage'
            );
            expect(grazeLogs).toHaveLength(0);
        });

        it('skips graze when attack hits', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', {
                targetName: 'Goblin',
                grazeDamage: true,
                grazeAbilityMod: 3,
                damageType: 'slashing',
            });

            expect(applyDamageToTarget).not.toHaveBeenCalled();
            const grazeLogs = deps.logEntry.mock.calls.filter(
                (call) => call[0].rollType === 'graze-damage'
            );
            expect(grazeLogs).toHaveLength(0);
        });
    });
});
