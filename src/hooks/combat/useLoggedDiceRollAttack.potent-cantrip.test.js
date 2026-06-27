// @improved-by-ai
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

import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
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
        rollD20.mockReturnValue(15);
        rollExpression.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 15 });
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 15 }] });
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

    describe('potent cantrip miss-half-damage', () => {
        it('logs cantrip-miss-half-damage when potent cantrip misses with storedDamageResult', async () => {
            hasPotentCantrip.mockReturnValue(true);
            applyMinDamageAdjustment.mockImplementation((d) => d);
            loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 15 }] });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                autoDamageRollResult: { total: 10, rolls: [5, 5], modifier: 0 },
                damageType: 'fire',
                saveDc: 13,
                saveType: 'DEX',
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            const missLogs = deps.logEntry.mock.calls.filter(
                call => call[0].rollType === 'cantrip-miss-half-damage'
            );
            expect(missLogs.length).toBeGreaterThan(0);
            expect(missLogs[0][0].isPotentCantrip).toBe(true);
        });

        it('logs cantrip-miss-half-damage when no storedDamageResult (rolls fresh)', async () => {
            hasPotentCantrip.mockReturnValue(true);
            applyMinDamageAdjustment.mockImplementation((d) => d);
            loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 15 }] });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                damageType: 'fire',
                saveDc: 13,
                saveType: 'DEX',
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            const missLogs = deps.logEntry.mock.calls.filter(
                call => call[0].rollType === 'cantrip-miss-half-damage'
            );
            expect(missLogs.length).toBeGreaterThan(0);
        });

        it('does not apply half damage when isAutoMiss and no saveDc', async () => {
            hasPotentCantrip.mockReturnValue(true);
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                damageType: 'fire',
                isAutoMiss: true,
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            expect(rollExpression).not.toHaveBeenCalled();
            const missLogs = deps.logEntry.mock.calls.filter(
                call => call[0].rollType === 'cantrip-miss-half-damage'
            );
            expect(missLogs.length).toBe(0);
        });

        it('applies half damage when isAutoMiss and saveDc is provided', async () => {
            hasPotentCantrip.mockReturnValue(true);
            applyMinDamageAdjustment.mockImplementation((d) => d);
            loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 15 }] });
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
            const missLogs = deps.logEntry.mock.calls.filter(
                call => call[0].rollType === 'cantrip-miss-half-damage'
            );
            expect(missLogs.length).toBeGreaterThan(0);
            expect(missLogs[0][0].isPotentCantrip).toBe(true);
        });

        it('applies half damage with Empowered Evocation when isAutoMiss and saveDc and isEvocation', async () => {
            hasPotentCantrip.mockReturnValue(true);
            getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
            getEmpoweredEvocationIntModifier.mockReturnValue(2);
            applyMinDamageAdjustment.mockImplementation((d) => d);
            loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 15 }] });
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
            const saveDamagePopups = deps.setPopupHtml.mock.calls.filter(
                call => call[0].type === 'save-damage'
            );
            expect(saveDamagePopups.length).toBeGreaterThan(0);
            expect(saveDamagePopups[0][0].formula).toContain('Empowered Evocation');
        });

        it('does not apply potent cantrip when hit is true', async () => {
            hasPotentCantrip.mockReturnValue(true);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                damageType: 'fire',
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('does not apply potent cantrip when no autoDamageFormula', async () => {
            hasPotentCantrip.mockReturnValue(true);
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                damageType: 'fire',
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('does not apply potent cantrip when playerStats has no potent_cantrip passive', async () => {
            hasPotentCantrip.mockReturnValue(false);
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                damageType: 'fire',
                playerStats: { automation: { passives: [] } },
            });
            expect(rollExpression).not.toHaveBeenCalled();
        });
    });

    describe('soulknife psychic blades homing strikes', () => {
        it('does not apply homing strikes when isAutoMiss is true', async () => {
            const ps = {
                class: { name: 'Rogue', major: { name: 'Soulknife' } },
                level: 9,
                class_levels: [{ level: 9, energy: { energy_die: 6 } }],
            };
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 21 });
            const fn = createFn();
            await fn('Psychic Blade', 3, 'attack', {
                targetName: 'Goblin',
                isPsychicBlade: true,
                playerStats: ps,
                isAutoMiss: true,
            });
            const lastAttackCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'lastAttackRoll'
            );
            const homingCalls = lastAttackCalls.filter(call => call[2]?.homingStrikesBonus);
            expect(homingCalls.length).toBe(0);
        });

        it('does not apply homing strikes when not level 9+', async () => {
            const ps = {
                class: { name: 'Rogue', major: { name: 'Soulknife' } },
                level: 5,
                class_levels: [],
            };
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 21 });
            const fn = createFn();
            await fn('Psychic Blade', 3, 'attack', {
                targetName: 'Goblin',
                isPsychicBlade: true,
                playerStats: ps,
            });
            const lastAttackCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'lastAttackRoll'
            );
            const homingCalls = lastAttackCalls.filter(call => call[2]?.homingStrikesBonus);
            expect(homingCalls.length).toBe(0);
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
            const lastAttackCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'lastAttackRoll'
            );
            const homingCalls = lastAttackCalls.filter(call => call[2]?.homingStrikesBonus);
            expect(homingCalls.length).toBe(0);
        });

        it('does not apply homing strikes when isPsychicBlade is false', async () => {
            const ps = {
                class: { name: 'Rogue', major: { name: 'Soulknife' } },
                level: 9,
                class_levels: [{ level: 9, energy: { energy_die: 6 } }],
            };
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 21 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', {
                targetName: 'Goblin',
                isPsychicBlade: false,
                playerStats: ps,
            });
            const lastAttackCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'lastAttackRoll'
            );
            const homingCalls = lastAttackCalls.filter(call => call[2]?.homingStrikesBonus);
            expect(homingCalls.length).toBe(0);
        });

        it('applies homing strikes bonus when psychic blade misses and newHit is true', async () => {
            const ps = {
                class: { name: 'Rogue', major: { name: 'Soulknife' } },
                level: 9,
                class_levels: [{ level: 9, energy: { energy_die: 6 } }],
            };
            // d20=15, bonus=3 → total=18, ac=20 → miss, but psychic bonus of 6 makes it 24 → hit
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
            const spyRandom = vi.spyOn(Math, 'random').mockReturnValue(1); // max roll = 6
            const fn = createFn();
            await fn('Psychic Blade', 3, 'attack', {
                targetName: 'Goblin',
                isPsychicBlade: true,
                playerStats: ps,
            });
            spyRandom.mockRestore();
            const lastAttackCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'lastAttackRoll'
            );
            const homingCalls = lastAttackCalls.filter(call => call[2]?.homingStrikesBonus);
            // The psychic blades homing strikes adds a random bonus to the attack
            // If newHit becomes true, it sets lastAttackRoll with homingStrikesBonus
            expect(homingCalls.length).toBeGreaterThan(0);
            expect(homingCalls[0][2].hit).toBe(true);
            expect(homingCalls[0][2].isCrit).toBe(false);
        });
    });
});
