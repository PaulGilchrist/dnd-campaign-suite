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
        getName: vi.fn((n) => n || 'Unknown'),
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
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 5, newHp: 5 })),
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
    collectWeaponMastery: vi.fn(),
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

vi.mock('../../services/combat/automation/automationPassives.js', () => ({
    isResilientSphereActive: vi.fn(),
}));

import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { isResilientSphereActive } from '../../services/combat/automation/automationPassives.js';
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../services/rules/spells/postCastRiderService.js';
import {
    hasPotentCantrip,
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
    applyMinDamageAdjustment,
} from './loggedDiceRollUtils.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';
import {
    isUnbreakableMajestyActive,
    hasAttackerTriggeredMajesty,
} from '../../services/combat/auras/unbreakableMajesty.js';

describe('createLogAndShow - Potent Cantrip & Soulknife', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        autoDamageSourceRef: { current: null },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 15 });
        isResilientSphereActive.mockReturnValue(false);
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 15 }] });
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getRuntimeValue.mockReturnValue(null);
        getShieldAcBonus.mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReturnValue(0);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        utils.getName.mockImplementation((n) => n);
        hasIgnoreResistance.mockReturnValue(false);
        rollD20.mockReturnValue(15);
    });

    function createFn() {
        return createLogAndShow(deps);
    }

    function findCantripMissHalfDamageLogs() {
        return deps.logEntry.mock.calls.filter(
            (call) => call[0].rollType === 'cantrip-miss-half-damage'
        );
    }

    function findSaveDamagePopups() {
        return deps.setPopupHtml.mock.calls.filter(
            (call) => call[0].type === 'save-damage'
        );
    }

    function findLastAttackRollSetCalls() {
        return setRuntimeValue.mock.calls.filter(
            (call) => call[1] === 'lastAttackRoll'
        );
    }

    describe('potent cantrip miss-half-damage', () => {
        it('does not apply potent cantrip when the player lacks the passive', async () => {
            hasPotentCantrip.mockReturnValue(false);
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                damageType: 'fire',
                saveDc: 13,
                saveType: 'DEX',
                playerStats: { automation: { passives: [] } },
            });
            expect(findCantripMissHalfDamageLogs()).toHaveLength(0);
            expect(findSaveDamagePopups()).toHaveLength(0);
        });

        it('does not apply potent cantrip when there is no damage formula', async () => {
            hasPotentCantrip.mockReturnValue(true);
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                damageType: 'fire',
                saveDc: 13,
                saveType: 'DEX',
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            expect(findCantripMissHalfDamageLogs()).toHaveLength(0);
        });

        it('does not apply potent cantrip when the attack hits', async () => {
            hasPotentCantrip.mockReturnValue(true);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                damageType: 'fire',
                saveDc: 13,
                saveType: 'DEX',
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            expect(findCantripMissHalfDamageLogs()).toHaveLength(0);
        });

        it('does not apply potent cantrip on auto miss when no saveDc is provided', async () => {
            hasPotentCantrip.mockReturnValue(true);
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                damageType: 'fire',
                isAutoMiss: true,
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            expect(findCantripMissHalfDamageLogs()).toHaveLength(0);
        });

        it('rolls half damage and logs cantrip-miss-half-damage when potent cantrip misses with stored damage result', async () => {
            hasPotentCantrip.mockReturnValue(true);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            const storedResult = { total: 10, rolls: [5, 5], modifier: 0 };
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                autoDamageRollResult: storedResult,
                damageType: 'fire',
                saveDc: 13,
                saveType: 'DEX',
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            const missLogs = findCantripMissHalfDamageLogs();
            expect(missLogs).toHaveLength(1);
            expect(missLogs[0][0]).toMatchObject({
                rollType: 'cantrip-miss-half-damage',
                isPotentCantrip: true,
                targetName: 'Goblin',
                damageType: 'fire',
            });
            expect(findSaveDamagePopups()).toHaveLength(1);
            expect(findSaveDamagePopups()[0][0]).toMatchObject({
                type: 'save-damage',
                isPotentCantrip: true,
                targetName: 'Goblin',
            });
        });

        it('rolls half damage when potent cantrip misses and rolls fresh (no stored result)', async () => {
            hasPotentCantrip.mockReturnValue(true);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            rollExpression.mockReturnValue({ total: 10, rolls: [4, 6], modifier: 0 });
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                damageType: 'fire',
                saveDc: 13,
                saveType: 'DEX',
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            const missLogs = findCantripMissHalfDamageLogs();
            expect(missLogs).toHaveLength(1);
            expect(missLogs[0][0]).toMatchObject({
                rollType: 'cantrip-miss-half-damage',
                isPotentCantrip: true,
            });
            expect(rollExpression).toHaveBeenCalledWith('1d10');
        });

        it('applies half damage on auto miss when saveDc is provided', async () => {
            hasPotentCantrip.mockReturnValue(true);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                damageType: 'fire',
                isAutoMiss: true,
                saveDc: 13,
                saveType: 'DEX',
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            const missLogs = findCantripMissHalfDamageLogs();
            expect(missLogs).toHaveLength(1);
            expect(missLogs[0][0].isPotentCantrip).toBe(true);
        });

        it('applies Empowered Evocation to the half-damage formula for evocation cantrips on miss', async () => {
            hasPotentCantrip.mockReturnValue(true);
            getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
            getEmpoweredEvocationIntModifier.mockReturnValue(2);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                autoDamageSchool: 'Evocation',
                damageType: 'fire',
                isAutoMiss: true,
                saveDc: 13,
                saveType: 'DEX',
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            const missLogs = findCantripMissHalfDamageLogs();
            expect(missLogs).toHaveLength(1);
            expect(missLogs[0][0].formula).toContain('Empowered Evocation');
            const popups = findSaveDamagePopups();
            expect(popups).toHaveLength(1);
            expect(popups[0][0].formula).toContain('Empowered Evocation');
        });

        it('does not apply Empowered Evocation for non-evocation schools', async () => {
            hasPotentCantrip.mockReturnValue(true);
            getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
            getEmpoweredEvocationIntModifier.mockReturnValue(2);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            const fn = createFn();
            await fn('Ice Knife', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                autoDamageSchool: 'Ice',
                damageType: 'cold',
                isAutoMiss: true,
                saveDc: 13,
                saveType: 'DEX',
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            const missLogs = findCantripMissHalfDamageLogs();
            expect(missLogs).toHaveLength(1);
            expect(missLogs[0][0].formula).toBe('1d10');
        });

        it('does not apply Empowered Evocation when the int modifier is zero', async () => {
            hasPotentCantrip.mockReturnValue(true);
            getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
            getEmpoweredEvocationIntModifier.mockReturnValue(0);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                autoDamageSchool: 'Evocation',
                damageType: 'fire',
                isAutoMiss: true,
                saveDc: 13,
                saveType: 'DEX',
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            const missLogs = findCantripMissHalfDamageLogs();
            expect(missLogs).toHaveLength(1);
            expect(missLogs[0][0].formula).toBe('1d10');
        });
    });

    describe('soulknife psychic blades homing strikes', () => {
        function makeSoulknifePs(level) {
            return {
                class: { name: 'Rogue', major: { name: 'Soulknife' } },
                level,
                class_levels: level >= 9 ? [{ level, energy: { energy_die: 6 } }] : [],
            };
        }

        it('applies homing strikes bonus when psychic blade misses and psionic energy is available', async () => {
            const ps = {
                ...makeSoulknifePs(9),
                _trackedResources: { psionicEnergy: { max: 6 } },
            };
            getRuntimeValue.mockImplementation((name, key) =>
                key === 'psionicEnergy' ? 6 : null
            );
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
            const spyRandom = vi.spyOn(Math, 'random').mockReturnValue(0.999);
            const fn = createFn();
            await fn('Psychic Blade', 3, 'attack', {
                targetName: 'Goblin',
                isPsychicBlade: true,
                playerStats: ps,
            });
            spyRandom.mockRestore();
            const lastAttackCalls = findLastAttackRollSetCalls();
            const homingCalls = lastAttackCalls.filter(
                (call) => call[2]?.homingStrikesBonus
            );
            expect(homingCalls).toHaveLength(1);
            expect(homingCalls[0][2].hit).toBe(true);
            expect(homingCalls[0][2].isCrit).toBe(false);
        });

        it('does not apply homing strikes when isAutoMiss is true', async () => {
            const ps = makeSoulknifePs(9);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 21 });
            const fn = createFn();
            await fn('Psychic Blade', 3, 'attack', {
                targetName: 'Goblin',
                isPsychicBlade: true,
                playerStats: ps,
                isAutoMiss: true,
            });
            const lastAttackCalls = findLastAttackRollSetCalls();
            const homingCalls = lastAttackCalls.filter(
                (call) => call[2]?.homingStrikesBonus
            );
            expect(homingCalls).toHaveLength(0);
        });

        it('does not apply homing strikes when not level 9+', async () => {
            const ps = makeSoulknifePs(5);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 21 });
            const fn = createFn();
            await fn('Psychic Blade', 3, 'attack', {
                targetName: 'Goblin',
                isPsychicBlade: true,
                playerStats: ps,
            });
            const lastAttackCalls = findLastAttackRollSetCalls();
            const homingCalls = lastAttackCalls.filter(
                (call) => call[2]?.homingStrikesBonus
            );
            expect(homingCalls).toHaveLength(0);
        });

        it('does not apply homing strikes when not a soulknife', async () => {
            const ps = {
                class: { name: 'Fighter', major: { name: 'Champion' } },
                level: 9,
            };
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 21 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', {
                targetName: 'Goblin',
                isPsychicBlade: true,
                playerStats: ps,
            });
            const lastAttackCalls = findLastAttackRollSetCalls();
            const homingCalls = lastAttackCalls.filter(
                (call) => call[2]?.homingStrikesBonus
            );
            expect(homingCalls).toHaveLength(0);
        });

        it('does not apply homing strikes when isPsychicBlade is false', async () => {
            const ps = makeSoulknifePs(9);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 21 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', {
                targetName: 'Goblin',
                isPsychicBlade: false,
                playerStats: ps,
            });
            const lastAttackCalls = findLastAttackRollSetCalls();
            const homingCalls = lastAttackCalls.filter(
                (call) => call[2]?.homingStrikesBonus
            );
            expect(homingCalls).toHaveLength(0);
        });

        it('does not apply homing strikes when the reroll still misses', async () => {
            const ps = {
                ...makeSoulknifePs(9),
                _trackedResources: { psionicEnergy: { max: 6 } },
            };
            getRuntimeValue.mockImplementation((name, key) =>
                key === 'psionicEnergy' ? 6 : null
            );
            // AC is very high so even with max psionic die bonus the attack still misses
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 35 });
            const spyRandom = vi.spyOn(Math, 'random').mockReturnValue(0.999);
            const fn = createFn();
            await fn('Psychic Blade', 3, 'attack', {
                targetName: 'Goblin',
                isPsychicBlade: true,
                playerStats: ps,
            });
            spyRandom.mockRestore();
            const lastAttackCalls = findLastAttackRollSetCalls();
            const homingCalls = lastAttackCalls.filter(
                (call) => call[2]?.homingStrikesBonus
            );
            expect(homingCalls).toHaveLength(0);
        });

        it('does not apply homing strikes when psionic energy is depleted', async () => {
            const ps = {
                ...makeSoulknifePs(9),
                _trackedResources: { psionicEnergy: { max: 6 } },
            };
            getRuntimeValue.mockImplementation((name, key) =>
                key === 'psionicEnergy' ? 0 : null
            );
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
            const spyRandom = vi.spyOn(Math, 'random').mockReturnValue(0.999);
            const fn = createFn();
            await fn('Psychic Blade', 3, 'attack', {
                targetName: 'Goblin',
                isPsychicBlade: true,
                playerStats: ps,
            });
            spyRandom.mockRestore();
            const lastAttackCalls = findLastAttackRollSetCalls();
            const homingCalls = lastAttackCalls.filter(
                (call) => call[2]?.homingStrikesBonus
            );
            expect(homingCalls).toHaveLength(0);
        });
    });
});
