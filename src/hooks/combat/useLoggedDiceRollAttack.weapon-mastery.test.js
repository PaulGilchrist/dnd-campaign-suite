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
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 3, newHp: 7 })),
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

vi.mock('../../services/automation/handlers/combat/weaponMasteryHandler.js', () => ({
    applyMasteryEffect: vi.fn(),
    MASTERY_EFFECTS: {
        Push: { label: 'Push', effect: 'push', value: 10 },
        Vex: { label: 'Vex', effect: 'next_attack_advantage' },
        Sap: { label: 'Sap', effect: 'disadvantage_next_attack' },
        Slow: { label: 'Slow', effect: 'speed_reduction' },
        Graze: { label: 'Graze', effect: 'graze' },
        Cleave: { label: 'Cleave', effect: 'cleave', oncePerTurn: true },
        Nick: { label: 'Nick', effect: 'nick', oncePerTurn: true },
    },
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
}));

import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance, collectWeaponMastery } from '../../services/combat/automation/automationService.js';
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

describe('createLogAndShow - Weapon Mastery', () => {
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
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12 }] });
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getRuntimeValue.mockReturnValue(null);
        getShieldAcBonus.mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReturnValue(0);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        utils.getName.mockImplementation((n) => n);
        hasIgnoreResistance.mockReturnValue(false);
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Push', extraMasteries: ['Vex'] });
    });

    function createFn() {
        return createLogAndShow(deps);
    }

    describe('weapon mastery not applied during attack roll', () => {
        it('does not call collectWeaponMastery during attack roll', async () => {
            const fn = createFn();
            await fn('Longsword', 5, 'attack', {
                targetName: 'Goblin',
                weaponType: 'melee',
                attackerName: 'TestFighter',
                weaponName: 'Longsword',
                playerStats: { name: 'TestFighter' },
            });
            expect(collectWeaponMastery).not.toHaveBeenCalled();
        });

        it('does not call applyMasteryEffect during attack roll', async () => {
            const { applyMasteryEffect } = await import('../../services/automation/handlers/combat/weaponMasteryHandler.js');
            const fn = createFn();
            await fn('Longsword', 5, 'attack', {
                targetName: 'Goblin',
                weaponType: 'melee',
                attackerName: 'TestFighter',
                weaponName: 'Longsword',
                playerStats: { name: 'TestFighter' },
            });
            expect(applyMasteryEffect).not.toHaveBeenCalled();
        });

        it('still rolls attack for ranged weapons without mastery check', async () => {
            const fn = createFn();
            await fn('Longbow', 5, 'attack', {
                targetName: 'Goblin',
                weaponType: 'ranged',
                attackerName: 'TestFighter',
                weaponName: 'Longbow',
                playerStats: { name: 'TestFighter' },
            });
            expect(collectWeaponMastery).not.toHaveBeenCalled();
        });
    });
});
