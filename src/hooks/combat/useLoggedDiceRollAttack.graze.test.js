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

import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
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
        vi.useFakeTimers();
        vi.clearAllMocks();
        rollD20.mockReturnValue(15);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
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
        applyDamageToTarget.mockReturnValue({ finalDamage: 2, newHp: 8, damageReduced: 0 });
    });

    function createFn() {
        return createLogAndShow(deps);
    }

    describe('graze damage on miss', () => {
        it('applies graze damage when grazeDamage is true, attack misses, and grazeAbilityMod > 0', async () => {
            const fn = createFn();
            await fn('Longsword', 2, 'attack', {
                targetName: 'Goblin',
                grazeDamage: true,
                grazeAbilityMod: 3,
                damageType: 'slashing',
            });
            // Graze damage is applied via setTimeout, advance timers
            await vi.advanceTimersByTimeAsync(2500);
            expect(applyDamageToTarget).toHaveBeenCalled();
            const grazeLogs = deps.logEntry.mock.calls.filter(
                call => call[0].rollType === 'graze-damage'
            );
            expect(grazeLogs.length).toBeGreaterThan(0);
            expect(grazeLogs[0][0].note).toBe('Graze: ability modifier damage on miss');
        });

        it('does not apply graze damage when grazeAbilityMod is zero or negative', async () => {
            const fn = createFn();
            await fn('Longsword', 2, 'attack', {
                targetName: 'Goblin',
                grazeDamage: true,
                grazeAbilityMod: 0,
                damageType: 'slashing',
            });
            await vi.advanceTimersByTimeAsync(2500);
            const grazeLogs = deps.logEntry.mock.calls.filter(
                call => call[0].rollType === 'graze-damage'
            );
            expect(grazeLogs.length).toBe(0);
        });

        it('does not apply graze damage when hit is true', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', {
                targetName: 'Goblin',
                grazeDamage: true,
                grazeAbilityMod: 3,
                damageType: 'slashing',
            });
            await vi.advanceTimersByTimeAsync(2500);
            const grazeLogs = deps.logEntry.mock.calls.filter(
                call => call[0].rollType === 'graze-damage'
            );
            expect(grazeLogs.length).toBe(0);
        });

        it('does not apply graze damage when isAutoMiss is true', async () => {
            const fn = createFn();
            await fn('Longsword', 2, 'attack', {
                targetName: 'Goblin',
                grazeDamage: true,
                grazeAbilityMod: 3,
                damageType: 'slashing',
                isAutoMiss: true,
            });
            await vi.advanceTimersByTimeAsync(2500);
            const grazeLogs = deps.logEntry.mock.calls.filter(
                call => call[0].rollType === 'graze-damage'
            );
            expect(grazeLogs.length).toBe(0);
        });

        it('uses default damage type when damageType is not provided', async () => {
            const fn = createFn();
            await fn('Longsword', 2, 'attack', {
                targetName: 'Goblin',
                grazeDamage: true,
                grazeAbilityMod: 3,
            });
            await vi.advanceTimersByTimeAsync(2500);
            const grazeLogs = deps.logEntry.mock.calls.filter(
                call => call[0].rollType === 'graze-damage'
            );
            expect(grazeLogs.length).toBeGreaterThan(0);
            expect(grazeLogs[0][0].damageType).toBe('Slashing');
        });

        it('calls addEntry for graze damage', async () => {
            const { addEntry } = await import('../../services/ui/logService.js');
            addEntry.mockResolvedValue({});
            const fn = createFn();
            await fn('Longsword', 2, 'attack', {
                targetName: 'Goblin',
                grazeDamage: true,
                grazeAbilityMod: 3,
                damageType: 'slashing',
            });
            await vi.advanceTimersByTimeAsync(2500);
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Graze',
            }));
        });

        it('sets popupHtml with graze-damage type', async () => {
            const fn = createFn();
            await fn('Longsword', 2, 'attack', {
                targetName: 'Goblin',
                grazeDamage: true,
                grazeAbilityMod: 3,
                damageType: 'slashing',
            });
            await vi.advanceTimersByTimeAsync(2500);
            const grazePopups = deps.setPopupHtml.mock.calls.filter(
                call => call[0].type === 'graze-damage'
            );
            expect(grazePopups.length).toBeGreaterThan(0);
            expect(grazePopups[0][0].formula).toBe('3 [Graze]');
        });

        it('uses target hitPoints from runtimeValue for player targets', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });
            const chars = [{ name: 'Ally', computedStats: { armorClass: 20 } }];
            getRuntimeValue.mockImplementation((name, prop, _campaign) => {
                if (name === 'Ally' && prop === 'hitPoints') return 10;
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 2, newHp: 8, damageReduced: 0 });
            const fn = createLogAndShow({ ...deps, characters: chars });
            await fn('Longsword', 2, 'attack', {
                targetName: 'Ally',
                grazeDamage: true,
                grazeAbilityMod: 3,
                damageType: 'slashing',
            });
            await vi.advanceTimersByTimeAsync(2500);
            const grazePopups = deps.setPopupHtml.mock.calls.filter(
                call => call[0].type === 'graze-damage'
            );
            expect(grazePopups.length).toBeGreaterThan(0);
            expect(grazePopups[0][0].targetCurrentHp).toBe(8);
        });

        it('uses target.maxHp for non-player targets', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', type: 'npc', maxHp: 15, ac: 20 });
            applyDamageToTarget.mockReturnValue({ finalDamage: 2, newHp: 13, damageReduced: 0 });
            const fn = createFn();
            await fn('Longsword', 2, 'attack', {
                targetName: 'Goblin',
                grazeDamage: true,
                grazeAbilityMod: 3,
                damageType: 'slashing',
            });
            await vi.advanceTimersByTimeAsync(2500);
            const grazePopups = deps.setPopupHtml.mock.calls.filter(
                call => call[0].type === 'graze-damage'
            );
            expect(grazePopups.length).toBeGreaterThan(0);
            expect(grazePopups[0][0].targetMaxHp).toBe(15);
        });
    });
});
